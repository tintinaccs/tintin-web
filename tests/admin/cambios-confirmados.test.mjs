import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmedChangeWriter } from '../../js/core/store/cambio-confirmado.mjs';
import { createSiteRevisionObserver } from '../../js/quality/revision-tienda.mjs';
import { publishConfirmedSiteRevision } from '../../cloudflare/revision-tienda.js';

test('un guardado fallido no avisa; el confirmado conserva resultado aunque falle el aviso', async () => {
  const published = [], failures = [];
  const write = createConfirmedChangeWriter({ publish: () => { published.push(true); return Promise.reject(new Error('offline')); }, onError: error => failures.push(error.message) });
  await assert.rejects(write(async () => { throw new Error('conflict'); }), /conflict/);
  assert.equal(published.length, 0);
  const result = { id: 'confirmed', stock: 2 };
  assert.equal(await write(async () => result), result);
  await Promise.resolve();
  assert.equal(published.length, 1);
  assert.deepEqual(failures, ['offline']);
});

test('el aviso no espera una conexión colgada ni se publica para otro rol', async () => {
  let published = 0;
  const never = new Promise(() => {});
  const write = createConfirmedChangeWriter({ publish: () => { published++; return never; } });
  assert.equal(await write(async () => 'guardado'), 'guardado');
  const staff = createConfirmedChangeWriter({ enabled: () => false, publish: () => published++ });
  await staff(async () => 'staff');
  assert.equal(published, 1);
});

test('no avisa al abrir; avisa por revisiones nuevas incluso tras documento ausente y deduplica', () => {
  let notices = 0;
  const receive = createSiteRevisionObserver(() => notices++);
  receive(null); receive({ revision: 'first' }); receive({ revision: 'first' }); receive(null); receive({ revision: 'second' });
  assert.equal(notices, 2);
  const existing = createSiteRevisionObserver(() => notices++);
  existing({ revision: 'already-seen' });
  assert.equal(notices, 2);
});

function request(path, action, method = 'POST') {
  return new Request('https://tintin.test' + path, { method, ...(method === 'POST' ? { body: JSON.stringify({ action }) } : {}) });
}
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
test('sólo cambios backend confirmados publican una revisión sin datos privados', async () => {
  const writes = [];
  const deps = { publish: async (_env, path, fields) => writes.push({ path, fields }) };
  for (const path of ['/api/admin-order-mutation', '/api/admin-engagement', '/api/local-commerce']) {
    assert.equal(await publishConfirmedSiteRevision({}, request(path, 'update'), response({ ok: true }), deps), true);
  }
  assert.equal(await publishConfirmedSiteRevision({}, request('/api/push-admin', 'settings'), response({ success: true }), deps), true);
  for (const { fields, path } of writes) {
    assert.equal(path, 'settings/siteRevision');
    assert.deepEqual(Object.keys(fields).sort(), ['revision', 'updatedAt']);
    assert.ok(fields.revision.stringValue);
  }
  assert.equal(writes.length, 4);
});
test('lecturas, errores, reintentos y borradores no anuncian una publicación inexistente', async () => {
  const deps = { publish: () => assert.fail('no debe publicar') };
  for (const [path, action, result, method] of [
    ['/api/visual-builder', 'save', { ok: true }],
    ['/api/visual-studio-global', 'cancel', { ok: true }],
    ['/api/admin-import-job', 'status', { ok: true }],
    ['/api/admin-order-mutation', 'update', { ok: true, result: { duplicate: true } }],
    ['/api/admin-order-mutation', 'update', { ok: false }],
    ['/api/local-commerce', '', { ok: true }, 'GET'],
    ['/api/notifications', 'adminNotificationsSeenAll', { ok: true }],
    ['/api/push-admin', 'list', { success: true }],
    ['/api/push-admin', 'settings', { success: false }],
    ['/api/local-commerce-webhook', 'snapshot', { ok: true }],
    ['/api/local-commerce', 'upsert', { ok: true, results: [{ unchanged: true }] }],
  ]) assert.equal(await publishConfirmedSiteRevision({}, request(path, action, method), response(result), deps), false);
});
