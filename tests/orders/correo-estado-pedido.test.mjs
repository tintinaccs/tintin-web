import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOrderChange, buildOrderStatusEmail, notifyCustomerOrderChange } from '../../cloudflare/correo-estado-pedido.js';

const order = { shortId: 'TINPED07', userName: 'Ana <b>', userEmail: 'ana@example.com', total: 150000 };
const base = { orderId: 'ORDER_ID_123456', changeId: 'chg-1', order, duplicate: false, status: 'confirmado', paymentStatus: 'pendiente', previousStatus: 'pendiente', previousPaymentStatus: 'pendiente' };

test('describeOrderChange avisa cambios de estado y de pago, y calla los demás', () => {
  assert.equal(describeOrderChange({ status: 'pendiente', paymentStatus: 'pendiente', previousStatus: 'pendiente', previousPaymentStatus: 'pendiente' }), null);
  assert.equal(describeOrderChange({ status: 'confirmado', paymentStatus: 'pendiente', previousStatus: 'confirmado', previousPaymentStatus: 'pendiente' }), null);
  assert.match(describeOrderChange({ status: 'en_camino', previousStatus: 'preparando' }).title, /camino/);
  assert.match(describeOrderChange({ status: 'pendiente', paymentStatus: 'pagado', previousStatus: 'pendiente', previousPaymentStatus: 'pendiente' }).title, /pago/);
  const both = describeOrderChange({ status: 'confirmado', paymentStatus: 'pagado', previousStatus: 'pendiente', previousPaymentStatus: 'pendiente' });
  assert.equal(both.lines.length, 2);
});

test('el correo escapa HTML y lleva el número de pedido', () => {
  const mail = buildOrderStatusEmail(order, 'ORDER_ID_123456', describeOrderChange(base));
  assert.match(mail.subject, /TINPED07/);
  assert.ok(!mail.html.includes('<b>'));
  assert.match(mail.html, /Ana &lt;b&gt;/);
});

test('notifyCustomerOrderChange envía con clave idempotente y respeta los casos sin envío', async () => {
  const calls = [];
  const send = async (key, payload, idem) => { calls.push({ key, payload, idem }); };
  const env = { RESEND_API_KEY: 'k' };
  assert.deepEqual(await notifyCustomerOrderChange(env, base, { send }), { sent: true });
  assert.equal(calls[0].idem, 'order-ORDER_ID_123456-status-chg-1');
  assert.deepEqual(calls[0].payload.to, ['ana@example.com']);
  assert.equal((await notifyCustomerOrderChange(env, { ...base, duplicate: true }, { send })).sent, false);
  assert.equal((await notifyCustomerOrderChange({}, base, { send })).reason, 'no_api_key');
  assert.equal((await notifyCustomerOrderChange(env, { ...base, order: { ...order, userEmail: 'x', contactEmail: '' } }, { send })).reason, 'invalid_email');
  const failing = await notifyCustomerOrderChange(env, base, { send: async () => { throw new Error('boom'); } });
  assert.deepEqual(failing, { sent: false, reason: 'error' });
  assert.equal(calls.length, 1);
});
