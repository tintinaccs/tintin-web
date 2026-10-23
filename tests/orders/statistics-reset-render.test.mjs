import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { statisticsSince } from '../../js/admin/statistics/modelo-reinicios.mjs';
import { onRequest } from '../../functions/api/admin-commerce-controls.js';
const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function renderGeneralStatistics()'), source.indexOf('async function listenStatisticsTraffic()'));
function render(resets = {}, extraOrders = []) {
  const values = {}, bars = {}, rankings = {};
  const now = Date.now();
  const allOrders = [{ createdAt: now - 10000, status: 'entregado', paymentStatus: 'pagado', total: 200, items: [], shipping: { city: 'A' } },
    { createdAt: now - 1000, status: 'pendiente', paymentStatus: 'pendiente', total: 100, items: [], shipping: { city: 'B' } },
    ...extraOrders.map(order=>({createdAt:now-500,status:'entregado',paymentStatus:'pagado',...order}))];
  const dependencies = { currentRole: 'superadmin', ensureStatisticsControls: () => true, refreshStatisticsViews() {}, runAdminCrudOperation() {},
    statisticsStartDate: () => new Date(now - 100000), allOrders, allUsers: [{ createdAt: now - 10000 }],
    activityTimestampMillis: value => Number(value), statisticsOrderIsValid: () => true,
    statisticsPaymentStatus: order => order.paymentStatus, statisticsTrafficSessions: [{ startedAt: now - 10000, visitorId: 'old' }, { startedAt: now - 1000, visitorId: 'new' }],
    statisticsActivePresence: () => [], _allProducts: [], filterStatisticsRows: (metric, rows, timeOf) => statisticsSince(rows, metric, resets, timeOf),
    statisticsSetText: (key, value) => { values[key] = value; }, formatPrice: value => Number(value),
    adminRealtimeReady: { orders: true, users: true, traffic: true, presence: true, products: true },
    activityLocationLabel: () => 'QA', activityPageLabel: () => '/', renderStatisticsBars: (key, value) => { bars[key] = value; },
    renderStatisticsRanking: (key, value) => { rankings[key] = value; }, ORDER_STATUS_LABELS: {}, PAY_STATUS_LABELS: {}, renderStatisticsTrend() {} };
  new Function(...Object.keys(dependencies), renderer + '\nrenderGeneralStatistics();')(...Object.values(dependencies));
  return { values, bars, rankings, now };
}
test('reiniciar facturación no reinicia importe pagado, cantidad ni promedio', () => {
  const before = render();
  const { values } = render({ revenue: new Date(before.now + 1000) });
  assert.equal(values['statistics-revenue'], 0);
  assert.equal(values['statistics-paid'], 200);
  assert.equal(values['statistics-orders'], '2');
  assert.equal(values['statistics-average-ticket'], 150);
});
test('cada contador usa su propia fecha y nuevas operaciones vuelven a sumar', () => {
  const baseline = render(); const date = new Date(baseline.now - 5000);
  const { values } = render({ paid: date, orders: date, average: date, visitors: date, users: date });
  assert.equal(values['statistics-paid'], 0); assert.equal(values['statistics-orders'], '1');
  assert.equal(values['statistics-average-ticket'], 100); assert.equal(values['statistics-visitors'], '1');
  assert.equal(values['statistics-new-users'], '0'); assert.match(values['statistics-sessions'], /^1 sesión$/);
  assert.equal(values['statistics-revenue'], 300);
});
test('endpoint rechaza origen ajeno, sesión ausente y métodos no permitidos sin acceder a datos', async () => {
  const denied = await onRequest({ request: new Request('https://tintinaccs.com/api/admin-commerce-controls', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }), env: {} });
  assert.equal(denied.status, 403);
  for (const method of ['GET', 'POST']) {
    const response = await onRequest({ request: new Request('https://tintinaccs.com/api/admin-commerce-controls', { method, headers: { origin: 'https://tintinaccs.com' }, ...(method === 'POST' ? { body: '{}' } : {}) }), env: {} });
    assert.equal(response.status, 401);
  }
  const wrongMethod = await onRequest({ request: new Request('https://tintinaccs.com/api/admin-commerce-controls', { method: 'DELETE', headers: { origin: 'https://tintinaccs.com' } }), env: {} });
  assert.equal(wrongMethod.status, 405);
});


test('product ranking separates identical names and joins renamed snapshots by stable ID',()=>{
 const orders=[{items:[{id:'a',name:'Mismo',qty:1,price:100},{id:'b',name:'Mismo',qty:1,price:200}]},{items:[{id:'a',name:'Renombrado',qty:2,price:120}]}];
 const result=render({},orders),rows=result.rankings['statistics-top-products'];
 assert.equal(rows.length,2);
 assert.equal(rows.find(row=>row.id==='a')?.value,3);
 assert.equal(rows.find(row=>row.id==='b')?.value,1);
 assert.equal(render({products:new Date(result.now+1000)},orders).rankings['statistics-top-products'].length,0);
});
