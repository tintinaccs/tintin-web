import {
  decodeFirestoreFields,
  firestoreAdminListAll,
} from '../../cloudflare/firebase-admin-ligero.js';
import { corsHeaders } from '../../cloudflare/seguridad-cloudinary.js';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_EXPORT = 2000;
export const SHEETS_ADMIN_EXPORT_REVISION = 'sheets-admin-export-v1';

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function classifySheetsAdminExportAuth(provided, expected) {
  const providedValue = String(provided || '');
  const expectedValue = String(expected || '');
  if (!providedValue) return 'missing-header';
  if (!expectedValue) return 'server-secret-missing';
  return sameSecret(providedValue, expectedValue) ? 'authenticated' : 'secret-mismatch';
}

function responseJson(body, status, requestUrl, authState = 'authenticated') {
  const headers = corsHeaders('', requestUrl);
  headers['content-type'] = 'application/json; charset=utf-8';
  headers['cache-control'] = 'no-store';
  headers['x-tintin-sheets-admin-export'] = SHEETS_ADMIN_EXPORT_REVISION;
  headers['x-tintin-auth-state'] = authState;
  return new Response(JSON.stringify(body), { status, headers });
}

function docId(document) {
  return String(document?.name || '').split('/').pop();
}

function decodeDocument(document) {
  if (!document) return null;
  return { id: docId(document), ...decodeFirestoreFields(document.fields || {}) };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampMs(value) {
  if (!value) return 0;
  const date = value?.toDate ? value.toDate() : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function newestFirst(a, b) {
  return timestampMs(b.updatedAt || b.createdAt || b.timestamp) - timestampMs(a.updatedAt || a.createdAt || a.timestamp);
}

function orderUserId(order) {
  return String(order?.userId || order?.uid || '').trim();
}

function orderIsCancelled(order) {
  return ['cancelado', 'rechazado'].includes(String(order?.status || '').trim().toLowerCase());
}

function lastOrderValue(orders, uid, fieldGetter) {
  for (const order of orders) {
    if (orderUserId(order) !== uid) continue;
    const value = fieldGetter(order);
    if (value !== '' && value !== null && value !== undefined) return value;
  }
  return '';
}

export function projectUserForSheets(user, orders = []) {
  const uid = String(user?.id || user?.uid || '').trim();
  const ownOrders = orders.filter(order => orderUserId(order) === uid && !orderIsCancelled(order));
  const totalSpent = ownOrders.reduce((sum, order) => sum + number(order?.total), 0);
  const checkoutDefaults = user?.checkoutDefaults || {};
  const ci = String(
    user?.ci || checkoutDefaults?.ci ||
    lastOrderValue(orders, uid, order => order?.ci) || ''
  ).trim();
  return {
    uid,
    name: user?.name || user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
    email: user?.email || '',
    createdAt: user?.createdAt || user?.registeredAt || '',
    role: user?.role || 'client',
    blocked: user?.blocked === true,
    orderCount: ownOrders.length,
    totalSpent,
    internalNotes: user?.internalNotes || user?.notes || '',
    customerId: user?.customerId || (uid ? `CUS_${uid}` : ''),
    username: user?.username || user?.alias || '',
    phone: user?.phone || user?.phoneNormalized || '',
    ci,
    profileStatus: user?.profileStatus || '',
    lastAccess: user?.lastAccessAt || user?.lastLoginAt || user?.lastSeenAt || user?.updatedAt || '',
    usernameChanged: Boolean(user?.usernameChangedAt || user?.usernameChangeUsed),
    lastChangeId: user?.lastChangeId || user?.changeId || '',
  };
}

export function projectOrderForSheets(order) {
  const shipping = order?.shipping || {};
  const payment = order?.payment || {};
  const invoice = order?.invoice || order?.billing || {};
  return {
    orderId: order?.id || order?.orderId || '',
    orderNumber: order?.orderNumber || order?.shortId || '',
    requestId: order?.requestId || '',
    customerId: order?.customerId || '',
    userId: order?.userId || '',
    userEmail: order?.userEmail || '',
    contactEmail: order?.contactEmail || order?.userEmail || '',
    userName: order?.userName || '',
    userPhone: order?.userPhone || '',
    ci: order?.ci || '',
    status: order?.status || '',
    paymentMethod: payment?.method || order?.paymentMethod || '',
    paymentStatus: payment?.status || order?.paymentStatus || '',
    shippingMethod: shipping?.method || order?.shippingMethod || '',
    shippingCity: shipping?.city || order?.shippingCity || '',
    departamento: shipping?.departamento || order?.departamento || '',
    address: shipping?.address || order?.address || '',
    subtotal: number(order?.subtotal),
    shippingCost: number(order?.shippingCost),
    total: number(order?.total),
    invoiceWanted: order?.wantsInvoice === true || invoice?.wanted === true,
    razonSocial: order?.razonSocial || invoice?.razonSocial || '',
    ruc: order?.ruc || invoice?.ruc || '',
    itemsSnapshot: order?.itemsSnapshot || order?.items || [],
    createdAt: order?.createdAt || '',
    updatedAt: order?.updatedAt || '',
    inventoryState: order?.inventoryState || '',
    notificationStatus: order?.notificationStatus || '',
    lastChangeId: order?.lastChangeId || order?.changeId || '',
  };
}

export function projectAuditForSheets(record) {
  return {
    eventId: record?.eventId || record?.id || '',
    timestamp: record?.timestamp || record?.createdAt || '',
    customerId: record?.customerId || '',
    actorId: record?.actorId || record?.actorUid || '',
    actorEmail: record?.actorEmail || '',
    actorRole: record?.actorRole || '',
    action: record?.action || '',
    entityType: record?.entityType || record?.targetType || '',
    entityId: record?.entityId || record?.targetId || '',
    before: record?.before ?? '',
    after: record?.after ?? '',
    origin: record?.origin || '',
    result: record?.result || 'success',
    changeId: record?.changeId || record?.eventId || record?.id || '',
  };
}

async function readCollection(env, path, maxDocuments) {
  return (await firestoreAdminListAll(env, path, maxDocuments)).map(decodeDocument).filter(Boolean);
}

async function exportEntity(env, entity, limit) {
  if (entity === 'users') {
    const [users, orders] = await Promise.all([
      readCollection(env, 'users', limit),
      readCollection(env, 'orders', MAX_EXPORT),
    ]);
    orders.sort(newestFirst);
    return users.map(user => projectUserForSheets(user, orders)).sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  }
  if (entity === 'orders') {
    return (await readCollection(env, 'orders', limit)).map(projectOrderForSheets).sort(newestFirst);
  }
  if (entity === 'audit') {
    return (await readCollection(env, 'auditLog', limit)).map(projectAuditForSheets).sort(newestFirst);
  }
  throw new Error('Entidad no permitida.');
}

export async function onRequestPost({ request, env }) {
  const authState = classifySheetsAdminExportAuth(
    request.headers.get('X-Tintin-Sheets-Secret'),
    env.SHEETS_ENGAGEMENT_SECRET,
  );
  if (authState !== 'authenticated') {
    return responseJson({ ok: false, error: 'No autorizado' }, 401, request.url, authState);
  }

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    if (body.action === 'diagnose') {
      return responseJson({
        ok: true,
        authenticated: true,
        destructive: false,
        revision: SHEETS_ADMIN_EXPORT_REVISION,
        entities: ['users', 'orders', 'audit'],
      }, 200, request.url);
    }
    if (body.action !== 'export') throw new Error('Acción no permitida.');
    const entity = String(body.entity || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(MAX_EXPORT, Number(body.limit) || MAX_EXPORT));
    const rows = await exportEntity(env, entity, limit);
    return responseJson({ ok: true, entity, count: rows.length, rows, revision: SHEETS_ADMIN_EXPORT_REVISION }, 200, request.url);
  } catch (error) {
    return responseJson({ ok: false, error: String(error?.message || 'No se pudo exportar.').slice(0, 300) }, 400, request.url);
  }
}
