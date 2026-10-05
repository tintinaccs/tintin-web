import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

const html = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  let usernameAvailability'), html.indexOf('  // El mismo componente de mapa'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ token = () => Promise.resolve('isolated-token'), fetch = async () => ({ ok: true, json: async () => ({ available: true }) }) } = {}) {
  const timers = [], elements = new Map(), input = { value: 'firstname', addEventListener(_, fn) { this.input = fn; } };
  const context = vm.createContext({
    AbortController, user: { getIdToken: token }, fetch, AUTH_NETWORK_DEADLINE_MS: 15000,
    withDeadline: (promise, ms) => withDeadline(promise, ms, { set(fn, ms) { const timer = { fn, ms }; timers.push(timer); return timer; }, clear(t) { t.cleared = true; } }),
    usernameInput: input, plan: { needsUsername: true },
    isValidUsernameFormat: raw => raw.length >= 3, isReservedUsername: () => false, normalizeUsername: raw => raw.toLowerCase(),
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, { dataset: {}, textContent: '', classList: { add() {}, remove() {} } }); return elements.get(id); } },
    window: { clearTimeout(t) { if (t) t.cleared = true; }, setTimeout(fn, ms) { const timer = { fn, ms }; timers.push(timer); return timer; } },
  });
  vm.runInContext(source + '\nglobalThis.api = { requestProfileAvailability, checkUsernameAvailability, checkPhoneAvailability };', context);
  return { api: context.api, input, timers, status: elements.get('login-username-status') };
}

test('editar invalida inmediatamente una respuesta anterior durante el debounce', async () => {
  const old = deferred(); let requests = 0;
  const f = fixture({ fetch: async () => { requests++; return { ok: true, json: () => old.promise }; } });
  const attempt = f.api.checkUsernameAvailability(); await tick();
  f.input.value = 'secondname'; f.input.input();
  old.resolve({ available: false }); await attempt;
  assert.equal(f.status.dataset.state, 'idle'); assert.equal(f.status.textContent, '');
  assert.equal(requests, 1);
  f.timers.find(t => t.ms === 360 && !t.cleared).fn(); await tick();
  assert.equal(requests, 2); assert.equal(f.status.dataset.state, 'taken');
});

for (const phase of ['token', 'request', 'body']) {
  test(`consulta sin respuesta en ${phase} termina como desconocida y aborta la red`, async () => {
    const stalled = deferred(); let signal, requests = 0;
    const f = fixture({ token: () => phase === 'token' ? stalled.promise : Promise.resolve('isolated-token'), fetch: async (_, options) => {
      requests++; signal = options.signal;
      return phase === 'request' ? stalled.promise : { ok: true, json: () => stalled.promise };
    } });
    const attempt = f.api.checkUsernameAvailability(); await tick();
    f.timers.find(t => t.ms === 15000 && !t.cleared).fn(); await attempt;
    assert.equal(f.status.dataset.state, 'unknown');
    if (signal) assert.equal(signal.aborted, true);
    if (phase === 'token') { stalled.resolve('late-token'); await tick(); assert.equal(requests, 0); }
    if (phase === 'body') { stalled.resolve({ available: false }); await tick(); assert.equal(f.status.dataset.state, 'unknown'); }
  });
}

for (const result of [{}, { available: 'true' }, null]) {
  test(`respuesta inválida ${JSON.stringify(result)} no declara libre ni ocupado`, async () => {
    const f = fixture({ fetch: async () => ({ ok: true, json: async () => result }) });
    await f.api.checkUsernameAvailability(); assert.equal(f.status.dataset.state, 'unknown');
  });
}

test('teléfono conserva resultado booleano confirmado y cuerpo correcto', async () => {
  let payload, endpoint;
  const f = fixture({ fetch: async (path, options) => { endpoint = path; payload = JSON.parse(options.body); return { ok: true, json: async () => ({ available: false }) }; } });
  const result = await f.api.checkPhoneAvailability('0912345678', { code: 'PY' });
  assert.equal(result.known, true); assert.equal(result.available, false);
  assert.equal(endpoint, '/api/phone-availability'); assert.deepEqual(payload, { phone: '0912345678', country: 'PY' });
});
