import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryReservationReview } from '../../js/core/store/revision-reservas-inventario.mjs';

test('solo reservas vigentes y proyección sin información de clientes', () => {
  const orders = [
    { id: 'o1', inventoryState: 'reserved', status: 'confirmado', userEmail: 'private@test.local', shipping: { address: 'PRIVATE_ADDRESS' }, items: [{ id: 'p1', qty: 2, name: 'PRIVATE_ITEM_NAME' }], variantInventoryItems: [{ id: 'p1', variant: 'Azul', qty: 2 }], payment: { token: 'PRIVATE_TOKEN' } },
    { id: 'o2', inventoryState: 'unreserved', status: 'pendiente', items: [{ id: 'p1', qty: 9 }] },
    { id: 'o3', inventoryState: 'released', status: 'cancelado', items: [{ id: 'p1', qty: 4 }] }
  ];
  const before = JSON.stringify(orders);
  const report = buildInventoryReservationReview(orders);
  assert.deepEqual(report.summary, { ordersChecked: 3, reservedOrders: 1, legacyOrders: 0, affectedProducts: 1, reservedQty: 2, issues: 0 });
  assert.equal(report.products[0].variantUnassignedQty, 0);
  assert.doesNotMatch(JSON.stringify(report), /private@test|PRIVATE_/);
  assert.equal(JSON.stringify(orders), before);
});

test('reservas antiguas sin estado se señalan y nunca se atribuyen a una variante', () => {
  const report = buildInventoryReservationReview([{ id: 'old', status: 'pendiente', items: [{ productId: 'p1', quantity: 3, variant: 'Rojo' }] }]);
  assert.equal(report.products[0].legacyQty, 3);
  assert.equal(report.products[0].variantUnassignedQty, 3);
  assert.deepEqual(report.reservations[0].variantInventoryItems, []);
  assert.equal(report.issues[0].code, 'LEGACY_RESERVATION_REQUIRES_REVIEW');
});

test('cantidades, matrices y pedidos sin líneas válidas quedan visibles como incidencias', () => {
  const report = buildInventoryReservationReview([
    { id: 'bad', inventoryState: 'reserved', items: [{ id: 'p1', qty: -2 }], variantInventoryItems: 'INVALID' },
    { id: 'mismatch', inventoryState: 'reserved', items: [{ id: 'p2', qty: 1 }], variantInventoryItems: [{ id: 'p2', qty: 2, variant: 'L' }] }
  ]);
  assert.equal(report.summary.ordersChecked, 2);
  for (const code of ['INVALID_INVENTORY_ITEM', 'RESERVED_ORDER_WITHOUT_VALID_ITEMS', 'INVALID_VARIANT_RESERVATION', 'VARIANT_AGGREGATE_MISMATCH']) assert.ok(report.issues.some(issue => issue.code === code));
});

test('estado reservado terminal y cantidad acumulada excesiva no se ocultan', () => {
  const report = buildInventoryReservationReview([{ id: 'conflict', inventoryState: 'reserved', status: 'cancelado', items: [{ id: 'p', qty: 60 }, { id: 'p', qty: 60 }] }]);
  assert.ok(report.issues.some(issue => issue.code === 'TERMINAL_ORDER_STILL_RESERVED'));
  assert.ok(report.issues.some(issue => issue.code === 'INVALID_AGGREGATE_QUANTITY'));
  assert.equal(report.products[0].reservedQty, 120);
});
