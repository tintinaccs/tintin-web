import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyIdempotentStagingChunk,
  activateStagingCatalog,
  buildCollectionMappingTable,
  buildMediaPlan,
  classifyMediaResponse,
  createCatalogLifecycle,
  createPhase2Plan,
  diffProductAgainstCatalog,
  mediaRetryDecision,
  prepareStagingCatalog,
  rollbackCatalog,
  validateMediaSourceUrl,
} from '../../js/core/store/shopify-phase2-pipeline.mjs';
import { detectCsvDelimiter, parseDelimitedRows, parseLocalizedNumber, parseOptionalStock } from '../../js/core/store/normalizacion-importacion.mjs';
import { groupShopifyRows } from '../../js/core/store/shopify-import-core.mjs';

const fixture = fs.readFileSync(new URL('../fixtures/shopify-phase2-fixture.csv', import.meta.url), 'utf8');
const rows = parseDelimitedRows(fixture, detectCsvDelimiter(fixture));
const headers = rows.shift().map(value => value.toLowerCase());
const objects = rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
const collections = [{ id: 'relojes', slug: 'relojes', name: 'Relojes' }];

test('fixture Shopify agrupa por Handle, variantes e imágenes sin duplicar stock', () => {
  const result = groupShopifyRows(objects, collections, { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });
  assert.equal(result.products.length, 4);
  const watch = result.products.find(item => item.product.sourceMetadata.handle === 'reloj-seguro');
  assert.equal(watch.product.stock, 3);
  assert.equal(watch.product.imagesExtra.length, 1);
  assert.equal(watch.product.variants.length, 1);
  const variants = result.products.find(item => item.product.sourceMetadata.handle === 'reloj-variantes');
  assert.equal(variants.product.stock, 3);
  assert.equal(variants.product.variants.length, 2);
  const deduped = result.products.find(item => item.product.sourceMetadata.handle === 'duplicado-media');
  assert.equal(deduped.product.imagesExtra.length, 0);
});

test('media admite 0, 1, 2 y N, deduplica y conserva orden', () => {
  assert.equal(buildMediaPlan({ importFingerprint: 'x', imageUrl: '', imagesExtra: [] }).length, 0);
  assert.equal(buildMediaPlan({ importFingerprint: 'x', imageUrl: 'https://cdn.shopify.com/a.webp', imagesExtra: [] }).length, 1);
  const plan = buildMediaPlan({ importFingerprint: 'x', imageUrl: 'https://cdn.shopify.com/a.webp', imagesExtra: ['https://cdn.shopify.com/b.webp', 'https://cdn.shopify.com/a.webp'] });
  assert.deepEqual(plan.map(item => item.position), [0, 1]);
  assert.equal(plan[0].featured, true);
});

test('media remoto valida host, MIME, tamaño, status y retries', () => {
  assert.equal(validateMediaSourceUrl('https://cdn.shopify.com/a.webp').ok, true);
  assert.equal(validateMediaSourceUrl('https://evil.example/a.webp').code, 'MEDIA_URL_NOT_ALLOWED');
  assert.equal(validateMediaSourceUrl('http://cdn.shopify.com/a.webp').code, 'MEDIA_URL_NOT_ALLOWED');
  assert.equal(classifyMediaResponse({ status: 200, contentType: 'image/webp', bytes: 100 }).state, 'VALIDATED');
  assert.equal(classifyMediaResponse({ status: 200, contentType: 'text/html', bytes: 100 }).code, 'MEDIA_MIME_UNSUPPORTED');
  assert.equal(classifyMediaResponse({ status: 404, contentType: 'image/webp', bytes: 100 }).retryable, false);
  assert.equal(classifyMediaResponse({ status: 503, contentType: 'image/webp', bytes: 100 }).retryable, true);
  assert.equal(mediaRetryDecision('MEDIA_HTTP_503', 1).retry, true);
  assert.equal(mediaRetryDecision('MEDIA_HTTP_503', 3).retry, false);
});

test('plan produce preview, diffs, mapping, warnings y bloqueo de production', () => {
  const grouped = groupShopifyRows(objects, collections, { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });
  const plan = createPhase2Plan({ records: grouped.products, collections, environment: 'TEST', chunkSize: 2 });
  assert.equal(plan.dryRun, true);
  assert.equal(plan.catalogMigration, 'not-executed');
  assert.equal(plan.summary.products, 4);
  assert.equal(plan.chunks, 2);
  assert.equal(plan.products.every(item => item.status === 'NEW'), true);
  assert.equal(plan.readyForDryRun, true);
  assert.equal(createPhase2Plan({ records: grouped.products, environment: 'PRODUCTION' }).readyForDryRun, false);
  assert.equal(buildCollectionMappingTable([{ product: { category: 'relojes' } }], collections)[0].status, 'MAPPED_EXISTING');
  assert.equal(buildCollectionMappingTable([{ product: { category: 'nueva' } }], collections)[0].status, 'CREATE_PROPOSED');
});

test('SKU conflictivo es blocking y diff distingue unchanged/changed', () => {
  const product = { name: 'A', price: 100, stock: 1, category: 'relojes', active: true, variants: [{ sku: 'SKU-1' }], importFingerprint: 'shopify:a', sourceMetadata: { handle: 'a' } };
  const same = diffProductAgainstCatalog(product, [{ id: 'a', ...product }]);
  assert.equal(same.status, 'UNCHANGED');
  assert.equal(diffProductAgainstCatalog({ ...product, price: 200 }, [{ id: 'a', ...product }]).status, 'CHANGED');
  const plan = createPhase2Plan({ records: [{ product }, { product: { ...product, importFingerprint: 'shopify:b', sourceMetadata: { handle: 'b' } } }] });
  assert.equal(plan.errors.some(error => error.code === 'DUPLICATE_CONFLICTING_SKU'), true);
  assert.equal(plan.readyForDryRun, false);
});

test('staging es idempotente, reanudable y no toca active; activation/rollback son reversibles', () => {
  const records = [{ product: { name: 'A', importFingerprint: 'shopify:a' } }, { product: { name: 'B', importFingerprint: 'shopify:b' } }];
  const first = applyIdempotentStagingChunk(new Map(), records, { jobId: 'job', chunk: 0, processed: 0, total: 2 });
  const second = applyIdempotentStagingChunk(first.staging, records, first.checkpoint);
  assert.equal(first.staging.size, 2);
  assert.equal(second.staging.size, 2);
  assert.equal(second.checkpoint.processed, 4);
  let lifecycle = createCatalogLifecycle({ activeCatalogId: 'A' });
  lifecycle = prepareStagingCatalog(lifecycle, 'B');
  lifecycle = activateStagingCatalog(lifecycle);
  assert.equal(lifecycle.activeCatalogId, 'B');
  lifecycle = rollbackCatalog(lifecycle);
  assert.equal(lifecycle.activeCatalogId, 'A');
  assert.deepEqual(lifecycle.archived, ['B']);
  assert.throws(() => prepareStagingCatalog(lifecycle, 'A'), /distinta/i);
});
