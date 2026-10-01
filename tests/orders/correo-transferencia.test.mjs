import test from 'node:test';
import assert from 'node:assert/strict';
import { customerEmail, transferInstructionsFromSettings } from '../../functions/api/order-email.js';

const settings = {
  paymentMethodsCatalog: [{
    id: 'transferencia', kind: 'transferencia', title: 'Transferencia', enabled: true,
    instructions: 'Enviá el comprobante.',
    details: [{ id: 'a', label: 'Banco', value: 'Ueno <b>' }, { id: 'b', label: 'Cuenta', value: '123' }]
  }]
};
const order = { shortId: 'AB12', userName: 'Ana', items: [], payment: { method: 'transferencia' } };

test('el correo de transferencia incluye datos bancarios escapados', () => {
  const transfer = transferInstructionsFromSettings(settings);
  const mail = customerEmail(order, 'order-id-123456', transfer);
  assert.match(mail.html, /Ueno &lt;b&gt;/);
  assert.doesNotMatch(mail.html, /Ueno <b>/);
  assert.match(mail.text, /Banco: Ueno <b>/);
  assert.match(mail.text, /Cuenta: 123/);
});

test('sin datos de transferencia el correo sale igual', () => {
  const mail = customerEmail(order, 'order-id-123456', null);
  assert.match(mail.text, /Pago: Transferencia bancaria/);
  assert.doesNotMatch(mail.text, /Cuenta:/);
});

test('método deshabilitado no expone datos', () => {
  const off = { paymentMethodsCatalog: [{ ...settings.paymentMethodsCatalog[0], enabled: false }] };
  assert.equal(transferInstructionsFromSettings(off), null);
});
