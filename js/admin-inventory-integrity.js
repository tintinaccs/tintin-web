import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  doc,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  computeInventoryDeltas,
  inventoryStateForStatus,
  normalizeInventoryItems,
  orderReservesInventory
} from './inventory-model.mjs?v=tintin-20260720-critical-healing-1';

const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';

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

  return runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', safeOrderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) return { orderId: safeOrderId, deleted: false };

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
    }

    transaction.delete(orderRef);
    return {
      orderId: safeOrderId,
      deleted: true,
      restored: shouldRestore,
      missingProducts
    };
  }, { maxAttempts: 2 });
}

window.TintinInventoryIntegrity = Object.freeze({
  updateEditedOrder,
  transitionStatus,
  deleteOrder
});
