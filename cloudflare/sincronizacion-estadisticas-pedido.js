import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminListAll,
  firestoreAdminMerge,
} from './firebase-admin-ligero.js';

const MAX_ORDERS = 5000;
const emailOf = value => String(value || '').trim().toLowerCase();
const dateOf = value => { const date = value instanceof Date ? value : new Date(value || ''); return Number.isNaN(date.getTime()) ? null : date; };
const orderTime = order => dateOf(order?.createdAt)?.getTime() || dateOf(order?.updatedAt)?.getTime() || 0;
const cancelled = order => {
  const status = String(order?.status || '').toLowerCase();
  const payment = String(order?.payment?.status || order?.paymentStatus || '').toLowerCase();
  return ['cancelado', 'rechazado'].includes(status) || ['cancelado', 'rechazado', 'reembolsado'].includes(payment);
};

function statsFor(orders) {
  const ordered = [...orders].sort((a, b) => orderTime(b) - orderTime(a));
  const valid = ordered.filter(order => !cancelled(order));
  const completed = ordered.filter(order => String(order?.status || '').toLowerCase() === 'entregado');
  const pending = valid.filter(order => String(order?.status || '').toLowerCase() !== 'entregado');
  const last = ordered[0] || null;
  const lastPurchase = valid[0] || null;
  return {
    orderCount: ordered.length,
    purchaseCount: ordered.length,
    totalOrders: ordered.length,
    totalSpent: Math.max(0, valid.reduce((sum, order) => sum + Math.max(0, Number(order?.total) || 0), 0)),
    completedOrders: completed.length,
    pendingOrders: pending.length,
    cancelledOrders: ordered.length - valid.length,
    lastOrderAt: dateOf(last?.createdAt),
    lastOrderId: last?.id || '',
    lastPurchaseAt: dateOf(lastPurchase?.createdAt),
    lastPurchaseOrderId: lastPurchase?.id || '',
  };
}

function statsPayload(stats) {
  return {
    ...stats,
    profileStatsUpdatedAt: new Date(),
    updatedAt: new Date(),
    orderStats: {
      total: stats.totalOrders,
      active: Math.max(0, stats.totalOrders - stats.cancelledOrders),
      completed: stats.completedOrders,
      pending: stats.pendingOrders,
      cancelled: stats.cancelledOrders,
      totalSpent: stats.totalSpent,
      lastOrderId: stats.lastOrderId,
      lastPurchaseOrderId: stats.lastPurchaseOrderId,
      lastRecalculatedAt: new Date(),
    },
  };
}

/** Replica el resumen de la cuenta desde la fuente canónica `orders`. */
export async function syncOrderOwnerStats(env, order) {
  const uid = String(order?.userId || order?.uid || '').trim();
  const email = emailOf(order?.userEmail || order?.email || order?.customerEmail);
  if (!uid && !email) return { updated: false, reason: 'missing-identity' };
  const documents = await firestoreAdminListAll(env, 'orders', MAX_ORDERS);
  const orders = documents.map(document => ({ id: String(document.name || '').split('/').pop(), ...decodeFirestoreFields(document.fields || {}) }));
  const owned = orders.filter(item => {
    const itemUid = String(item.userId || item.uid || '').trim();
    const itemEmail = emailOf(item.userEmail || item.email || item.customerEmail);
    // El UID es la identidad principal, pero el email también se conserva
    // como puente para pedidos históricos creados antes de la identidad
    // canónica. Así la cuenta nunca pierde importes por una migración vieja.
    return (uid && itemUid === uid) || (email && itemEmail === email);
  });
  let targets = uid ? [uid] : [];
  if (!targets.length) {
    const users = await firestoreAdminListAll(env, 'users', MAX_ORDERS);
    targets = users.map(document => ({ uid: String(document.name || '').split('/').pop(), ...decodeFirestoreFields(document.fields || {}) }))
      .filter(user => emailOf(user.email) === email).map(user => user.uid);
  }
  const fields = encodeFirestoreFields(statsPayload(statsFor(owned)));
  await Promise.all(targets.map(target => firestoreAdminMerge(env, `users/${encodeURIComponent(target)}`, fields)));
  return { updated: targets.length > 0, targets };
}
