import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ciEvidenceProblem } from '../../js/admin/flujo-conexiones/live-checks.js';

const source = fs.readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const progressPanel ='), source.indexOf('  const monitor ='));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const controls = {};
  const control = id => controls[id] ||= { hidden: true, disabled: false, value: 0, textContent: '', addEventListener(type, fn) { this[type] = fn; } };
  const cart = deferred();
  const firestore = deferred();
  const attributes = {};
  const env = {
    root: { querySelector: control, setAttribute: (key, value) => { attributes[key] = value; } },
    liveErrorEl: control('error'), liveErrorTextEl: control('errorText'), liveTimestampEl: control('time'),
    auth: { currentUser: { getIdToken: async () => 'test' } }, role: 'superadmin',
    waitForAdminAppCheck: async () => true, AbortSignal,
    fetch: async url => ({ status: 200, ok: true, headers: { get: () => 'csp' }, json: async () => (
      String(url).includes('/api/master-diagnostics') ? { ok: true, currentEvidence: { commit: 'abc123', checks: {} } } : { ok: true }
    ) }),
    ciEvidenceProblem,
    probeClientFirestoreRules: () => firestore.promise, probeEngagementStats: async () => ({}), probeEngagementRecords: async () => ({}),
    probeSheetsWebhook: async () => ({}), probeCurrentSession: async () => ({}), probeRenderedCart: () => cart.promise,
    liveState: {}, buildLiveChecks: () => ({ a: {} }), buildLiveEdges: () => ({ b: {} }), renderAll() {},
  };
  vm.runInNewContext(handler, env);
  return { env, controls, cart, firestore, attributes, click: () => env.revalidate(new AbortController().signal), bar: control('#tfc-revalidation-bar'), status: control('#tfc-revalidation-status') };
}
test('progress waits for actual checks, reaches 100 only after evidence', async () => {
  const f = fixture(); const run = f.click();
  assert.equal(f.bar.value, 0); assert.equal(f.attributes['aria-busy'], 'true');
  await tick(); const partial = f.bar.value;
  assert.ok(partial > 10 && partial < 95);
  f.firestore.resolve({}); await tick(); assert.ok(f.bar.value > partial && f.bar.value < 100);
  f.cart.resolve(['cart', {}]); await run;
  assert.equal(f.bar.value, 100); assert.ok(f.env.liveState.checkedAt);
  assert.equal(f.attributes['aria-busy'], 'false');
});
test('security failure preserves incomplete progress and permits retry', async () => {
  const f = fixture(); f.env.waitForAdminAppCheck = async () => false;
  await f.click(); assert.equal(f.bar.value, 5); assert.match(f.status.textContent, /interrumpida/);
  f.env.waitForAdminAppCheck = async () => true;
  const retry = f.click(); assert.equal(f.bar.value, 0);
  f.firestore.resolve({}); f.cart.resolve(['cart', {}]); await retry; assert.equal(f.bar.value, 100);
});
test('late checks cannot update interrupted progress or contaminate retry', async () => {
  const f = fixture(); const run = f.click(); await tick();
  f.firestore.reject(new Error('unavailable')); await run;
  const stopped = f.status.textContent; const value = f.bar.value;
  f.cart.resolve(['cart', {}]); await tick();
  assert.equal(f.status.textContent, stopped); assert.equal(f.bar.value, value); assert.ok(value < 100);
  f.env.probeClientFirestoreRules = async () => ({});
  await f.click(); assert.equal(f.bar.value, 100);
});
test('failed HTTP checks complete without claiming their health', async () => {
  const f = fixture(); f.env.fetch = async () => ({ status: 503, ok: false, json: async () => ({ ok: false }), headers: { get: () => null } });
  f.firestore.resolve({}); f.cart.resolve(['cart', {}]); await f.click();
  assert.equal(f.bar.value, 100); assert.match(f.status.textContent, /con avisos/); assert.equal(f.env.liveErrorEl.hidden, false);
});
test('una revalidación sana no muestra avisos', async () => {
  const f = fixture(); f.firestore.resolve({}); f.cart.resolve(['cart', {}]); await f.click();
  assert.equal(f.bar.value, 100); assert.equal(f.env.liveErrorEl.hidden, true); assert.doesNotMatch(f.status.textContent, /con avisos/);
});
test('sin evidencia de CI la revalidación termina y avisa qué quedó sin confirmar', async () => {
  for (const [status, body] of [[502, { ok: false, error: 'GitHub alcanzó temporalmente el límite de consultas.' }], [200, { ok: true, currentEvidence: null }]]) {
    const f = fixture();
    f.env.fetch = async url => ({ status: String(url).includes('/api/master-diagnostics') ? status : 200, ok: String(url).includes('/api/master-diagnostics') ? status === 200 : true, headers: { get: () => 'csp' }, json: async () => (String(url).includes('/api/master-diagnostics') ? body : { ok: true }) });
    f.firestore.resolve({}); f.cart.resolve(['cart', {}]); await f.click();
    assert.equal(f.bar.value, 100); assert.match(f.status.textContent, /con avisos/); assert.equal(f.env.liveErrorEl.hidden, false);
    assert.match(f.env.liveErrorTextEl.textContent, new RegExp(`/api/master-diagnostics respondió ${status} sin evidencia de CI`));
    assert.match(f.env.liveErrorTextEl.textContent, /Repository audit queda sin confirmar/);
  }
});

test('comprobación cancelada no publica datos ni cambia el progreso de otra sesión', async () => {
  const f = fixture();
  const controller = new AbortController();
  const run = f.env.revalidate(controller.signal);
  await tick(); controller.abort();
  f.attributes['aria-busy'] = 'true';
  f.status.textContent = 'Comprobación de otra sesión';
  f.firestore.resolve({}); f.cart.resolve(['cart', {}]); await run;
  assert.equal(f.env.liveState.checkedAt, undefined);
  assert.equal(f.attributes['aria-busy'], 'true');
  assert.equal(f.status.textContent, 'Comprobación de otra sesión');
});
