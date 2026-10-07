import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const backend = fs.readFileSync(new URL('../../functions/api/order-email.js', import.meta.url), 'utf8');
const frontend = fs.readFileSync(new URL('../../js/email/notificacion-pedido-resend.js', import.meta.url), 'utf8');
const clean = value => String(value ?? '').trim();

test('la lectura canónica conserva Auth y App Check; sin App Check Firestore sigue rechazando', async () => {
  const requests = [];
  const context = vm.createContext({
    clean, FIREBASE_PROJECT_ID: 'test-project',
    decodeFirestoreFields: fields => fields,
    fetch: async (url, init) => {
      requests.push({ url, headers: init.headers });
      const ok = init.headers['X-Firebase-AppCheck'] === 'valid-app-check';
      return { ok, status: ok ? 200 : 403, json: async () => ({ fields: { canonical: true } }) };
    },
  });
  vm.runInContext(backend.slice(backend.indexOf('async function fetchOrder('), backend.indexOf('// Datos para pagar')), context);
  await assert.rejects(context.fetchOrder('ORDER_123456789', 'id-token', ''), /permiso/);
  assert.equal((await context.fetchOrder('ORDER_123456789', 'id-token', 'valid-app-check')).canonical, true);
  assert.equal(requests[1].headers.authorization, 'Bearer id-token');
  assert.match(requests[1].url, /documents\/orders\/ORDER_123456789$/);
  await assert.rejects(context.fetchOrder('../other-order', 'id-token', 'valid-app-check'), /inválido/);
  assert.equal(requests.length, 2, 'un ID inválido no llega a Firestore');
});

test('el navegador adjunta el token de su instancia App Check sin ponerlo en el cuerpo', async () => {
  const requests = [];
  const context = vm.createContext({
    AbortController, REQUEST_TIMEOUT_MS: 15000, ORDER_EMAIL_API: '/api/order-email',
    appCheck: { ready: true },
    window: { setTimeout, clearTimeout },
    getAppCheckToken: async () => ({ token: 'valid-app-check' }),
    clean, defaultFailure: error => ({ success: false, error }),
    fetch: async (url, init) => {
      requests.push({ url, ...init });
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
    },
  });
  vm.runInContext(frontend.slice(frontend.indexOf('async function postOrderNotification('), frontend.indexOf('export async function sendOrderNotification')), context);
  const result = await context.postOrderNotification({ orderId: 'ORDER_123456789' }, 'id-token', 1);
  assert.equal(result.parsed.success, true);
  assert.equal(requests[0].headers.Authorization, 'Bearer id-token');
  assert.equal(requests[0].headers['X-Firebase-AppCheck'], 'valid-app-check');
  assert.equal(requests[0].body.includes('valid-app-check'), false);
  context.getAppCheckToken = async () => { throw new Error('App Check temporalmente indisponible'); };
  const denied = await context.postOrderNotification({ orderId: 'ORDER_123456789' }, 'id-token', 1);
  assert.equal(denied.parsed.success, false);
  assert.equal(requests.length, 1, 'no se envía una petición sin credencial de aplicación');
});
