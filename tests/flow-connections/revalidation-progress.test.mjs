import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const revalidateBtn ='), source.indexOf('  const sealConfirmation ='));
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
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ ok: true }), headers: { get: () => 'csp' } }),
    probeClientFirestoreRules: () => firestore.promise, probeEngagementStats: async () => ({}),
    probeSheetsWebhook: async () => ({}), probeCurrentSession: async () => ({}), probeRenderedCart: () => cart.promise,
    liveState: {}, buildLiveChecks: () => ({ a: {} }), buildLiveEdges: () => ({ b: {} }), renderAll() {},
  };
  vm.runInNewContext(handler, env);
  return { env, controls, cart, firestore, attributes, click: () => control('#tfc-btn-revalidate').click(), bar: control('#tfc-revalidation-bar'), status: control('#tfc-revalidation-status') };
}
test('progress waits for actual checks, ignores double click and reaches 100 only after evidence', async () => {
  const f = fixture(); const run = f.click();
  assert.equal(f.bar.value, 0); assert.equal(f.attributes['aria-busy'], 'true');
  await tick(); const partial = f.bar.value;
  assert.ok(partial > 10 && partial < 95);
  await f.click(); assert.equal(f.bar.value, partial);
  f.firestore.resolve({}); await tick(); assert.ok(f.bar.value > partial && f.bar.value < 100);
  f.cart.resolve(['cart', {}]); await run;
  assert.equal(f.bar.value, 100); assert.ok(f.env.liveState.checkedAt);
  assert.equal(f.attributes['aria-busy'], 'false'); assert.equal(f.controls['#tfc-btn-revalidate'].disabled, false);
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
