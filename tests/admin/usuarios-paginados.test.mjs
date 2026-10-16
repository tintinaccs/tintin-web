import test from 'node:test';
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
    createAdminPagedSource, adminRealtimeReady: ready, adminRealtimeErrors: {}, ADMIN_REALTIME_LIMIT: 250, db: {},
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
