import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paypalAmountFromPyg,
  paypalConfig,
  paypalCreateRequestId,
  paypalReversalDetails,
  publicPaypalConfig,
  validatePayableOrder,
} from '../../cloudflare/paypal-seguro.js';
import { onRequestPost, parseBcpUsdRate } from '../../functions/api/paypal-rate-refresh.js';

const now = Date.parse('2026-08-08T12:00:00Z');
const complete = {
  PAYPAL_ENABLED: 'true', PAYPAL_ENVIRONMENT: 'sandbox', PAYPAL_CLIENT_ID: 'client',
  PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'webhook', PAYPAL_SETTLEMENT_CURRENCY: 'USD',
  PAYPAL_PYG_PER_USD: '7500', PAYPAL_RATE_UPDATED_AT: '2026-08-08T10:00:00Z',
};

test('PayPal queda cerrado por defecto y no expone secretos', () => {
  const publicConfig = publicPaypalConfig({}, now);
  assert.equal(publicConfig.enabled, false);
  assert.equal(publicConfig.clientId, '');
  assert.equal(JSON.stringify(publicConfig).includes('clientSecret'), false);
});

test('solo habilita con credenciales, USD y tasa reciente', () => {
  assert.equal(paypalConfig(complete, now).enabled, true);
  assert.equal(paypalConfig({ ...complete, PAYPAL_CLIENT_SECRET: '' }, now).enabled, false);
  assert.equal(paypalConfig({ ...complete, PAYPAL_SETTLEMENT_CURRENCY: 'PYG' }, now).enabled, false);
  assert.equal(paypalConfig({ ...complete, PAYPAL_RATE_UPDATED_AT: '2026-07-01T00:00:00Z' }, now).enabled, false);
});

test('convierte guaraníes a centavos de USD con redondeo único', () => {
  assert.deepEqual(paypalAmountFromPyg(70000, 7500), { cents: 933, value: '9.33' });
  assert.throws(() => paypalAmountFromPyg(70000, 0));
  assert.throws(() => paypalAmountFromPyg(1.5, 7500));
});

test('lee únicamente el USD y la fecha publicados en la tabla interbancaria del BCP', () => {
  const html = `<input id="dp_cotizacion" value=""><input type="hidden" name="fecha" value="25/09/2026"><table id="cotizacion-interbancaria"><tr><th>Moneda</th><th>Código</th><th>ME/USD</th><th>₲ / ME</th></tr><tr><td><img alt="DÓLAR ESTADOUNIDENSE"> DÓLAR ESTADOUNIDENSE</td><td>USD</td><td>1,0000</td><td>5.873,44</td></tr></table>`;
  assert.deepEqual(parseBcpUsdRate(html), { rate: 5873.44, sourceDate: '2026-09-25' });
  assert.throws(() => parseBcpUsdRate('<html>sin cotización</html>'), /bcp_rate_not_found/);
});

test('la actualización BCP exige token OIDC antes de consultar o escribir datos', async () => {
  const request = new Request('https://tintinaccesorios.pages.dev/api/paypal-rate-refresh', { method: 'POST', headers: { 'cf-connecting-ip': '192.0.2.77' } });
  const response = await onRequestPost({ request, env: {} });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'missing_oidc_token' });
});

test('tasa fuera del rango plausible del guaraní deja PayPal deshabilitado', () => {
  assert.equal(paypalConfig({ ...complete, PAYPAL_PYG_PER_USD: '1' }, now).enabled, false);
  assert.equal(paypalConfig({ ...complete, PAYPAL_PYG_PER_USD: '900000' }, now).enabled, false);
});

const payable = { userId: 'uid1', payment: { method: 'paypal', status: 'pendiente' }, paymentStatus: 'pendiente', status: 'pendiente', total: 70000 };

test('un pedido cerrado no se puede cobrar por PayPal', () => {
  assert.equal(validatePayableOrder(payable, 'uid1'), 70000);
  assert.throws(() => validatePayableOrder({ ...payable, status: 'cancelado' }, 'uid1'), /cerrado/);
  assert.throws(() => validatePayableOrder({ ...payable, status: 'rechazado' }, 'uid1'), /cerrado/);
  assert.throws(() => validatePayableOrder({ ...payable, payment: { method: 'paypal', status: 'reembolsado' }, paymentStatus: 'reembolsado' }, 'uid1'), /cerrado/);
  assert.throws(() => validatePayableOrder({ ...payable, paymentStatus: 'pagado' }, 'uid1'), /ya está pagado/);
  assert.throws(() => validatePayableOrder(payable, 'otra'), /no pertenece/);
});

test('el id de creación PayPal cambia con el importe y respeta el máximo de 108 caracteres', async () => {
  const longId = `public_${'u'.repeat(28)}_${'r'.repeat(100)}`;
  const first = await paypalCreateRequestId(longId, 933);
  assert.equal(first, await paypalCreateRequestId(longId, 933));
  assert.notEqual(first, await paypalCreateRequestId(longId, 1000));
  assert.ok(first.length <= 108);
});

test('reembolsos y contracargos identifican la captura y el monto', () => {
  const refund = paypalReversalDetails({
    id: 'WH-1', event_type: 'PAYMENT.CAPTURE.REFUNDED',
    resource: { id: 'REF1', amount: { value: '9.33', currency_code: 'USD' },
      links: [{ rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/CAP123456/' }] },
  });
  assert.deepEqual(refund, { kind: 'refunded', captureId: 'CAP123456', providerOrderId: '', currency: 'USD', cents: 933, eventId: 'WH-1', refundId: 'REF1' });
  const reversal = paypalReversalDetails({
    event_type: 'PAYMENT.CAPTURE.REVERSED',
    resource: { id: 'CAP999999', amount: { value: '-9.33', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'ORDER12345' } } },
  });
  assert.equal(reversal.kind, 'reversed');
  assert.equal(reversal.captureId, 'CAP999999');
  assert.equal(reversal.providerOrderId, 'ORDER12345');
  assert.equal(reversal.cents, 933);
});
