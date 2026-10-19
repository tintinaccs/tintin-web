import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdminPagedSource } from '../../js/admin/datos/fuente-paginada-admin.mjs';

test('Usuarios conserva 600 cuentas, incluidas históricas sin fecha, y escucha cambios de la última página', () => {
  const original = readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
  const start = original.indexOf('    const mergeAdminUsers = () =>');
  const marker = '    adminUsersUnsubscribe = usersSource.stop;';
  const end = original.indexOf(marker, start) + marker.length;
  assert.ok(start > 0 && end > start);
  const watches = [], ready = { users: false };
  const deps = {
    compareUsersByRecentCustomerActivity: context.compare, createAdminPagedSource, adminRealtimeReady: ready, adminRealtimeErrors: {}, ADMIN_REALTIME_LIMIT: 250, db: {},
    collection: (_db, name) => name, orderBy: name => ({ order: name }), limit: n => ({ limit: n }),
    startAfter: cursor => ({ cursor }), query: (...parts) => parts,
    activityTimestampMillis: value => value?.seconds || 0,
    refreshRealtimeConsumers() {}, statisticsSetText() {}, recoverAdminRealtimeAuth() {},
    onSnapshot(query, options, next, error) {
      const watch = { query, options, next, error, stopped: false }; watches.push(watch);
      return () => { watch.stopped = true; };
    },
  };
  const runtime = new Function('deps', `let {${Object.keys(deps).join(',')}}=deps; let allUsers=[],adminUsersLive=[],adminUsersUnsubscribe;${original.slice(start, end)}; return {read:()=>allUsers,stop:()=>adminUsersUnsubscribe()};`)(deps);
  const docs = Array.from({ length: 600 }, (_, i) => ({ id: `user-${String(i).padStart(4, '0')}`, data: () => ({ blocked: false, ...(i < 500 ? { createdAt: { seconds: i + 1 } } : {}) }) }));
  watches[0].next({ docs: [], metadata: { fromCache: true } });
  assert.equal(ready.users, false);
  for (let page = 0; page < watches.length; page++) {
    const watch = watches[page];
    assert.equal(watch.query.at(-1).limit, 250);
    assert.ok(watch.query.some(part => part.order === '__name__'));
    watch.next({ docs: docs.slice(page * 250, (page + 1) * 250), metadata: { fromCache: false } });
    if (page < 2) assert.equal(ready.users, false, 'no presenta un total parcial como confirmado');
  }
  assert.equal(runtime.read().length, 600);
  assert.equal(ready.users, true);
  const changed = docs.slice(500).map((doc, i) => i ? doc : { ...doc, data: () => ({ blocked: true }) });
  watches[2].next({ docs: changed, metadata: { fromCache: false } });
  assert.equal(runtime.read().filter(user => user.blocked).length, 1);
  assert.equal(runtime.read().length, 600);
  runtime.stop();
  assert.ok(watches.every(watch => watch.stopped));
});

const source = readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(next, source.indexOf(`function ${name}(`)));
const context = vm.createContext({ SUPER_ADMIN: 'owner@example.test' });
vm.runInContext(extract('activityTimestampMillis', '\nfunction activityLocationLabel') + '\n' + extract('compareUsersByRecentCustomerActivity', '\nlet _lastFilteredUsers') + '\nthis.compare = compareUsersByRecentCustomerActivity;', context);
const sort = users => [...users].sort(context.compare).map(user => user.uid);
const registered = { uid: 'new', role: 'client', createdAt: '2026-10-19T14:00:00Z' };
const returning = { uid: 'returning', role: 'client', createdAt: '2026-03-01', lastLogin: { toMillis: () => Date.parse('2026-10-19T15:00:00Z') } };

test('el último login real de una clienta supera registros anteriores y una edición administrativa no la adelanta', () => {
  const edited = { uid: 'edited', role: 'client', createdAt: '2026-03-01', updatedAt: '2026-10-20' };
  assert.deepEqual(sort([registered, edited, returning]), ['returning', 'new', 'edited']);
  assert.deepEqual(sort([returning, { ...registered, createdAt: '2026-10-19T16:00:00Z' }]), ['new', 'returning']);
});

test('ninguna cuenta del equipo sube por iniciar sesión, incluso el titular con rol histórico de cliente', () => {
  const team = ['superadmin', 'admin', 'agent', 'modder', 'viewer'].map((role, i) => ({ uid: `team-${i}`, role, createdAt: '2026-03-01', lastLogin: '2026-10-20' }));
  team.push({ uid: 'owner', email: 'OWNER@example.test', role: 'client', createdAt: '2026-03-01', lastLogin: '2026-10-20' });
  team.push({ uid: 'blocked-team', role: 'client', roleBeforeBlock: 'agent', blocked: true, createdAt: '2026-03-01', lastLogin: '2026-10-20' });
  const before = sort([registered, returning, ...team]);
  const after = sort([registered, returning, ...team.map(user => ({ ...user, lastLogin: '2026-11-01' }))]);
  assert.deepEqual(before.slice(0, 2), ['returning', 'new']);
  assert.deepEqual(after, before);
});

test('una actualización de login reordena sin cambiar los usuarios ni los roles', () => {
  const users = [registered, returning];
  assert.deepEqual(sort(users), ['returning', 'new']);
  assert.deepEqual(sort([{ ...registered, lastLogin: '2026-10-19T17:00:00Z' }, returning]), ['new', 'returning']);
  assert.equal(users.length, 2);
  assert.equal(users[0].role, 'client');
});

test('cuentas históricas y fechas ausentes conservan un orden determinista', () => {
  assert.deepEqual(sort([{ uid: 'z', lastLoginAt: '2026-10-19' }, { uid: 'b' }, { uid: 'a', createdAt: 'fecha inválida' }]), ['z', 'a', 'b']);
});
