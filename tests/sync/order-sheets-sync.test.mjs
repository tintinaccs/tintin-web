import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';

const ENV = { SHEETS_ENGAGEMENT_SECRET: 'test-secret' };
const RESULT = {
  orderId: 'manual_test_123',
  order: {
    orderNumber: 'TINPED99',
    status: 'pendiente',
    subtotal: 100000,
    shippingCost: 20000,
    total: 120000,
    items: [{ id: 'prod_1', name: 'Reloj', price: 100000, qty: 1 }],
  },
};

test('push inmediato envía el pedido canónico y confirma la fila', async () => {
  let captured;
  const fakeFetch = async (_url, options) => {
    captured = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, row: 8 }),
    };
  };

  const result = await syncOrderToSheetsBestEffort(ENV, RESULT, fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.deferred, false);
  assert.equal(result.row, 8);
  assert.equal(captured.action, 'syncOrder');
  assert.equal(captured.secret, ENV.SHEETS_ENGAGEMENT_SECRET);
  assert.equal(captured.orderId, RESULT.orderId);
  assert.deepEqual(captured.order, RESULT.order);
});

test('una caída de Sheets queda diferida y no lanza error comercial', async () => {
  const fakeFetch = async () => { throw new Error('Google temporalmente no disponible'); };
  const result = await syncOrderToSheetsBestEffort(ENV, RESULT, fakeFetch);
  assert.equal(result.ok, false);
  assert.equal(result.deferred, true);
  assert.match(result.error, /Google temporalmente no disponible/);
});

test('sin secreto o resultado canónico no intenta red y queda diferido', async () => {
  let calls = 0;
  const fakeFetch = async () => { calls += 1; throw new Error('no debe ejecutarse'); };

  const missingSecret = await syncOrderToSheetsBestEffort({}, RESULT, fakeFetch);
  const missingOrder = await syncOrderToSheetsBestEffort(ENV, { orderId: RESULT.orderId }, fakeFetch);

  assert.equal(missingSecret.deferred, true);
  assert.equal(missingSecret.reason, 'missing_sheets_secret');
  assert.equal(missingOrder.deferred, true);
  assert.equal(missingOrder.reason, 'missing_order_result');
  assert.equal(calls, 0);
});
