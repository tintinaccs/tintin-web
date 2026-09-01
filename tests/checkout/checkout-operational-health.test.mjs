import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCheckoutOperationalOrder,
  inspectCheckoutOperationalHealth,
  isPaidOrder,
} from '../../cloudflare/checkout-operational-health.js';

test('solo los pagos aprobados entran a conciliación operativa', () => {
  assert.equal(isPaidOrder({ paymentStatus: 'pagado' }), true);
  assert.equal(isPaidOrder({ payment: { status: 'approved' } }), true);
  assert.equal(isPaidOrder({ paymentStatus: 'pendiente' }), false);
});

test('pago aprobado sin correo enviado genera alerta', () => {
  const alert = classifyCheckoutOperationalOrder({
    orderNumber: 'TINPED-1',
    paymentStatus: 'pagado',
    notificationStatus: 'failed',
  }, { orderId: 'order-1', sheetsAvailable: true });
  assert.equal(alert.emailIssue, true);
  assert.equal(alert.sheetsIssue, false);
});

test('caída del bridge Sheets marca pagos aprobados en riesgo sin exponer PII', async () => {
  const report = await inspectCheckoutOperationalHealth({}, {
    sheetsAvailable: false,
    listDocuments: async () => [{
      name: 'projects/demo/databases/(default)/documents/orders/order-2',
      fields: {
        orderNumber: { stringValue: 'TINPED-2' },
        paymentStatus: { stringValue: 'pagado' },
        notificationStatus: { stringValue: 'sent' },
        userEmail: { stringValue: 'privado@example.com' },
      },
    }],
  });

  assert.equal(report.ok, false);
  assert.equal(report.paidWithoutEmail, 0);
  assert.equal(report.paidAtRiskSheets, 1);
  assert.equal(report.alerts[0].orderId, 'order-2');
  assert.equal('userEmail' in report.alerts[0], false);
});

test('pago aprobado con correo y Sheets saludables no genera alerta', async () => {
  const report = await inspectCheckoutOperationalHealth({}, {
    sheetsAvailable: true,
    listDocuments: async () => [{
      name: 'projects/demo/databases/(default)/documents/orders/order-3',
      fields: {
        orderNumber: { stringValue: 'TINPED-3' },
        paymentStatus: { stringValue: 'pagado' },
        notificationStatus: { stringValue: 'sent' },
      },
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.paidOrders, 1);
  assert.equal(report.alerts.length, 0);
});
