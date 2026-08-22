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

    const name = text(input.name, 180);
    const category = text(input.category, 120);
    const price = optionalInteger(input.price);
    if (!name || !category || price === null || price <= 0) throw new Error('Nombre, categoria y precio son obligatorios.');

    const publicData = {
      name,
      category,
      price,
      stock: optionalInteger(input.stock, 1_000_000),
      active: input.active === true,
      oferta: input.oferta === true,
      destacado: input.destacado === true,
      priceBefore: optionalInteger(input.priceBefore),
      badge: text(input.badge, 60) || null,
      imageUrl: text(input.imageUrl, 2000) || null,
      description: text(input.description, 4000),
      material: text(input.material, 240),
      measurements: text(input.measurements, 240),
      colorFinish: text(input.colorFinish, 240),
      care: text(input.care, 500),
      waterResistance: text(input.waterResistance, 240),
      warranty: text(input.warranty, 240),
      sizeFit: text(input.sizeFit, 240),
      packageContents: text(input.packageContents, 500),
      imagesExtra: stringList(input.imagesExtra, 12, 2000),
      collection: text(input.collection, 240) || null,
      tags: stringList(input.tags, 30, 60),
      variants: variants(input.variants),
      updatedAt: new Date(),
    };
    const inventoryData = {
      costUnit: optionalInteger(input.costUnit),
      purchased: optionalInteger(input.purchased, 1_000_000),
      stockMinimum: optionalInteger(input.stockMinimum, 1_000_000),
      internalNotes: text(input.internalNotes, 1000),
      updatedAt: new Date(),
    };

    // Un único commit evita que products cambie si falla productInventory (o
    // viceversa). updateMask conserva metadatos que Sheets no administra.
    const publicFields = encodeFirestoreFields(publicData);
    const inventoryFields = encodeFirestoreFields(inventoryData);
    await firestoreAdminCommit(env, [
      { path: `products/${id}`, fields: publicFields, mergeFields: Object.keys(publicFields) },
      { path: `productInventory/${id}`, fields: inventoryFields, mergeFields: Object.keys(inventoryFields) },
    ]);
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
