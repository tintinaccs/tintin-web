import { chooseCancellationStock } from '../orders/seleccion-stock-cancelacion.mjs?v=tintin-20261102-cancel-stock-1';
import { withAdminSiteChange } from '../../core/store/publicar-cambio-administrativo.js?v=tintin-20261017-domain-cutover-1';
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from '../../core/auth/roles.js?v=tintin-20261017-domain-cutover-1';
import { authenticatedFetch } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20261022-avatar-inicial-1';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  runTransaction,
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  orderNeedsCancellationStockChoice
} from '../../core/store/modelo-inventario.mjs?v=tintin-20261102-cancel-stock-1';

function actorEmail() {
  return String(auth.currentUser?.email || '').trim().toLowerCase();
}

async function updateEditedOrder(orderId, patch) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) throw new Error('Pedido inválido.');
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión administrativa ya no está disponible.');
  patch = { ...(patch || {}) };
  if (['cancelado', 'rechazado'].includes(patch.status)) {
    const snapshot = await getDoc(doc(db, 'orders', safeOrderId));
    if (!snapshot.exists()) throw new Error('El pedido ya no existe.');
    const before = { ...snapshot.data(), id: safeOrderId };
    if (orderNeedsCancellationStockChoice(before, patch.status)) {
      const expected = patch.baseChangeId ?? window.TintinAdminOrders?.get?.(safeOrderId)?.lastChangeId ?? '';
      if (expected !== (before.lastChangeId || '')) throw new Error('El pedido cambió. Actualizá antes de elegir el stock.');
      const decision = await chooseCancellationStock(before, patch.status);
      if (decision === null) return { cancelled: true };
      if (auth.currentUser?.uid !== user.uid) throw new Error('La sesión administrativa cambió. Volvé a abrir el pedido.');
      patch.inventoryCancellationDecision = decision;
      patch.baseChangeId = expected;
    }
  }
  const response = await authenticatedFetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      orderId: safeOrderId,
      baseChangeId: window.TintinAdminOrders?.get?.(safeOrderId)?.lastChangeId || '',
      ...(patch && typeof patch === 'object' ? patch : {}),
      changeId: patch?.changeId || `admin_${crypto.randomUUID().replaceAll('-', '')}`,
      source: 'superadmin'
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const error = new Error(body.error || 'No se pudo actualizar el pedido.');
    error.status = response.status;
    error.code = body.code || '';
    throw error;
  }
  return body.result || {};
}

async function transitionStatus(orderId, status, context = {}) {
  return updateEditedOrder(orderId, { ...context, status: String(status || '').trim() });
}

async function deleteOrder(orderId) {
  if (actorEmail() !== SUPER_ADMIN_EMAIL) throw new Error('Solo Super Admin puede eliminar pedidos.');
  if (!window.TintinOrderAdmin?.trashOrder) throw new Error('La papelera de pedidos todavía no está disponible.');
  return window.TintinOrderAdmin.trashOrder(orderId);
}

async function cleanupStalePendingOrders(hoursOld = 2) {
  if (actorEmail() !== SUPER_ADMIN_EMAIL) {
    throw new Error('Solo Super Admin puede limpiar pedidos abandonados.');
  }
  const cutoffMs = Date.now() - Math.max(1, Number(hoursOld) || 2) * 60 * 60 * 1000;
  const snapshot = await getDocs(query(collection(db, 'orders'), where('inventoryState', '==', 'pending')));

  let removed = 0;
  let skipped = 0;
  for (const orderSnap of snapshot.docs) {
    const data = orderSnap.data() || {};
    const createdAtMs = typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
    if (!createdAtMs || createdAtMs > cutoffMs) { skipped += 1; continue; }

    try {
      await withAdminSiteChange(async () => runTransaction(db, async transaction => {
        const fresh = await transaction.get(orderSnap.ref);
        if (!fresh.exists()) return;
        const freshData = fresh.data() || {};
        if (freshData.inventoryState !== 'pending') return;
        transaction.delete(orderSnap.ref);
      }, { maxAttempts: 2 }));
      removed += 1;
    } catch (error) {
      console.warn('[admin-inventory-integrity] No se pudo limpiar', orderSnap.id, error);
      skipped += 1;
    }
  }

  return { checked: snapshot.docs.length, removed, skipped };
}

window.TintinInventoryIntegrity = Object.freeze({
  updateEditedOrder,
  transitionStatus,
  deleteOrder,
  cleanupStalePendingOrders
});
