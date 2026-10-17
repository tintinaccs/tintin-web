import test from 'node:test';
import assert from 'node:assert/strict';
import { moveOrderTrash, selectedReturns } from '../../cloudflare/order-trash-controls.js';
import { resetStatistics } from '../../cloudflare/statistics-controls.js';
import { statisticsSince } from '../../js/admin/statistics/modelo-reinicios.mjs';
import { createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { decodeFirestoreFields as decode, encodeFirestoreFields as encode } from '../../cloudflare/firebase-admin-ligero.js';
const actor = { uid: 'owner_fixture', email: 'owner@example.test', role: 'superadmin' };
const order = { status: 'entregado', paymentStatus: 'pagado', inventoryState: 'reserved', lastChangeId: 'before', total: 200,
  items: [{ id: 'product_one', name: 'QA', qty: 2, price: 100 }], userId: 'customer_fixture' };
function store(extra = {}) {
  let version = 1;
  const map = new Map(Object.entries({ 'orders/order_test': order, 'products/product_one': { stock: 8, price: 100 }, ...extra })
    .map(([path, data]) => [path, { name: `projects/demo/databases/(default)/documents/${path}`, fields: encode(data), updateTime: 'v1' }]));
  const writes = [];
  return { map, writes, get: async (_, path) => structuredClone(map.get(path) || null),
    batchGet: async (_, paths) => paths.map(path => structuredClone(map.get(path))).filter(Boolean),
    commit: async (_, list) => {
      for (const write of list) {
        const current = map.get(write.path), condition = write.currentDocument;
        if (condition && (condition.exists === false && current || condition.exists === true && !current || condition.updateTime && current?.updateTime !== condition.updateTime)) throw Object.assign(new Error('Conflicto'), { status: 409 });
      }
      writes.push(list); version++;
      for (const write of list) {
        if (write.delete) { map.delete(write.path); continue; }
        const data = write.mergeFields ? { ...decode(map.get(write.path)?.fields || {}), ...decode(write.fields) } : decode(write.fields);
        map.set(write.path, { name: `projects/demo/databases/(default)/documents/${write.path}`, fields: encode(data), updateTime: `v${version}` });
      }
    }, data: path => decode(map.get(path)?.fields || {}) };
}
const input = (qty = 0) => ({ action: 'trashOrder', orderId: 'order_test', changeId: 'trash_test', baseChangeId: 'before', reason: 'Motivo QA', returnItems: [{ index: 0, qty }] });
for (const qty of [0, 1, 2]) test(`borrar devuelve exactamente ${qty}; restaurar invierte sólo esa decisión`, async () => {
  const deps = store();
  await moveOrderTrash({}, input(qty), actor, deps);
  assert.equal(deps.map.has('orders/order_test'), false);
  assert.equal(deps.data('products/product_one').stock, 8 + qty);
  assert.equal(deps.data('products/product_one').price, 100);
  assert.equal(deps.data('orderTrash/order_test').total, 200);
  assert.equal(deps.data('auditLog/trash_test').notes, 'Motivo QA');
  const duplicate = await moveOrderTrash({}, input(qty), actor, deps);
  assert.equal(duplicate.duplicate, true); assert.equal(deps.writes.length, 1);
  await moveOrderTrash({}, { action: 'restoreOrder', orderId: 'order_test', changeId: 'restore_test', baseChangeId: 'trash_test' }, actor, deps);
  assert.equal(deps.data('products/product_one').stock, 8);
  assert.equal(deps.data('orders/order_test').status, 'entregado');
  assert.equal(deps.data('orders/order_test').paymentStatus, 'pagado');
  assert.equal(deps.data('orders/order_test').inventoryState, 'reserved');
  assert.equal(deps.map.has('orderTrash/order_test'), false);
});
test('no inventa reposición en pedidos nunca descontados y valida cantidades e índices', () => {
  assert.throws(() => selectedReturns({ ...order, inventoryState: 'unreserved' }, [{ index: 0, qty: 1 }]));
  for (const choice of [[{ index: 0, qty: 3 }], [{ index: 0, qty: -1 }], [{ index: 2, qty: 0 }], [{ index: 0, qty: 0.5 }], [{ index: 0, qty: 1 }, { index: 0, qty: 1 }]]) assert.throws(() => selectedReturns(order, choice));
});
test('otro rol y una edición concurrente no pueden borrar ni reponer', async () => {
  const deps = store();
  await assert.rejects(moveOrderTrash({}, input(2), { ...actor, role: 'admin' }, deps), error => error.status === 403);
  await assert.rejects(moveOrderTrash({}, { ...input(2), baseChangeId: 'old' }, actor, deps), error => error.status === 409);
  assert.equal(deps.writes.length, 0); assert.equal(deps.data('products/product_one').stock, 8);
});
test('una venta local no se modifica desde el libro de pedidos web', async () => {
  const deps = store({ 'orders/order_test': { ...order, localEntryId: 'local_entry' } });
  await assert.rejects(moveOrderTrash({}, input(), actor, deps), /Ventas locales/); assert.equal(deps.writes.length, 0);
});
test('sin stock para restaurar no restaura el pedido ni cambia ninguna unidad', async () => {
  const deps = store(); await moveOrderTrash({}, input(2), actor, deps);
  deps.map.get('products/product_one').fields = encode({ stock: 1 });
  await assert.rejects(moveOrderTrash({}, { action: 'restoreOrder', orderId: 'order_test', changeId: 'restore_test', baseChangeId: 'trash_test' }, actor, deps), /Stock insuficiente/);
  assert.equal(deps.map.has('orders/order_test'), false); assert.equal(deps.writes.length, 1);
});
test('una variante repone y vuelve a descontar sólo su inventario registrado', async () => {
  const items = [{ id: 'product_one', variant: 'Rosa', qty: 2 }];
  const deps = store({ 'orders/order_test': { ...order, items, variantInventoryItems: items },
    'products/product_one': { stock: 8, variantInventory: [{ variant: 'Rosa', stock: 3 }, { variant: 'Azul', stock: 5 }] } });
  await moveOrderTrash({}, input(1), actor, deps);
  assert.deepEqual(deps.data('products/product_one').variantInventory.map(row => row.stock), [4, 5]);
  await moveOrderTrash({}, { action: 'restoreOrder', orderId: 'order_test', changeId: 'restore_test', baseChangeId: 'trash_test' }, actor, deps);
  assert.deepEqual(deps.data('products/product_one').variantInventory.map(row => row.stock), [3, 5]);
});
test('no adivina la reserva de variantes históricas', async () => {
  const deps = store({ 'products/product_one': { stock: 8, variantInventory: [{ variant: 'Rosa', stock: 8 }] } });
  await assert.rejects(moveOrderTrash({}, input(1), actor, deps), /reserva histórica/); assert.equal(deps.writes.length, 0);
});
test('reinicio conserva otros contadores, registra auditoría y no toca pedidos ni stock', async () => {
  const deps = store(), now = new Date('2026-10-17T20:00:00Z');
  const first = await resetStatistics({}, { metrics: ['revenue'], changeId: 'reset_one', baseChangeId: '' }, actor, { ...deps, now: () => now });
  const second = await resetStatistics({}, { metrics: ['orders'], changeId: 'reset_two', baseChangeId: 'reset_one' }, actor, { ...deps, now: () => new Date(now.getTime() + 10) });
  assert.equal(new Date(second.resets.revenue).getTime(), new Date(first.resets.revenue).getTime());
  assert.equal(deps.data('orders/order_test').total, 200); assert.equal(deps.data('products/product_one').stock, 8);
  assert.ok(deps.map.has('auditLog/reset_one')); assert.ok(deps.map.has('auditLog/reset_two'));
  await resetStatistics({}, { metrics: ['orders'], changeId: 'reset_two', baseChangeId: 'old' }, actor, deps);
  assert.equal(deps.writes.length, 2);
});
test('reinicio rechaza claves arbitrarias, solicitudes vacías, permisos y datos obsoletos', async () => {
  const deps = store();
  for (const metrics of [[], ['unknown'], ['revenue', 'revenue'], ['__proto__']]) await assert.rejects(resetStatistics({}, { metrics, changeId: 'reset_test', baseChangeId: '' }, actor, deps));
  await assert.rejects(resetStatistics({}, { metrics: ['revenue'], changeId: 'reset_test', baseChangeId: '' }, { ...actor, role: 'admin' }, deps));
  await assert.rejects(resetStatistics({}, { metrics: ['revenue'], changeId: 'reset_test', baseChangeId: 'stale' }, actor, deps));
  assert.equal(deps.writes.length, 0);
});
test('el reinicio por fecha admite nuevos pedidos aunque después se borren históricos', () => {
  const old = { at: 100, total: 1000 }, fresh = { at: 300, total: 50 };
  const resets = { revenue: new Date(200) };
  assert.deepEqual(statisticsSince([old, fresh], 'revenue', resets, row => row.at), [fresh]);
  assert.deepEqual(statisticsSince([fresh], 'revenue', resets, row => row.at), [fresh]);
  assert.deepEqual(statisticsSince([old, fresh], 'orders', resets, row => row.at), [old, fresh]);
});
test('restablecer historial seleccionado conserva otros reinicios y todos los datos', async () => {
  const deps = store();
  await resetStatistics({}, { metrics: ['orders', 'revenue'], changeId: 'reset_both', baseChangeId: '' }, actor, deps);
  const result = await resetStatistics({}, { metrics: ['revenue'], mode: 'history', changeId: 'restore_history', baseChangeId: 'reset_both' }, actor, deps);
  assert.equal(Object.hasOwn(result.resets, 'revenue'), false); assert.ok(result.resets.orders);
  assert.equal(deps.data('orders/order_test').total, 200);
});
test('un reintento antiguo del checkout no recrea un pedido que está en Borrados', async () => {
  const deps = store(); await moveOrderTrash({}, input(2), actor, deps);
  await assert.rejects(createOrderAdmin({}, { orderId: 'order_test', userName: 'QA', status: 'pendiente', items: order.items }, actor, deps), error => error.code === 'order_archived');
  assert.equal(deps.map.has('orders/order_test'), false); assert.equal(deps.writes.length, 1);
});
test('conflicto de inventario rechaza todo el lote, incluida la eliminación del pedido', async () => {
  const deps = store(); const original = deps.commit;
  deps.commit = async (env, writes) => {
    deps.map.get('products/product_one').updateTime = 'another-session';
    return original(env, writes);
  };
  await assert.rejects(moveOrderTrash({}, input(2), actor, deps), error => error.status === 409);
  assert.equal(deps.map.has('orders/order_test'), true); assert.equal(deps.map.has('orderTrash/order_test'), false);
  assert.equal(deps.data('products/product_one').stock, 8);
});
