import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  computeInventoryDeltas,
  inventoryStateForStatus,
  normalizeInventoryItems,
  orderReservesInventory
} from './inventory-model.mjs?v=tintin-20260720-critical-healing-1';

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

  return runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', safeOrderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error('El pedido ya no existe.');

    const beforeOrder = orderSnapshot.data() || {};
    const nextPatch = patch && typeof patch === 'object' ? { ...patch } : {};
    const inventory = computeInventoryDeltas(beforeOrder, nextPatch);
    const refs = [...inventory.deltas.keys()].map(id => [id, productRef(id)]);
    const productSnapshots = new Map();

    for (const [id, ref] of refs) {
      productSnapshots.set(id, await transaction.get(ref));
    }

    for (const [id, reserveDelta] of inventory.deltas) {
      const snapshot = productSnapshots.get(id);
      if (!snapshot?.exists()) {
        throw new Error(`No se puede reconciliar el stock: el producto ${id} ya no existe.`);
      }
      const stock = finiteStock(snapshot.data()?.stock);
      if (stock === null) continue;
      const nextStock = stock - reserveDelta;
      if (nextStock < 0) {
        throw new Error(`Stock insuficiente para volver a activar o ampliar el pedido (${id}).`);
      }
      transaction.update(snapshot.ref, {
        stock: nextStock,
        lastInventoryOrderId: safeOrderId,
        lastInventoryAction: reserveDelta > 0 ? 'reserve' : 'release',
        updatedAt: serverTimestamp()
      });
    }

    const nextStatus = inventory.afterStatus;
    const nextRevision = Math.max(0, Number(beforeOrder.inventoryRevision || 0)) + 1;
    transaction.update(orderRef, {
      ...nextPatch,
      status: nextStatus,
      inventoryState: inventoryStateForStatus(nextStatus),
      inventoryRevision: nextRevision,
      inventoryUpdatedAt: serverTimestamp(),
      inventoryUpdatedBy: actorEmail(),
      updatedAt: serverTimestamp()
    });

    return {
      orderId: safeOrderId,
      status: nextStatus,
      inventoryState: inventoryStateForStatus(nextStatus),
      changedProducts: inventory.deltas.size
    };
  }, { maxAttempts: 2 });
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

  // Se hace en dos transacciones deliberadamente. Primero el pedido queda
  // marcado como released junto con la devolución de stock. Solo después se
  // elimina. Si la segunda operación falla o la pestaña se cierra, un reintento
  // ve inventoryState=released y no puede devolver el stock dos veces. Además,
  // este orden funciona con las reglas que ya están publicadas en producción.
  const releaseResult = await runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', safeOrderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) {
      return { orderId: safeOrderId, existed: false, restored: false, missingProducts: [] };
    }

    const order = orderSnapshot.data() || {};
    const items = normalizeInventoryItems(order.items || []);
    const shouldRestore = orderReservesInventory(order);
    const refs = shouldRestore ? [...items.keys()].map(id => [id, productRef(id)]) : [];
    const snapshots = new Map();
    const missingProducts = [];

    for (const [id, ref] of refs) snapshots.set(id, await transaction.get(ref));

    if (shouldRestore) {
      for (const [id, qty] of items) {
        const snapshot = snapshots.get(id);
        if (!snapshot?.exists()) {
          // Los pedidos históricos deben poder eliminarse aunque uno de sus
          // productos ya haya sido retirado del catálogo. No hay documento de
          // stock que restaurar en ese caso; el resto sí se reconcilia dentro
          // de la misma transacción.
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

// Un pedido queda en inventoryState='pending' (status='inventory_pending')
// mientras corre createPendingOrder() → reserveOrderInventory() en el
// checkout. Si la clienta cierra la pestaña justo entre esos dos pasos, el
// borrador nunca reserva stock real (no hay riesgo de inventario) pero
// queda huérfano en Firestore para siempre — nadie vuelve a referenciarlo
// porque el requestId vivía solo en el sessionStorage de esa pestaña. Esta
// limpieza los borra directamente (sin la reconciliación de stock de
// deleteOrder(), porque un pedido 'pending' nunca llegó a descontar nada).
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
        // Re-chequeado dentro de la transacción: si en el momento de borrar
        // ya avanzó a 'reserved' (la clienta volvió y confirmó su pedido
        // real), no se toca — solo se limpian los que siguen abandonados.
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
