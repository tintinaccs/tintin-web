import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createActivityTracker } from '../../js/components/notifications/avisos-en-vivo.mjs';

const source = fs.readFileSync(new URL('../../js/components/notifications/notificaciones-clientes.js', import.meta.url), 'utf8');
const notification = (id, extra = {}) => ({ id, title: 'Actividad', read: false, createdAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-05T10:00:00Z', ...extra });

test('el primer snapshot no avisa historial y sólo avisa actividad nueva una vez', () => {
  const tracker = createActivityTracker();
  const old = notification('old'), fresh = notification('new');
  assert.deepEqual(tracker.update('user:a', [old]), []);
  assert.deepEqual(tracker.update('user:a', [fresh, old]), [fresh]);
  assert.deepEqual(tracker.update('user:a', [fresh, old]), []);
});

test('marcar visto no avisa, un nuevo agregado sí, y otra cuenta comienza sin historial', () => {
  const tracker = createActivityTracker();
  const item = notification('like', { aggregateCount: 1 });
  tracker.update('admin:a', [item]);
  const read = { ...item, read: true, updatedAt: '2026-10-05T10:01:00Z' };
  assert.deepEqual(tracker.update('admin:a', [read]), []);
  const more = { ...item, aggregateCount: 2, updatedAt: '2026-10-05T10:02:00Z' };
  assert.deepEqual(tracker.update('admin:a', [more]), [more]);
  assert.deepEqual(tracker.update('user:b', [notification('private-b')]), []);
  tracker.reset();
  assert.deepEqual(tracker.update('admin:a', [more]), []);
});

function subscriptionHarness() {
  const subscriptions = [], notices = [];
  const context = vm.createContext({
    subscriptionGeneration: 0, unsubscribe: null, subscribeRetryTimer: 0,
    listenerFailed: false, notifications: [], subscribeRetryAttempt: 0, subscribeAuthRecoveryAttempted: false,
    currentUser: null, db: {}, window: { clearTimeout() {} }, console,
    isSuperAdmin: user => user?.email === 'admin@example.invalid',
    collection: (_db, ...path) => path, orderBy: field => field, limit: count => count,
    query: (...args) => args,
    onSnapshot: (query, next, error) => { subscriptions.push({ query, next, error }); return () => {}; },
    liveNotices: { update: (...args) => notices.push(args) }, render() {},
    notificationsSurfaceIsOpen: () => false, markVisibleNotificationsRead() {}, scheduleSubscriptionRecovery() {},
  });
  vm.runInContext(source.slice(source.indexOf('function isVisibleCustomerNotification'), source.indexOf('function groupedNotifications')), context);
  vm.runInContext(source.slice(source.indexOf('function subscribe(user'), source.indexOf('function optimisticRead')), context);
  return { context, subscriptions, notices };
}
const snapshot = items => ({ docs: items.map(item => ({ id: item.id, data: () => item })) });

test('Super Admin usa la misma colección global del panel; el cliente sólo su UID', () => {
  const { context, subscriptions } = subscriptionHarness();
  context.currentUser = { uid: 'owner', email: 'admin@example.invalid' };
  context.subscribe(context.currentUser);
  assert.equal(subscriptions[0].query[0].join('/'), 'adminNotifications');
  assert.equal(subscriptions[0].query[2], 100);
  subscriptions[0].next(snapshot([notification('like', { kind: 'product_like' })]));
  assert.equal(context.notifications.length, 1);
  context.currentUser = { uid: 'client', email: 'client@example.invalid' };
  context.subscribe(context.currentUser);
  assert.equal(subscriptions[1].query[0].join('/'), 'users/client/notifications');
  subscriptions[1].next(snapshot([notification('like', { kind: 'product_like' }), notification('order', { kind: 'order_created' })]));
  assert.deepEqual(Array.from(context.notifications, item => item.id), ['order']);
});

test('un snapshot administrativo tardío no reaparece después de cambiar de cuenta', () => {
  const { context, subscriptions, notices } = subscriptionHarness();
  context.currentUser = { uid: 'owner', email: 'admin@example.invalid' };
  context.subscribe(context.currentUser);
  context.currentUser = { uid: 'client', email: 'client@example.invalid' };
  context.subscribe(context.currentUser);
  subscriptions[0].next(snapshot([notification('private-admin')]));
  assert.equal(context.notifications.length, 0);
  assert.equal(notices.length, 0);
});

test('un cambio de sesión durante la obtención de token impide enviar la marca de lectura', async () => {
  let resolveToken, writes = 0;
  const context = vm.createContext({
    currentUser: { uid: 'a', getIdToken: () => new Promise(resolve => { resolveToken = resolve; }) },
    fetch: async () => { writes++; return { ok: true, json: async () => ({ ok: true }) }; },
  });
  vm.runInContext(source.slice(source.indexOf('async function api('), source.indexOf('async function apiWithRetry')), context);
  const request = context.api('notificationsSeenAll');
  context.currentUser = { uid: 'b' };
  resolveToken('fake-fixture-token');
  await assert.rejects(request, /sesión cambió/);
  assert.equal(writes, 0);
});
