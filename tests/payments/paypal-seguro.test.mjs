import test from 'node:test';
import assert from 'node:assert/strict';
import { paypalAmountFromPyg, paypalConfig, publicPaypalConfig } from '../../cloudflare/paypal-seguro.js';

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
