import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

const source = fs.readFileSync(new URL('../../js/pages/profile/mayorista-perfil.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ request, catalogFetch } = {}) {
  const timers = [], callbacks = [], notices = [], button = { disabled: false }, list = { innerHTML: '' }, card = {};
  let sessionCallback, currentUser, resets = 0, stops = 0;
  const form = { querySelector: () => button, reset: () => { resets++; } };
  const context = vm.createContext({
    console, crypto: { randomUUID: () => 'abcdefghijklmnop' }, AbortController,
    fetch: catalogFetch, authenticatedFetch: request, apiFailureMessage: () => 'error',
    withDeadline: (promise, ms) => withDeadline(promise, ms, { set(fn) { const timer = { fn }; timers.push(timer); return timer; }, clear(t) { t.cleared = true; } }),
    FormData: class { get() { return 'Emprendimiento'; } },
    document: { readyState: 'loading', addEventListener() {}, getElementById: id => id === 'perfil-wholesale-card' ? card : { querySelector: () => list } },
    AUTH_STATES: { RESTORING: 'RESTORING', UNKNOWN: 'UNKNOWN' }, appCheckReady: Promise.resolve(true), db: {},
    subscribeSession(fn) { sessionCallback = fn; }, getSessionUser: () => currentUser,
    collection: (_, name) => name, where: () => ({}), limit: () => ({}), query: (...args) => args,
    onSnapshot(_, fn) { callbacks.push(fn); return () => { stops++; }; },
  });
  vm.runInContext(source + '\nrender = () => {}; renderLines = () => {}; message = (text) => notices.push(text); api = {state, submit, loadCatalog, quotesHtml, start};', Object.assign(context, { notices }));
  context.api.start();
  const session = async uid => { currentUser = uid ? { uid } : null; sessionCallback({ status: uid ? 'AUTHENTICATED' : 'UNAUTHENTICATED', user: currentUser }); await tick(); };
  return { api: context.api, timers, callbacks, notices, button, form, session, list, resets: () => resets, stops: () => stops };
}
function addLine(f) { f.api.state.lines = [{ id: 'p1', name: 'Aros', qty: 10, variant: '' }]; }

test('cambiar cuenta borra el borrador y rechaza el snapshot anterior', async () => {
  const f = fixture(); await f.session('alice'); addLine(f); f.api.state.requestId = 'old-request';
  await f.session('bob');
  assert.equal(f.api.state.lines.length, 0); assert.equal(f.api.state.requestId, ''); assert.equal(f.stops(), 1);
  f.callbacks[0]({ docs: [{ id: 'private', data: () => ({ quoteNumber: 'ALICE' }) }] });
  assert.equal(f.api.state.quotes.length, 0); assert.equal(f.list.innerHTML, '');
});

test('envío anterior se aborta y no modifica la nueva cuenta', async () => {
  const stalled = deferred(); let signal;
  const f = fixture({ request: (_, options) => { signal = options.signal; return stalled.promise; } });
  await f.session('alice'); addLine(f); const attempt = f.api.submit(f.form); await tick();
  await f.session('bob'); addLine(f); f.api.state.requestId = 'bob-request';
  assert.equal(signal.aborted, true);
  stalled.resolve({ ok: true, json: async () => ({ ok: true, quoteNumber: 'ALICE' }) }); await attempt;
  assert.equal(f.api.state.lines.length, 1); assert.equal(f.api.state.requestId, 'bob-request'); assert.equal(f.resets(), 0);
});

for (const phase of ['request', 'body']) test(`envío pendiente en ${phase} libera el botón y conserva la clave del reintento`, async () => {
  const stalled = deferred(); let signal;
  const f = fixture({ request: (_, options) => { signal = options.signal; return phase === 'request' ? stalled.promise : Promise.resolve({ ok: true, json: () => stalled.promise }); } });
  await f.session('alice'); addLine(f); const attempt = f.api.submit(f.form); await tick(); const id = f.api.state.requestId;
  f.timers.find(t => !t.cleared).fn(); await attempt;
  assert.equal(f.button.disabled, false); assert.equal(f.api.state.sending, false); assert.equal(signal.aborted, true); assert.equal(f.api.state.requestId, id);
  stalled.resolve(phase === 'request' ? { ok: true, json: async () => ({ ok: true }) } : { ok: true }); await tick();
  assert.equal(f.api.state.lines.length, 1); assert.equal(f.resets(), 0);
});

test('catálogo comparte una petición y puede reintentarse después del plazo', async () => {
  let calls = 0, signal; const stalled = deferred();
  const f = fixture({ catalogFetch: (_, options) => { calls++; signal = options.signal; return calls === 1 ? stalled.promise : Promise.resolve({ ok: true, json: async () => ({ ok: true, items: [{ id: 'p1', data: { name: 'Aros' } }] }) }); } });
  const first = f.api.loadCatalog(), second = f.api.loadCatalog();
  const failures = Promise.allSettled([first, second]); await tick(); assert.equal(calls, 1);
  f.timers.find(t => !t.cleared).fn(); assert.ok((await failures).every(r => r.status === 'rejected')); assert.equal(signal.aborted, true);
  const catalog = await f.api.loadCatalog(); assert.equal(calls, 2); assert.equal(catalog.length, 1);
  stalled.resolve({ ok: true, json: async () => ({ ok: true, items: [] }) }); await tick(); assert.equal(f.api.state.catalog.length, 1);
});

test('cotización histórica aprobada no declara un permiso mayorista actual', async () => {
  const f = fixture(); f.api.state.quotes = [{ status: 'aprobada', items: [] }];
  assert.ok(!f.api.quotesHtml().includes('Sos mayorista aprobada'));
});
