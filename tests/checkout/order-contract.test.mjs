import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  CHECKOUT_DRAFT_KEYS,
  aggregateCheckoutCart,
  composeCheckoutDraft
} from '../../js/orders/politica-checkout.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const phase4Source = fs.readFileSync(path.join(root, 'apps-script', 'CrearPedido.gs'), 'utf8');

function phase4Context() {
  const context = vm.createContext({ FIRESTORE_PROJECT_ID_: 'demo-tintin', console });
  vm.runInContext(phase4Source, context, { filename: 'CrearPedido.gs' });
  return context;
}

function draftFor(shipping) {
  return composeCheckoutDraft({
    requestId: 'request_123456789',
    items: [{ id: 'p1', qty: 2, variant: 'Dorado / M' }],
    name: 'Clienta Tintin',
    phone: '595981123456',
    contactEmail: 'clienta@example.com',
    notes: '',
    selectedCity: shipping.method === 'retiro' ? '__retiro__' : shipping.city,
    departamento: shipping.method === 'retiro' ? '' : 'Central',
    address: shipping.method === 'encomienda' && shipping.encomiendaMode === 'puerta' ? 'Calle 123' : '',
    referencia: '',
    shipping,
    paymentMethod: 'transferencia',
    subtotal: 50000
  });
}

test('buildDraft produce exactamente un payload aceptado por phase4CreateOrder_', () => {
  const server = phase4Context();
  const draft = draftFor({ method: 'delivery', city: 'Fernando de la Mora', cost: 20000, pending: false, mapLocation: { lat: -25.3, lng: -57.5, name: 'Casa', address: 'Calle' } });
  assert.deepEqual(Object.keys(draft), [...CHECKOUT_DRAFT_KEYS]);
  assert.equal(server.phase4HasOnlyKeys_({ action: 'createOrder', idToken: 'token', ...draft }, server.PHASE4_ALLOWED_PAYLOAD_KEYS_), true);
  assert.equal(draft.shippingMethod, 'delivery');
  assert.equal(draft.encomiendaMode, '');
  assert.equal(draft.expectedTotal, 70000);
});

test('delivery suma tarifa y conserva ubicación', () => {
  const draft = draftFor({ method: 'delivery', city: 'Fernando de la Mora', cost: 20000, pending: false, mapLocation: { lat: -25.3, lng: -57.5, name: 'Casa', address: 'Calle' } });
  assert.equal(draft.expectedShippingCost, 20000);
  assert.equal(draft.expectedTotal, 70000);
  assert.equal(draft.mapLocation.name, 'Casa');
});

test('encomienda agencia cuesta cero y no envía ubicación', () => {
  const draft = draftFor({ method: 'encomienda', encomiendaMode: 'agencia', city: 'Encarnación', cost: 0, pending: false, mapLocation: null });
  assert.equal(draft.encomiendaMode, 'agencia');
  assert.equal(draft.mapLocation, null);
  assert.equal(draft.expectedShippingCost, 0);
  assert.equal(draft.expectedTotal, 50000);
});

test('encomienda puerta conserva modo, dirección y ubicación sin sumar flete', () => {
  const draft = draftFor({ method: 'encomienda', encomiendaMode: 'puerta', city: 'Encarnación', cost: 0, pending: false, mapLocation: { lat: -27.3, lng: -55.9, name: 'Casa', address: 'Calle 123' } });
  assert.equal(draft.encomiendaMode, 'puerta');
  assert.equal(draft.address, 'Calle 123');
  assert.equal(draft.mapLocation.name, 'Casa');
  assert.equal(draft.expectedTotal, 50000);
});

test('CI sólo se conserva en el draft para encomienda; factura sólo si se pidió', () => {
  const encomienda = draftFor({ method: 'encomienda', encomiendaMode: 'agencia', city: 'Encarnación', cost: 0, pending: false, mapLocation: null });
  assert.equal(encomienda.ci, '');
  const draft = composeCheckoutDraft({
    requestId: 'request_123456789',
    items: [{ id: 'p1', qty: 2, variant: 'Dorado / M' }],
    name: 'Clienta Tintin', phone: '595981123456', contactEmail: 'clienta@example.com', notes: '',
    selectedCity: 'Encarnación', departamento: 'Itapúa', address: '', referencia: '',
    shipping: { method: 'encomienda', encomiendaMode: 'agencia', city: 'Encarnación', cost: 0, pending: false, mapLocation: null },
    paymentMethod: 'transferencia', subtotal: 50000,
    ci: '4123456', wantsInvoice: true, razonSocial: 'Tintin SA', ruc: '80012345-6'
  });
  assert.equal(draft.ci, '4123456');
  assert.equal(draft.wantsInvoice, true);
  assert.equal(draft.razonSocial, 'Tintin SA');
  assert.equal(draft.ruc, '80012345-6');

  const retiro = composeCheckoutDraft({
    requestId: 'request_123456789',
    items: [{ id: 'p1', qty: 2, variant: 'Dorado / M' }],
    name: 'Clienta Tintin', phone: '595981123456', contactEmail: 'clienta@example.com', notes: '',
    selectedCity: '__retiro__', departamento: '', address: '', referencia: '',
    shipping: { method: 'retiro', city: 'Retiro coordinado', cost: 0, pending: false, mapLocation: null },
    paymentMethod: 'transferencia', subtotal: 50000,
    ci: '4123456', wantsInvoice: false
  });
  assert.equal(retiro.ci, '', 'el retiro no exige CI aunque se haya escrito algo en el campo');
  assert.equal(retiro.wantsInvoice, false);
  assert.equal(retiro.razonSocial, '');
  assert.equal(retiro.ruc, '');
});

test('servidor rechaza CI inválida en encomienda y RUC/razón social inválidos si se pidió factura', () => {
  const server = phase4Context();
  server.SUPER_ADMIN_EMAIL = 'teamdinas@gmail.com';
  server.verifyFirebaseIdToken_ = () => ({ ok: true, emailVerified: true, uid: 'admin-uid', email: 'teamdinas@gmail.com' });
  server.phase3EmailMatches_ = (email, expected) => email === expected;
  server.phase4BeginTransaction_ = () => ({ ok: true, transaction: 'tx' });
  server.phase4Rollback_ = () => {};
  server.phase4BatchGet_ = () => ({ ok: true, documents: {
    'orders/admin-uid_request_123456789': null,
    'settings/general': { paymentMethods: { transferencia: true }, whatsappNumber: '595981299331' },
    'settings/shippingRates': { encomiendaCities: [{ name: 'Encarnación', price: 0 }] },
    'settings/orderSequence': { lastNumber: 41, lastCode: 'TINPED41' },
    'users/admin-uid': { role: 'superadmin', customerId: 'CUS_admin-uid', identityVersion: 1 },
    'checkoutGuards/admin-uid': null,
    'products/p1': { name: 'Aro', price: 10000, stock: 10, active: true }
  }});
  let committedWrites = null;
  server.phase4Commit_ = writes => { committedWrites = writes; return { ok: true }; };

  const basePayload = {
    requestId: 'request_123456789', cartLines: [{ id: 'p1', qty: 5, variant: '' }],
    name: 'Admin Tintin', phone: '595981123456', contactEmail: 'teamdinas@gmail.com', notes: '',
    selectedCity: 'Encarnación', departamento: 'Itapúa', address: '', referencia: '', mapLocation: null,
    shippingMethod: 'encomienda', encomiendaMode: 'agencia', paymentMethod: 'transferencia',
    expectedSubtotal: 50000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 50000
  };

  const sinCi = server.phase4CreateOrder_({ ...basePayload, ci: '' }, 'token');
  assert.equal(sinCi.error, 'ci_invalid');
  assert.equal(committedWrites, null);

  const ciLetras = server.phase4CreateOrder_({ ...basePayload, ci: 'abc1234' }, 'token');
  assert.equal(ciLetras.error, 'ci_invalid');

  const facturaSinRazonSocial = server.phase4CreateOrder_({ ...basePayload, ci: '4123456', wantsInvoice: true, ruc: '80012345-6' }, 'token');
  assert.equal(facturaSinRazonSocial.error, 'razon_social_required');

  const facturaRucInvalido = server.phase4CreateOrder_({ ...basePayload, ci: '4123456', wantsInvoice: true, razonSocial: 'Tintin SA', ruc: '80012345' }, 'token');
  assert.equal(facturaRucInvalido.error, 'ruc_invalid');

  const ok = server.phase4CreateOrder_({ ...basePayload, ci: '4123456', wantsInvoice: true, razonSocial: 'Tintin SA', ruc: '80012345-6' }, 'token');
  assert.equal(ok.ok, true);
  assert.equal(ok.order.ci, '4123456');
  assert.equal(ok.order.invoice.wanted, true);
  assert.equal(ok.order.invoice.razonSocial, 'Tintin SA');
  assert.equal(ok.order.invoice.ruc, '80012345-6');

  committedWrites = null;
  const sinFacturaNiCi = server.phase4CreateOrder_({ ...basePayload, ci: '4123456' }, 'token');
  assert.equal(sinFacturaNiCi.ok, true);
  assert.equal(sinFacturaNiCi.order.invoice.wanted, false);
  assert.equal(sinFacturaNiCi.order.invoice.razonSocial, '');
  assert.equal(sinFacturaNiCi.order.invoice.ruc, '');
});

test('retiro cuesta cero y no incluye ubicación privada', () => {
  const draft = draftFor({ method: 'retiro', city: 'Retiro coordinado', cost: 0, pending: false, mapLocation: null });
  assert.equal(draft.shippingMethod, 'retiro');
  assert.equal(draft.mapLocation, null);
  assert.equal(draft.expectedTotal, 50000);
});

test('servidor recalcula delivery, encomienda y retiro desde configuración vigente', () => {
  const server = phase4Context();
  const rates = {
    deliveryCities: [{ name: 'Fernando de la Mora', price: 20000 }],
    encomiendaCities: [{ name: 'Encarnación', price: 35000 }]
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(server.phase4ResolveShipping_(rates, 'Fernando de la Mora'))),
    { ok: true, method: 'delivery', city: 'Fernando de la Mora', cost: 20000, pending: false, rateIndex: 0 }
  );
  assert.equal(server.phase4ResolveShipping_(rates, 'Encarnación').cost, 0);
  assert.equal(server.phase4ResolveShipping_(rates, 'Encarnación').method, 'encomienda');
  assert.equal(server.phase4ResolveShipping_(rates, '__retiro__').cost, 0);
});

test('cliente y servidor normalizan productId repetido con cantidad agregada', () => {
  const client = aggregateCheckoutCart([
    { id: 'p1', qty: 2, variant: 'Dorado / M' },
    { id: 'p1', qty: 3, variant: 'Plateado / M' }
  ]);
  assert.deepEqual(client, [{ id: 'p1', qty: 5, variants: ['Dorado / M', 'Plateado / M'] }]);
  const server = phase4Context().phase4NormalizeCartLines_([
    { id: 'p1', qty: 2, variant: 'Dorado / M' },
    { id: 'p1', qty: 3, variants: ['Plateado / M'] }
  ]);
  assert.equal(server.ok, true);
  assert.equal(server.lines.length, 1);
  assert.equal(server.lines[0].qty, 5);
});

test('servidor rechaza variante inexistente y exige variante cuando corresponde', () => {
  const server = phase4Context();
  const product = { variants: { Color: ['Dorado', 'Plateado'], Talla: ['S', 'M'] } };
  assert.equal(server.phase4VariantIsValid_(product, 'Dorado / M'), true);
  assert.equal(server.phase4VariantIsValid_(product, 'Rojo / M'), false);
  assert.equal(server.phase4VariantIsValid_(product, ''), false);
  assert.equal(server.phase4VariantIsValid_({ variants: null }, 'Inventada'), false);
  assert.equal(server.phase4VariantIsValid_({ variants: null }, ''), true);
});

test('PayPal queda rechazado en Apps Script hasta habilitarlo expresamente', () => {
  const server = phase4Context();
  server.SUPER_ADMIN_EMAIL = 'teamdinas@gmail.com';
  server.verifyFirebaseIdToken_ = () => ({ ok: true, emailVerified: true, uid: 'admin-uid', email: 'teamdinas@gmail.com' });
  server.phase3EmailMatches_ = (email, expected) => email === expected;
  server.phase4BeginTransaction_ = () => ({ ok: true, transaction: 'tx' });
  server.phase4Rollback_ = () => {};
  server.phase4BatchGet_ = () => ({ ok: true, documents: {
    'orders/admin-uid_request_123456789': null,
    'settings/general': { paymentMethods: { transferencia: true }, whatsappNumber: '595981299331' },
    'settings/shippingRates': {},
    'users/admin-uid': { role: 'superadmin', customerId: 'CUS_admin-uid', identityVersion: 1 },
    'checkoutGuards/admin-uid': null,
    'products/p1': { name: 'Aro', price: 10000, stock: 10, active: true }
  }});
  server.phase4Commit_ = () => { throw new Error('No debe escribir un pedido PayPal deshabilitado'); };

  const result = server.phase4CreateOrder_({
    requestId: 'request_123456789', cartLines: [{ id: 'p1', qty: 5, variant: '' }],
    name: 'Admin Tintin', phone: '595981123456', contactEmail: 'teamdinas@gmail.com', notes: '',
    selectedCity: '__retiro__', departamento: '', address: '', referencia: '', mapLocation: null,
    shippingMethod: 'retiro', encomiendaMode: '', paymentMethod: 'paypal',
    expectedSubtotal: 50000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 50000
  }, 'token');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'payment_unavailable');
});

test('pedido manipulado con productId repetido descuenta stock agregado una sola vez', () => {
  const server = phase4Context();
  let committedWrites = null;
  server.SUPER_ADMIN_EMAIL = 'teamdinas@gmail.com';
  server.verifyFirebaseIdToken_ = () => ({ ok: true, emailVerified: true, uid: 'admin-uid', email: 'teamdinas@gmail.com' });
  server.phase3EmailMatches_ = (email, expected) => email === expected;
  server.phase4BeginTransaction_ = () => ({ ok: true, transaction: 'tx' });
  server.phase4Rollback_ = () => {};
  server.phase4BatchGet_ = () => ({ ok: true, documents: {
    'orders/admin-uid_request_123456789': null,
    'settings/general': { paymentMethods: { transferencia: true }, whatsappNumber: '595981299331' },
    'settings/shippingRates': {},
    'settings/orderSequence': { lastNumber: 41, lastCode: 'TINPED41' },
    'users/admin-uid': { role: 'superadmin', customerId: 'CUS_admin-uid', identityVersion: 1 },
    'checkoutGuards/admin-uid': null,
    'products/p1': { name: 'Aro', price: 10000, stock: 10, active: true, variants: { Color: ['Dorado', 'Plateado'], Talla: ['M'] } }
  }});
  server.phase4Commit_ = writes => { committedWrites = writes; return { ok: true }; };

  const result = server.phase4CreateOrder_({
    requestId: 'request_123456789',
    cartLines: [
      { id: 'p1', qty: 2, variant: 'Dorado / M' },
      { id: 'p1', qty: 3, variant: 'Plateado / M' }
    ],
    name: 'Admin Tintin', phone: '595981123456', contactEmail: 'teamdinas@gmail.com', notes: '',
    selectedCity: '__retiro__', departamento: '', address: '', referencia: '', mapLocation: null,
    shippingMethod: 'retiro', encomiendaMode: '', paymentMethod: 'transferencia',
    expectedSubtotal: 50000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 50000
  }, 'token');

  assert.equal(result.ok, true);
  assert.equal(result.order.items.length, 1);
  assert.equal(result.order.items[0].qty, 5);
  assert.equal(result.order.orderNumber, 'TINPED42');
  assert.equal(result.order.shortId, 'TINPED42');
  assert.equal(committedWrites.length, 3);
  assert.equal(committedWrites[1].update.name.endsWith('/settings/orderSequence'), true);
  assert.equal(committedWrites[1].update.fields.lastNumber.integerValue, '42');
  assert.equal(committedWrites[1].update.fields.lastCode.stringValue, 'TINPED42');
  assert.equal(committedWrites[2].update.name.endsWith('/products/p1'), true);
  assert.equal(committedWrites[2].update.fields.stock.integerValue, '5');

  committedWrites = null;
  const invalidVariant = server.phase4CreateOrder_({
    requestId: 'request_123456789', cartLines: [{ id: 'p1', qty: 5, variant: 'Rojo / M' }],
    name: 'Admin Tintin', phone: '595981123456', contactEmail: 'teamdinas@gmail.com', notes: '',
    selectedCity: '__retiro__', departamento: '', address: '', referencia: '', mapLocation: null,
    shippingMethod: 'retiro', encomiendaMode: '', paymentMethod: 'transferencia',
    expectedSubtotal: 50000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 50000
  }, 'token');
  assert.equal(invalidVariant.error, 'invalid_variant');
  assert.equal(committedWrites, null);

  const mismatchedShipping = server.phase4CreateOrder_({
    requestId: 'request_123456789', cartLines: [{ id: 'p1', qty: 5, variant: 'Dorado / M' }],
    name: 'Admin Tintin', phone: '595981123456', contactEmail: 'teamdinas@gmail.com', notes: '',
    selectedCity: '__retiro__', departamento: '', address: '', referencia: '', mapLocation: null,
    shippingMethod: 'delivery', encomiendaMode: '', paymentMethod: 'transferencia',
    expectedSubtotal: 50000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 50000
  }, 'token');
  assert.equal(mismatchedShipping.error, 'shipping_changed');
});
