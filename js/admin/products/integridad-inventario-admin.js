import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  normalizeInventoryItems,
  orderReservesInventory
} from '../../core/store/modelo-inventario.mjs?v=tintin-20260720-critical-healing-1';

function actorEmail() {
  return String(auth.currentUser?.email || '').trim().toLowerCase();
}

function productRef(productId) {
  return doc(db, 'products', String(productId));
}

function finiteStock(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
}

async function updateEditedOrder(orderId, patch) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) throw new Error('Pedido inválido.');
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión administrativa ya no está disponible.');
  const token = await user.getIdToken();
  const response = await fetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      orderId: safeOrderId,
      ...(patch && typeof patch === 'object' ? patch : {}),
      changeId: `admin_${crypto.randomUUID().replaceAll('-', '')}`,
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

async function transitionStatus(orderId, status) {
  return updateEditedOrder(orderId, { status: String(status || '').trim() });
}

async function deleteOrder(orderId) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) throw new Error('Pedido inválido.');
  if (actorEmail() !== SUPER_ADMIN_EMAIL) {
    throw new Error('Solo Super Admin puede eliminar pedidos definitivamente.');
  }

  // La eliminación definitiva conserva su flujo de dos transacciones: primero
  // libera stock y marca el pedido como released; después elimina el documento.
  // Las ediciones normales y transiciones de estado usan el dominio server-side
  // compartido con Google Sheets.
  const releaseResult = await runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', safeOrderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) {
      return { orderId: safeOrderId, existed: false, restored: false, missingProducts: [] };
    }

    const order = orderSnapshot.data() || {};
    const items = normalizeInventoryItems(order.items || [], 100);
    const shouldRestore = orderReservesInventory(order);
    const refs = shouldRestore ? [...items.keys()].map(id => [id, productRef(id)]) : [];
    const snapshots = new Map();
    const missingProducts = [];

    for (const [id, ref] of refs) snapshots.set(id, await transaction.get(ref));

    if (shouldRestore) {
      for (const [id, qty] of items) {
        const snapshot = snapshots.get(id);
        if (!snapshot?.exists()) {
          missingProducts.push(id);
          continue;
        }
        const stock = finiteStock(snapshot.data()?.stock);
        if (stock === null) continue;
        transaction.update(snapshot.ref, {
          stock: stock + qty,
          lastInventoryOrderId: safeOrderId,
          lastInventoryAction: 'release',
          updatedAt: serverTimestamp()
        });
      }

      transaction.update(orderRef, {
        status: 'cancelado',
        inventoryState: 'released',
        inventoryRevision: Math.max(0, Number(order.inventoryRevision || 0)) + 1,
        inventoryUpdatedAt: serverTimestamp(),
        inventoryUpdatedBy: actorEmail(),
        updatedAt: serverTimestamp()
      });
    }

    return {
      orderId: safeOrderId,
      existed: true,
      restored: shouldRestore,
      missingProducts
    };
  }, { maxAttempts: 2 });

  if (!releaseResult.existed) {
    return { orderId: safeOrderId, deleted: false, restored: false, missingProducts: [] };
  }

  await runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', safeOrderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) return;
    if (orderReservesInventory(orderSnapshot.data() || {})) {
      throw new Error('El pedido cambió mientras se eliminaba. Volvé a intentarlo.');
    }
    transaction.delete(orderRef);
  }, { maxAttempts: 2 });

  return {
    orderId: safeOrderId,
    deleted: true,
    restored: releaseResult.restored,
    missingProducts: releaseResult.missingProducts
  };
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
      await runTransaction(db, async transaction => {
        const fresh = await transaction.get(orderSnap.ref);
        if (!fresh.exists()) return;
        const freshData = fresh.data() || {};
        if (freshData.inventoryState !== 'pending') return;
        transaction.delete(orderSnap.ref);
      }, { maxAttempts: 2 });
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
