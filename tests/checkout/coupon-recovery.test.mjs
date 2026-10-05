import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

const html = fs.readFileSync(new URL('../../checkout.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('(() => {', html.indexOf('// Cupón de envío gratis')), html.indexOf("document.getElementById('btn-step3-back')"));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ token = async () => 'isolated-token', fetch = async () => ({ ok: true, json: async () => ({ valid: true, code: 'ENVIO' }) }) } = {}) {
  const timers = [], elements = new Map();
  for (const id of ['ck-coupon', 'ck-coupon-apply', 'ck-coupon-status']) elements.set(id, { value: 'ENVIO', disabled: false, dataset: {}, style: {}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
  const auth = { currentUser: { uid: 'current', getIdToken: token } };
  vm.runInNewContext(source, {
    document: { getElementById: id => elements.get(id) }, auth, fetch, AbortController,
    apiUrl: path => path,
    withDeadline: (promise, ms) => withDeadline(promise, ms, { set(fn, ms) { const t = { fn, ms }; timers.push(t); return t; }, clear(t) { t.cleared = true; } }),
  });
  return { auth, timers, input: elements.get('ck-coupon'), button: elements.get('ck-coupon-apply'), status: elements.get('ck-coupon-status'), click: () => elements.get('ck-coupon-apply').listeners.click() };
}

for (const phase of ['token', 'request', 'body']) test(`cupón pendiente en ${phase} libera el botón, aborta y permite reintentar`, async () => {
  const pending = deferred(); let count = 0, signal;
  const f = fixture({ token: () => phase === 'token' ? pending.promise : Promise.resolve('isolated-token'), fetch: async (_, options) => {
    count++; signal = options.signal;
    return phase === 'request' ? pending.promise : { ok: true, json: () => pending.promise };
  } });
  const attempt = f.click(); await tick();
  assert.equal(f.button.disabled, true);
  f.timers.find(t => t.ms === 15000 && !t.cleared).fn(); await attempt;
  assert.equal(f.button.disabled, false); assert.equal(f.input.dataset.applied, undefined);
  assert.match(f.status.textContent, /Intentá de nuevo/);
  if (signal) assert.equal(signal.aborted, true);
  if (phase === 'token') { pending.resolve('late-token'); await tick(); assert.equal(count, 0); }
  if (phase === 'body') { pending.resolve({ valid: true, code: 'ENVIO' }); await tick(); assert.equal(f.input.dataset.applied, undefined); }
});

test('editar descarta respuesta vieja y su finally no libera un intento nuevo', async () => {
  const old = deferred(), next = deferred(); let count = 0;
  const f = fixture({ fetch: async () => ({ ok: true, json: () => ++count === 1 ? old.promise : next.promise }) });
  const first = f.click(); await tick();
  f.input.value = 'NUEVO'; f.input.listeners.input();
  const second = f.click(); await tick();
  old.resolve({ valid: true, code: 'ENVIO' }); await first;
  assert.equal(f.input.value, 'NUEVO'); assert.equal(f.input.dataset.applied, undefined); assert.equal(f.button.disabled, true);
  next.resolve({ valid: true, code: 'NUEVO' }); await second;
  assert.equal(f.input.dataset.applied, 'NUEVO'); assert.equal(f.button.disabled, false);
});

test('cambio de cuenta descarta cupón confirmado para la identidad anterior', async () => {
  const result = deferred(); const f = fixture({ fetch: async () => ({ ok: true, json: () => result.promise }) });
  const attempt = f.click(); await tick(); f.auth.currentUser = { uid: 'other' };
  result.resolve({ valid: true, code: 'ENVIO' }); await attempt;
  assert.equal(f.input.dataset.applied, undefined); assert.equal(f.button.disabled, false);
  assert.match(f.status.textContent, /Tu sesión cambió/);
});

test('doble clic inicia una consulta y una respuesta incompleta no aplica descuentos', async () => {
  const result = deferred(); let requests = 0;
  const f = fixture({ fetch: async () => { requests++; return { ok: true, json: () => result.promise }; } });
  const attempt = f.click(); await f.click(); await tick(); assert.equal(requests, 1);
  result.resolve({ valid: true }); await attempt;
  assert.equal(f.input.dataset.applied, undefined); assert.match(f.status.textContent, /No pudimos comprobar/);
});
