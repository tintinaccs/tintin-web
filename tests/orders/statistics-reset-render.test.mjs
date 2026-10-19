import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { statisticsSince } from '../../js/admin/statistics/modelo-reinicios.mjs';
import { onRequest } from '../../functions/api/admin-commerce-controls.js';
const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function renderGeneralStatistics()'), source.indexOf('async function listenStatisticsTraffic()'));
function render(resets = {}) {
  const values = {}, bars = {}, rankings = {};
  const now = Date.now();
  const allOrders = [{ createdAt: now - 10000, status: 'entregado', paymentStatus: 'pagado', total: 200, items: [], shipping: { city: 'A' } },
    { createdAt: now - 1000, status: 'pendiente', paymentStatus: 'pendiente', total: 100, items: [], shipping: { city: 'B' } }];
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
