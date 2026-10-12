import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/core/auth/diagnostico-sesion.js', import.meta.url), 'utf8');
function harness() {
  const logs = [];
  const world = { window: { location: { pathname: '/login', search: '?token=PRIVATE&email=private@example.test' } },
    console: { info: (...args) => logs.push(args) } };
  vm.createContext(world);
  vm.runInContext(source.replaceAll('export function ', 'function ') + '\nthis.record = recordAuthDiagnostic; this.read = getAuthDiagnostics;', world);
  return { world, logs };
}

test('session diagnostics omit queries, sensitive keys, nested data and production console output', () => {
  const { world, logs } = harness();
  const event = world.record('AUTH_READY', { source: 'login', token: 'PRIVATE', email: 'private@example.test',
    metadata: { token: 'PRIVATE' }, reason: 'private@example.test', destination: 'https://example.test/?token=PRIVATE',
    persisted: true, retryAttempt: 2, route: '/unsafe?token=PRIVATE', code: 'OVERRIDE', epochMs: 0 });
  assert.equal(event.route, '/login');
  assert.equal(event.code, 'AUTH_READY');
  assert.equal(event.source, 'login');
  assert.equal(event.persisted, true);
  assert.equal(event.retryAttempt, 2);
  assert.equal(JSON.stringify(event).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(event).includes('private@example.test'), false);
  assert.deepEqual(logs, []);
});

test('safe diagnostic events remain bounded and usable without details', () => {
  const { world } = harness();
  for (let i = 0; i < 85; i++) world.record('AUTH_READY', null);
  assert.equal(world.read().length, 80);
  assert.equal(Object.isFrozen(world.read()[0]), true);
});
