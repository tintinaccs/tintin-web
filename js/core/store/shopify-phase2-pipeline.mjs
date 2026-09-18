/**
 * Shopify Phase 2: deterministic planning contracts.
 *
 * This module is deliberately side-effect free. It builds a preview/staging
 * plan and models activation/rollback; Firestore writes and Cloudinary copy
 * stay behind server-side guards in the API layer.
 */

import { buildImportFingerprint, normalizeImportKey, stableProductDocumentId } from './shopify-import-core.mjs';

export const PHASE2_JOB_STATES = Object.freeze([
  'CREATED', 'VALIDATING', 'READY_FOR_DRY_RUN', 'DRY_RUNNING', 'STAGING',
  'PAUSED', 'FAILED', 'READY_TO_ACTIVATE', 'ACTIVATING', 'ACTIVE',
  'ROLLED_BACK', 'CANCELLED',
]);

export const MEDIA_LIFECYCLE_STATES = Object.freeze([
  'PENDING', 'DOWNLOADING', 'VALIDATED', 'COPIED', 'DEDUPED', 'FAILED', 'SKIPPED',
]);

export const COLLECTION_MAPPING_STATES = Object.freeze([
  'MAPPED_EXISTING', 'CREATE_PROPOSED', 'IGNORED', 'AMBIGUOUS',
]);

export const PRODUCT_MATCH_STATES = Object.freeze([
  'NEW', 'MATCHED', 'CHANGED', 'UNCHANGED', 'CONFLICT',
]);

const ALLOWED_MEDIA_HOSTS = Object.freeze(['cdn.shopify.com', 'shopify.com', 'myshopify.com']);
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

function text(value) { return String(value == null ? '' : value); }

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizedSku(value) { return text(value).trim().toLocaleUpperCase('es'); }

export function validateMediaSourceUrl(value, { allowedHosts = ALLOWED_MEDIA_HOSTS } = {}) {
  const raw = text(value).trim();
  if (!raw) return { ok: false, code: 'MEDIA_URL_MISSING', url: '' };
  let parsed;
  try { parsed = new URL(raw); } catch { return { ok: false, code: 'MEDIA_URL_INVALID', url: raw }; }
  const host = parsed.hostname.toLocaleLowerCase('en');
  const allowed = allowedHosts.some(candidate => host === candidate || host.endsWith(`.${candidate}`));
  if (parsed.protocol !== 'https:' || !allowed) return { ok: false, code: 'MEDIA_URL_NOT_ALLOWED', url: raw, host };
  return { ok: true, url: parsed.href, host };
}

export function classifyMediaResponse({ status, contentType, contentLength, bytes } = {}) {
  const size = Number.isFinite(bytes) ? bytes : Number(contentLength);
  if (!Number.isInteger(Number(status)) || Number(status) < 200 || Number(status) >= 300) {
    return { ok: false, state: Number(status) >= 500 ? 'PENDING' : 'FAILED', code: `MEDIA_HTTP_${status || 'UNKNOWN'}`, retryable: Number(status) >= 500 || !status };
  }
  if (!/^image\/(?:avif|gif|jpeg|png|webp)$/i.test(text(contentType).split(';')[0].trim())) {
    return { ok: false, state: 'FAILED', code: 'MEDIA_MIME_UNSUPPORTED', retryable: false };
  }
  if (Number.isFinite(size) && size > MAX_MEDIA_BYTES) {
    return { ok: false, state: 'FAILED', code: 'MEDIA_TOO_LARGE', retryable: false };
  }
  return { ok: true, state: 'VALIDATED', code: 'MEDIA_VALID', retryable: false, bytes: size || null };
}

export function mediaRetryDecision(errorCode, attempt, maxAttempts = 3) {
  const retryable = /^(MEDIA_HTTP_5|MEDIA_TIMEOUT|MEDIA_NETWORK)/.test(text(errorCode));
  return { retry: retryable && Number(attempt) < maxAttempts, attempt: Number(attempt) || 0, maxAttempts };
}

export function buildMediaPlan(product, { maxAttempts = 3 } = {}) {
  const urls = unique([product?.imageUrl, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : [])]);
  return urls.map((sourceUrl, index) => ({
    mediaId: `media_${stableProductDocumentId(`${product?.importFingerprint || product?.sourceMetadata?.handle || 'product'}:${sourceUrl}`).slice(4)}`,
    sourceUrl,
    position: index,
    featured: index === 0,
    state: 'PENDING',
    attempts: 0,
    maxAttempts,
    lastError: '',
    canonicalUrl: '',
  }));
}

function productSignature(product) {
  return stableJson({
    name: product?.name || '', price: product?.price ?? null, priceBefore: product?.priceBefore ?? null,
    stock: product?.stock ?? null, active: product?.active !== false,
    variants: product?.variants || [], imageUrl: product?.imageUrl || '', imagesExtra: product?.imagesExtra || [],
    category: product?.category || '', tags: product?.tags || [],
  });
}

export function buildCollectionMappingTable(records, existingCollections = []) {
  const existing = new Map(existingCollections.map(item => [normalizeImportKey(item?.slug || item?.id || item?.name), item]));
  const incoming = unique((records || []).flatMap(record => {
    const product = record?.product || record;
    return [product?.category, ...(product?.collectionMappings || [])].map(normalizeImportKey);
  }));
  return incoming.map(source => {
    const ambiguous = (records || []).some(record => {
      const product = record?.product || record;
      return normalizeImportKey(product?.category) === source && (product?._ambiguousCollection || record?._ambiguousCollection);
    });
    if (ambiguous) return { source, target: '', status: 'AMBIGUOUS' };
    const match = existing.get(source);
    if (match) return { source, target: match.slug || match.id || source, status: 'MAPPED_EXISTING' };
    if (!source) return { source, target: '', status: 'IGNORED' };
    return { source, target: '', status: 'CREATE_PROPOSED' };
  });
}

export function detectSkuConflicts(products) {
  const owners = new Map();
  const conflicts = [];
  for (const product of products || []) for (const variant of product?.variants || []) {
    const sku = normalizedSku(variant?.sku);
    if (!sku) continue;
    const identity = product?.importFingerprint || product?.sourceMetadata?.handle || product?.name || '';
    if (owners.has(sku) && owners.get(sku) !== identity) conflicts.push({ sku, owners: [owners.get(sku), identity] });
    else owners.set(sku, identity);
  }
  return conflicts;
}

export function diffProductAgainstCatalog(product, existingProducts = []) {
  const fingerprint = product?.importFingerprint || buildImportFingerprint('shopify', product?.sourceMetadata?.handle || product?.name);
  const existing = existingProducts.find(item => item?.importFingerprint === fingerprint || (
    item?.sourceMetadata?.platform === 'shopify' && normalizeImportKey(item?.sourceMetadata?.handle) === normalizeImportKey(product?.sourceMetadata?.handle)
  ));
  if (!existing) return { status: 'NEW', fingerprint, productId: stableProductDocumentId(fingerprint), changes: [] };
  const changes = [];
  for (const field of ['name', 'price', 'priceBefore', 'stock', 'category', 'active', 'imageUrl', 'imagesExtra', 'variants']) {
    if (stableJson(existing[field]) !== stableJson(product[field])) changes.push(field);
  }
  return { status: changes.length ? 'CHANGED' : 'UNCHANGED', fingerprint, productId: existing.id || stableProductDocumentId(fingerprint), changes };
}

export function createPhase2Plan({ records = [], collections = [], existingProducts = [], environment = 'TEST', chunkSize = 50 } = {}) {
  const products = records.map(record => record?.product || record).filter(Boolean);
  const errors = records.flatMap(record => (record?.errors || []).map(message => ({ severity: 'BLOCKING_ERROR', message, source: record?.product?.sourceMetadata?.handle || '' })));
  const warnings = records.flatMap(record => (record?.warnings || []).map(message => ({ severity: 'WARNING', message, source: record?.product?.sourceMetadata?.handle || '' })));
  const skuConflicts = detectSkuConflicts(products);
  for (const conflict of skuConflicts) errors.push({ severity: 'BLOCKING_ERROR', code: 'DUPLICATE_CONFLICTING_SKU', ...conflict });
  const diffs = products.map(product => diffProductAgainstCatalog(product, existingProducts));
  const media = products.flatMap(product => buildMediaPlan(product));
  const mapping = buildCollectionMappingTable(records, collections);
  const blocking = errors.length > 0 || environment === 'PRODUCTION';
  return {
    environment, dryRun: true, catalogMigration: 'not-executed', products: diffs,
    media, collectionMapping: mapping, errors, warnings,
    chunks: Math.ceil(products.length / Math.max(1, Number(chunkSize) || 50)),
    summary: {
      products: products.length, variants: products.reduce((n, item) => n + (item.variants?.length || 0), 0),
      images: media.length, collections: mapping.length, errors: errors.length, warnings: warnings.length,
    },
    readyForDryRun: !blocking && products.length > 0,
    realMigrationGuard: 'EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED',
  };
}

export function createCheckpoint({ jobId, chunk = 0, processed = 0, total = 0, status = 'STAGING' } = {}) {
  return { jobId, chunk, processed, total, status, updatedAt: new Date().toISOString() };
}

export function applyIdempotentStagingChunk(staging, records, checkpoint = {}) {
  const next = new Map(staging instanceof Map ? staging : []);
  for (const record of records || []) {
    const product = record?.product || record;
    const fingerprint = product?.importFingerprint || buildImportFingerprint('shopify', product?.sourceMetadata?.handle || product?.name);
    if (!next.has(fingerprint)) next.set(fingerprint, { ...product, id: stableProductDocumentId(fingerprint), catalogState: 'STAGING' });
  }
  return { staging: next, checkpoint: createCheckpoint({ ...checkpoint, processed: (checkpoint.processed || 0) + (records?.length || 0) }) };
}

export function createCatalogLifecycle({ activeCatalogId = 'catalog-active' } = {}) {
  return { activeCatalogId, previousCatalogId: null, stagingCatalogId: null, state: 'ACTIVE', archived: [] };
}

export function prepareStagingCatalog(lifecycle, catalogId) {
  if (!catalogId || catalogId === lifecycle.activeCatalogId) throw new Error('El staging debe tener una identidad distinta del catálogo activo.');
  return { ...lifecycle, stagingCatalogId: catalogId, state: 'READY_TO_ACTIVATE' };
}

export function activateStagingCatalog(lifecycle) {
  if (lifecycle.state !== 'READY_TO_ACTIVATE' || !lifecycle.stagingCatalogId) throw new Error('El staging no está listo para activarse.');
  return { ...lifecycle, previousCatalogId: lifecycle.activeCatalogId, activeCatalogId: lifecycle.stagingCatalogId, stagingCatalogId: null, state: 'ACTIVE' };
}

export function rollbackCatalog(lifecycle) {
  if (!lifecycle.previousCatalogId) throw new Error('No existe un catálogo anterior para rollback.');
  const catalogToArchive = lifecycle.activeCatalogId;
  return { ...lifecycle, stagingCatalogId: catalogToArchive, activeCatalogId: lifecycle.previousCatalogId, previousCatalogId: null, state: 'ROLLED_BACK', archived: [...lifecycle.archived, catalogToArchive].filter(Boolean) };
}
