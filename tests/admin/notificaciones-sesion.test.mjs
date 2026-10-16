import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la escucha de pedidos no se abre si termina App Check después de cerrar sesión', async () => {
  const source = readFileSync(new URL('../../js/admin/notifications/notificaciones-admin.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function subscribeOrderStatusChanges()');
  const end = source.indexOf('\nfunction wireEvents()', start);
  let resolveCheck, subscriptions = 0;
  const waiting = new Promise(resolve => { resolveCheck = resolve; });
  const deps = { window: { clearTimeout() {} }, waitForAdminAppCheck: () => waiting,
    query() {}, collection() {}, orderBy() {}, limit() {}, db: {},
    onSnapshot() { subscriptions++; return () => {}; },
  };
  const runtime = new Function('deps', `let {${Object.keys(deps).join(',')}}=deps;
    let ordersGeneration=0,user={uid:'owner'},unsubscribeOrders=null,orderState,ordersPrimed,ordersRetryTimer=0;
    ${source.slice(start, end)}
    return {start:subscribeOrderStatusChanges,logout:()=>{user=null;ordersGeneration++;}};`)(deps);
  const startWatch = runtime.start();
  runtime.logout(); resolveCheck(true);
  await startWatch;
  assert.equal(subscriptions, 0);
});
