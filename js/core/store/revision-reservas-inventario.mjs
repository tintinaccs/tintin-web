import { orderReservesInventory } from './modelo-inventario.mjs?v=tintin-20261001-stock-pago-1';
import { normalizeVariantInventoryItems } from './inventario-variantes.mjs?v=tintin-20261003-variant-inventory-1';

// Read-only projection. Never spreads order documents: customer, payment and
// address fields do not belong in an inventory reconciliation export.
export function buildInventoryReservationReview(orders = []) {
  if (!Array.isArray(orders)) throw new Error('La lista de pedidos no es válida.');
  const reservations = [];
  const issues = [];
  const products = new Map();
  let legacyOrders = 0;
  for (const order of orders) {
    const orderId = String(order?.id || '');
    const inventoryState = String(order?.inventoryState || '');
    const legacy = !['reserved', 'released', 'unreserved'].includes(inventoryState);
    if (legacy) legacyOrders++;
    if (!orderReservesInventory(order)) continue;
    if (['cancelado', 'rechazado'].includes(order?.status)) issues.push({ orderId, code: 'TERMINAL_ORDER_STILL_RESERVED' });
    if (legacy) issues.push({ orderId, code: 'LEGACY_RESERVATION_REQUIRES_REVIEW' });
    const items = [];
    for (const raw of Array.isArray(order?.items) ? order.items : []) {
      const productId = String(raw?.id || raw?.productId || '').trim();
      const qty = Number(raw?.qty ?? raw?.quantity);
      if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        issues.push({ orderId, code: 'INVALID_INVENTORY_ITEM' });
        continue;
      }
      items.push({ id: productId, qty });
    }
    if (!items.length) issues.push({ orderId, code: 'RESERVED_ORDER_WITHOUT_VALID_ITEMS' });
    let variants = [];
    try { variants = normalizeVariantInventoryItems(order?.variantInventoryItems || []); }
    catch { issues.push({ orderId, code: 'INVALID_VARIANT_RESERVATION' }); }
    const aggregate = new Map();
    for (const item of items) aggregate.set(item.id, (aggregate.get(item.id) || 0) + item.qty);
    for (const [productId, qty] of aggregate) if (qty > 99) issues.push({ orderId, productId, code: 'INVALID_AGGREGATE_QUANTITY' });
    const tracked = new Map();
    for (const item of variants) tracked.set(item.id, (tracked.get(item.id) || 0) + item.qty);
    for (const [productId, qty] of tracked) {
      if (qty !== aggregate.get(productId)) issues.push({ orderId, productId, code: 'VARIANT_AGGREGATE_MISMATCH' });
    }
    for (const [productId, qty] of aggregate) {
      if (!products.has(productId)) products.set(productId, { id: productId, reservedQty: 0, legacyQty: 0, variantUnassignedQty: 0, orderIds: [] });
      const product = products.get(productId);
      product.reservedQty += qty;
      if (legacy) product.legacyQty += qty;
      if (!tracked.has(productId)) product.variantUnassignedQty += qty;
      product.orderIds.push(orderId);
    }
    reservations.push({ orderId, status: String(order?.status || 'pendiente'), inventoryState,
      legacy, items, variantInventoryItems: variants });
  }
  return { format: 'tintin-inventory-reservation-review', schemaVersion: 1, readOnly: true,
    excludes: ['customer', 'addresses', 'payments', 'emails', 'phones'],
    summary: { ordersChecked: orders.length, reservedOrders: reservations.length, legacyOrders,
      affectedProducts: products.size, reservedQty: [...products.values()].reduce((sum, product) => sum + product.reservedQty, 0), issues: issues.length },
    note: 'No recalcula ni modifica stock. Las reservas anteriores sin estado explícito requieren revisión; no asignar sus cantidades a variantes por suposición.',
    products: [...products.values()], reservations, issues };
}
