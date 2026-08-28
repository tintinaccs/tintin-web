import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { MAX_ADMIN_BATCH_WRITES } from '../../cloudflare/firestore-admin-batch.js';
import { applyOrderAdminMutation } from '../../cloudflare/order-admin-domain.js';

function document(data, updateTime = '2026-08-27T18:00:00.000000Z') {
  return { fields: encodeFirestoreFields(data), updateTime };
}

function harness({ order, products = {} }) {
  const reads = [];
  const commits = [];
  const get = async (_env, path) => {
    reads.push(path);
    if (path.startsWith('orders/')) return document(order, '2026-08-27T18:00:00.000000Z');
    if (path.startsWith('products/')) {
      const id = decodeURIComponent(path.slice('products/'.length));
      return Object.prototype.hasOwnProperty.call(products, id)
        ? document(products[id], `2026-08-27T18:00:${String(Object.keys(products).indexOf(id)).padStart(2, '0')}.000000Z`)
        : null;
    }
    return null;
  };
  const commit = async (_env, writes) => {
    commits.push(writes);
    return { commitTime: '2026-08-27T18:01:00Z' };
  };
  return { reads, commits, deps: { get, commit } };
}

const actor = { uid: 'google-sheets', email: 'google-sheets@tintin.internal', role: 'sheets-sync', origin: 'google-sheets:Pedidos web' };

function baseOrder(overrides = {}) {
  return {
    status: 'pendiente',
    paymentStatus: 'pendiente',
    payment: { method: 'transferencia', status: 'pendiente' },
    items: [{ id: 'prod_A', name: 'A', price: 50000, qty: 2 }],
    subtotal: 100000,
    shippingCost: 25000,
    total: 125000,
    inventoryState: 'reserved',
    inventoryRevision: 3,
    lastChangeId: 'change_old_123',
    customerId: 'CUS_test',
    ...overrides,
  };
}

test('cancelar desde Sheets libera stock y audita en el mismo lote', async () => {
  const h = harness({ order: baseOrder(), products: { prod_A: { stock: 5 } } });
  const result = await applyOrderAdminMutation({}, {
    orderId: 'order_123456', status: 'cancelado', changeId: 'change_new_123', baseChangeId: 'change_old_123',
  }, actor, h.deps);

  assert.equal(result.status, 'cancelado');
  assert.equal(result.inventoryState, 'released');
  assert.equal(result.changedProducts, 1);
  assert.equal(h.commits.length, 1);
  const writes = h.commits[0];
  assert.equal(writes.length, 3);
  const productWrite = writes.find(write => write.path === 'products/prod_A');
  assert.equal(decodeFirestoreFields(productWrite.fields).stock, 7);
  assert.deepEqual(productWrite.currentDocument, { updateTime: '2026-08-27T18:00:00.000000Z' });
  const orderWrite = writes.find(write => write.path === 'orders/order_123456');
  const orderPatch = decodeFirestoreFields(orderWrite.fields);
  assert.equal(orderPatch.inventoryState, 'released');
  assert.equal(orderPatch.lastChangeId, 'change_new_123');
  assert.ok(writes.some(write => write.path.startsWith('auditLog/')));
});

test('reactivar un pedido reserva stock y rechaza si no alcanza', async () => {
  const order = baseOrder({ status: 'cancelado', inventoryState: 'released' });
  const h = harness({ order, products: { prod_A: { stock: 1 } } });
  await assert.rejects(
    () => applyOrderAdminMutation({}, {
      orderId: 'order_123456', status: 'confirmado', changeId: 'change_new_456', baseChangeId: 'change_old_123',
    }, actor, h.deps),
    /Stock insuficiente/,
  );
  assert.equal(h.commits.length, 0);
});

test('un cambio solo de pago no toca productos ni stock', async () => {
  const h = harness({ order: baseOrder(), products: { prod_A: { stock: 5 } } });
  const result = await applyOrderAdminMutation({}, {
    orderId: 'order_123456', paymentStatus: 'pagado', changeId: 'change_pay_123', baseChangeId: 'change_old_123',
  }, actor, h.deps);
  assert.equal(result.changedProducts, 0);
  assert.deepEqual(h.reads, ['orders/order_123456']);
  assert.equal(h.commits[0].length, 2);
  const patch = decodeFirestoreFields(h.commits[0].find(write => write.path === 'orders/order_123456').fields);
  assert.equal(patch.paymentStatus, 'pagado');
  assert.equal(patch.inventoryState, 'reserved');
});

test('baseChangeId viejo bloquea una edición de Sheets', async () => {
  const h = harness({ order: baseOrder() });
  await assert.rejects(
    () => applyOrderAdminMutation({}, {
      orderId: 'order_123456', status: 'preparando', changeId: 'change_new_789', baseChangeId: 'otra_version',
    }, actor, h.deps),
    error => error?.status === 409 && error?.code === 'stale_order',
  );
  assert.equal(h.commits.length, 0);
});

test('changeId repetido es idempotente y no vuelve a escribir', async () => {
  const h = harness({ order: baseOrder({ lastChangeId: 'same_change_123' }) });
  const result = await applyOrderAdminMutation({}, {
    orderId: 'order_123456', status: 'cancelado', changeId: 'same_change_123', baseChangeId: 'same_change_123',
  }, actor, h.deps);
  assert.equal(result.duplicate, true);
  assert.equal(h.commits.length, 0);
});

test('un pedido histórico con 20 productos cabe en el lote administrativo seguro', async () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `prod_${String(index).padStart(2, '0')}`, name: `P${index}`, price: 1000, qty: 1,
  }));
  const products = Object.fromEntries(items.map(item => [item.id, { stock: 2 }]));
  const h = harness({ order: baseOrder({ items, subtotal: 20000, total: 45000 }), products });
  await applyOrderAdminMutation({}, {
    orderId: 'order_historico_20', status: 'cancelado', changeId: 'change_big_123', baseChangeId: 'change_old_123',
  }, actor, h.deps);
  assert.equal(h.commits[0].length, 22);
  assert.ok(h.commits[0].length <= MAX_ADMIN_BATCH_WRITES);
  assert.equal(h.commits[0].filter(write => write.path.startsWith('products/')).length, 20);
});

test('estados fuera del contrato son rechazados antes de escribir', async () => {
  const h = harness({ order: baseOrder() });
  await assert.rejects(
    () => applyOrderAdminMutation({}, {
      orderId: 'order_123456', status: 'inventado', changeId: 'change_bad_123', baseChangeId: 'change_old_123',
    }, actor, h.deps),
    /Estado de pedido no permitido/,
  );
  assert.equal(h.commits.length, 0);
});
