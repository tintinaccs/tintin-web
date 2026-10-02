import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOrderChange, buildOrderStatusEmail, notifyCustomerOrderChange, queueOrderStatusEmail } from '../../cloudflare/correo-estado-pedido.js';
import { decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

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
  const queued = [];
  const enqueue = async (_env, result, error) => { queued.push({ orderId: result.orderId, changeId: result.changeId, error: error.message }); return 'q1'; };
  const failing = await notifyCustomerOrderChange(env, base, { send: async () => { throw new Error('boom'); }, enqueue });
  assert.deepEqual(failing, { sent: false, reason: 'error', queued: true });
  assert.deepEqual(queued, [{ orderId: 'ORDER_ID_123456', changeId: 'chg-1', error: 'boom' }]);
  // Sin cambio que avisar no se encola nada aunque algo falle.
  assert.equal(calls.length, 1);
});

test('queueOrderStatusEmail guarda un trabajo por cambio, sin pisar uno existente', async () => {
  const commits = [];
  const commit = async (_env, writes) => { commits.push(writes); };
  const id = await queueOrderStatusEmail({}, base, new Error('Resend 500'), commit);
  assert.equal(id, 'status__ORDER_ID_123456__chg-1');
  const [write] = commits[0];
  assert.equal(write.path, 'orderEmailQueue/status__ORDER_ID_123456__chg-1');
  assert.deepEqual(write.currentDocument, { exists: false });
  const data = decodeFirestoreFields(write.fields);
  assert.equal(data.kind, 'status');
  assert.equal(data.status, 'pending');
  assert.equal(data.orderStatus, 'confirmado');
  assert.equal(data.previousStatus, 'pendiente');
  assert.equal(data.lastError, 'Resend 500');
  const conflict = async () => { throw Object.assign(new Error('existe'), { code: 'version_conflict' }); };
  assert.equal(await queueOrderStatusEmail({}, base, new Error('x'), conflict), 'status__ORDER_ID_123456__chg-1');
  assert.equal(await queueOrderStatusEmail({}, { ...base, changeId: '' }, new Error('x'), commit), null);
});
