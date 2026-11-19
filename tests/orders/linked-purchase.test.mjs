import assert from 'node:assert/strict';
import test from 'node:test';

import { createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { prepareLinkedPurchaseInput } from '../../cloudflare/perfil-cliente-admin.mjs';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const UID = 'cliente_uid_123';
const SUPER = { uid: 'super-uid', email: 'tintinaccs@gmail.com', role: 'superadmin', origin: 'superadmin-linked-purchase' };

function document(path, data) {
  return { name: `projects/test/databases/(default)/documents/${path}`, fields: encodeFirestoreFields(data), updateTime: '2026-11-01T00:00:00.000Z' };
}

function fakeStore(entries) {
  const map = new Map(Object.entries(entries));
  const commits = [];
  return {
    commits,
    get: async (_env, path) => map.get(decodeURIComponent(path)) || null,
    batchGet: async (_env, paths) => paths.map(path => map.get(decodeURIComponent(path))).filter(Boolean),
    findFirst: async () => null,
    maxNumber: async () => 0,
    commit: async (_env, writes) => { commits.push(writes); return { writeResults: writes.map(() => ({})) }; },
  };
}

function client(extra = {}) {
  return document(`users/${UID}`, { firstName: 'Ana', lastName: 'Ruiz', name: 'Ana Ruiz', phone: '+595981123456', email: 'ana@example.com', customerId: 'CUS_ANA', ...extra });
}

test('la compra vinculada toma la identidad del perfil guardado, no del navegador', async () => {
  const store = fakeStore({ [`users/${UID}`]: client() });
  const input = await prepareLinkedPurchaseInput({}, {
    linkUid: UID, orderId: 'linked_abc12345', userName: 'Nombre falso', userPhone: '0000', accountEmail: 'otro@example.com',
    items: [{ id: 'prod_001', qty: 1 }], paymentStatus: 'pagado', shipping: 'retiro',
  }, store);
  assert.equal(input.userId, UID);
  assert.equal(input.customerId, 'CUS_ANA');
  assert.equal(input.accountEmail, 'ana@example.com');
  assert.equal(input.contactEmail, 'ana@example.com');
  assert.equal(input.userName, 'Ana Ruiz');
  assert.equal(input.userPhone, '+595981123456');
  assert.equal(input.orderId, 'linked_abc12345');
});

test('no se vincula una compra a un cliente bloqueado, eliminado, sin correo o a la Super Admin', async () => {
  const cases = [
    [client({ blocked: true }), /bloqueado/],
    [client({ deleted: true }), /eliminado/],
    [client({ email: '' }), /no tiene un correo válido/],
    [client({ email: 'tintinaccs@gmail.com' }), /Super Admin/],
  ];
  for (const [profile, error] of cases) {
    const store = fakeStore({ [`users/${UID}`]: profile });
    await assert.rejects(prepareLinkedPurchaseInput({}, { linkUid: UID, items: [] }, store), error);
  }
  await assert.rejects(prepareLinkedPurchaseInput({}, { linkUid: 'no/valido' }, fakeStore({})), /Cliente inválido/);
  await assert.rejects(prepareLinkedPurchaseInput({}, { linkUid: UID }, fakeStore({})), /ya no existe/);
});

test('compra vinculada: TINPED nuevo, stock descontado hasta agotarse, atada al cliente y auditada', async () => {
  const store = fakeStore({
    [`users/${UID}`]: client(),
    'products/prod_001': document('products/prod_001', { name: 'Aro', category: 'aros', price: 50000, stock: 2, active: true }),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 40, lastCode: 'TINPED40' }),
  });
  const input = await prepareLinkedPurchaseInput({}, {
    linkUid: UID, orderId: 'linked_abc12345', items: [{ id: 'prod_001', qty: 2 }], shipping: 'retiro', payment: 'transferencia',
  }, store);
  const result = await createOrderAdmin({}, input, SUPER, store);

  assert.equal(result.orderNumber, 'TINPED41');
  assert.equal(result.order.userId, UID);
  assert.equal(result.order.linkedPurchase, true);
  assert.equal(result.order.source, 'superadmin-linked-purchase-v1');
  assert.equal(result.order.inventoryState, 'reserved', 'aparta stock como una compra del checkout');

  const writes = store.commits[0];
  const product = decodeFirestoreFields(writes.find(write => write.path === 'products/prod_001').fields);
  assert.equal(product.stock, 0, 'queda agotado');
  const audit = decodeFirestoreFields(writes.find(write => write.path.startsWith('auditLog/')).fields);
  assert.equal(audit.action, 'vincular_compra_cliente');
  assert.equal(audit.targetId, UID);
});

test('sin el origen autenticado de la Super Admin no se aparta stock al crear pendiente', async () => {
  const store = fakeStore({
    'products/prod_001': document('products/prod_001', { name: 'Aro', category: 'aros', price: 50000, stock: 2, active: true }),
    'settings/orderSequence': document('settings/orderSequence', { lastNumber: 1, lastCode: 'TINPED01' }),
  });
  const result = await createOrderAdmin({}, { userName: 'Cli', contactEmail: 'c@example.com', shippingMethod: 'retiro', items: [{ id: 'prod_001', qty: 1 }], source: 'superadmin-linked-purchase' },
    { ...SUPER, origin: 'superadmin' }, store);
  assert.equal(result.order.inventoryState, 'unreserved');
  assert.notEqual(result.order.linkedPurchase, true);
});
