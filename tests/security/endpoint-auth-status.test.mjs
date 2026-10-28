import test from 'node:test';
import assert from 'node:assert/strict';

const routes = ['cloudinary-delete', 'cloudinary-sign-audio-upload', 'coupon-validate', 'phone-availability', 'username-availability', 'paypal-create-order', 'paypal-capture-order'];

for (const route of routes) {
  test(`${route} distingue falta de sesión, origen ajeno y método inválido`, async () => {
    const { onRequest } = await import(`../../functions/api/${route}.js`);
    for (const [method, origin, expected] of [['POST', 'https://tintin.test', 401], ['POST', 'https://untrusted.invalid', 403], ['DELETE', 'https://tintin.test', 405]]) {
      const response = await onRequest({ request: new Request(`https://tintin.test/api/${route}`, {
        method, headers: { origin, 'content-type': 'application/json' }, body: '{}',
      }), env: {} });
      assert.equal(response.status, expected, `${method} ${origin}`);
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
  });
}
