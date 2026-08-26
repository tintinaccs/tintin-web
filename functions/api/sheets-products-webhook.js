import { corsHeaders } from '../../cloudflare/seguridad-cloudinary.js';
import {
  encodeFirestoreFields,
  firestoreAdminCommit,
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_BODY_BYTES = 32 * 1024;
export const PRODUCTS_WEBHOOK_REVISION = 'products-canonical-v3';

export function classifySheetsWebhookAuth(provided, expected) {
  const providedValue = String(provided || '');
  const expectedValue = String(expected || '');
  if (!providedValue) return 'missing-header';
  if (!expectedValue) return 'server-secret-missing';
  return sameSecret(providedValue, expectedValue) ? 'authenticated' : 'secret-mismatch';
}

function webhookResponse(body, status, requestUrl, authState = 'authenticated') {
  const headers = corsHeaders('', requestUrl);
  headers['x-tintin-products-webhook'] = PRODUCTS_WEBHOOK_REVISION;
  headers['x-tintin-auth-state'] = authState;
  return new Response(JSON.stringify(body), { status, headers });
}

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalInteger(value, max = 1_000_000_000) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) throw new Error('Valor numerico invalido.');
  return number;
}

function stringList(value, maxItems, maxLength) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|,/);
  return [...new Set(source.map(item => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function variants(value) {
  if (!value) return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Variantes invalidas.');
  const output = {};
  Object.entries(parsed).slice(0, 20).forEach(([key, values]) => {
    const safeKey = text(key, 60);
    const safeValues = stringList(values, 50, 120);
    if (safeKey && safeValues.length) output[safeKey] = safeValues;
  });
  return Object.keys(output).length ? output : null;
}

function productId(value, allowCreate) {
  const id = text(value, 128);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('ID de producto invalido.');
  if (id) return id;
  if (!allowCreate) throw new Error('El producto existente necesita productId.');
  return crypto.randomUUID().replace(/-/g, '');
}

const PUBLIC_FIELDS = new Set([
  'name', 'category', 'price', 'stock', 'active', 'oferta', 'destacado',
  'priceBefore', 'badge', 'imageUrl', 'description', 'material', 'measurements',
  'colorFinish', 'care', 'waterResistance', 'warranty', 'sizeFit',
  'packageContents', 'imagesExtra', 'collection', 'tags', 'variants',
]);
const INVENTORY_FIELDS = new Set(['costUnit', 'purchased', 'stockMinimum', 'internalNotes']);

function selectedFields(value, id) {
  // Sólo un producto existente puede ser actualizado parcialmente. Para crear
  // una fila nueva se conserva la validación completa de nombre/categoría/precio.
  if (!id || !Array.isArray(value)) return null;
  return new Set(value.map(field => text(field, 60)).filter(field => PUBLIC_FIELDS.has(field) || INVENTORY_FIELDS.has(field)));
}

function has(fields, field) {
  return !fields || fields.has(field);
}

function addIf(target, fields, field, value) {
  if (has(fields, field)) target[field] = value;
}

export async function onRequestPost({ request, env }) {
  const authState = classifySheetsWebhookAuth(
    request.headers.get('X-Tintin-Sheets-Secret'),
    env.SHEETS_ENGAGEMENT_SECRET,
  );
  if (authState !== 'authenticated') {
    return webhookResponse({ ok: false, error: 'No autorizado' }, 401, request.url, authState);
  }

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud invalida.');
    const input = JSON.parse(raw);

    if (input.action === 'diagnose') {
      return webhookResponse({
        ok: true,
        authenticated: true,
        destructive: false,
        endpoint: '/api/sheets-products-webhook',
        revision: PRODUCTS_WEBHOOK_REVISION,
        hostname: new URL(request.url).hostname,
      }, 200, request.url);
    }

    const id = productId(input.productId, input.action === 'saveProduct');

    if (input.action === 'deleteProduct') {
      await firestoreAdminCommit(env, [
        { path: `products/${id}`, delete: true },
        { path: `productInventory/${id}`, delete: true },
      ]);
      return webhookResponse({ ok: true, productId: id, deleted: true }, 200, request.url);
    }
    if (input.action !== 'saveProduct') throw new Error('Accion no permitida.');

    const fields = selectedFields(input.changedFields, id);
    const name = text(input.name, 180);
    const category = text(input.category, 120);
    const price = optionalInteger(input.price);
    if ((!fields || fields.has('name')) && !name) throw new Error('El nombre es obligatorio.');
    if ((!fields || fields.has('category')) && !category) throw new Error('La categoria es obligatoria.');
    if ((!fields || fields.has('price')) && (price === null || price <= 0)) throw new Error('El precio debe ser mayor a cero.');

    const publicData = {};
    addIf(publicData, fields, 'name', name);
    addIf(publicData, fields, 'category', category);
    addIf(publicData, fields, 'price', price);
    addIf(publicData, fields, 'stock', optionalInteger(input.stock, 1_000_000));
    addIf(publicData, fields, 'active', input.active === true);
    addIf(publicData, fields, 'oferta', input.oferta === true);
    addIf(publicData, fields, 'destacado', input.destacado === true);
    addIf(publicData, fields, 'priceBefore', optionalInteger(input.priceBefore));
    addIf(publicData, fields, 'badge', text(input.badge, 60) || null);
    addIf(publicData, fields, 'imageUrl', text(input.imageUrl, 2000) || null);
    addIf(publicData, fields, 'description', text(input.description, 4000));
    addIf(publicData, fields, 'material', text(input.material, 240));
    addIf(publicData, fields, 'measurements', text(input.measurements, 240));
    addIf(publicData, fields, 'colorFinish', text(input.colorFinish, 240));
    addIf(publicData, fields, 'care', text(input.care, 500));
    addIf(publicData, fields, 'waterResistance', text(input.waterResistance, 240));
    addIf(publicData, fields, 'warranty', text(input.warranty, 240));
    addIf(publicData, fields, 'sizeFit', text(input.sizeFit, 240));
    addIf(publicData, fields, 'packageContents', text(input.packageContents, 500));
    addIf(publicData, fields, 'imagesExtra', stringList(input.imagesExtra, 12, 2000));
    addIf(publicData, fields, 'collection', text(input.collection, 240) || null);
    addIf(publicData, fields, 'tags', stringList(input.tags, 30, 60));
    addIf(publicData, fields, 'variants', variants(input.variants));
    if (Object.keys(publicData).length) publicData.updatedAt = new Date();

    const inventoryData = {};
    addIf(inventoryData, fields, 'costUnit', optionalInteger(input.costUnit));
    addIf(inventoryData, fields, 'purchased', optionalInteger(input.purchased, 1_000_000));
    addIf(inventoryData, fields, 'stockMinimum', optionalInteger(input.stockMinimum, 1_000_000));
    addIf(inventoryData, fields, 'internalNotes', text(input.internalNotes, 1000));
    if (Object.keys(inventoryData).length) inventoryData.updatedAt = new Date();

    // Un único commit evita que products cambie si falla productInventory (o
    // viceversa). updateMask conserva metadatos que Sheets no administra.
    const publicFields = encodeFirestoreFields(publicData);
    const inventoryFields = encodeFirestoreFields(inventoryData);
    const writes = [];
    if (Object.keys(publicFields).length) writes.push({ path: `products/${id}`, fields: publicFields, mergeFields: Object.keys(publicFields) });
    if (Object.keys(inventoryFields).length) writes.push({ path: `productInventory/${id}`, fields: inventoryFields, mergeFields: Object.keys(inventoryFields) });
    if (!writes.length) throw new Error('No hay campos de producto permitidos para sincronizar.');
    await firestoreAdminCommit(env, writes);
    return webhookResponse({ ok: true, productId: id }, 200, request.url);
  } catch (error) {
    const upstreamStatus = Number(error?.status);
    const responseStatus = upstreamStatus === 409 || upstreamStatus === 502 ? upstreamStatus : 400;
    return webhookResponse({
      ok: false,
      error: String(error?.message || 'No se pudo sincronizar.').slice(0, 300),
    }, responseStatus, request.url);
  }
}
