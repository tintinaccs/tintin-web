import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaymentMethod } from '../../js/orders/nucleo-metodos-pago.js';

test('datos de transferencia antiguos corrigen ueno sin alterar cuentas ni otros bancos', () => {
  const method = normalizePaymentMethod({ id: 'transferencia', kind: 'transferencia', details: [
    { id: 'ueno', label: 'Ueno (Banco GNB)', value: '123456789' },
    { id: 'gnb', label: 'Banco GNB', value: '987654321' }
  ] });
  assert.equal(method.details[0].label, 'ueno bank');
  assert.equal(method.details[0].value, '123456789');
  assert.equal(method.details[1].label, 'Banco GNB');
  assert.equal(method.details[1].value, '987654321');
});
