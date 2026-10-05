import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import {
  applyQuotePrices,
  buildQuoteLines,
  createWholesaleQuote,
  formatQuoteNumber,
  normalizeQuoteRequest,
  respondWholesaleQuote,
} from '../../cloudflare/mayoristas.js';
import { afterWholesaleQuoteCreated, afterWholesaleQuoteResponded, buildWholesaleApprovedEmail } from '../../cloudflare/mayoristas-avisos.js';
import { onRequest as quoteEndpoint } from '../../functions/api/wholesale-quote.js';
import { onRequest as adminEndpoint } from '../../functions/api/admin-wholesale.js';

const validRequest = {
  requestId: 'req_abcdef123456',
  businessName: 'Emprende Bella',
  whatsapp: '+595 981 123 456',
  city: 'Luque',
  notes: 'Para reventa',
  items: [{ id: 'p1', qty: 10 }, { id: 'p2', qty: 5, variant: 'Dorado' }, { id: 'p1', qty: 5 }],
};

// Firestore en memoria con la misma forma que la API REST (fields + updateTime).
function memoryStore(initial = {}) {
  const docs = new Map(Object.entries(initial).map(([path, data]) => [path, { fields: encodeFirestoreFields(data), updateTime: 't0' }]));
  let tick = 0;
  const commits = [];
  return {
    docs,
    commits,
    get: async (_env, path) => docs.get(path) || null,
    commit: async (_env, writes) => {
      for (const write of writes) {
        const current = docs.get(write.path);
        const pre = write.currentDocument || {};
        if (pre.exists === false && current) throw Object.assign(new Error('conflict'), { status: 409 });
        if (pre.exists === true && !current) throw Object.assign(new Error('missing'), { status: 409 });
        if (pre.updateTime && current?.updateTime !== pre.updateTime) throw Object.assign(new Error('conflict'), { status: 409 });
      }
      for (const write of writes) {
        const current = docs.get(write.path);
        const fields = write.mergeFields && current ? { ...current.fields, ...write.fields } : write.fields;
        tick += 1;
        docs.set(write.path, { fields, updateTime: `t${tick}` });
      }
      commits.push(writes.map(write => write.path));
    },
  };
}

const catalog = {
  'users/uid1': { name: 'Ana', email: 'ana@example.com', customerId: 'CUS_uid1', role: 'client', blocked: false },
  'products/p1': { name: 'Aros Luna', price: 50000, imageUrl: 'https://img/p1.jpg', active: true },
  'products/p2': { name: 'Pulsera Sol', price: 80000, active: true },
};

test('valida y agrupa lo que manda la clienta sin aceptar precios ni campos extra', () => {
  const request = normalizeQuoteRequest(validRequest);
  assert.deepEqual(request.lines, [{ id: 'p1', variant: '', qty: 15 }, { id: 'p2', variant: 'Dorado', qty: 5 }]);
  assert.equal(request.whatsapp, '595981123456');
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, items: [{ id: 'p1', qty: 1, price: 1 }] }), /invalid_line/);
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, items: [] }), /empty_quote/);
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, items: [{ id: 'p1', qty: 0 }] }), /invalid_line/);
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, whatsapp: '12' }), /whatsapp_invalid/);
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, businessName: '' }), /business_name_required/);
  assert.throws(() => normalizeQuoteRequest({ ...validRequest, requestId: 'x' }), /invalid_request_id/);
  assert.equal(formatQuoteNumber(7), 'MAY-000007');
});

test('las líneas salen del catálogo y rechazan productos inactivos o inexistentes', () => {
  const products = new Map([['p1', { name: 'Aros', price: 50000, active: true }], ['p2', { name: 'Off', price: 1, active: false }]]);
  const lines = buildQuoteLines([{ id: 'p1', variant: '', qty: 3 }], products);
  assert.equal(lines[0].retailUnitPrice, 50000);
  assert.equal(lines[0].unitPrice, null);
  assert.throws(() => buildQuoteLines([{ id: 'p2', variant: '', qty: 1 }], products), /product_inactive/);
  assert.throws(() => buildQuoteLines([{ id: 'p9', variant: '', qty: 1 }], products), /product_not_found/);
});

test('los precios se validan y aprobar exige precio en todas las líneas', () => {
  const items = [{ qty: 10 }, { qty: 5 }];
  assert.deepEqual(applyQuotePrices(items, [30000, null]).total, 300000);
  assert.equal(applyQuotePrices(items, [30000, 60000]).total, 600000);
  assert.throws(() => applyQuotePrices(items, [30000, null], { requireAll: true }), /price_required/);
  assert.throws(() => applyQuotePrices(items, [-1, 1]), /price_invalid/);
  assert.throws(() => applyQuotePrices(items, [1.5, 1]), /price_invalid/);
  assert.throws(() => applyQuotePrices(items, [1]), /prices_mismatch/);
});

test('crear una cotización es idempotente y marca la cuenta como solicitante', async () => {
  const store = memoryStore(catalog);
  const user = { uid: 'uid1', email: 'Ana@Example.com' };
  const first = await createWholesaleQuote({}, validRequest, user, store);
  assert.equal(first.duplicate, false);
  assert.equal(first.quoteNumber, 'MAY-000001');
  assert.equal(first.quote.status, 'pendiente');
  assert.equal(first.quote.itemCount, 20);
  assert.equal(first.quote.retailReferenceTotal, 15 * 50000 + 5 * 80000);
  const again = await createWholesaleQuote({}, validRequest, user, store);
  assert.equal(again.duplicate, true);
  assert.equal(store.commits.length, 1);
  const second = await createWholesaleQuote({}, { ...validRequest, requestId: 'req_second_123456' }, user, store);
  assert.equal(second.quoteNumber, 'MAY-000002');
  assert.ok(store.docs.get('users/uid1').fields.wholesaleStatus.stringValue === 'solicitado');
});

test('una cuenta bloqueada no puede cotizar', async () => {
  const store = memoryStore({ ...catalog, 'users/uid1': { ...catalog['users/uid1'], blocked: true } });
  await assert.rejects(createWholesaleQuote({}, validRequest, { uid: 'uid1', email: 'ana@example.com' }, store), /account_blocked/);
});

test('Super Admin guarda precios, aprueba y la cuenta queda mayorista aprobada', async () => {
  const store = memoryStore(catalog);
  const created = await createWholesaleQuote({}, validRequest, { uid: 'uid1', email: 'ana@example.com' }, store);
  const actor = { uid: 'super', email: 'tintinaccs@gmail.com' };
  const saved = await respondWholesaleQuote({}, { quoteId: created.quoteId, decision: 'guardar', prices: [30000, null] }, actor, store);
  assert.equal(saved.quote.status, 'pendiente');
  assert.equal(saved.quote.total, 450000);
  await assert.rejects(respondWholesaleQuote({}, { quoteId: created.quoteId, decision: 'aprobar', prices: [30000, null] }, actor, store), /price_required/);
  await assert.rejects(respondWholesaleQuote({}, { quoteId: created.quoteId, decision: 'aprobar', prices: [30000, 60000], expectedRevision: 1 }, actor, store), /stale_quote/);
  const approved = await respondWholesaleQuote({}, { quoteId: created.quoteId, decision: 'aprobar', prices: [30000, 60000], adminNote: 'Envío gratis' }, actor, store);
  assert.equal(approved.quote.status, 'aprobada');
  assert.equal(approved.quote.total, 15 * 30000 + 5 * 60000);
  assert.equal(store.docs.get('users/uid1').fields.wholesaleStatus.stringValue, 'aprobado');
  await assert.rejects(respondWholesaleQuote({}, { quoteId: created.quoteId, decision: 'rechazar' }, actor, store), /quote_closed/);
});

test('aprobar avisa a la clienta y manda el correo; rechazar solo avisa', async () => {
  const calls = [];
  const deps = {
    notifyUser: async (_env, uid, event, key) => calls.push(['user', uid, event.kind, key]),
    sendEmail: async (_env, quote) => calls.push(['email', quote.quoteNumber]),
    sync: async () => calls.push(['sheets']),
  };
  const quote = { quoteId: 'WQ_uid1_req_abcdef123456', quoteNumber: 'MAY-000001', userId: 'uid1' };
  await afterWholesaleQuoteResponded({}, { decision: 'aprobar', quote }, deps);
  assert.deepEqual(calls.map(call => call[0]).sort(), ['email', 'sheets', 'user']);
  assert.equal(calls.find(call => call[0] === 'user')[2], 'wholesale_quote_approved');
  calls.length = 0;
  await afterWholesaleQuoteResponded({}, { decision: 'rechazar', quote }, deps);
  assert.deepEqual(calls.map(call => call[0]).sort(), ['sheets', 'user']);
  calls.length = 0;
  await afterWholesaleQuoteResponded({}, { decision: 'guardar', quote }, deps);
  assert.deepEqual(calls.map(call => call[0]), ['sheets']);
});

test('una cotización nueva avisa al panel (con push de pedido) y a la clienta; un reintento no', async () => {
  const calls = [];
  const deps = {
    notifyAdmin: async (_env, event) => calls.push(['admin', event.kind]),
    notifyUser: async (_env, _uid, event) => calls.push(['user', event.kind]),
    sync: async () => calls.push(['sheets']),
  };
  const quote = { quoteId: 'WQ_uid1_req_abcdef123456', quoteNumber: 'MAY-000001', userId: 'uid1', businessName: 'Bella', itemCount: 3, items: [{}] };
  await afterWholesaleQuoteCreated({}, { quote, duplicate: false }, deps);
  assert.deepEqual(calls.map(call => call.join(':')).sort(), ['admin:wholesale_quote_created', 'sheets', 'user:wholesale_quote_received']);
  calls.length = 0;
  await afterWholesaleQuoteCreated({}, { quote, duplicate: true }, deps);
  assert.equal(calls.length, 0);
});

test('el correo de aprobación confirma, menciona WhatsApp y escapa el contenido', () => {
  const email = buildWholesaleApprovedEmail({
    quoteNumber: 'MAY-000001', customerName: 'Ana <script>', total: 600000, adminNote: '',
    items: [{ name: 'Aros <b>', qty: 15, lineTotal: 450000 }],
  });
  assert.match(email.subject, /MAY-000001 fue aceptada/);
  assert.match(email.text, /WhatsApp/);
  assert.doesNotMatch(email.html, /<script>|<b>/);
});

test('los endpoints exigen origen permitido y sesión', async () => {
  const request = (url, headers = {}) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
  const foreign = await quoteEndpoint({ request: request('https://tintinaccesorios.pages.dev/api/wholesale-quote', { origin: 'https://evil.example' }), env: {} });
  assert.equal(foreign.status, 403);
  const anonymous = await quoteEndpoint({ request: request('https://tintinaccesorios.pages.dev/api/wholesale-quote', { origin: 'https://tintinaccesorios.pages.dev' }), env: {} });
  assert.equal(anonymous.status, 401);
  const adminAnonymous = await adminEndpoint({ request: request('https://tintinaccesorios.pages.dev/api/admin-wholesale', { origin: 'https://tintinaccesorios.pages.dev' }), env: {} });
  assert.ok([401, 403].includes(adminAnonymous.status));
});
