import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/core/firebase/suscripcion-app-check.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
function setup(options = null, status) {
  let settle;
  const listeners = new Set();
  const calls = [];
  let stops = 0;
  const context = vm.createContext({ appCheckReady: new Promise(resolve => { settle = resolve; }),
    window: { TintinAppCheckStatus: status, addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn) },
    onSnapshot: (reference, ...args) => { const options = typeof args[0] === 'function' ? null : args.shift(); const [next, fail] = args; calls.push({ reference, options, next, fail }); return () => { stops++; }; } });
  vm.runInContext(source, context);
  const errors = [], values = [];
  const stop = context.onAppCheckSnapshot('private-source', ...(options ? [options] : []), value => values.push(value), error => errors.push(error.code));
  const ready = value => { for (const fn of listeners) fn({ detail: { ready: value } }); };
  return { settle, ready, calls, errors, values, stop, get stops() { return stops; }, listeners };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('subscription created after the late readiness event uses confirmed canonical status', async () => {
  const state = setup(null, 'enabled'); state.settle(false); await tick();
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.errors, []);
});

test('no private request before secure readiness; late token opens exactly one listener', async () => {
  const state = setup();
  assert.equal(state.calls.length, 0);
  state.settle(false); await tick();
  assert.deepEqual(state.errors, ['app-check-unavailable']);
  assert.equal(state.calls.length, 0);
  state.ready(true); state.ready(true);
  assert.equal(state.calls.length, 1);
  state.calls[0].next('snapshot');
  assert.deepEqual(state.values, ['snapshot']);
});
test('confirmed readiness and its event do not create duplicate listeners', async () => {
  const state = setup(); state.ready(true); state.settle(true); await tick();
  assert.equal(state.calls.length, 1);
});
test('actual Rules rejection remains an error without automatic retries', async () => {
  const state = setup(); state.settle(true); await tick();
  state.calls[0].fail({ code: 'permission-denied' }); state.ready(true);
  assert.deepEqual(state.errors, ['permission-denied']);
  assert.equal(state.calls.length, 1);
});
test('logout before token resolution cannot open the old user subscription', async () => {
  const state = setup(); state.stop(); state.ready(true); state.settle(true); await tick();
  assert.equal(state.calls.length, 0);
  assert.equal(state.listeners.size, 0);
});
test('dispose stops listener and ignores stale callbacks', async () => {
  const state = setup(); state.settle(true); await tick(); state.stop();
  state.calls[0].next('stale'); state.calls[0].fail({ code: 'permission-denied' });
  assert.deepEqual(state.values, []); assert.deepEqual(state.errors, []);
  assert.equal(state.stops, 1); assert.equal(state.listeners.size, 0);
});
test('cart metadata subscription preserves SDK options and callback positions', async () => {
  const options = { includeMetadataChanges: true };
  const state = setup(options); state.settle(true); await tick();
  assert.equal(state.calls[0].options, options);
  state.calls[0].next('cart'); state.calls[0].fail({ code: 'permission-denied' });
  assert.deepEqual(state.values, ['cart']); assert.deepEqual(state.errors, ['permission-denied']);
});
