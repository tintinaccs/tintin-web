/* =============================================================
   TINTIN — Order Stats centralizadas
   =============================================================
   Fuente de verdad: colección `orders`.
   Recalcula contadores del perfil por uid y, si hace falta, por email.
   Nunca resta manualmente: vuelve a contar desde los pedidos existentes.
   ============================================================= */

import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getDocsPaginated } from './firestore-pagination.js?v=tintin-20260716-cloudinary-fix-1';

const ZERO_STATS = Object.freeze({
  orderCount: 0,
  purchaseCount: 0,
  totalOrders: 0,
  totalSpent: 0,
  completedOrders: 0,
  pendingOrders: 0,
  cancelledOrders: 0,
  lastOrderAt: null,
  lastOrderId: '',
  lastPurchaseAt: null,
  lastPurchaseOrderId: ''
});

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function jsDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function orderTime(order) {
  return jsDate(order.createdAt)?.getTime() || jsDate(order.updatedAt)?.getTime() || 0;
}

function normalizeStatus(status) {
  return String(status || 'pendiente').toLowerCase();
}

function isCancelled(order) {
  const s = normalizeStatus(order.status);
  const p = normalizeStatus(order.payment?.status || order.paymentStatus);
  return s === 'cancelado' || s === 'rechazado' || p === 'cancelado' || p === 'rechazado' || p === 'reembolsado';
}

function isCompleted(order) {
  const s = normalizeStatus(order.status);
  return s === 'entregado';
}

function isPending(order) {
  return !isCancelled(order) && !isCompleted(order);
}

function uniqOrders(list) {
  const map = new Map();
  (list || []).forEach(order => {
    if (!order?.id) return;
    map.set(order.id, order);
  });
  return [...map.values()].sort((a, b) => orderTime(b) - orderTime(a));
}

async function getOrdersByField(field, value) {
  if (!value) return [];
  const snap = await getDocs(query(collection(db, 'orders'), where(field, '==', value)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getOrdersForUserIdentity({ uid, email } = {}) {
  const emailNorm = normEmail(email);
  const batches = [];
  if (uid) batches.push(getOrdersByField('userId', uid));
  if (email) batches.push(getOrdersByField('userEmail', email));
  if (emailNorm && emailNorm !== email) batches.push(getOrdersByField('userEmail', emailNorm));

  const settled = await Promise.allSettled(batches);
  const orders = [];
  settled.forEach(r => {
    if (r.status === 'fulfilled') orders.push(...r.value);
    else console.warn('[order-stats] No se pudo leer una consulta de pedidos:', r.reason);
  });
  return uniqOrders(orders);
}

export function calculateOrderStats(orders = []) {
  const clean = uniqOrders(orders);
  const completed = clean.filter(isCompleted);
  const cancelled = clean.filter(isCancelled);
  const pending = clean.filter(isPending);
  const validForSpent = clean.filter(o => !isCancelled(o));
  const lastOrder = clean[0] || null;
  const lastPurchase = validForSpent[0] || null;
  const totalSpent = Math.max(0, validForSpent.reduce((sum, o) => sum + Number(o.total || 0), 0));

  return {
    orderCount: Math.max(0, clean.length),
    purchaseCount: Math.max(0, clean.length),
    totalOrders: Math.max(0, clean.length),
    totalSpent,
    completedOrders: Math.max(0, completed.length),
    pendingOrders: Math.max(0, pending.length),
    cancelledOrders: Math.max(0, cancelled.length),
    lastOrderAt: lastOrder?.createdAt || null,
    lastOrderId: lastOrder?.id || '',
    lastPurchaseAt: lastPurchase?.createdAt || null,
    lastPurchaseOrderId: lastPurchase?.id || ''
  };
}

export function buildUserStatsPayload(stats) {
  const safe = { ...ZERO_STATS, ...(stats || {}) };
  const payload = {
    ...safe,
    profileStatsUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    orderStats: {
      total: safe.totalOrders,
      active: Math.max(0, safe.totalOrders - safe.cancelledOrders),
      completed: safe.completedOrders,
      pending: safe.pendingOrders,
      cancelled: safe.cancelledOrders,
      totalSpent: safe.totalSpent,
      lastOrderId: safe.lastOrderId,
      lastPurchaseOrderId: safe.lastPurchaseOrderId,
      lastRecalculatedAt: serverTimestamp()
    }
  };
  return payload;
}

export async function recalculateUserOrderStats({ uid, email } = {}) {
  if (!uid && !email) return { updated: false, reason: 'missing-identity', stats: { ...ZERO_STATS } };
  const orders = await getOrdersForUserIdentity({ uid, email });
  const stats = calculateOrderStats(orders);
  if (!uid) return { updated: false, reason: 'missing-uid', stats, orders };

  await setDoc(doc(db, 'users', uid), buildUserStatsPayload(stats), { merge: true });
  try {
    localStorage.setItem('tt_profile_stats_refresh', String(Date.now()));
  } catch {}
  return { updated: true, uid, email, stats, orders };
}

async function findUsersByEmail(email) {
  const emailRaw = String(email || '').trim();
  const emailLower = normEmail(emailRaw);
  if (!emailRaw) return [];
  const results = [];
  const queries = [getOrdersSafeUserQuery('email', emailRaw)];
  if (emailLower && emailLower !== emailRaw) queries.push(getOrdersSafeUserQuery('email', emailLower));
  const settled = await Promise.allSettled(queries);
  settled.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
  const map = new Map();
  results.forEach(u => { if (u.uid) map.set(u.uid, u); });
  return [...map.values()];
}

async function getOrdersSafeUserQuery(field, value) {
  const snap = await getDocs(query(collection(db, 'users'), where(field, '==', value)));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function recalculateOrderOwnerStats(order) {
  if (!order) return { updated: false, reason: 'missing-order' };
  const uid = order.userId || order.uid || order.customerId || '';
  const email = order.userEmail || order.email || order.customerEmail || '';
  const updates = [];

  if (uid) {
    updates.push(await recalculateUserOrderStats({ uid, email }));
  } else if (email) {
    const users = await findUsersByEmail(email).catch(e => {
      console.warn('[order-stats] No se pudo buscar usuario por email:', e);
      return [];
    });
    for (const user of users) {
      updates.push(await recalculateUserOrderStats({ uid: user.uid, email: user.email || email }));
    }
  }

  return { updated: updates.some(u => u.updated), updates, uid, email };
}

export async function recalculateAllUserOrderStats() {
  const [usersSnap, ordersSnap] = await Promise.all([
    getDocsPaginated(collection(db, 'users'), { pageSize: 500, maxDocs: 20000 }),
    getDocsPaginated(collection(db, 'orders'), { pageSize: 500, maxDocs: 20000 })
  ]);
  if (usersSnap.truncated || ordersSnap.truncated) {
    throw new Error('La recalculación global superó el límite seguro de 20.000 registros por colección.');
  }
  const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ordersByUid = new Map();
  const ordersByEmail = new Map();

  orders.forEach(order => {
    const uid = order.userId || order.uid || order.customerId || '';
    const email = normEmail(order.userEmail || order.email || order.customerEmail || '');
    if (uid) {
      if (!ordersByUid.has(uid)) ordersByUid.set(uid, []);
      ordersByUid.get(uid).push(order);
    }
    if (email) {
      if (!ordersByEmail.has(email)) ordersByEmail.set(email, []);
      ordersByEmail.get(email).push(order);
    }
  });

  const CHUNK = 450;
  let updated = 0;
  for (let i = 0; i < users.length; i += CHUNK) {
    const batch = writeBatch(db);
    users.slice(i, i + CHUNK).forEach(user => {
      const email = normEmail(user.email || '');
      const merged = uniqOrders([...(ordersByUid.get(user.uid) || []), ...(ordersByEmail.get(email) || [])]);
      batch.set(doc(db, 'users', user.uid), buildUserStatsPayload(calculateOrderStats(merged)), { merge: true });
      updated++;
    });
    await batch.commit();
  }
  return { updated, users: users.length, orders: orders.length };
}

export async function readOrderBeforeDelete(orderId) {
  if (!orderId) return null;
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
