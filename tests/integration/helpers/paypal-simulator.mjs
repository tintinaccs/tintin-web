import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

// Only OAuth/provider replies are simulated. The production PayPal functions
// and Firestore REST calls run unchanged against the guarded local emulator.
export async function withPaypalSimulator(project, host, payment, action) {
  assert.match(project, /^demo-/); assert.match(host, /^(localhost|127\.0\.0\.1):\d+$/);
  const nativeFetch = globalThis.fetch, calls = []; let captureAttempts = 0;
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: project, client_email: 'qa-only@example.invalid', private_key: privateKey }),
    PAYPAL_ENABLED: 'true', PAYPAL_ENVIRONMENT: 'sandbox', PAYPAL_CLIENT_ID: 'qa-only-client', PAYPAL_CLIENT_SECRET: 'qa-only-placeholder',
    PAYPAL_WEBHOOK_ID: 'qa-only-webhook', PAYPAL_SETTLEMENT_CURRENCY: 'USD', PAYPAL_PYG_PER_USD: '7500', PAYPAL_RATE_UPDATED_AT: new Date().toISOString(),
  };
  const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.origin === `http://${host}`) return nativeFetch(input, options);
    if (url.hostname === 'firestore.googleapis.com' && url.pathname.startsWith(`/v1/projects/${project}/`)) {
      const headers = new Headers(options.headers); headers.set('authorization', 'Bearer owner');
      return nativeFetch(`http://${host}${url.pathname}${url.search}`, { ...options, headers });
    }
    if (url.href === 'https://oauth2.googleapis.com/token') return json({ access_token: 'qa-google-placeholder', expires_in: 3600 });
    if (url.origin === 'https://api-m.sandbox.paypal.com') {
      calls.push({ path: url.pathname, method: options.method, requestId: new Headers(options.headers).get('PayPal-Request-Id'), body: options.body && JSON.parse(options.body.startsWith('{') ? options.body : '{}') });
      if (url.pathname === '/v1/oauth2/token') return json({ access_token: 'qa-paypal-placeholder' });
      if (url.pathname === '/v2/checkout/orders') return json({ id: payment.providerId, status: 'CREATED' });
      if (url.pathname === `/v2/checkout/orders/${payment.providerId}/capture`) {
        if (payment.failCaptureOnce && ++captureAttempts === 1) return new Response(JSON.stringify({ name: 'SIMULATED_TEMPORARY_FAILURE' }), { status: 500 });
        return json({ id: payment.providerId, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: payment.captureId, status: 'COMPLETED', amount: { currency_code: 'USD', value: payment.value } }] } }] });
      }
    }
    throw new Error(`La simulación bloqueó un servicio externo inesperado: ${url.origin}${url.pathname}`);
  };
  try { return await action({ env, calls }); } finally { globalThis.fetch = nativeFetch; }
}
