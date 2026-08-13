import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';
import {
  encodeFirestoreFields,
  firestoreAdminCommit,
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_BODY_BYTES = 32 * 1024;

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

function productId(value) {
  const id = text(value, 128);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('ID de producto invalido.');
  return id || crypto.randomUUID().replace(/-/g, '');
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return jsonResponse({ ok: false, error: 'No autorizado' }, 401, '', request.url);
  }

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud invalida.');
    const input = JSON.parse(raw);
    const id = productId(input.productId);

    if (input.action === 'deleteProduct') {
      await firestoreAdminCommit(env, [
        { path: `products/${id}`, delete: true },
        { path: `productInventory/${id}`, delete: true },
      ]);
      return jsonResponse({ ok: true, productId: id, deleted: true }, 200, '', request.url);
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

    await firestoreAdminCommit(env, [
      { path: `products/${id}`, fields: encodeFirestoreFields(publicData) },
      { path: `productInventory/${id}`, fields: encodeFirestoreFields(inventoryData) },
    ]);
    return jsonResponse({ ok: true, productId: id }, 200, '', request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo sincronizar.').slice(0, 300) }, 400, '', request.url);
  }
}
