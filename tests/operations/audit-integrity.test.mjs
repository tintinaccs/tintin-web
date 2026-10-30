import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { appendAuditEntry, handleAuditRequest } from '../../cloudflare/registro-auditoria.mjs';
import { onRequest } from '../../functions/api/admin-order-mutation.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const actor = { uid: 'qa-agent', email: 'agent@example.invalid', role: 'agent' };
const entry = { action: 'editar_producto', targetType: 'producto', targetId: 'qa-product', details: 'Prueba aislada', bulk: true, bulkCount: 2 };
test('los dos escritores reales envían datos sin autor ni fecha al mismo ingreso confiable', async () => {
  const calls = [];
  for (const [file, name, args] of [
    ['../../js/admin/admin-app.js', 'logAudit', ['editar_producto', 'producto', 'qa', 'Producto', 'Cambio', { bulk: true, count: 2, productHistory: [{ productId: 'qa', stockAfter: 2 }] }]],
    ['../../js/components/images/biblioteca-multimedia.js', 'logMediaDeletion', ['qa-media', { originalName: 'foto', publicId: 'qa', url: 'https://img.test/a.png' }, 'Sin uso']],
  ]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const fn = source.match(new RegExp('async function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];
    assert.ok(fn);
    const context = vm.createContext({ recordAuditEntry: async input => calls.push(input), console });
    vm.runInContext(fn, context);
    await context[name](...args);
  }
  assert.equal(calls.length, 2);
  for (const input of calls) for (const key of ['actorId', 'actorEmail', 'actorRole', 'createdAt']) assert.equal(Object.hasOwn(input, key), false);
  assert.equal(calls[0].bulkCount, 2); assert.equal(calls[0].productHistory.length, 1);
  assert.equal(calls[1].action, 'eliminar_imagen_biblioteca'); assert.equal(calls[1].bulkCount, 0);
});
function store(gate = { storeOpen: true }) {
  const writes = [];
  return { writes, get: async () => gate === null ? null : { fields: encodeFirestoreFields(gate) },
    commit: async (_, batch) => writes.push(...batch), now: () => new Date('2026-10-30T12:00:00Z') };
}
test('autor/rol/fecha provienen del servidor y el commit es sólo creación', async () => {
  const io = store();
  const result = await appendAuditEntry({}, entry, actor, io);
  assert.match(result.id, /^client_[a-f0-9]{32}$/);
  assert.equal(io.writes.length, 1);
  assert.deepEqual(io.writes[0].currentDocument, { exists: false });
  assert.match(io.writes[0].path, /^auditLog\/client_/);
  const saved = decodeFirestoreFields(io.writes[0].fields);
  assert.equal(saved.actorId, actor.uid); assert.equal(saved.actorEmail, actor.email); assert.equal(saved.actorRole, actor.role);
  assert.equal(saved.createdAt, '2026-10-30T12:00:00.000Z');
});
test('rechaza suplantación, fecha falsa, campos ajenos y contador HTML/tipo/rango', async () => {
  for (const patch of [ { actorEmail: 'tintinaccs@gmail.com' }, { actorId: 'owner' }, { actorRole: 'superadmin' },
    { createdAt: '2099-01-01' }, { extra: 'field' }, { bulkCount: '<span id="injection">HTML</span>' },
    { bulkCount: -1 }, { bulkCount: 1.5 }, { bulkCount: 1000001 }, { bulkCount: {} }, { bulk: 'true' },
    { bulk: false, bulkCount: 1 }, { action: '' }, { details: 'x'.repeat(16001) }, { targetLabel: 'x'.repeat(2001) } ]) {
    const io = store();
    await assert.rejects(appendAuditEntry({}, { ...entry, ...patch }, actor, io), error => error.status === 422);
    assert.equal(io.writes.length, 0);
  }
});
test('valida cada fila y cada valor del historial, conserva forma individual y masiva legítima', async () => {
  const history = { productId: 'qa-product', priceBefore: '25000', priceAfter: 30000, stockBefore: null, stockAfter: 0 };
  for (const productHistory of [history, [history], Array.from({ length: 500 }, () => history)]) {
    const io = store(); await appendAuditEntry({}, { ...entry, productHistory }, actor, io);
    assert.deepEqual(decodeFirestoreFields(io.writes[0].fields).productHistory, productHistory);
  }
  for (const productHistory of [Array.from({ length: 501 }, () => history), [history, { ...history, stockAfter: '<img>' }],
    [history, { productId: 'x'.repeat(221) }], { ...history, extra: true }, { ...history, priceAfter: {} },
    { ...history, stockAfter: -1 }, { ...history, priceBefore: 'x'.repeat(41) }, null, 'history']) {
    const io = store(); await assert.rejects(appendAuditEntry({}, { ...entry, productHistory }, actor, io), error => error.status === 422);
    assert.equal(io.writes.length, 0);
  }
});
test('conserva permisos, bloqueo de tienda y excepción del propietario', async () => {
  for (const role of ['client', 'viewer', 'support', 'moderator', '', 'SUPERADMIN']) {
    const io = store(); await assert.rejects(appendAuditEntry({}, entry, { ...actor, role }, io), error => error.status === 403); assert.equal(io.writes.length, 0);
  }
  const closed = store({ storeOpen: false, maintenanceAccess: {} });
  await assert.rejects(appendAuditEntry({}, entry, actor, closed), error => error.status === 403);
  assert.equal(closed.writes.length, 0);
  for (const role of ['admin', 'agent']) {
    await appendAuditEntry({}, entry, { ...actor, role }, store(null));
    await appendAuditEntry({}, entry, { ...actor, role }, store({ storeOpen: false, maintenanceAccess: { [role]: true } }));
  }
  await appendAuditEntry({}, entry, { ...actor, role: 'superadmin' }, closed);
});
const request = (body = entry, origin = 'https://tintinaccs.com', method = 'POST') => new Request('https://tintinaccs.com/api/admin-order-mutation', {
  method, headers: { origin, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
test('endpoint real rechaza anónimo, origen externo y métodos de escritura alternativos', async () => {
  assert.equal((await onRequest({ request: request({ action: 'appendAudit', entry }), env: {} })).status, 401);
  assert.equal((await handleAuditRequest({ request: request(), env: {} })).status, 401);
  for (const origin of ['', 'https://untrusted.invalid']) assert.equal((await handleAuditRequest({ request: request(entry, origin), env: {} })).status, 403);
  for (const method of ['GET', 'DELETE', 'PATCH']) assert.equal((await handleAuditRequest({ request: request(entry, undefined, method), env: {} })).status, 405);
  assert.equal((await handleAuditRequest({ request: request(entry, undefined, 'OPTIONS'), env: {} })).status, 204);
});
test('el ingreso integrado usa el cuerpo ya leído por la API y confirma el commit sin releerlo', async () => {
  const io = store();
  const consumed = request({ action: 'appendAudit', entry });
  await consumed.text();
  const dependencies = { input: entry, authenticate: async () => actor,
    append: (env, input, trusted) => appendAuditEntry(env, input, trusted, io) };
  const response = await handleAuditRequest({ request: consumed, env: {} }, dependencies);
  assert.equal(response.status, 200); assert.equal(io.writes.length, 1);
  assert.equal((await response.json()).ok, true);
  for (const [input, status] of [[null, 422], [{ ...entry, details: 'x'.repeat(256 * 1024) }, 413]]) {
    const rejected = await handleAuditRequest({ request: consumed, env: {} }, { ...dependencies, input });
    assert.equal(rejected.status, status); assert.equal(io.writes.length, 1);
  }
});
test('el endpoint espera confirmación, limita tamaño/JSON y conserva errores/cuotas', async () => {
  let calls = 0;
  const dependencies = { authenticate: async () => actor, append: async (_env, input, trusted) => {
    calls++; assert.deepEqual(input, entry); assert.deepEqual(trusted, actor); return { id: 'qa-committed' };
  } };
  const response = await handleAuditRequest({ request: request(), env: {} }, dependencies);
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).result.id, 'qa-committed'); assert.equal(calls, 1);
  for (const [raw, status] of [['{', 422], ['x'.repeat(256 * 1024 + 1), 413]]) {
    assert.equal((await handleAuditRequest({ request: request(raw), env: {} }, dependencies)).status, status);
    assert.equal(calls, 1);
  }
  const failure = await handleAuditRequest({ request: request(), env: {} }, { ...dependencies, append: async () => { throw Object.assign(new Error('Private backend detail'), { status: 502 }); } });
  assert.equal(failure.status, 502); assert.doesNotMatch(await failure.text(), /Private backend/);
  const limited = await handleAuditRequest({ request: request(), env: {} }, { authenticate: async () => { throw Object.assign(new Error('quota'), { status: 429, retryAfterSeconds: 30 }); } });
  assert.equal(limited.status, 429);
});
