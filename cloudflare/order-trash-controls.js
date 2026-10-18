import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet, firestoreAdminBatchGet } from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';
import { orderReservesInventory } from '../js/core/store/modelo-inventario.mjs';
import { variantInventoryEntries, applyVariantInventoryDeltas, normalizeVariantSelection } from '../js/core/store/inventario-variantes.mjs';

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{6,220}$/.test(value);
const condition = document => document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

// Las cantidades siempre salen del snapshot canónico, nunca del precio/stock
// enviado por el navegador. Una línea puede reponerse sólo hasta lo descontado.
export function selectedReturns(order, selection) {
  if (!Array.isArray(selection) || selection.length > 250) fail('Seleccioná las cantidades que querés devolver.');
  const seen = new Set();
  const items = selection.map(row => {
    if (!Number.isInteger(row?.index) || seen.has(row.index)) fail('Selección de productos inválida.');
    seen.add(row.index);
    const item = order.items?.[row.index];
    const bought = Number(item?.qty ?? item?.quantity);
    if (!item || !Number.isSafeInteger(bought) || bought < 1 || !Number.isInteger(row.qty) || row.qty < 0 || row.qty > bought) fail('Cantidad a devolver inválida.');
    return { id: String(item.id || ''), variant: normalizeVariantSelection(item.variant), qty: row.qty };
  }).filter(item => item.qty > 0);
  if (items.length && !orderReservesInventory(order)) fail('Este pedido no tiene stock descontado para devolver.');
  return items;
}

async function inventoryWrites(env, order, returned, restore, deps) {
  const ids = [...new Set(returned.map(item => item.id))];
  if (ids.length > 100 || ids.some(id => !/^[A-Za-z0-9_-]{1,180}$/.test(id))) fail('Productos del pedido inválidos.');
  if (!ids.length) return [];
  const docs = await deps.batchGet(env, ids.map(id => `products/${id}`));
  const byId = new Map(docs.map(document => [document.name.split('/').pop(), document]));
  return ids.map(id => {
    const document = byId.get(id);
    if (!document) fail(`El producto ${id} ya no existe. Elegí no devolverlo o recuperá primero el producto.`, 409);
    const product = decodeFirestoreFields(document.fields || {});
    const lines = returned.filter(item => item.id === id);
    const quantity = lines.reduce((sum, item) => sum + item.qty, 0);
    const stock = product.stock;
    const patch = { updatedAt: new Date(), lastInventoryAction: restore ? 'restore-order' : 'trash-order' };
    if (stock !== null && stock !== undefined && stock !== '') {
      if (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0) fail('Stock actual inválido.', 409);
      const next = Number(stock) + (restore ? -quantity : quantity);
      if (!Number.isSafeInteger(next) || next < 0 || next > 1000000) fail('Stock insuficiente o fuera de rango para esta operación.', 409);
      patch.stock = next;
    }
    if (variantInventoryEntries(product) !== null) {
      const recorded = order.variantInventoryItems || [];
      for (const line of lines) {
        const reserved = recorded.filter(item => item.id === id && normalizeVariantSelection(item.variant) === line.variant)
          .reduce((sum, item) => sum + Number(item.qty || 0), 0);
        const selected = lines.filter(item => item.variant === line.variant).reduce((sum, item) => sum + item.qty, 0);
        if (!Number.isSafeInteger(reserved) || reserved < selected) fail('La reserva histórica de esta variante requiere revisión; no se adivina su stock.', 409);
      }
      patch.variantInventory = applyVariantInventoryDeltas(product, lines.map(item => ({ ...item, qty: (restore ? 1 : -1) * item.qty })));
    }
    return { path: `products/${id}`, fields: encodeFirestoreFields(patch), mergeFields: Object.keys(patch), currentDocument: condition(document) };
  });
}

export async function moveOrderTrash(env, input, actor, { get = firestoreAdminGet, batchGet = firestoreAdminBatchGet, commit = firestoreAdminBatchCommit } = {}) {
  if (actor?.role !== 'superadmin') fail('Esta acción es exclusiva de Super Admin.', 403);
  const { orderId, changeId, baseChangeId } = input;
  if (!validId(orderId) || !validId(changeId) || typeof baseChangeId !== 'string') fail('Solicitud de pedido inválida.');
  const restore = input.action === 'restoreOrder';
  if (!restore && input.action !== 'trashOrder') fail('Acción no permitida.');
  const from = `${restore ? 'orderTrash' : 'orders'}/${orderId}`;
  const to = `${restore ? 'orders' : 'orderTrash'}/${orderId}`;
  const source = await get(env, from);
  const destination = await get(env, to);
  if (!source) {
    const data = destination ? decodeFirestoreFields(destination.fields || {}) : null;
    if (data?.trashMeta?.changeId === changeId || data?.lastChangeId === changeId) {
      return { orderId, moved: !restore, restored: restore, duplicate: true, order: data };
    }
    fail('El pedido ya no está en esta lista. Actualizá los datos.', 409);
  }
  if (destination) fail('El pedido ya existe en la lista de destino.', 409);
  const order = decodeFirestoreFields(source.fields || {});
  if (order.localEntryId) fail('Esta venta se administra desde Ventas locales.', 409);
  const version = restore ? (order.trashMeta?.changeId || order.lastChangeId || '') : (order.lastChangeId || '');
  if (version !== baseChangeId) fail('El pedido cambió en otra sesión. Actualizá los datos.', 409);
  const returned = restore ? (order.trashMeta?.returnedItems || []) : selectedReturns(order, input.returnItems);
  const writes = await inventoryWrites(env, order, returned, restore, { batchGet });
  const now = new Date();
  const after = { ...order, updatedAt: now, lastChangeId: changeId };
  if (restore) {
    delete after.trashMeta;
    after.restoredAt = now;
    after.restoredBy = actor.email;
  } else {
    after.originalOrderId = orderId;
    after.trashMeta = { reason: String(input.reason || '').slice(0, 500), originalStatus: order.status || 'pendiente',
      trashedAt: now, trashedBy: actor.email, changeId, returnedItems: returned };
  }
  writes.push(
    { path: to, fields: encodeFirestoreFields(after), currentDocument: { exists: false } },
    { path: from, delete: true, currentDocument: condition(source) },
    { path: `auditLog/${changeId}`, fields: encodeFirestoreFields({ action: restore ? 'restaurar_pedido' : 'mover_pedido_borrados',
      entityType: 'pedido', entityId: orderId, actorId: actor.uid, actorEmail: actor.email, actorRole: 'superadmin',
      createdAt: now, timestamp: now, returnedItems: returned, notes: restore ? 'Restauración de pedido archivado' : String(input.reason || '').slice(0, 500), result: 'success' }), currentDocument: { exists: false } },
    { path: 'settings/siteRevision', fields: encodeFirestoreFields({ revision: changeId, updatedAt: now }), mergeFields: ['revision', 'updatedAt'] },
  );
  await commit(env, writes);
  return { orderId, order: after, orderBefore: order, moved: !restore, restored: restore, returnedItems: returned, duplicate: false };
}
