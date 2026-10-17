import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('App Check tardío mantiene la escucha pendiente sin reintentos y recupera una sola suscripción', async () => {
  const window = new EventTarget(), document = new EventTarget();
  document.hidden = false;
  const subscriptions = [], timers = [], warnings = [], revisions = [];
  let stopped = 0;
  const context = vm.createContext({
    window, document, db: {}, doc: (...parts) => parts,
    console: { warn: (...values) => warnings.push(values) },
    appCheckReady: Promise.resolve(false),
    onSnapshot: (_ref, options, data, error) => {
      subscriptions.push({ data, error });
      return () => stopped++;
    },
    createSiteRevisionObserver: () => value => revisions.push(value?.revision),
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout() {},
  });
  const wrapper = readFileSync(new URL('../../js/core/firebase/suscripcion-app-check.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const source = readFileSync(new URL('../../js/quality/cambios-tienda.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(wrapper, context);
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(subscriptions.length, 0, 'Firestore no se inicia sin token');
  assert.equal(timers.length, 0, 'no reiniciar una espera que conserva su recuperación');
  assert.equal(warnings.length, 0, 'la espera no es un error de permisos');
  window.TintinAppCheckStatus = 'enabled';
  const ready = () => window.dispatchEvent(Object.assign(new Event('tintin:app-check-ready'), { detail: { ready: true } }));
  ready(); ready();
  assert.equal(subscriptions.length, 1);
  subscriptions[0].data({ exists: () => true, data: () => ({ revision: 'confirmed' }), metadata: {} });
  assert.deepEqual(revisions, ['confirmed']);
  subscriptions[0].error({ code: 'permission-denied' });
  assert.equal(warnings.length, 1, 'un rechazo real sigue visible');
  assert.equal(timers.length, 1, 'la reconexión de errores reales sigue acotada');
  window.dispatchEvent(new Event('pagehide'));
  subscriptions[0].data({ exists: () => true, data: () => ({ revision: 'disposed' }), metadata: {} });
  ready();
  assert.deepEqual(revisions, ['confirmed']);
  assert.equal(stopped, 1);
  assert.equal(subscriptions.length, 1);
});

test('la revisión recupera permisos/conexión con reintentos acotados y descarta callbacks viejos', () => {
  const source = readFileSync(new URL('../../js/quality/cambios-tienda.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const window = new EventTarget(), document = new EventTarget();
  document.hidden = false;
  const subscriptions = [], timers = new Map(), revisions = [];
  let nextTimer = 0, stopped = 0;
  vm.runInNewContext(source, {
    window, document, db: {}, doc: (...parts) => parts, console: { warn() {} },
    createSiteRevisionObserver: () => value => revisions.push(value?.revision),
    onAppCheckSnapshot: (_ref, options, data, error) => {
      assert.equal(options.includeMetadataChanges, true);
      subscriptions.push({ data, error }); return () => stopped++;
    },
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  for (const delay of [1400, 4000, 12000, 30000]) {
    subscriptions.at(-1).error({ code: 'permission-denied' });
    assert.equal(timers.size, 1);
    const [id, timer] = [...timers][0];
    assert.equal(timer.delay, delay); timers.delete(id); timer.fn();
  }
  subscriptions.at(-1).error({ code: 'unavailable' });
  assert.equal(timers.size, 0);
  assert.equal(subscriptions.length, 5);
  window.dispatchEvent(new Event('online'));
  assert.equal(subscriptions.length, 6);
  const snapshot = revision => ({ exists: () => true, data: () => ({ revision }), metadata: {} });
  subscriptions[0].data(snapshot('obsolete'));
  subscriptions.at(-1).data({ ...snapshot('local-pending'), metadata: { hasPendingWrites: true } });
  subscriptions.at(-1).data(snapshot('confirmed'));
  assert.deepEqual(revisions, ['confirmed']);
  window.dispatchEvent(new Event('pagehide'));
  subscriptions.at(-1).data(snapshot('after-dispose'));
  window.dispatchEvent(new Event('online'));
  assert.deepEqual(revisions, ['confirmed']);
  assert.equal(subscriptions.length, 6);
  assert.equal(stopped, 6);
});
