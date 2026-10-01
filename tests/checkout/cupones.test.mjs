import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

import { createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { preparePublicCheckoutOrder } from '../../cloudflare/politica-checkout-publico.js';
import { evaluateCoupon, normalizeCouponCode } from '../../cloudflare/cupones.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { CHECKOUT_DRAFT_KEYS } from '../../js/orders/politica-checkout.js';

const UID = 'uid_cliente_123';
const REQUEST_ID = 'req_abcdef123456';
const USER = { uid: UID, email: 'cuenta@example.com' };
const NOW = Date.parse('2026-10-01T12:00:00-03:00');

function document(path, data) {
  return { name: `projects/test/databases/(default)/documents/${path}`, fields: encodeFirestoreFields(data), updateTime: '2026-09-26T12:00:00.000Z' };
}

function store(extra = {}) {
  const entries = {
    'settings/general': { storeOpen: true, paymentMethods: { efectivo: true, transferencia: true }, paypal: { enabled: false } },
    'settings/shippingRates': { deliveryCities: [{ name: 'Asunción', price: 20000, departamento: 'Central' }], encomiendaCities: [{ name: 'Encarnación', departamento: 'Itapúa' }], deliveryCost: 25000 },
    [`checkoutGuards/${UID}`]: { lastCheckoutOrderId: `${UID}_${REQUEST_ID}`, lastCheckoutAt: new Date() },
    'products/aro_1': { name: 'Aro', price: 50000, stock: 5, active: true },
    'settings/orderSequence': { lastNumber: 40 },
    'coupons/ENVIO': { code: 'ENVIO', type: 'free_shipping', active: true, startsAt: '', endsAt: '', maxUses: 10, maxUsesPerCustomer: 1, usedCount: 0 },
    ...extra,
  };
  const map = new Map(Object.entries(entries).filter(([, d]) => d !== null).map(([p, d]) => [p, document(p, d)]));
  const commits = [];
  return {
    commits,
    get: async (_env, path) => map.get(decodeURIComponent(path)) || null,
    commit: async (_env, writes) => { commits.push(writes); return { writeResults: writes.map(() => ({})) }; },
  };
}

function draft(over = {}) {
  return {
    action: 'createOrder', idToken: 't', requestId: REQUEST_ID,
    cartLines: [{ id: 'aro_1', qty: 2, variant: '' }],
    name: 'Clienta Real', phone: '595981000000', contactEmail: 'c@example.com', notes: '',
    selectedCity: 'Asunción', departamento: 'Central', address: 'Calle 123', referencia: 'Portón',
    mapLocation: { lat: -25.3, lng: -57.6, name: 'Casa', address: 'Calle 123' },
    shippingMethod: 'delivery', encomiendaMode: '', paymentMethod: 'transferencia',
    expectedSubtotal: 100000, expectedShippingCost: 0, expectedShippingPending: false, expectedTotal: 100000,
    wantsInvoice: false, razonSocial: '', ruc: '', ci: '', couponCode: 'envio',
    ...over,
  };
}

async function run(payload, st) {
  const prepared = await preparePublicCheckoutOrder({}, payload, USER, { get: st.get });
  const created = await createOrderAdmin({}, prepared.input, { uid: UID, email: USER.email, role: 'client', origin: 'public-checkout' }, { get: st.get, commit: st.commit, inspect: prepared.inspect });
  return { prepared, created };
}

test('evaluateCoupon cubre vigencia, límites y aplicabilidad', () => {
  const base = { active: true, type: 'free_shipping', usedCount: 0 };
  const ctx = { now: NOW, shippingCost: 20000 };
  assert.deepEqual(evaluateCoupon(base, null, ctx), { ok: true, shippingDiscount: 20000 });
  assert.equal(evaluateCoupon(null, null, ctx).code, 'coupon_not_found');
  assert.equal(evaluateCoupon({ ...base, active: false }, null, ctx).code, 'coupon_inactive');
  assert.equal(evaluateCoupon({ ...base, startsAt: '2026-10-02' }, null, ctx).code, 'coupon_not_started');
  assert.equal(evaluateCoupon({ ...base, endsAt: '2026-09-30' }, null, ctx).code, 'coupon_expired');
  assert.equal(evaluateCoupon({ ...base, endsAt: '2026-10-01' }, null, ctx).ok, true);
  assert.equal(evaluateCoupon({ ...base, maxUses: 3, usedCount: 3 }, null, ctx).code, 'coupon_exhausted');
  assert.equal(evaluateCoupon({ ...base, maxUsesPerCustomer: 1 }, { count: 1 }, ctx).code, 'coupon_customer_limit');
  assert.equal(evaluateCoupon(base, null, { now: NOW, shippingCost: 0 }).code, 'coupon_not_applicable');
});

test('normalizeCouponCode acepta solo códigos seguros', () => {
  assert.equal(normalizeCouponCode(' envio gratis '), 'ENVIOGRATIS');
  assert.equal(normalizeCouponCode('ab'), '');
  assert.equal(normalizeCouponCode(' envio-10 '), 'ENVIO-10');
  assert.equal(normalizeCouponCode('a/b'), '');
  assert.equal(normalizeCouponCode(''), '');
});

test('un cupón válido deja el envío en 0 y registra uso y canje atómicos', async () => {
  const st = store();
  const { created } = await run(draft(), st);
  assert.ok(created);
  const writes = st.commits.at(-1);
  const order = decodeFirestoreFields(writes.find(w => w.path.startsWith('orders/')).fields);
  assert.equal(order.shippingCost, 0);
  assert.equal(order.shippingDiscount, 20000);
  assert.equal(order.total, 100000);
  assert.equal(order.coupon.code, 'ENVIO');
  const couponWrite = writes.find(w => w.path === 'coupons/ENVIO');
  assert.ok(couponWrite && couponWrite.currentDocument);
  assert.equal(decodeFirestoreFields(couponWrite.fields).usedCount, 1);
  const redemption = writes.find(w => w.path.startsWith('couponRedemptions/'));
  assert.ok(redemption && redemption.currentDocument);
  assert.equal(decodeFirestoreFields(redemption.fields).count, 1);
});

test('cupón vencido, agotado o del cliente agotado se rechaza con 422', async () => {
  for (const [extra, code] of [
    [{ 'coupons/ENVIO': { code: 'ENVIO', type: 'free_shipping', active: true, endsAt: '2020-01-01', usedCount: 0 } }, 'coupon_expired'],
    [{ 'coupons/ENVIO': { code: 'ENVIO', type: 'free_shipping', active: true, maxUses: 1, usedCount: 1 } }, 'coupon_exhausted'],
    [{ [`couponRedemptions/ENVIO__${UID}`]: { code: 'ENVIO', uid: UID, count: 1 } }, 'coupon_customer_limit'],
    [{ 'coupons/ENVIO': null }, 'coupon_not_found'],
  ]) {
    await assert.rejects(run(draft(), store(extra)), e => { assert.equal(e.code, code); assert.equal(e.status, 422); return true; });
  }
});

test('un cupón no aplica a envío por encomienda: se rechaza y sin cupón el envío se cobra', async () => {
  await assert.rejects(run(draft({ shippingMethod: 'encomienda', encomiendaMode: 'agencia', selectedCity: 'Encarnación', departamento: 'Itapúa', ci: '1234567', address: '', referencia: '', mapLocation: null, expectedShippingCost: 0, expectedShippingPending: true, expectedTotal: 100000 }), store()), e => e.code === 'coupon_not_applicable');
  const st = store();
  await run(draft({ couponCode: '', expectedShippingCost: 20000, expectedTotal: 120000 }), st);
  const order = decodeFirestoreFields(st.commits.at(-1).find(w => w.path.startsWith('orders/')).fields);
  assert.equal(order.shippingCost, 20000);
  assert.equal(order.coupon, undefined);
});

test('contrato: couponCode está en el borrador y en Apps Script; reglas restringen a super admin', async () => {
  assert.ok(CHECKOUT_DRAFT_KEYS.includes('couponCode'));
  const [gs, rules] = await Promise.all([fs.readFile('apps-script/CrearPedido.gs', 'utf8'), fs.readFile('firestore.rules', 'utf8')]);
  assert.match(gs, /'couponCode'/);
  const redemption = rules.slice(rules.indexOf('match /couponRedemptions/'));
  assert.match(redemption.slice(0, 140), /allow create, update, delete: if false/);
  const coupons = rules.slice(rules.indexOf('match /coupons/'), rules.indexOf('match /couponRedemptions/'));
  assert.doesNotMatch(coupons, /allow (read|get|list)[^;]*:\s*if true/);
});
