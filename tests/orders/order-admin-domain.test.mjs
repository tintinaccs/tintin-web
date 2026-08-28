import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOrderAdminMutation,
  createOrderAdmin,
} from '../../cloudflare/order-admin-domain.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
} from '../../cloudflare/firebase-admin-ligero.js';

const UPDATED = '2026-08-27T19:00:00.000Z';

function document(path, data, updateTime = UPDATED) {
  return {
    name: `projects/test/databases/(default)/documents/${path}`,
    fields: encodeFirestoreFields(data),
    updateTime,
  };
}

function fakeStore(entries = {}) {
  const map = new Map(Object.entries(entries));
  const commits = [];
  return {
    commits,
    get: async (_env, path) => map.get(decodeURIComponent(path)) || null,
    commit: async (_env, writes) => {
      commits.push(writes);
      return { writeResults: writes.map(() => ({})) };
    },
  };
}

function writeFor(writes, prefix) {
  return writes.find(write => String(write.path || '').startsWith(prefix));
}

test('crear pedido manual usa precio canónico, calcula total, reserva stock y asigna TINPED', async () => {
  const store = fakeStore({
    'products/prod_001': document('products/prod_001', {
      name: 'ARO CANÓNICO',
      category: 'aros',
      price: 50000,
      stock: 4,
      active: true,
      imageUrl: 'https://cdn.example.test/aro.png',
    }),
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 12,
      lastCode: 'TINPED12',
    }),
  });

  const result = await createOrderAdmin({}, {
    userName: 'Cliente Manual',
    userPhone: '0981000000',
    contactEmail: 'cliente@example.com',
    shippingMethod: 'delivery',
    shippingCity: 'San Lorenzo',
    shippingCost: 5000,
    // Estos datos comerciales son deliberadamente falsos. El servidor debe ignorarlos.
    items: [{ id: 'prod_001', qty: 2, price: 1, name: 'PRECIO FALSO' }],
  }, {
    uid: 'admin-test',
    email: 'admin@example.com',
    role: 'superadmin',
    origin: 'superadmin',
  }, store);

  assert.equal(result.orderNumber, 'TINPED13');
  assert.equal(result.order.subtotal, 100000);
  assert.equal(result.order.shippingCost, 5000);
  assert.equal(result.order.total, 105000);
  assert.equal(result.order.items[0].price, 50000);
  assert.equal(result.order.items[0].name, 'ARO CANÓNICO');
  assert.equal(result.order.inventoryState, 'reserved');
  assert.equal(store.commits.length, 1);

  const writes = store.commits[0];
  assert.equal(writes.length, 4, 'producto + pedido + secuencia + auditoría deben confirmarse juntos');

  const productWrite = writeFor(writes, 'products/prod_001');
  const productPatch = decodeFirestoreFields(productWrite.fields);
  assert.equal(productPatch.stock, 2);
  assert.equal(productPatch.lastInventoryAction, 'reserve');

  const orderWrite = writeFor(writes, 'orders/manual_');
  const persistedOrder = decodeFirestoreFields(orderWrite.fields);
  assert.equal(persistedOrder.orderNumber, 'TINPED13');
  assert.equal(persistedOrder.subtotal, 100000);
  assert.equal(persistedOrder.total, 105000);
  assert.equal(persistedOrder.items[0].price, 50000);

  const sequenceWrite = writeFor(writes, 'settings/orderSequence');
  const sequence = decodeFirestoreFields(sequenceWrite.fields);
  assert.equal(sequence.lastNumber, 13);
  assert.equal(sequence.lastCode, 'TINPED13');
  assert.ok(writes.some(write => String(write.path).startsWith('auditLog/')));
});

test('crear pedido manual rechaza productos inactivos', async () => {
  const store = fakeStore({
    'products/prod_inactivo': document('products/prod_inactivo', {
      name: 'Producto retirado',
      category: 'otros',
      price: 30000,
      stock: 5,
      active: false,
    }),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 1 }),
  });

  await assert.rejects(
    createOrderAdmin({}, {
      userName: 'Cliente',
      items: [{ id: 'prod_inactivo', qty: 1, price: 1 }],
    }, { email: 'admin@example.com', origin: 'superadmin' }, store),
    /no está activo/i,
  );
  assert.equal(store.commits.length, 0);
});

test('cancelar pedido histórico de 20 productos libera todo en un único lote administrativo', async () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `prod_${String(index + 1).padStart(3, '0')}`,
    name: `Producto ${index + 1}`,
    price: 10000,
    qty: 1,
  }));
  const entries = {
    'orders/pedido_historico_20': document('orders/pedido_historico_20', {
      orderNumber: 'TINPED99',
      status: 'pendiente',
      paymentStatus: 'pendiente',
      inventoryState: 'reserved',
      inventoryRevision: 4,
      lastChangeId: 'base_change_20',
      items,
      subtotal: 200000,
      shippingCost: 0,
      total: 200000,
    }),
  };
  for (const item of items) {
    entries[`products/${item.id}`] = document(`products/${item.id}`, {
      name: item.name,
      price: item.price,
      stock: 3,
      active: true,
    });
  }
  const store = fakeStore(entries);

  const result = await applyOrderAdminMutation({}, {
    orderId: 'pedido_historico_20',
    status: 'cancelado',
    baseChangeId: 'base_change_20',
    changeId: 'sheet_cancel_20',
  }, {
    uid: 'google-sheets',
    email: 'google-sheets@tintin.internal',
    role: 'sheets-sync',
    origin: 'google-sheets:Pedidos web',
  }, store);

  assert.equal(result.status, 'cancelado');
  assert.equal(result.inventoryState, 'released');
  assert.equal(result.changedProducts, 20);
  assert.equal(store.commits.length, 1);
  const writes = store.commits[0];
  assert.equal(writes.length, 22, '20 productos + pedido + auditoría');
  const productWrites = writes.filter(write => String(write.path).startsWith('products/'));
  assert.equal(productWrites.length, 20);
  productWrites.forEach(write => {
    const patch = decodeFirestoreFields(write.fields);
    assert.equal(patch.stock, 4);
    assert.equal(patch.lastInventoryAction, 'release');
  });
});

test('edición de Sheets con baseChangeId viejo devuelve conflicto y no escribe', async () => {
  const store = fakeStore({
    'orders/pedido_conflicto': document('orders/pedido_conflicto', {
      orderNumber: 'TINPED22',
      status: 'pendiente',
      inventoryState: 'reserved',
      lastChangeId: 'change_nuevo',
      items: [{ id: 'prod_001', name: 'Aro', price: 20000, qty: 1 }],
      subtotal: 20000,
      shippingCost: 0,
      total: 20000,
    }),
  });

  await assert.rejects(
    applyOrderAdminMutation({}, {
      orderId: 'pedido_conflicto',
      status: 'confirmado',
      baseChangeId: 'change_viejo',
      changeId: 'sheet_change_123',
    }, { email: 'google-sheets@tintin.internal', origin: 'google-sheets:Pedidos web' }, store),
    error => Number(error?.status) === 409 && /cambió después/i.test(error.message),
  );
  assert.equal(store.commits.length, 0);
});
