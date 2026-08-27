import {
  decodeFirestoreFields,
  firestoreAdminListAll,
} from '../../cloudflare/firebase-admin-ligero.js';
import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_RECORDS = 1000;
const ALLOWED_ENTITIES = new Set(['products', 'users', 'orders', 'audit']);

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

function asIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function publicProduct(document, inventoryById) {
  const product = decodeFirestoreFields(document.fields || {});
  const inventory = inventoryById.get(documentId(document)) || {};
  return {
    id: documentId(document),
    name: product.name || '', category: product.category || '', price: product.price ?? '',
    stock: product.stock ?? '', active: product.active !== false, oferta: product.oferta === true,
    destacado: product.destacado === true, priceBefore: product.priceBefore ?? '', badge: product.badge || '',
    imageUrl: product.imageUrl || '', description: product.description || '', material: product.material || '',
    measurements: product.measurements || '', colorFinish: product.colorFinish || '', care: product.care || '',
    waterResistance: product.waterResistance || '', warranty: product.warranty || '', sizeFit: product.sizeFit || '',
    packageContents: product.packageContents || '', imagesExtra: product.imagesExtra || [], collection: product.collection || '',
    tags: product.tags || [], variants: product.variants || null, updatedAt: asIso(product.updatedAt),
    costUnit: inventory.costUnit ?? '', purchased: inventory.purchased ?? '', stockMinimum: inventory.stockMinimum ?? '',
    internalNotes: inventory.internalNotes || '',
  };
}

function userRecord(document) {
  const user = decodeFirestoreFields(document.fields || {});
  return {
    uid: documentId(document), name: user.name || user.displayName || '', email: user.email || '',
    createdAt: asIso(user.createdAt || user.registeredAt), role: user.role || 'client', blocked: user.blocked === true,
    orders: Number(user.ordersCount || user.orders || 0), totalSpent: Number(user.totalSpent || 0),
    internalNotes: user.internalNotes || '', customerId: user.customerId || '', username: user.username || '',
    phone: user.phone || '', ci: user.ci || '', profileStatus: user.profileStatus || '',
    lastAccess: asIso(user.lastAccess || user.lastLoginAt), usernameChangeUsed: user.usernameChangeUsed === true,
    lastChangeId: user.lastChangeId || '', updatedAt: asIso(user.updatedAt),
  };
}

function orderRecord(document) {
  const order = decodeFirestoreFields(document.fields || {});
  const shipping = order.shipping && typeof order.shipping === 'object' ? order.shipping : {};
  const payment = order.payment && typeof order.payment === 'object' ? order.payment : {};
  const invoice = order.invoice && typeof order.invoice === 'object' ? order.invoice : {};
  return {
    orderId: documentId(document), orderNumber: order.orderNumber || order.shortId || '', requestId: order.requestId || '',
    customerId: order.customerId || '', userId: order.userId || '', userEmail: order.userEmail || '',
    contactEmail: order.contactEmail || '', userName: order.userName || '', userPhone: order.userPhone || '', ci: order.ci || '',
    status: order.status || '', paymentMethod: payment.method || order.paymentMethod || '',
    paymentStatus: payment.status || order.paymentStatus || '', shippingMethod: shipping.method || order.shippingMethod || '',
    shippingCity: shipping.city || order.shippingCity || '', departamento: shipping.departamento || order.departamento || '',
    address: shipping.address || order.address || '', reference: shipping.referencia || shipping.reference || '',
    notes: order.notes || '', subtotal: order.subtotal ?? '', shippingCost: order.shippingCost ?? '', total: order.total ?? '',
    invoiceWanted: invoice.wanted === true, razonSocial: invoice.razonSocial || '', ruc: invoice.ruc || '',
    itemsSnapshot: order.items || [], createdAt: asIso(order.createdAt), updatedAt: asIso(order.updatedAt),
    inventoryState: order.inventoryState || '', notificationStatus: order.notificationStatus || '', lastChangeId: order.lastChangeId || '',
    syncOrigin: order.syncOrigin || '',
  };
}

function auditRecord(document) {
  const record = decodeFirestoreFields(document.fields || {});
  return { eventId: documentId(document), timestamp: asIso(record.createdAt || record.timestamp), ...record };
}

async function snapshot(env, entity) {
  if (entity === 'products') {
    const [products, inventory] = await Promise.all([
      firestoreAdminListAll(env, 'products', MAX_RECORDS),
      firestoreAdminListAll(env, 'productInventory', MAX_RECORDS),
    ]);
    const inventoryById = new Map(inventory.map(document => [documentId(document), decodeFirestoreFields(document.fields || {})]));
    return products.map(document => publicProduct(document, inventoryById));
  }
  const collection = entity === 'users' ? 'users' : entity === 'orders' ? 'orders' : 'auditLog';
  const documents = await firestoreAdminListAll(env, collection, MAX_RECORDS);
  if (entity === 'users') return documents.map(userRecord);
  if (entity === 'orders') return documents.map(orderRecord);
  return documents.map(auditRecord);
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return jsonResponse({ ok: false, error: 'No autorizado' }, 401, '', request.url);
  }
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud inválida');
    const input = JSON.parse(raw);
    const entity = String(input.entity || '');
    if (input.action !== 'snapshot' || !ALLOWED_ENTITIES.has(entity)) throw new Error('Solicitud de sincronización inválida');
    const records = await snapshot(env, entity);
    return jsonResponse({ ok: true, entity, records, generatedAt: new Date().toISOString() }, 200, '', request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo leer la sincronización').slice(0, 300) }, 400, '', request.url);
  }
}
