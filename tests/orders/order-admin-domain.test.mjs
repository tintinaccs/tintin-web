import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOrderAdminMutation,
  createOrderAdmin,
  recordOrderEmailResend,
  resetOrderSequenceAdmin,
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

function fakeStore(entries = {}, { transactional = false } = {}) {
  const map = new Map(Object.entries(entries));
  const commits = [];
  const calls = { findFirst: 0, maxNumber: 0 };
  let version = 0;
  const valueAtPath = (data, fieldPath) => String(fieldPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, data);
  return {
    commits,
    get: async (_env, path) => map.get(decodeURIComponent(path)) || null,
    calls,
    map,
    findFirst: async (_env, collectionId, fieldPaths, value) => {
      calls.findFirst += 1;
      const fields = Array.isArray(fieldPaths) ? fieldPaths : [fieldPaths];
      for (const [docPath, doc] of map) {
        if (!String(docPath).startsWith(`${collectionId}/`)) continue;
        const data = decodeFirestoreFields(doc?.fields || {});
        if (fields.some(field => String(valueAtPath(data, field) ?? '') === String(value ?? ''))) return doc;
      }
      return null;
    },
    maxNumber: async (_env, collectionId, fieldPath) => {
      calls.maxNumber += 1;
      let max = 0;
      for (const [docPath, doc] of map) {
        if (!String(docPath).startsWith(`${collectionId}/`)) continue;
        const value = decodeFirestoreFields(doc?.fields || {})[fieldPath];
        if (typeof value === 'number' && value > max) max = value;
      }
      return max;
    },
    commit: async (_env, writes) => {
      if (transactional) {
        // Precondiciones como Firestore: el lote entero falla con 409.
        for (const write of writes) {
          const current = map.get(write.path) || null;
          const pre = write.currentDocument || {};
          const ok = pre.exists === false ? !current
            : pre.exists === true ? Boolean(current)
              : pre.updateTime ? current?.updateTime === pre.updateTime
                : true;
          if (!ok) throw Object.assign(new Error('Conflicto de versión en Firestore.'), { status: 409 });
        }
        for (const write of writes) {
          const previous = map.get(write.path);
          const incoming = decodeFirestoreFields(write.fields || {});
          const data = write.mergeFields && previous
            ? { ...decodeFirestoreFields(previous.fields || {}), ...incoming }
            : incoming;
          version += 1;
          map.set(write.path, document(write.path, data, `2026-10-01T00:00:00.${String(version).padStart(3, '0')}Z`));
        }
      }
      commits.push(writes);
      return { writeResults: writes.map(() => ({})) };
    },
  };
}

test('recordOrderEmailResend actualiza pedido y auditoría en un commit e impide replay', async () => {
  const store = fakeStore({
    'orders/pedido_correo_1': document('orders/pedido_correo_1', {
      orderNumber: 'TINPED31', resendCount: 2, notificationStatus: 'sent', lastChangeId: 'admin_before',
    }),
  });
  const input = { orderId: 'pedido_correo_1', changeId: 'admin_email_change_123' };
  const actor = { uid: 'admin-test', email: 'admin@example.com', role: 'admin' };
  const result = await recordOrderEmailResend({}, input, actor, store);

  assert.equal(result.order.resendCount, 3);
  assert.equal(result.order.notificationStatus, 'sent');
  assert.ok(result.order.lastResendAt instanceof Date);
  assert.equal(store.commits.length, 1);
  assert.equal(store.commits[0].length, 2, 'pedido y bitácora deben confirmarse juntos');
  assert.ok(store.commits[0].some(write => write.path.startsWith('auditLog/')));

  const replay = await recordOrderEmailResend({}, input, actor, {
    ...store,
    get: async () => document('orders/pedido_correo_1', result.order),
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.order.resendCount, 3);
});

const RETIRO = {
  userName: 'Cliente',
  shippingMethod: 'retiro',
  items: [{ id: 'prod_001', qty: 1 }],
};

function stockedProduct() {
  return document('products/prod_001', { name: 'Aro', category: 'aros', price: 50000, stock: 50, active: true });
}

function sequencePatch(store, index = 0) {
  return decodeFirestoreFields(writeFor(store.commits[index], 'settings/orderSequence').fields);
}

function writeFor(writes, prefix) {
  return writes.find(write => String(write.path || '').startsWith(prefix));
}

test('crear pedido manual usa precio canónico, calcula total, descuenta stock (pago confirmado) y asigna TINPED', async () => {
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
    paymentStatus: 'pagado',
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

test('TINPED no reutiliza códigos históricos aunque la secuencia quede atrasada', async () => {
  const store = fakeStore({
    'products/prod_001': document('products/prod_001', {
      name: 'Aro',
      category: 'aros',
      price: 50000,
      stock: 5,
      active: true,
    }),
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 0,
      lastCode: '',
    }),
    'orders/pedido_viejo_1': document('orders/pedido_viejo_1', {
      orderNumber: 'TINPED01',
      shortId: 'TINPED01',
    }),
    'orderTrash/pedido_viejo_2': document('orderTrash/pedido_viejo_2', {
      orderNumber: 'TINPED02',
      shortId: 'TINPED02',
    }),
    'auditLog/evt_viejo_3': document('auditLog/evt_viejo_3', {
      after: { orderNumber: 'TINPED03', shortId: 'TINPED03' },
    }),
  });

  const result = await createOrderAdmin({}, {
    userName: 'Cliente',
    shippingMethod: 'retiro',
    items: [{ id: 'prod_001', qty: 1 }],
  }, ACTOR, store);

  assert.equal(result.orderNumber, 'TINPED04');
  const sequenceWrite = writeFor(store.commits[0], 'settings/orderSequence');
  const sequence = decodeFirestoreFields(sequenceWrite.fields);
  assert.equal(sequence.lastNumber, 4);
  assert.equal(sequence.highWaterMark, 4);
  assert.ok(sequence.historyReconciledAt, 'la primera asignación deja la secuencia conciliada');
});

test('TINPED: secuencia conciliada usa una sola consulta y ninguna de máximo', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 7, highWaterMark: 7, lastCode: 'TINPED07', historyReconciledAt: new Date('2026-10-01T00:00:00Z'),
    }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED08');
  assert.deepEqual(store.calls, { findFirst: 1, maxNumber: 0 });
  assert.equal(sequencePatch(store).historyReconciledAt, undefined, 'el camino normal no reescribe la marca');
});

test('TINPED: secuencia atrasada salta al mayor orderSequenceNumber de pedidos y papelera', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 2, lastCode: 'TINPED02' }),
    'orders/a': document('orders/a', { orderNumber: 'TINPED12', shortId: 'TINPED12', orderSequenceNumber: 12 }),
    'orderTrash/b': document('orderTrash/b', { orderNumber: 'TINPED16', shortId: 'TINPED16', orderSequenceNumber: 16 }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED17');
  assert.equal(sequencePatch(store).highWaterMark, 17);
});

test('TINPED: secuencia ya adelantada no retrocede hacia el historial', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 30, lastCode: 'TINPED30' }),
    'orders/a': document('orders/a', { orderNumber: 'TINPED16', shortId: 'TINPED16', orderSequenceNumber: 16 }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED31');
});

test('TINPED: documento con lastNumber y highWaterMark distintos usa el mayor', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 3, highWaterMark: 9 }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED10');
});

test('TINPED: pedidos históricos con sólo shortId o sólo orderNumber también bloquean el código', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'orders/solo_short': document('orders/solo_short', { shortId: 'TINPED01' }),
    'orders/solo_number': document('orders/solo_number', { orderNumber: 'TINPED02' }),
    'auditLog/evt_short': document('auditLog/evt_short', { after: { shortId: 'TINPED03' } }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED04');
});

test('TINPED: sin settings/orderSequence crea el documento con precondición de inexistencia', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED01');
  const write = writeFor(store.commits[0], 'settings/orderSequence');
  assert.deepEqual(write.currentDocument, { exists: false });
  assert.equal(write.mergeFields, undefined);
});

test('TINPED: la secuencia conciliada vuelve a conciliar si el código ya figura en pedidos', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 4, highWaterMark: 4, historyReconciledAt: new Date('2026-10-01T00:00:00Z'),
    }),
    'orders/externo': document('orders/externo', { orderNumber: 'TINPED05', shortId: 'TINPED05', orderSequenceNumber: 5 }),
  });
  const result = await createOrderAdmin({}, RETIRO, ACTOR, store);
  assert.equal(result.orderNumber, 'TINPED06');
});

test('TINPED: dos altas simultáneas no comparten código (precondición + reintento tras 409)', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 20, highWaterMark: 20, historyReconciledAt: new Date('2026-10-01T00:00:00Z'),
    }),
  }, { transactional: true });
  const results = await Promise.all([
    createOrderAdmin({}, RETIRO, ACTOR, store),
    createOrderAdmin({}, RETIRO, ACTOR, store),
  ]);
  assert.deepEqual(results.map(result => result.orderNumber).sort(), ['TINPED21', 'TINPED22']);
  const sequence = decodeFirestoreFields(store.map.get('settings/orderSequence').fields);
  assert.equal(sequence.lastNumber, 22);
  assert.equal(sequence.highWaterMark, 22);
});

test('TINPED: dos altas simultáneas sin documento de secuencia tampoco duplican', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() }, { transactional: true });
  const results = await Promise.all([
    createOrderAdmin({}, RETIRO, ACTOR, store),
    createOrderAdmin({}, RETIRO, ACTOR, store),
  ]);
  assert.deepEqual(results.map(result => result.orderNumber).sort(), ['TINPED01', 'TINPED02']);
});

test('TINPED: un 409 persistente se informa sin inventar código', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() });
  let attempts = 0;
  store.commit = async () => {
    attempts += 1;
    throw Object.assign(new Error('Conflicto de versión en Firestore.'), { status: 409 });
  };
  await assert.rejects(createOrderAdmin({}, RETIRO, ACTOR, store), error => error.status === 409);
  assert.equal(attempts, 3);
});

test('TINPED: las validaciones del llamador corren antes de consultar la secuencia', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() });
  await assert.rejects(
    createOrderAdmin({}, RETIRO, ACTOR, { ...store, inspect: async () => { throw new Error('variant_required'); } }),
    /variant_required/,
  );
  assert.deepEqual(store.calls, { findFirst: 0, maxNumber: 0 });
});

test('la acción histórica de reinicio no puede bajar la secuencia TINPED', async () => {
  const store = fakeStore({
    'settings/orderSequence': document('settings/orderSequence', {
      lastNumber: 12,
      highWaterMark: 12,
      lastCode: 'TINPED12',
    }),
  });

  const result = await resetOrderSequenceAdmin({}, ACTOR, store);
  assert.equal(result.reset, false);
  assert.equal(result.protected, true);
  assert.equal(result.nextOrderNumber, 'TINPED13');

  const sequenceWrite = writeFor(store.commits[0], 'settings/orderSequence');
  const patch = decodeFirestoreFields(sequenceWrite.fields);
  assert.equal(patch.lastNumber, 12);
  assert.equal(patch.highWaterMark, 12);
  assert.equal(patch.lastCode, 'TINPED12');
});

test('proteger una secuencia reiniciada a 0 la lleva al último TINPED emitido, nunca a 0', async () => {
  const store = fakeStore({
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 0, lastCode: '' }),
    'orders/a': document('orders/a', { orderNumber: 'TINPED05', shortId: 'TINPED05', orderSequenceNumber: 5 }),
    'auditLog/evt_6': document('auditLog/evt_6', { after: { orderNumber: 'TINPED06' } }),
  });
  const result = await resetOrderSequenceAdmin({}, ACTOR, store);
  assert.equal(result.nextOrderNumber, 'TINPED07');
  const patch = sequencePatch(store);
  assert.equal(patch.lastNumber, 6);
  assert.equal(patch.highWaterMark, 6);
  assert.equal(patch.lastCode, 'TINPED06');
  assert.ok(patch.historyReconciledAt);
});

test('proteger sin documento ni historial no inventa números', async () => {
  const store = fakeStore({});
  const result = await resetOrderSequenceAdmin({}, ACTOR, store);
  assert.equal(result.nextOrderNumber, 'TINPED01');
  assert.equal(sequencePatch(store).lastNumber, 0);
  assert.deepEqual(writeFor(store.commits[0], 'settings/orderSequence').currentDocument, { exists: false });
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

const ACTOR = { uid: 'admin-test', email: 'admin@example.com', role: 'superadmin', origin: 'superadmin' };

function variantStore() {
  return fakeStore({ 'products/ring': document('products/ring', {
    name: 'Anillo', category: 'anillos', price: 100, active: true, stock: 5,
    variants: { Talla: ['6', '7'] }, variantInventory: [{ variant: '6', stock: 2 }, { variant: '7', stock: 3 }],
  }) }, { transactional: true });
}

test('variant inventory reserves atomically, switches options and releases once on cancellation', async () => {
  const store = variantStore();
  const created = await createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', paymentStatus: 'pagado', items: [{ id: 'ring', qty: 2, variant: '6' }] }, ACTOR, store);
  const product = () => decodeFirestoreFields(store.map.get('products/ring').fields);
  assert.equal(product().stock, 3);
  assert.deepEqual(product().variantInventory, [{ variant: '6', stock: 0 }, { variant: '7', stock: 3 }]);
  assert.deepEqual(created.order.variantInventoryItems, [{ id: 'ring', variant: '6', qty: 2 }]);
  const changed = await applyOrderAdminMutation({}, { orderId: created.orderId, items: [{ id: 'ring', name: 'Anillo', price: 100, qty: 2, variant: '7' }], changeId: 'switch_variant_123' }, ACTOR, store);
  assert.equal(product().stock, 3, 'switching options keeps aggregate stock');
  assert.equal(changed.changedProducts, 1);
  assert.deepEqual(product().variantInventory, [{ variant: '6', stock: 2 }, { variant: '7', stock: 1 }]);
  await applyOrderAdminMutation({}, { orderId: created.orderId, status: 'cancelado', changeId: 'cancel_variant_123' }, ACTOR, store);
  assert.equal(product().stock, 5);
  assert.deepEqual(product().variantInventory, [{ variant: '6', stock: 2 }, { variant: '7', stock: 3 }]);
  const count = store.commits.length;
  await applyOrderAdminMutation({}, { orderId: created.orderId, status: 'cancelado', changeId: 'cancel_variant_123' }, ACTOR, store);
  assert.equal(store.commits.length, count);
});

test('pending order validates option stock without reserving; confirmation rejects sold-out option', async () => {
  const store = variantStore();
  await assert.rejects(createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items: [{ id: 'ring', qty: 3, variant: '6' }] }, ACTOR, store), /Stock insuficiente/);
  assert.equal(store.commits.length, 0);
  await assert.rejects(createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items: [{ id: 'ring', qty: 1, variant: '8' }] }, ACTOR, store), /variante.*no existe/);
  const created = await createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items: [{ id: 'ring', qty: 2, variant: '6' }] }, ACTOR, store);
  assert.deepEqual(created.order.variantInventoryItems, []);
  assert.equal(decodeFirestoreFields(store.map.get('products/ring').fields).stock, 5);
  const data = decodeFirestoreFields(store.map.get('products/ring').fields);
  data.variantInventory[0].stock = 0;
  store.map.set('products/ring', document('products/ring', data));
  const count = store.commits.length;
  await assert.rejects(applyOrderAdminMutation({}, { orderId: created.orderId, status: 'confirmado', changeId: 'confirm_variant_123' }, ACTOR, store), /Stock insuficiente/);
  assert.equal(store.commits.length, count);
});

test('legacy reserved order releases aggregate stock without inventing option inventory', async () => {
  const store = variantStore();
  store.map.set('orders/legacy_ring', document('orders/legacy_ring', { status: 'confirmado', inventoryState: 'reserved', items: [{ id: 'ring', qty: 1, variant: '6' }] }));
  await assert.rejects(applyOrderAdminMutation({}, { orderId: 'legacy_ring', items: [{ id: 'ring', name: 'Anillo', price: 100, qty: 1, variant: '7' }], changeId: 'legacy_switch_123' }, ACTOR, store), /requiere revisar/);
  assert.equal(store.commits.length, 0);
  await applyOrderAdminMutation({}, { orderId: 'legacy_ring', status: 'cancelado', changeId: 'legacy_cancel_123' }, ACTOR, store);
  const product = decodeFirestoreFields(store.map.get('products/ring').fields);
  assert.equal(product.stock, 6);
  assert.deepEqual(product.variantInventory, [{ variant: '6', stock: 2 }, { variant: '7', stock: 3 }]);
});

test('concurrent paid orders cannot reserve the same last option twice', async () => {
  const store = variantStore();
  const input = { userName: 'Cliente', shippingMethod: 'retiro', paymentStatus: 'pagado', items: [{ id: 'ring', qty: 2, variant: '6' }] };
  const results = await Promise.allSettled([createOrderAdmin({}, input, ACTOR, store), createOrderAdmin({}, input, ACTOR, store)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const product = decodeFirestoreFields(store.map.get('products/ring').fields);
  assert.equal(product.stock, 3);
  assert.equal(product.variantInventory[0].stock, 0);
  assert.equal(store.commits.length, 1);
});
const aro = stock => document('products/prod_001', { name: 'Aro', price: 50000, stock, active: true });
const pedido = (extra = {}) => document('orders/pedido_prueba_1', {
  orderNumber: 'TINPED50', status: 'pendiente', paymentStatus: 'pendiente',
  inventoryState: 'unreserved', inventoryRevision: 1, lastChangeId: 'c0',
  items: [{ id: 'prod_001', name: 'Aro', price: 50000, qty: 2 }],
  subtotal: 100000, shippingCost: 0, total: 100000, ...extra,
});
const stockWrites = store => store.commits.flat().filter(w => String(w.path).startsWith('products/'));

test('pedido nuevo pendiente no descuenta stock pero valida disponibilidad', async () => {
  const entries = {
    'products/prod_001': aro(4),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 1, lastCode: 'TINPED01' }),
  };
  const store = fakeStore(entries);
  const result = await createOrderAdmin({}, {
    userName: 'Cli', contactEmail: 'c@example.com', shippingMethod: 'retiro',
    items: [{ id: 'prod_001', qty: 2 }],
  }, ACTOR, store);
  assert.equal(result.order.inventoryState, 'unreserved');
  assert.equal(stockWrites(store).length, 0);

  const sinStock = fakeStore({ ...entries, 'products/prod_001': aro(1) });
  await assert.rejects(
    createOrderAdmin({}, { userName: 'Cli', contactEmail: 'c@example.com', shippingMethod: 'retiro', items: [{ id: 'prod_001', qty: 2 }] }, ACTOR, sinStock),
    /Stock insuficiente/,
  );
});

test('confirmar el pago descuenta el stock una sola vez y exige stock suficiente', async () => {
  const store = fakeStore({ 'orders/pedido_prueba_1': pedido(), 'products/prod_001': aro(5) });
  const result = await applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', paymentStatus: 'pagado' }, ACTOR, store);
  assert.equal(result.inventoryState, 'reserved');
  const [write] = stockWrites(store);
  assert.equal(decodeFirestoreFields(write.fields).stock, 3);
  assert.equal(decodeFirestoreFields(write.fields).lastInventoryAction, 'reserve');

  const ultima = fakeStore({ 'orders/pedido_prueba_1': pedido(), 'products/prod_001': aro(1) });
  await assert.rejects(
    applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', paymentStatus: 'pagado' }, ACTOR, ultima),
    /Stock insuficiente/,
  );
  assert.equal(ultima.commits.length, 0);
});

test('reconciliar tras pago externo (PayPal) descuenta stock con pedido ya pagado', async () => {
  const store = fakeStore({ 'orders/pedido_prueba_1': pedido({ paymentStatus: 'pagado' }), 'products/prod_001': aro(5) });
  const result = await applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', reconcileInventory: true }, ACTOR, store);
  assert.equal(result.inventoryState, 'reserved');
  assert.equal(decodeFirestoreFields(stockWrites(store)[0].fields).stock, 3);
});

test('avanzar el estado descuenta; cancelar un pedido sin descuento no devuelve stock', async () => {
  const avanza = fakeStore({ 'orders/pedido_prueba_1': pedido(), 'products/prod_001': aro(5) });
  await applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', status: 'confirmado' }, ACTOR, avanza);
  assert.equal(decodeFirestoreFields(stockWrites(avanza)[0].fields).stock, 3);

  const cancela = fakeStore({ 'orders/pedido_prueba_1': pedido(), 'products/prod_001': aro(5) });
  const result = await applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', status: 'cancelado' }, ACTOR, cancela);
  assert.equal(result.inventoryState, 'released');
  assert.equal(stockWrites(cancela).length, 0);
});

test('pedido anterior ya reservado conserva su reserva al editarlo sin pago', async () => {
  const store = fakeStore({ 'orders/pedido_prueba_1': pedido({ inventoryState: 'reserved' }), 'products/prod_001': aro(5) });
  const result = await applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', notes: 'nota' }, ACTOR, store);
  assert.equal(result.inventoryState, 'reserved');
  assert.equal(stockWrites(store).length, 0);
});

test('el pedido canónico conserva dos colores y reconstruye sus fotos desde el catálogo', async () => {
  const gold = 'https://cdn.example.test/gold.jpg';
  const silver = 'https://cdn.example.test/silver.jpg';
  const store = fakeStore({ 'products/prod_001': document('products/prod_001', {
    name: 'Aro', price: 50000, stock: 5, active: true, imageUrl: gold,
    variants: { Color: ['Dorado', 'Plateado'] },
    variantMedia: [{ Color: 'Dorado', imageUrls: [gold] }, { Color: 'Plateado', imageUrls: [silver] }],
    variantInventory: [{ variant: 'Dorado', stock: 3 }, { variant: 'Plateado', stock: 2 }],
  }) }, { transactional: true });
  const result = await createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items: [
    { id: 'prod_001', variant: 'Dorado', qty: 2, price: 1, imageUrl: silver },
    { id: 'prod_001', variant: 'Plateado', qty: 1, price: 1, imageUrl: gold },
  ] }, ACTOR, store);
  assert.deepEqual(result.order.items.map(({ variant, qty, imageUrl, price }) => ({ variant, qty, imageUrl, price })), [
    { variant: 'Dorado', qty: 2, imageUrl: gold, price: 50000 },
    { variant: 'Plateado', qty: 1, imageUrl: silver, price: 50000 },
  ]);
  assert.equal(result.order.subtotal, 150000);
});
