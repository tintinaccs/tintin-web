const TERMINAL_STATUSES = new Set(['cancelado', 'rechazado']);

export function normalizeInventoryItems(items, maxDistinct = 4) {
  const grouped = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    const id = String(raw?.id || '').trim();
    const qty = Number(raw?.qty ?? raw?.quantity ?? 0);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error('El pedido contiene una cantidad o producto inválido.');
    }
    grouped.set(id, (grouped.get(id) || 0) + qty);
  }
  if (!grouped.size) throw new Error('El pedido debe contener al menos un producto.');
  if (grouped.size > maxDistinct) throw new Error(`El pedido supera el máximo de ${maxDistinct} productos distintos.`);
  for (const qty of grouped.values()) {
    if (qty > 99) throw new Error('La cantidad acumulada de un producto supera 99 unidades.');
  }
  return grouped;
}

export function statusReservesInventory(status) {
  return !TERMINAL_STATUSES.has(String(status || 'pendiente'));
}

export function orderReservesInventory(order) {
  const state = String(order?.inventoryState || '');
  if (state === 'reserved') return true;
  if (state === 'released') return false;
  return statusReservesInventory(order?.status);
}

export function computeInventoryDeltas(beforeOrder, patch = {}) {
  const beforeItems = normalizeInventoryItems(beforeOrder?.items || []);
  const afterItems = normalizeInventoryItems(
    Object.prototype.hasOwnProperty.call(patch, 'items') ? patch.items : beforeOrder?.items || []
  );
  const beforeReserved = orderReservesInventory(beforeOrder);
  const afterStatus = Object.prototype.hasOwnProperty.call(patch, 'status')
    ? patch.status
    : beforeOrder?.status;
  const afterReserved = statusReservesInventory(afterStatus);
  const ids = new Set([...beforeItems.keys(), ...afterItems.keys()]);
  const deltas = new Map();

  for (const id of ids) {
    const beforeQty = beforeReserved ? (beforeItems.get(id) || 0) : 0;
    const afterQty = afterReserved ? (afterItems.get(id) || 0) : 0;
    const reserveDelta = afterQty - beforeQty;
    if (reserveDelta !== 0) deltas.set(id, reserveDelta);
  }

  return {
    afterReserved,
    afterStatus: String(afterStatus || 'pendiente'),
    deltas
  };
}

export function inventoryStateForStatus(status) {
  return statusReservesInventory(status) ? 'reserved' : 'released';
}
