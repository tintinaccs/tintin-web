import assert from 'node:assert/strict';
import test from 'node:test';

import { createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { preparePublicCheckoutOrder, variantIsValid } from '../../cloudflare/politica-checkout-publico.js';
import { SUPERADMIN_EMAIL } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const UID = 'uid_cliente_123';
const REQUEST_ID = 'req_abcdef123456';
const USER = { uid: UID, email: 'cuenta@example.com' };

function document(path, data) {
  return {
    name: `projects/test/databases/(default)/documents/${path}`,
    fields: encodeFirestoreFields(data),
    updateTime: '2026-09-26T12:00:00.000Z',
  };
}

function fakeStore(overrides = {}) {
  const entries = {
    'settings/general': { storeOpen: true, paymentMethods: { efectivo: true, transferencia: true }, paypal: { enabled: false } },
    'settings/shippingRates': {
      deliveryCities: [{ name: 'Asunción', price: 20000, departamento: 'Central' }, { name: 'Luque', price: null }],
      encomiendaCities: [{ name: 'Encarnación', departamento: 'Itapúa' }],
      deliveryCost: 25000,
    },
    [`checkoutGuards/${UID}`]: { lastCheckoutOrderId: `${UID}_${REQUEST_ID}`, lastCheckoutAt: new Date() },
    'products/aro_1': { name: 'Aro', price: 50000, stock: 5, active: true },
    'products/anillo_1': { name: 'Anillo', price: 80000, stock: 3, active: true, variants: { Talle: ['6', '7'] } },
    'settings/orderSequence': { lastNumber: 40 },
    ...overrides,
  };
  const map = new Map(
    Object.entries(entries)
      .filter(([, data]) => data !== null)
      .map(([path, data]) => [path, document(path, data)]),
  );
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

function draft(overrides = {}) {
  return {
    action: 'createOrder',
    idToken: 'token',
    requestId: REQUEST_ID,
    cartLines: [{ id: 'aro_1', qty: 2, variant: '' }],
    name: 'Clienta Real',
    phone: '595981000000',
    contactEmail: 'contacto@example.com',
    notes: '',
    selectedCity: 'Asunción',
    departamento: 'Central',
    address: 'Calle 123',
    referencia: 'Portón negro',
    mapLocation: { lat: -25.3, lng: -57.6, name: 'Casa', address: 'Calle 123' },
    shippingMethod: 'delivery',
    encomiendaMode: '',
    paymentMethod: 'transferencia',
    expectedSubtotal: 100000,
    expectedShippingCost: 20000,
    expectedShippingPending: false,
    expectedTotal: 120000,
    wantsInvoice: false,
    razonSocial: '',
    ruc: '',
    ci: '',
    ...overrides,
  };
}

async function checkout(payload, store = fakeStore(), user = USER) {
  const prepared = await preparePublicCheckoutOrder({}, payload, user, { get: store.get });
  const created = await createOrderAdmin(
    {},
    prepared.input,
    { uid: user.uid, email: user.email, role: 'client', origin: 'public-checkout' },
    // Sin historial TINPED en el fake: la secuencia sólo se concilia contra sí misma.
    { get: store.get, commit: store.commit, inspect: prepared.inspect, findFirst: async () => null, maxNumber: async () => 0 },
  );
  return { created, store };
}

function orderWrite(store) {
  const write = store.commits.at(-1).find(item => item.path.startsWith('orders/'));
  return decodeFirestoreFields(write.fields);
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, error => {
    assert.equal(error.code, code);
    return true;
  });
}

test('el navegador no puede fijar estado, pago, correo de cuenta ni costo de envío', async () => {
  const { created, store } = await checkout(draft({
    status: 'entregado',
    paymentStatus: 'pagado',
    payment: { status: 'pagado', method: 'transferencia' },
    userEmail: 'otra@example.com',
    shippingCost: 0,
    customerId: 'CUS_otra',
    userId: 'otra',
    invoice: { wanted: true, razonSocial: '<script>', ruc: 'x' },
  }));
  const order = orderWrite(store);
  assert.equal(created.duplicate, undefined);
  assert.equal(order.status, 'pendiente');
  assert.equal(order.paymentStatus, 'pendiente');
  assert.deepEqual(order.payment, { method: 'transferencia', status: 'pendiente' });
  assert.equal(order.userEmail, 'cuenta@example.com');
  assert.equal(order.contactEmail, 'contacto@example.com');
  assert.equal(order.userId, UID);
  assert.equal(order.customerId, `CUS_${UID}`);
  assert.equal(order.shippingCost, 20000);
  assert.equal(order.total, 120000);
  assert.deepEqual(order.invoice, { wanted: false, razonSocial: '', ruc: '' });
  assert.equal(order.shipping.mapLocation.name, 'Casa');
  assert.equal(order.shipping.zone, 'central');
  assert.equal(order.source, 'public-checkout-v1');
});

test('un total distinto al canónico devuelve quote_changed sin escribir', async () => {
  const store = fakeStore();
  await assert.rejects(
    checkout(draft({ expectedSubtotal: 2, expectedTotal: 20002 }), store),
    error => {
      assert.equal(error.code, 'quote_changed');
      assert.equal(error.status, 422);
      assert.equal(error.quote.subtotal, 100000);
      assert.equal(error.quote.total, 120000);
      assert.equal(error.quote.items[0].price, 50000);
      return true;
    },
  );
  assert.equal(store.commits.length, 0);
});

test('costo de envío a confirmar se guarda como pendiente', async () => {
  const { store } = await checkout(draft({
    selectedCity: 'Luque',
    departamento: '',
    expectedShippingCost: 0,
    expectedShippingPending: true,
    expectedTotal: 100000,
  }));
  const order = orderWrite(store);
  assert.equal(order.shippingPending, true);
  assert.equal(order.shippingCost, 0);
});

test('tienda cerrada, turno ausente o vencido y pago deshabilitado se rechazan', async () => {
  await rejectsWith(checkout(draft(), fakeStore({ 'settings/general': { storeOpen: false } })), 'store_closed');
  await rejectsWith(checkout(draft(), fakeStore({ [`checkoutGuards/${UID}`]: null })), 'checkout_guard_missing');
  await rejectsWith(
    checkout(draft(), fakeStore({
      [`checkoutGuards/${UID}`]: { lastCheckoutOrderId: `${UID}_${REQUEST_ID}`, lastCheckoutAt: new Date(Date.now() - 10 * 60 * 1000) },
    })),
    'checkout_guard_expired',
  );
  await rejectsWith(checkout(draft({ paymentMethod: 'paypal' })), 'payment_unavailable');
  await rejectsWith(
    checkout(draft(), fakeStore({ 'settings/general': { storeOpen: true, paymentMethods: { transferencia: false } } })),
    'payment_unavailable',
  );
});

test('el Super Admin puede comprar con la tienda cerrada y sin turno', async () => {
  const store = fakeStore({ 'settings/general': { storeOpen: false }, [`checkoutGuards/${UID}`]: null });
  const { created } = await checkout(draft(), store, { uid: UID, email: SUPERADMIN_EMAIL });
  assert.ok(created.orderId);
});

test('encomienda exige CI, modo válido y únicamente transferencia', async () => {
  const base = {
    selectedCity: 'Encarnación',
    departamento: 'Itapúa',
    shippingMethod: 'encomienda',
    encomiendaMode: 'agencia',
    mapLocation: null,
    expectedShippingCost: 0,
    expectedTotal: 100000,
    ci: '1234567',
  };
  const { store } = await checkout(draft(base));
  const order = orderWrite(store);
  assert.equal(order.shippingMethod, 'encomienda');
  assert.equal(order.shipping.zone, 'interior');
  assert.equal(order.shipping.address, '');
  assert.equal(order.ci, '1234567');

  await rejectsWith(checkout(draft({ ...base, ci: '12' })), 'ci_invalid');
  await rejectsWith(checkout(draft({ ...base, encomiendaMode: '' })), 'shipping_invalid');
  await rejectsWith(checkout(draft({ ...base, paymentMethod: 'efectivo' })), 'payment_unavailable');
  const paypalStore = fakeStore({ 'settings/general': { storeOpen: true, paymentMethods: { efectivo: true, transferencia: true }, paypal: { enabled: true } } });
  await rejectsWith(checkout(draft({ ...base, paymentMethod: 'paypal' }), paypalStore), 'payment_unavailable');
  await rejectsWith(checkout(draft({ ...base, shippingMethod: 'delivery' })), 'shipping_invalid');
});

test('delivery exige ubicación nombrada y factura exige RUC válido', async () => {
  await rejectsWith(checkout(draft({ mapLocation: null })), 'map_required');
  await rejectsWith(checkout(draft({ wantsInvoice: true, razonSocial: 'Empresa SA', ruc: '123' })), 'ruc_invalid');
  const { store } = await checkout(draft({ wantsInvoice: true, razonSocial: 'Empresa SA', ruc: '80012345-6', taxpayerType: 'juridica' }));
  assert.deepEqual(orderWrite(store).invoice, { wanted: true, razonSocial: 'Empresa SA', ruc: '80012345-6', taxpayerType: 'juridica' });
});

test('variantes: requerida, inválida y válida', async () => {
  const line = variant => ({ cartLines: [{ id: 'anillo_1', qty: 1, variant }], expectedSubtotal: 80000, expectedTotal: 100000 });
  await rejectsWith(checkout(draft(line(''))), 'variant_required');
  await rejectsWith(checkout(draft(line('9'))), 'invalid_variant');
  const { store } = await checkout(draft(line('7')));
  assert.equal(orderWrite(store).items[0].variant, '7');
  assert.equal(variantIsValid({ variants: [{ Color: 'Oro', price: 1 }] }, 'Oro'), true);
  assert.equal(variantIsValid({}, 'Oro'), false);
});

test('delivery exige referencia útil, pero retiro no conserva dirección ni referencia', async () => {
  await rejectsWith(checkout(draft({ referencia: '' })), 'reference_required');
  await rejectsWith(checkout(draft({ referencia: '  a  ' })), 'reference_required');
  const { store } = await checkout(draft({ selectedCity: '__retiro__', shippingMethod: 'retiro', referencia: '', mapLocation: null, expectedShippingCost: 0, expectedTotal: 100000 }));
  assert.equal(orderWrite(store).shipping.referencia, '');
});

test('factura conserva tipo oficial; no obliga datos fiscales cuando no se solicita', async () => {
  await rejectsWith(checkout(draft({ wantsInvoice: true, razonSocial: 'Nombre Fiscal', ruc: '1234567-8' })), 'taxpayer_type_required');
  await rejectsWith(checkout(draft({ wantsInvoice: true, razonSocial: 'Nombre Fiscal', ruc: '1234567-8', taxpayerType: '<script>' })), 'taxpayer_type_required');
  for (const taxpayerType of ['fisica', 'juridica']) {
    const { store } = await checkout(draft({ wantsInvoice: true, razonSocial: 'Nombre Fiscal', ruc: '1234567-8', taxpayerType }));
    assert.equal(orderWrite(store).invoice.taxpayerType, taxpayerType);
  }
  const { store } = await checkout(draft({ wantsInvoice: false, taxpayerType: 'invalid', ruc: 'invalid' }));
  assert.deepEqual(orderWrite(store).invoice, { wanted: false, razonSocial: '', ruc: '' });
});

test('stock insuficiente devuelve datos para corregir el carrito', async () => {
  await assert.rejects(
    checkout(draft({ cartLines: [{ id: 'aro_1', qty: 9 }], expectedSubtotal: 450000, expectedTotal: 470000 })),
    error => {
      assert.equal(error.code, 'insufficient_stock');
      assert.equal(error.productId, 'aro_1');
      assert.equal(error.available, 5);
      assert.equal(error.requested, 9);
      assert.notEqual(error.status, 409);
      return true;
    },
  );
});

test('borradores malformados se rechazan antes de leer Firestore', async () => {
  await rejectsWith(checkout(draft({ requestId: 'x' })), 'invalid_request_id');
  await rejectsWith(checkout(draft({ cartLines: [] })), 'empty_cart');
  await rejectsWith(checkout(draft({ cartLines: [{ id: 'aro_1', qty: 1, price: 1 }] })), 'invalid_cart');
  await rejectsWith(checkout(draft({ phone: '123' })), 'phone_invalid');
  await rejectsWith(checkout(draft({ expectedTotal: '120000' })), 'invalid_quote');
  await rejectsWith(checkout(draft({ mapLocation: { lat: 200, lng: 0 } })), 'map_invalid');
  await rejectsWith(checkout(draft({ paymentMethod: 'tarjeta' })), 'payment_required');
});

test('reintento del mismo requestId devuelve el pedido existente sin escribir', async () => {
  const store = fakeStore({
    [`orders/public_${UID}_${REQUEST_ID}`]: { orderNumber: 'TINPED41', userId: UID, status: 'pendiente' },
  });
  const { created } = await checkout(draft({ expectedTotal: 1 }), store);
  assert.equal(created.duplicate, true);
  assert.equal(store.commits.length, 0);
});

test('cotización canónica aplica 25.000 a ambas ciudades aunque settings conserve las zonas antiguas', async () => {
 for (const selectedCity of ['San Lorenzo','San Lorenzo Centro','San Lorenzo Alrededores','Fernando de la Mora']) {
  const store=fakeStore({'settings/shippingRates':{deliveryCities:[{name:'San Lorenzo Centro',price:15000},{name:'San Lorenzo Alrededores',price:20000},{name:'Fernando de la Mora',price:20000}]}});
  await checkout(draft({selectedCity,expectedShippingCost:25000,expectedTotal:125000}),store);
  assert.equal(orderWrite(store).shippingCost,25000);assert.equal(orderWrite(store).total,125000);
 }
});
