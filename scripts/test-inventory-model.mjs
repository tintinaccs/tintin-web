import assert from 'node:assert/strict';
import {
  computeInventoryDeltas,
  inventoryStateForStatus,
  normalizeInventoryItems,
  orderReservesInventory
} from '../js/inventory-model.mjs';

function entries(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const active = {
  status: 'pendiente',
  inventoryState: 'reserved',
  items: [{ id: 'p1', qty: 2 }, { id: 'p2', qty: 1 }]
};

assert.deepEqual(entries(computeInventoryDeltas(active, { status: 'cancelado' }).deltas), {
  p1: -2,
  p2: -1
});
assert.equal(inventoryStateForStatus('cancelado'), 'released');

const released = { ...active, status: 'cancelado', inventoryState: 'released' };
assert.deepEqual(entries(computeInventoryDeltas(released, { status: 'rechazado' }).deltas), {});
assert.deepEqual(entries(computeInventoryDeltas(released, { status: 'confirmado' }).deltas), {
  p1: 2,
  p2: 1
});

assert.deepEqual(entries(computeInventoryDeltas(active, {
  items: [{ id: 'p1', qty: 3 }, { id: 'p2', qty: 1 }]
}).deltas), { p1: 1 });

assert.deepEqual(entries(computeInventoryDeltas(active, {
  items: [{ id: 'p1', qty: 1 }]
}).deltas), { p1: -1, p2: -1 });

assert.equal(orderReservesInventory({ status: 'pendiente' }), true);
assert.equal(orderReservesInventory({ status: 'cancelado' }), false);
assert.equal(orderReservesInventory({ status: 'cancelado', inventoryState: 'reserved' }), true);
assert.throws(() => normalizeInventoryItems([{ id: 'p1', qty: 0 }]), /inválido/);
assert.throws(() => normalizeInventoryItems([
  { id: '1', qty: 1 }, { id: '2', qty: 1 }, { id: '3', qty: 1 },
  { id: '4', qty: 1 }, { id: '5', qty: 1 }
]), /máximo/);

console.log('Inventario: 12 escenarios críticos verificados.');
