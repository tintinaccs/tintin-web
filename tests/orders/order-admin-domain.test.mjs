import {mergeSelectedOrderProducts} from '../../js/admin/orders/seleccion-productos-pedido.mjs';
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
  const reads = [];
  const batchReads = [];
  const calls = { findFirst: 0, maxNumber: 0 };
  let version = 0;
  const valueAtPath = (data, fieldPath) => String(fieldPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, data);
  return {
    commits,
    get: async (_env, path) => { reads.push(path); return map.get(decodeURIComponent(path)) || null; },
    batchGet: async (_env, paths) => {
      batchReads.push([...paths]);
      return paths.map(path => map.get(decodeURIComponent(path))).filter(Boolean).reverse();
    },
    reads,
    batchReads,
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

test('editar importes, entrega, artículos o contacto confirma el aviso junto al pedido sin repetir etapa', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() }, { transactional: true });
  const actor = { uid: 'superadmin-fixture', email: 'admin@example.test', role: 'superadmin' };
  let result = await createOrderAdmin({}, { ...RETIRO, userId: 'customer-fixture', userEmail: 'customer@example.test' }, actor, store);
  for (const [index, patch] of [{ shippingCost: 15000 }, { address: 'Nueva dirección' }, { items: [{ id: 'prod_001', name: 'Aro', price: 50000, qty: 2 }] }, { userPhone: '+595981111111' }].entries()) {
    const input = { orderId: result.orderId, baseChangeId: result.order.lastChangeId, changeId: `detail_change_${index}`, ...patch };
    result = await applyOrderAdminMutation({}, input, actor, store);
    const write = writeFor(store.commits.at(-1), 'users/customer-fixture/notifications/');
    assert.ok(write, 'pedido y aviso deben confirmarse en el mismo commit');
    const notice = decodeFirestoreFields(write.fields);
    assert.equal(notice.kind, 'order_updated');
    assert.match(notice.title, /Actualizamos los detalles/);
    assert.equal(notice.targetUrl, `perfil.html#pedido-${result.orderId}`);
    const count = store.commits.length;
    assert.equal((await applyOrderAdminMutation({}, input, actor, store)).duplicate, true);
    assert.equal(store.commits.length, count);
  }
});

for (const shippingMethod of ['delivery', 'retiro']) test(`cada etapa y su aviso al dueño se confirman juntos: ${shippingMethod}`, async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() }, { transactional: true });
  const actor = { uid: 'superadmin-fixture', email: 'admin@example.test', role: 'superadmin' };
  let result = await createOrderAdmin({}, { ...RETIRO, shippingMethod, userId: 'customer-fixture', userEmail: 'customer@example.test' }, actor, store);
  const id = result.orderId;
  const stages = shippingMethod === 'retiro' ? ['preparando', 'listo_retiro', 'entregado'] : ['preparando', 'listo', 'en_camino', 'entregado'];
  for (const status of stages) {
    const input = { orderId: id, status, baseChangeId: result.order.lastChangeId, changeId: `fixture_${status}` };
    result = await applyOrderAdminMutation({}, input, actor, store);
    const writes = store.commits.at(-1);
    const notice = writeFor(writes, 'users/customer-fixture/notifications/');
    assert.ok(notice, 'cada avance incluye el aviso en el mismo lote que orders');
    assert.equal(decodeFirestoreFields(notice.fields).status, status);
    assert.equal(decodeFirestoreFields(notice.fields).targetUrl, `perfil.html#pedido-${id}`);
    const count = store.commits.length;
    const replay = await applyOrderAdminMutation({}, input, actor, store);
    assert.equal(replay.duplicate, true);
    assert.equal(store.commits.length, count, 'reintentar el avance no duplica avisos');
  }
  const notices = [...store.map.entries()].filter(([path]) => path.startsWith('users/customer-fixture/notifications/')).map(([, doc]) => decodeFirestoreFields(doc.fields));
  assert.equal(notices.length, stages.length + 1);
  assert.match(notices[0].title, /Recibimos tu pedido/);
  assert.match(notices.at(-1).title, shippingMethod === 'retiro' ? /retirado/ : /entregado/);
  assert.ok(notices.every(notice => notice.recipientUid === 'customer-fixture'));
});

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
  assert.deepEqual(store.batchReads, [['products/prod_001']], 'las dos variantes leen el mismo producto una sola vez');
  assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
});

test('60 productos se leen en un batch y conservan stock/precondiciones al crear un pedido', async () => {
  const items = Array.from({ length: 60 }, (_, index) => ({ id: `p_${index}`, qty: 1, price: 1 }));
  const entries = Object.fromEntries(items.map(item => [`products/${item.id}`, document(`products/${item.id}`, {
    name: item.id, price: 100, stock: 2, active: true,
  })]));
  entries['settings/orderSequence'] = document('settings/orderSequence', { lastNumber: 1, highWaterMark: 1, historyReconciledAt: new Date() });
  const store = fakeStore(entries);
  const result = await createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', paymentStatus: 'pagado', items }, ACTOR, store);
  assert.equal(result.order.items.length, 60);
  assert.equal(result.order.subtotal, 6000);
  assert.equal(result.changedProducts, 60);
  assert.equal(store.batchReads.length, 1);
  assert.equal(store.batchReads[0].length, 60);
  assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
  const inventoryWrites = store.commits[0].filter(write => write.path.startsWith('products/'));
  assert.equal(inventoryWrites.length, 60);
  for (const write of inventoryWrites) {
    assert.equal(decodeFirestoreFields(write.fields).stock, 1);
    assert.deepEqual(write.currentDocument, { updateTime: UPDATED });
  }
});

test('el batch incompleto rechaza el producto faltante sin escribir stock/pedido', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() });
  const batch = store.batchGet;
  store.batchGet = async (env, paths) => (await batch(env, paths)).filter(doc => !doc.name.endsWith('/prod_001'));
  await assert.rejects(createOrderAdmin({}, RETIRO, ACTOR, store), error => error.code === 'product_not_found' && error.productId === 'prod_001');
  assert.equal(store.commits.length, 0);
});

test('el límite administrativo conserva 100 productos en un batch y rechaza 101 antes de leer', async () => {
  const items = Array.from({ length: 101 }, (_, index) => ({ id: `p_${index}`, qty: 1 }));
  const entries = Object.fromEntries(items.map(item => [`products/${item.id}`, document(`products/${item.id}`, { name: item.id, price: 100, stock: 2, active: true })]));
  const accepted = fakeStore(entries);
  const created = await createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items: items.slice(0, 100) }, ACTOR, accepted);
  assert.equal(created.order.items.length, 100);
  assert.equal(accepted.batchReads.length, 1);
  assert.equal(accepted.batchReads[0].length, 100);
  const rejected = fakeStore(entries);
  await assert.rejects(createOrderAdmin({}, { userName: 'Cliente', shippingMethod: 'retiro', items }, ACTOR, rejected), /demasiados productos distintos/);
  assert.equal(rejected.batchReads.length, 0);
  assert.equal(rejected.commits.length, 0);
});

test('fallo del batch bloquea el pedido sin fallback de 60 lecturas ni escrituras', async () => {
  const store = fakeStore({ 'products/prod_001': stockedProduct() });
  store.batchGet = async () => { throw new Error('Firestore batch unavailable'); };
  await assert.rejects(createOrderAdmin({}, RETIRO, ACTOR, store), /Firestore batch unavailable/);
  assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
  assert.equal(store.commits.length, 0);
});

test('un conflicto vuelve a leer el batch y no reserva inventario con versiones antiguas', async () => {
  const store = fakeStore({
    'products/prod_001': stockedProduct(),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 1, historyReconciledAt: new Date() }),
  });
  const commit = store.commit;
  let attempts = 0;
  store.commit = async (env, writes) => {
    attempts += 1;
    if (attempts === 1) {
      store.map.set('products/prod_001', document('products/prod_001', { name: 'Aro', price: 50000, stock: 3, active: true }, '2026-10-13T12:00:00.000Z'));
      throw Object.assign(new Error('Version conflict'), { status: 409 });
    }
    return commit(env, writes);
  };
  await createOrderAdmin({}, { ...RETIRO, paymentStatus: 'pagado' }, ACTOR, store);
  assert.equal(store.batchReads.length, 2);
  const write = store.commits[0].find(write => write.path === 'products/prod_001');
  assert.deepEqual(write.currentDocument, { updateTime: '2026-10-13T12:00:00.000Z' });
  assert.equal(decodeFirestoreFields(write.fields).stock, 2);
});

for (const action of ['cancelar', 'confirmar', 'reconciliar pago PayPal']) {
  test(`${action} un pedido de 60 productos usa un batch y conserva CAS/stock/idempotencia`, async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({ id: `p_${index}`, name: `P${index}`, qty: 1, price: 100 }));
    const entries = Object.fromEntries(items.map(item => [`products/${item.id}`, document(`products/${item.id}`, { name: item.name, price: 100, stock: 3, active: true })]));
    const cancelling = action === 'cancelar';
    entries['orders/order_sixty_123'] = document('orders/order_sixty_123', {
      items, userName: 'Cliente', status: 'pendiente', paymentStatus: action === 'reconciliar pago PayPal' ? 'pagado' : 'pendiente',
      payment: { method: 'paypal', status: action === 'reconciliar pago PayPal' ? 'pagado' : 'pendiente' },
      inventoryState: cancelling ? 'reserved' : 'unreserved', inventoryRevision: 1, lastChangeId: 'before-change', subtotal: 6000, total: 6000, shippingCost: 0,
    });
    const store = fakeStore(entries, { transactional: true });
    const input = { orderId: 'order_sixty_123', changeId: 'mutation_sixty_123',
      ...(cancelling ? { status: 'cancelado' } : action === 'confirmar' ? { status: 'confirmado' } : { reconcileInventory: true }) };
    const result = await applyOrderAdminMutation({}, input, ACTOR, store);
    assert.equal(result.changedProducts, 60);
    assert.equal(result.inventoryState, cancelling ? 'released' : 'reserved');
    assert.equal(store.batchReads.length, 1);
    assert.equal(store.batchReads[0].length, 60);
    assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
    assert.equal(store.commits.length, 1);
    const writes = store.commits[0].filter(write => write.path.startsWith('products/'));
    assert.equal(writes.length, 60);
    for (const write of writes) {
      assert.equal(decodeFirestoreFields(write.fields).stock, cancelling ? 4 : 2);
      assert.deepEqual(write.currentDocument, { updateTime: UPDATED });
    }
    const duplicate = await applyOrderAdminMutation({}, input, ACTOR, store);
    assert.equal(duplicate.duplicate, true);
    assert.equal(store.commits.length, 1);
    assert.equal(store.batchReads.length, 1, 'el replay no vuelve a consultar stock');
  });
}

test('mutación con batch fallido o producto faltante no modifica pedido ni inventario', async () => {
  for (const mode of ['missing', 'unavailable']) {
    const store = fakeStore({ 'orders/pedido_prueba_1': pedido({ inventoryState: 'reserved' }), 'products/prod_001': aro(5) });
    store.batchGet = mode === 'missing' ? async () => [] : async () => { throw new Error('batch unavailable'); };
    await assert.rejects(applyOrderAdminMutation({}, { orderId: 'pedido_prueba_1', status: 'cancelado' }, ACTOR, store), mode === 'missing' ? /No se puede reconciliar el stock.*prod_001/ : /batch unavailable/);
    assert.equal(store.commits.length, 0);
    assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
  }
});

test('cambiar 55 productos reservados por otros 55 lee dos batches sin truncar la unión', async () => {
  const items = prefix => Array.from({ length: 55 }, (_, index) => ({ id: `${prefix}_${index}`, name: `P${index}`, qty: 1, price: 100 }));
  const before = items('old');
  const after = items('new');
  const entries = Object.fromEntries([...before, ...after].map(item => [`products/${item.id}`, document(`products/${item.id}`, { stock: 2, price: 100, active: true })]));
  entries['orders/swap_order_123'] = document('orders/swap_order_123', { items: before, inventoryState: 'reserved', status: 'confirmado', subtotal: 5500, total: 5500 });
  const store = fakeStore(entries);
  const result = await applyOrderAdminMutation({}, { orderId: 'swap_order_123', items: after }, ACTOR, store);
  assert.equal(result.changedProducts, 110);
  assert.deepEqual(store.batchReads.map(paths => paths.length), [100, 10]);
  assert.equal(store.reads.filter(path => path.startsWith('products/')).length, 0);
  assert.equal(store.commits[0].length, 112, 'conserva el límite existente de 120 escrituras');
  for (const write of store.commits[0].filter(write => write.path.startsWith('products/'))) {
    assert.equal(decodeFirestoreFields(write.fields).stock, write.path.startsWith('products/old_') ? 3 : 1);
    assert.deepEqual(write.currentDocument, { updateTime: UPDATED });
  }
});


test('maestro: añadir selección conserva compra y cuenta, recalcula total y confirma sólo el delta de inventario',async()=>{
 const store=fakeStore({'products/prod_001':stockedProduct(),'products/prod_002':document('products/prod_002',{name:'Collar',category:'collares',price:30000,stock:5,active:true})},{transactional:true});
 const actor={uid:'superadmin-fixture',email:'admin@example.test',role:'superadmin'};
 const created=await createOrderAdmin({}, {...RETIRO,status:'confirmado',userId:'client-master',accountEmail:'client@example.test'},actor,store);
 const orderCount=[...store.map.keys()].filter(path=>path.startsWith('orders/')).length;
 const beforeA=decodeFirestoreFields(store.map.get('products/prod_001').fields).stock;
 const beforeB=decodeFirestoreFields(store.map.get('products/prod_002').fields).stock;
 const items=mergeSelectedOrderProducts(created.order.items,[{id:'prod_001',name:'Aro',price:50000,stock:50,active:true},{id:'prod_002',name:'Collar',price:30000,stock:5,active:true}]);
 const input={orderId:created.orderId,baseChangeId:created.order.lastChangeId,changeId:'master_existing_selection',items};
 const result=await applyOrderAdminMutation({},input,actor,store);
 assert.equal(result.order.userId,'client-master');assert.equal(result.order.userEmail,'client@example.test');assert.equal(result.order.orderNumber,created.order.orderNumber);assert.equal(result.order.total,130000);
 assert.equal([...store.map.keys()].filter(path=>path.startsWith('orders/')).length,orderCount);
 assert.equal(decodeFirestoreFields(store.map.get('products/prod_001').fields).stock,beforeA-1);assert.equal(decodeFirestoreFields(store.map.get('products/prod_002').fields).stock,beforeB-1);
 const writes=store.commits.length;assert.equal((await applyOrderAdminMutation({},input,actor,store)).duplicate,true);assert.equal(store.commits.length,writes);
 await assert.rejects(applyOrderAdminMutation({}, {...input,changeId:'master_stale_selection'},actor,store),/cambió/);assert.equal(store.commits.length,writes);
});
test('maestro: selección sin stock rechaza el pedido entero y conserva cuenta y artículos anteriores',async()=>{
 const store=fakeStore({'products/prod_001':stockedProduct(),'products/prod_002':document('products/prod_002',{name:'Collar',category:'collares',price:30000,stock:0,active:true})},{transactional:true});
 const actor={uid:'superadmin-fixture',email:'admin@example.test',role:'superadmin'};
 const created=await createOrderAdmin({}, {...RETIRO,status:'confirmado',userId:'client-master'},actor,store);
 const count=store.commits.length,baseline=structuredClone(store.map.get('orders/'+created.orderId));
 const items=mergeSelectedOrderProducts(created.order.items,[{id:'prod_002',name:'Collar',price:30000,active:true}]);
 await assert.rejects(applyOrderAdminMutation({}, {orderId:created.orderId,baseChangeId:created.order.lastChangeId,changeId:'master_no_stock',items},actor,store),/stock/i);
 assert.equal(store.commits.length,count);assert.deepEqual(store.map.get('orders/'+created.orderId),baseline);
});

const checkoutActor=uid=>({uid,email:`${uid}@example.test`,role:'client',origin:'public-checkout'});
test('dos clientas pendientes no pueden apartar la misma última variante al confirmar checkout',async()=>{
 const store=variantStore();
 const input={userName:'Clienta Test',shippingMethod:'retiro',paymentStatus:'pendiente',items:[{id:'ring',qty:2,variant:'6'}]};
 const results=await Promise.allSettled([
  createOrderAdmin({}, {...input,orderId:'public_checkout_first'}, checkoutActor('first'),store),
  createOrderAdmin({}, {...input,orderId:'public_checkout_second'}, checkoutActor('second'),store),
 ]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const failure=results.find(r=>r.status==='rejected');assert.equal(failure.reason.code,'insufficient_stock');assert.equal(failure.reason.available,0);
 const created=results.find(r=>r.status==='fulfilled').value;
 assert.equal(created.order.paymentStatus,'pendiente');assert.equal(created.order.inventoryState,'reserved');
 assert.equal(created.order.inventoryPolicy,'reserve-on-checkout');
 assert.equal(decodeFirestoreFields(store.map.get('products/ring').fields).variantInventory[0].stock,0);
 assert.equal([...store.map.keys()].filter(key=>key.startsWith('orders/')).length,1);
});
test('reintento, pago y confirmación no duplican la reserva; cancelación y reapertura son recuperables',async()=>{
 const store=variantStore();const input={orderId:'public_checkout_retry',userName:'Clienta Test',shippingMethod:'retiro',paymentStatus:'pendiente',items:[{id:'ring',qty:1,variant:'6'}]};
 const first=await createOrderAdmin({},input,checkoutActor('first'),store);
 const stock=()=>decodeFirestoreFields(store.map.get('products/ring').fields);
 assert.equal(stock().stock,4);assert.equal(stock().variantInventory[0].stock,1);
 const retry=await createOrderAdmin({},input,checkoutActor('first'),store);assert.equal(retry.duplicate,true);assert.equal(stock().stock,4);
 await applyOrderAdminMutation({}, {orderId:first.orderId,paymentStatus:'pagado',status:'confirmado',changeId:'public_checkout_paid'},ACTOR,store);assert.equal(stock().stock,4);
 await applyOrderAdminMutation({}, {orderId:first.orderId,status:'cancelado',changeId:'public_checkout_cancel'},ACTOR,store);assert.equal(stock().stock,5);assert.equal(stock().variantInventory[0].stock,2);
 await applyOrderAdminMutation({}, {orderId:first.orderId,status:'cancelado',changeId:'public_checkout_cancel'},ACTOR,store);assert.equal(stock().stock,5);
 await applyOrderAdminMutation({}, {orderId:first.orderId,status:'pendiente',paymentStatus:'pendiente',changeId:'public_checkout_reopen'},ACTOR,store);assert.equal(stock().stock,4);assert.equal(stock().variantInventory[0].stock,1);
});
test('campo de política aportado por navegador no modifica la creación manual',async()=>{
 const store=variantStore();const result=await createOrderAdmin({}, {userName:'Manual Test',shippingMethod:'retiro',inventoryPolicy:'reserve-on-checkout',items:[{id:'ring',qty:1,variant:'6'}]},ACTOR,store);
 assert.equal(result.order.inventoryState,'unreserved');assert.equal(result.order.inventoryPolicy,undefined);assert.equal(decodeFirestoreFields(store.map.get('products/ring').fields).stock,5);
});
for(const status of ['cancelado','rechazado']) test(`pedido público sin pago libera la reserva una sola vez al quedar ${status}`,async()=>{
 const store=variantStore();const created=await createOrderAdmin({}, {orderId:`public_unpaid_${status}`,userName:'Clienta Test',shippingMethod:'retiro',paymentStatus:'pendiente',items:[{id:'ring',qty:1,variant:'6'}]},checkoutActor('first'),store);
 const stock=()=>decodeFirestoreFields(store.map.get('products/ring').fields);
 assert.equal(stock().stock,4);
 const change={orderId:created.orderId,status,changeId:`public_release_${status}`};
 await applyOrderAdminMutation({},change,ACTOR,store);await applyOrderAdminMutation({},change,ACTOR,store);
 assert.equal(stock().stock,5);assert.equal(stock().variantInventory[0].stock,2);
 const order=decodeFirestoreFields(store.map.get('orders/'+created.orderId).fields);assert.equal(order.inventoryState,'released');assert.equal(order.paymentStatus,'pendiente');
});

function commercialStore() {
 return fakeStore({'products/ring':document('products/ring',{name:'Fixture',price:100,stock:999,active:true,variantCommerceVersion:2,
 variants:{Color:['Plateado','Dorado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:1,price:250},
 {variant:'Dorado',attributes:{Color:'Dorado'},stock:null}]})}, {transactional:true});
}
test('v2 simultaneous orders reserve last counted combination only once with CAS',async()=>{
 const store=commercialStore();
 const create=uid=>createOrderAdmin({}, {orderId:'v2_'+uid,userName:'Clienta Test',shippingMethod:'retiro',items:[{id:'ring',qty:1,variant:'Plateado'}]},checkoutActor(uid),store);
 const result=await Promise.allSettled([create('first'),create('second')]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(result.filter(r=>r.status==='rejected').length,1);
 const p=decodeFirestoreFields(store.map.get('products/ring').fields);
 assert.equal(p.stock,null);assert.equal(p.variantInventory[0].stock,0);assert.equal(p.variantInventory[0].price,250);
});
test('v2 cancel, replay, reopen and quantity edits retain historical unit price and metadata',async()=>{
 const store=commercialStore();
 const created=await createOrderAdmin({}, {orderId:'v2_history',userName:'Clienta Test',shippingMethod:'retiro',items:[{id:'ring',qty:1,variant:'Plateado'},{id:'ring',qty:2,variant:'Dorado'}]},checkoutActor('history'),store);
 assert.equal(created.order.total,450);
 const p=decodeFirestoreFields(store.map.get('products/ring').fields);p.variantInventory[0].price=900;
 store.map.set('products/ring',document('products/ring',p,'2099-01-01T00:00:00Z'));
 const edited=await applyOrderAdminMutation({}, {orderId:created.orderId,changeId:'v2_edit_123',items:[{id:'ring',qty:1,variant:'Plateado',price:1},{id:'ring',qty:3,variant:'Dorado',price:999}]},ACTOR,store);
 assert.equal(edited.order.items[0].price,250);assert.equal(edited.order.items[1].price,100);assert.equal(edited.order.total,550);
 const cancel={orderId:created.orderId,status:'cancelado',changeId:'v2_cancel_123'};
 await applyOrderAdminMutation({},cancel,ACTOR,store);await applyOrderAdminMutation({},cancel,ACTOR,store);
 let now=decodeFirestoreFields(store.map.get('products/ring').fields);assert.equal(now.variantInventory[0].stock,1);assert.equal(now.variantInventory[1].stock,null);
 await applyOrderAdminMutation({}, {orderId:created.orderId,status:'pendiente',paymentStatus:'pendiente',changeId:'v2_reopen_123'},ACTOR,store);
 now=decodeFirestoreFields(store.map.get('products/ring').fields);assert.equal(now.variantInventory[0].stock,0);assert.equal(now.variantInventory[0].price,900);
 const order=decodeFirestoreFields(store.map.get('orders/'+created.orderId).fields);assert.equal(order.items[0].price,250);
});

test('v2 cancellation after overlapping attribute reorder releases the saved reference, not the new positional label',async()=>{
 const data={name:'Overlap',price:100,stock:2,active:true,variantCommerceVersion:2,variants:{Color:['S','L'],Talle:['S','L']},variantInventory:[{variant:'S / L',attributes:{Color:'S',Talle:'L'},price:250,stock:1},{variant:'L / S',attributes:{Color:'L',Talle:'S'},price:300,stock:1}]};
 const store=fakeStore({'products/ring':document('products/ring',data)}, {transactional:true});
 const created=await createOrderAdmin({}, {orderId:'v2_overlap',userName:'Clienta Test',shippingMethod:'retiro',items:[{id:'ring',variant:'S / L',qty:1}]},checkoutActor('overlap'),store);
 assert.equal(created.order.items[0].price,250);assert.equal(created.order.variantInventoryItems[0].variantKey,'S / L');
 const p=decodeFirestoreFields(store.map.get('products/ring').fields);p.variants={Talle:['S','L'],Color:['S','L']};store.map.set('products/ring',document('products/ring',p,'2099-01-01T00:00:00Z'));
 await applyOrderAdminMutation({}, {orderId:created.orderId,status:'cancelado',changeId:'overlap_cancel'},ACTOR,store);
 const after=decodeFirestoreFields(store.map.get('products/ring').fields);assert.equal(after.variantInventory[0].stock,1);assert.equal(after.variantInventory[1].stock,1);
});

test('edit and cancel legacy reservation after explicit v2 fixture upgrade retain historical price and immutable reference',async()=>{
 const old={name:'Legacy overlap',price:100,stock:2,active:true,variants:{Color:['S','L'],Talle:['S','L']},variantInventory:[{variant:'S / L',stock:1},{variant:'L / S',stock:1}]};
 const store=fakeStore({'products/ring':document('products/ring',old)}, {transactional:true});
 const created=await createOrderAdmin({}, {orderId:'v1_to_v2_fixture',userName:'Clienta Test',shippingMethod:'retiro',items:[{id:'ring',variant:'S / L',qty:1}]},checkoutActor('legacy'),store);
 const p=decodeFirestoreFields(store.map.get('products/ring').fields);p.variantCommerceVersion=2;p.variants={Talle:['S','L'],Color:['S','L']};p.variantInventory[0].attributes={Color:'S',Talle:'L'};p.variantInventory[1].attributes={Color:'L',Talle:'S'};
 store.map.set('products/ring',document('products/ring',p,'2099-01-01T00:00:00Z'));
 const edited=await applyOrderAdminMutation({}, {orderId:created.orderId,changeId:'legacy_v2_edit',items:[{id:'ring',variant:'S / L',qty:1,price:999}]},ACTOR,store);
 assert.equal(edited.order.items[0].price,100);
 assert.equal(edited.order.items[0].variantKey,'S / L');
 assert.equal(edited.order.items[0].variant,'L / S');
 assert.equal(edited.order.variantInventoryItems[0].variantKey,'S / L');
 await applyOrderAdminMutation({}, {orderId:created.orderId,status:'cancelado',changeId:'legacy_v2_cancel'},ACTOR,store);
 const after=decodeFirestoreFields(store.map.get('products/ring').fields);assert.equal(after.variantInventory[0].stock,1);assert.equal(after.variantInventory[1].stock,1);
});

test('multiple combinations may exceed 99 units in aggregate and still cancel without double release',async()=>{
 const p={name:'Bulk combinations',price:100,stock:120,active:true,variantCommerceVersion:2,variants:{Color:['Plateado','Dorado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:60,price:200},{variant:'Dorado',attributes:{Color:'Dorado'},stock:60}]};
 const store=fakeStore({'products/ring':document('products/ring',p)}, {transactional:true});
 const created=await createOrderAdmin({}, {orderId:'v2_multi_quantity',userName:'Clienta Test',shippingMethod:'retiro',items:[{id:'ring',variant:'Plateado',qty:60},{id:'ring',variant:'Dorado',qty:60}]},checkoutActor('multi_quantity'),store);
 assert.equal(created.order.total,18000);assert.equal(decodeFirestoreFields(store.map.get('products/ring').fields).stock,0);
 const cancel={orderId:created.orderId,status:'cancelado',changeId:'v2_multi_cancel'};
 await applyOrderAdminMutation({},cancel,ACTOR,store);await applyOrderAdminMutation({},cancel,ACTOR,store);
 const after=decodeFirestoreFields(store.map.get('products/ring').fields);assert.equal(after.stock,120);assert.equal(after.variantInventory[0].stock,60);assert.equal(after.variantInventory[1].stock,60);
});
