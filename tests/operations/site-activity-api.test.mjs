import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSiteActivity } from '../../functions/api/site-activity.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const date = new Date('2026-10-15T12:00:00Z');
const makeRequest = input => new Request('https://shop.test/api/site-activity', {
  method: 'POST', headers: { origin: 'https://shop.test', 'content-type': 'application/json' }, body: JSON.stringify(input),
});
function fixture() {
  const documents = new Map(), policies = []; let revision = 0;
  return { documents, policies, deps: {
    now: () => date,
    ipLimit: async (_request, _env, policy) => policies.push(policy),
    reserve: async (_env, policy) => policies.push(policy),
    get: async (_env, path) => documents.get(path) || null,
    commit: async (_env, writes) => {
      for (const write of writes) {
        const before = documents.get(write.path);
        if (write.currentDocument?.exists === false && before || write.currentDocument?.updateTime && before?.updateTime !== write.currentDocument.updateTime) throw Object.assign(Error('conflict'), { status: 409 });
        documents.set(write.path, { fields: write.fields, updateTime: String(++revision) });
      }
    },
  } };
}
const input = { kind: 'session', visitorId: 'visitor_123', sessionId: 'session_123', consent: true, route: '/catalogo?token=private', email: 'do-not-store@example.test', lat: -25, uid: 'owner' };
test('sesión acotada, sin identidad ni consultas sensibles, y duplicados sin sobrescribir', async () => {
  const state = fixture();
  for (let i = 0; i < 2; i++) assert.equal((await handleSiteActivity({ request: makeRequest(input), env: {} }, state.deps)).status, 202);
  assert.equal(state.documents.size, 1);
  const fields = decodeFirestoreFields([...state.documents.values()][0].fields);
  assert.equal(fields.landingPage, '/catalogo'); assert.equal(fields.userId, '');
  assert.equal(JSON.stringify(fields).includes('private'), false);
  assert.equal('email' in fields || 'lat' in fields || 'uid' in fields, false);
  assert.ok(state.policies.some(p => p.id === 'site-activity-budget' && p.identity === 'all-visitors' && p.limit === 20_000));
});
for (const bad of [{ ...input, consent: false }, { ...input, sessionId: '../users' }, { ...input, visitorId: '__bad__' }, { kind: 'authFailure', reason: 'anything' }, { kind: 'admin' }, { ...input, huge: 'x'.repeat(5000) }]) {
  test(`rechaza evento inválido antes de escribir: ${bad.kind}/${bad.reason || bad.sessionId || ''}/${bad.huge?.length || 0}`, async () => {
    const state = fixture(); assert.equal((await handleSiteActivity({ request: makeRequest(bad), env: {} }, state.deps)).status, 400);
    assert.equal(state.documents.size, 0);
  });
}
test('cambiar IDs no evita el presupuesto global y su fallo no escribe datos', async () => {
  const state = fixture(); state.deps.reserve = async () => { throw Object.assign(Error('limited'), { status: 429, code: 'rate_limited', retryAfter: 60 }); };
  for (const sessionId of ['session_123', 'session_456']) {
    const response = await handleSiteActivity({ request: makeRequest({ ...input, sessionId }), env: {} }, state.deps);
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  }
  assert.equal(state.documents.size, 0);
});
test('la API conserva el contador con conflicto CAS y un heartbeat adelantado no escribe', async () => {
  const state = fixture(); let conflict = true;
  const commit = state.deps.commit;
  state.deps.commit = async (...args) => { if (conflict) { conflict = false; throw Object.assign(Error('conflict'), { status: 409 }); } return commit(...args); };
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'aggregate' }), env: {} }, state.deps)).status, 202);
  assert.equal(decodeFirestoreFields(state.documents.get('siteAggregate/2026-10-15').fields).totalVisits, 1);
  await handleSiteActivity({ request: makeRequest({ ...input, kind: 'presence' }), env: {} }, state.deps);
  const previous = state.documents.get('sitePresence/visitor_123');
  const duplicate = await handleSiteActivity({ request: makeRequest({ ...input, kind: 'presence' }), env: {} }, state.deps);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(state.documents.get('sitePresence/visitor_123').updateTime, previous.updateTime);
});
test('diagnóstico de acceso sigue disponible sin sesión y no guarda userAgent ni query', async () => {
  const state = fixture();
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'authFailure', reason: 'auth-restore-fallback', route: '/admin?code=private', userAgent: 'private' }), env: {} }, state.deps)).status, 202);
  const fields = decodeFirestoreFields([...state.documents.values()][0].fields);
  assert.equal(fields.route, '/admin'); assert.equal(fields.code, 'REDIRECT_LOOP_BROKEN'); assert.equal('userAgent' in fields, false);
});
test('mantenimiento no acepta estadísticas, y un origen ajeno no alcanza las cuotas', async () => {
  const state = fixture(); state.documents.set('settings/storeGate', { fields: encodeFirestoreFields({ storeOpen: false }) });
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'aggregate' }), env: {} }, state.deps)).status, 403);
  const request = new Request('https://shop.test/api/site-activity', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' });
  state.policies.length = 0;
  assert.equal((await handleSiteActivity({ request, env: {} }, state.deps)).status, 403); assert.equal(state.policies.length, 0);
});
