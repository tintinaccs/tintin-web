import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminQueryByFieldPage,
} from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';

const MAX_ACCOUNT_DOCUMENTS = 10000;
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
export async function syncOrderOwnerStats(env, order, { get = firestoreAdminGet, queryPage = firestoreAdminQueryByFieldPage, commit = firestoreAdminBatchCommit } = {}) {
  const uid = String(order?.userId || order?.uid || '').trim();
  const email = emailOf(order?.userEmail || order?.email || order?.customerEmail);
  if (!uid && !email) return { updated: false, reason: 'missing-identity' };
  const readMatches = async (collection, pairs, snapshot = { readTime: '' }) => {
    const documents = new Map();
    for (const [field, value] of pairs) {
      let after = '';
      const cursors = new Set();
      do {
        const page = await queryPage(env, collection, field, value, { after, readTime: snapshot.readTime, pageSize: 300 });
        if (!page || !Array.isArray(page.documents) || !page.readTime || snapshot.readTime && snapshot.readTime !== page.readTime) throw new Error('Resumen de cuenta: página o snapshot inválido.');
        snapshot.readTime = page.readTime;
        for (const document of page.documents) {
          if (!document?.name) throw new Error('Resumen de cuenta: documento inválido.');
          documents.set(document.name, document);
        }
        if (documents.size > MAX_ACCOUNT_DOCUMENTS) throw new Error('La cuenta supera el presupuesto de resumen; no se publica un resultado parcial.');
        after = page.after || '';
        if (after && cursors.has(after)) throw new Error('El resumen de cuenta no pudo avanzar.');
        cursors.add(after);
      } while (after);
    }
    return [...documents.values()];
  };
  let targets = uid ? [uid] : [];
  if (!targets.length) {
    const users = await readMatches('users', [['email', email]]);
    targets = users.map(document => ({ ...decodeFirestoreFields(document.fields || {}), uid: String(document.name || '').split('/').pop() }))
      .filter(user => emailOf(user.email) === email).map(user => user.uid);
  }
  if (!targets.length) return { updated: false, targets: [], reason: 'missing-account' };
  const pairs = [...(uid ? [['userId', uid], ['uid', uid]] : []), ...(email ? [['userEmail', email], ['email', email], ['customerEmail', email]] : [])];
  for (let attempt = 0; attempt < 3; attempt++) {
    // Leer las revisiones ANTES del cálculo impide que un resultado antiguo
    // sobrescriba uno que ya fue publicado mientras consultábamos los pedidos.
    const users = await Promise.all(targets.map(target => get(env, `users/${encodeURIComponent(target)}`)));
    const documents = await readMatches('orders', pairs);
    const orders = documents.map(document => ({ ...decodeFirestoreFields(document.fields || {}), id: String(document.name).split('/').pop() }));
    const owned = orders.filter(item => {
      const itemUid = String(item.userId || item.uid || '').trim();
      const itemEmail = emailOf(item.userEmail || item.email || item.customerEmail);
      // UID principal y puente por email para pedidos históricos normalizados.
      return (uid && itemUid === uid) || (email && itemEmail === email);
    });
    const payload = statsPayload(statsFor(owned));
    const activeTargets = targets.filter((_, index) => users[index]);
    const writes = targets.flatMap((target, index) => users[index] ? [{ path: `users/${encodeURIComponent(target)}`, fields: encodeFirestoreFields(payload), mergeFields: Object.keys(payload), currentDocument: { updateTime: users[index].updateTime } }] : []);
    if (!writes.length) return { updated: false, targets: [], reason: 'missing-account' };
    try {
      await commit(env, writes);
      return { updated: true, targets: activeTargets };
    } catch (error) {
      if (error?.code !== 'version_conflict' || attempt === 2) throw error;
    }
  }
}
