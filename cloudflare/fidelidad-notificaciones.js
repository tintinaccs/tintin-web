import {
  decodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminQueryEqual,
} from './firebase-admin-ligero.js';
import { notifyAdminIfAbsent, notifyUserIfAbsent } from './notificaciones-sociales.js';
import { resolveCustomerTier } from './fidelidad-clientes.js';

const INVALID_PURCHASE_STATES = new Set(['cancelado', 'rechazado', 'reembolsado', 'refunded', 'refund']);
const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';

const clean = (value, max = 180) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

function orderIsValid(order = {}) {
  const status = clean(order.status, 40).toLowerCase();
  const payment = clean(order.paymentStatus || order.payment?.status, 40).toLowerCase();
  return !INVALID_PURCHASE_STATES.has(status) && !INVALID_PURCHASE_STATES.has(payment);
}

function orderId(order) {
  return clean(order?.id || order?.orderId || order?.requestId, 220);
}

function orderCustomerUid(order) {
  return clean(order?.userId || order?.uid || order?.customerUid, 180);
}

function orderEmail(order) {
  return clean(order?.userEmail || order?.contactEmail || order?.email, 254).toLowerCase();
}

function customerName(order) {
  return clean(order?.userName || order?.customerName || 'Clienta Tintin', 160);
}

async function readCustomerOrders(env, order, get = firestoreAdminGet, query = firestoreAdminQueryEqual) {
  const uid = orderCustomerUid(order);
  const email = orderEmail(order);
  if (!uid && !email) return [];
  const requests = [];
  if (uid) requests.push(query(env, 'orders', 'userId', uid));
  if (email) requests.push(query(env, 'orders', 'userEmail', email));
  const rows = (await Promise.all(requests)).flat();
  const unique = new Map();
  for (const document of rows) {
    const decoded = document?.fields ? { id: String(document.name || '').split('/').pop(), ...decodeFirestoreFields(document.fields) } : document;
    const id = orderId(decoded);
    if (id) unique.set(id, decoded);
  }
  if (orderId(order) && !unique.has(orderId(order))) unique.set(orderId(order), order);
  return [...unique.values()];
}

function tierFor(orders, settings) {
  return resolveCustomerTier({
    purchaseCount: orders.filter(orderIsValid).length,
  }, settings?.loyaltyTiers);
}

/**
 * Reconciles one committed order against the canonical order collection.
 * Firestore remains authoritative; notifications are idempotent side effects.
 * A missing UID is intentionally ignored because guest purchases have no
 * account to notify.
 */
export async function reconcileLoyaltyTierNotification(
  env,
  {
    orderId: explicitOrderId = '',
    beforeOrder = null,
    afterOrder = null,
    get = firestoreAdminGet,
    query = firestoreAdminQueryEqual,
    notifyUser = notifyUserIfAbsent,
    notifyAdmin = notifyAdminIfAbsent,
  } = {},
) {
  const order = afterOrder || beforeOrder || {};
  const uid = orderCustomerUid(order);
  const email = orderEmail(order);
  if (!uid || email === SUPER_ADMIN_EMAIL) return { ok: true, skipped: 'non_customer_order' };

  const [settingsDocument, orders] = await Promise.all([
    get(env, 'settings/general'),
    readCustomerOrders(env, order, get, query),
  ]);
  const settings = settingsDocument ? decodeFirestoreFields(settingsDocument.fields || {}) : {};
  const currentOrderId = clean(explicitOrderId || orderId(afterOrder), 220);
  const afterWithId = afterOrder ? { id: currentOrderId, ...afterOrder } : null;
  const afterOrders = orders.map(item => orderId(item) === currentOrderId ? afterWithId : item).filter(Boolean);
  if (afterWithId && !afterOrders.some(item => orderId(item) === currentOrderId)) afterOrders.push(afterWithId);
  const beforeOrders = afterOrders.filter(item => orderId(item) !== currentOrderId);
  if (beforeOrder) beforeOrders.push({ id: currentOrderId, ...beforeOrder });

  const previousTier = tierFor(beforeOrders, settings);
  const nextTier = tierFor(afterOrders, settings);
  if (previousTier?.id === nextTier?.id) return { ok: true, changed: false, previousTier, nextTier };

  const revision = clean(afterOrder?.lastChangeId || afterOrder?.updatedAt || currentOrderId, 220);
  const dedupeKey = `loyalty-tier:${uid}:${previousTier?.id || 'none'}:${nextTier?.id || 'none'}:${revision}`;
  const orderNumber = clean(afterOrder?.orderNumber || afterOrder?.shortId || currentOrderId, 80);
  const gained = Boolean(nextTier && (!previousTier || nextTier.minPurchases > previousTier.minPurchases));
  const title = gained ? `Ganaste el nivel ${nextTier.label}` : 'Tu nivel de fidelidad fue actualizado';
  const body = nextTier
    ? (gained
      ? `Alcanzaste ${nextTier.minPurchases} compras válidas. ¡Gracias por elegir Tintin!`
      : `Tu nivel actual es ${nextTier.label}, según tus compras válidas.`)
    : 'Tu nivel de fidelidad quedó sin insignia activa por el estado actual de tus compras.';
  const event = {
    kind: gained ? 'loyalty_tier_awarded' : 'loyalty_tier_updated',
    actorType: 'system',
    actorUid: uid,
    actorName: customerName(afterOrder),
    title,
    body,
    iconKey: 'loyalty',
    targetUrl: '/perfil#fidelidad',
    targetType: 'loyalty',
    targetId: uid,
    targetOwnerUid: uid,
    targetOwnerName: customerName(afterOrder),
    orderId: currentOrderId,
    orderNumber,
    aggregateCount: afterOrders.filter(orderIsValid).length,
    sourceType: 'loyalty',
    sourceId: uid,
    createdAt: new Date(),
  };
  const [user, admin] = await Promise.all([
    // Las bajadas se reflejan en el perfil, sin notificación al cliente.
    gained ? notifyUser(env, uid, event, dedupeKey) : Promise.resolve({ skipped: 'silent_downgrade' }),
    notifyAdmin(env, { ...event, title: `Fidelidad actualizada: ${customerName(afterOrder)}`, body: `${customerName(afterOrder)}: ${nextTier?.label || 'sin nivel activo'}.`, targetUrl: '/admin.html#section-usuarios' }, `admin:${dedupeKey}`),
  ]);
  return { ok: true, changed: true, previousTier, nextTier, user, admin };
}
