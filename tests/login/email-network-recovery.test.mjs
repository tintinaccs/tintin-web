import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

const source = readFileSync(new URL('../../js/email/correo-autenticacion.js', import.meta.url), 'utf8')
  .replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g, '').replace(/export /g, '');
const never = () => new Promise(() => {});
function fixture({ fetchImpl, persistence = Promise.resolve(), tokenImpl = async () => ({ user: { uid: 'confirmed' } }) }) {
  const timers = [], calls = { token: 0 }, context = vm.createContext({
    auth: {}, db: {}, authPersistenceReady: persistence, AbortController,
    apiUrl: name => '/api/' + name, console: { error() {} }, fetch: fetchImpl,
    signInWithCustomToken(...args) { calls.token++; return tokenImpl(...args); },
    withDeadline(promise, ms) { return withDeadline(promise, ms, { set(fn, delay) { const t = { fn, delay }; timers.push(t); return t; }, clear(t) { t.cleared = true; } }); }
  });
  vm.runInContext(source, context);
  return { context, timers, calls };
}
const ok = async () => ({ ok: true, json: async () => ({ success: true, customToken: 'isolated-fixture' }) });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('pedido sin respuesta aborta y devuelve un error recuperable', async () => {
  let signal;
  const f = fixture({ fetchImpl: (_url, options) => { signal = options.signal; return never(); } });
  const result = f.context.requestOtpCode('fixture@example.invalid');
  f.timers.find(t => t.delay === 20000).fn();
  await assert.rejects(result, error => error.code === 'network_error');
  assert.equal(signal.aborted, true);
  assert.equal(f.calls.token, 0);
});

test('un cuerpo de respuesta colgado también libera el intento', async () => {
  const f = fixture({ fetchImpl: async () => ({ ok: true, json: never }) });
  const result = f.context.requestOtpCode('fixture@example.invalid');
  await flush(); f.timers.find(t => !t.cleared).fn();
  await assert.rejects(result, error => error.code === 'network_error');
});

test('persistencia pendiente impide firmar y vence sin éxito falso', async () => {
  const f = fixture({ fetchImpl: ok, persistence: never() });
  const result = f.context.verifyOtpCode('fixture@example.invalid', '123456');
  await flush(); f.timers.find(t => !t.cleared && t.delay === 15000).fn();
  await assert.rejects(result, error => error.code === 'login_failed');
  assert.equal(f.calls.token, 0);
});

test('Auth pendiente vence; solo una credencial confirmada devuelve usuario', async () => {
  const f = fixture({ fetchImpl: ok, tokenImpl: never });
  const result = f.context.verifyOtpCode('fixture@example.invalid', '123456');
  await flush(); f.timers.find(t => !t.cleared && t.delay === 15000).fn();
  await assert.rejects(result, error => error.code === 'login_failed');
  assert.equal(f.calls.token, 1);
  const success = fixture({ fetchImpl: ok });
  assert.equal((await success.context.verifyOtpCode('fixture@example.invalid', '123456')).uid, 'confirmed');
});
