import test from 'node:test';
import assert from 'node:assert/strict';
import { markPaid, markReversed, paypalReversalTransition } from '../../cloudflare/paypal-seguro.js';
import { decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const mapping = { id: 'ORDER12345', orderId: 'order_fixture_123', captureId: 'CAP123456', currency: 'USD', expectedCents: 1000, status: 'COMPLETED', updateTime: '2026-10-05T12:00:00Z' };
const refund = (id, cents = 500) => ({ kind: 'refunded', refundId: id, eventId: `WH-${id}`, captureId: mapping.captureId, currency: 'USD', cents });

test('dos reembolsos parciales distintos completan el total; repetir un reembolso no lo suma', () => {
  const first = paypalReversalTransition(mapping, refund('REF1'));
  const partial = { ...mapping, status: first.status, refundRecords: first.records };
  assert.equal(first.status, 'PARTIALLY_REFUNDED');
  assert.equal(paypalReversalTransition(partial, refund('REF1')).cumulative, 500);
  assert.equal(paypalReversalTransition(partial, refund('REF2')).status, 'REFUNDED');
});

test('eventos tardíos no degradan un reembolso total ni una reversión', () => {
  for (const status of ['REFUNDED', 'REVERSED']) {
    assert.equal(paypalReversalTransition({ ...mapping, status }, refund('REF3', 100)).status, status);
  }
});

test('rechaza captura, moneda e importe desconocidos antes de escribir', () => {
  assert.throws(() => paypalReversalTransition(mapping, { ...refund('REF1'), captureId: 'OTHER1234' }), /captura/);
  assert.throws(() => paypalReversalTransition(mapping, { ...refund('REF1'), currency: 'EUR' }), /Importe/);
  for (const cents of [0, -5, 1001, NaN]) assert.throws(() => paypalReversalTransition(mapping, refund('REF1', cents)));
});

test('reembolso completo actualiza pedido y conciliación juntos y condiciona la versión', async () => {
  const batches = [];
  const result = await markReversed({}, mapping, refund('REF1', 1000), { commit: async (_env, writes) => batches.push(writes), notify: async () => {} });
  assert.equal(result.full, true);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.deepEqual(batches[0][0].currentDocument, { updateTime: mapping.updateTime });
  assert.equal(decodeFirestoreFields(batches[0][0].fields).status, 'REFUNDED');
  assert.equal(decodeFirestoreFields(batches[0][1].fields).paymentStatus, 'reembolsado');
  assert.deepEqual(batches[0][1].currentDocument, { exists: true });
});

test('fallo o conflicto del commit permite reintentar y no anuncia éxito', async () => {
  let notices = 0;
  await assert.rejects(markReversed({}, mapping, refund('REF1', 1000), { commit: async () => { throw new Error('version_conflict'); }, notify: async () => { notices += 1; } }), /version_conflict/);
  assert.equal(notices, 0);
  let retried = false;
  await markReversed({}, mapping, refund('REF1', 1000), { commit: async () => { retried = true; }, notify: async () => {} });
  assert.equal(retried, true);
});

test('un evento repetido repara el pedido incluso si la conciliación ya dice REFUNDED', async () => {
  const first = paypalReversalTransition(mapping, refund('REF1', 1000));
  let writes;
  const result = await markReversed({}, { ...mapping, status: 'REFUNDED', refundRecords: first.records }, refund('REF1', 1000), { commit: async (_env, batch) => { writes = batch; }, notify: async () => {} });
  assert.equal(result.idempotent, true);
  assert.equal(writes.length, 2);
  assert.equal(decodeFirestoreFields(writes[0].fields).reversalCents, 1000);
});

test('cobro tardío conserva el reembolso parcial; no revive un reembolso total', async () => {
  const capture = { id: mapping.captureId, amount: { currency_code: 'USD', value: '10.00' } };
  const writes = [];
  const deps = { commit: async (_env, batch) => writes.push(batch), deductStock: async () => {}, notify: async () => {} };
  await markPaid({}, { ...mapping, status: 'PARTIALLY_REFUNDED' }, capture, deps);
  assert.equal(decodeFirestoreFields(writes[0][1].fields).status, 'PARTIALLY_REFUNDED');
  await markPaid({}, { ...mapping, status: 'REFUNDED' }, capture, deps);
  await markPaid({}, { ...mapping, status: 'REVERSED' }, capture, deps);
  assert.equal(writes.length, 1);
});
