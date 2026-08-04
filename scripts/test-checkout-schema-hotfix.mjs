import assert from 'node:assert/strict';
import { onRequest } from '../functions/js/orders/secure-checkout-order.js.js';

const incompatibleSource = `
const orderData = {
  shipping: {
    method: shipping.method,
    city: shipping.city,
    departamento: draft.departamento || '',
    rateIndex: shipping.rateIndex,
    address: draft.address
  }
};
`;

async function callFunction(source, method = 'GET') {
  const request = new Request(
    'https://tintinaccesorios.pages.dev/js/orders/secure-checkout-order.js?v=test',
    { method }
  );
  const env = {
    ASSETS: {
      fetch: async () => new Response(source, {
        status: 200,
        headers: {
          'content-type': 'text/javascript',
          'cache-control': 'public, max-age=31536000',
          'content-length': String(source.length)
        }
      })
    }
  };
  return onRequest({ request, env });
}

const patchedResponse = await callFunction(incompatibleSource);
const patchedSource = await patchedResponse.text();
assert.equal(patchedResponse.status, 200);
assert.equal(patchedResponse.headers.get('x-tintin-checkout-schema-fix'), 'applied');
assert.equal(patchedResponse.headers.get('content-length'), null);
assert.match(patchedResponse.headers.get('cache-control') || '', /no-store/);
assert.ok(!patchedSource.includes("departamento: draft.departamento || ''"));
assert.ok(patchedSource.includes('city: shipping.city'));
assert.ok(patchedSource.includes('rateIndex: shipping.rateIndex'));

const compatibleSource = incompatibleSource.replace(
  /^\s*departamento:\s*draft\.departamento\s*\|\|\s*'',\s*$/m,
  ''
);
const untouchedResponse = await callFunction(compatibleSource);
assert.equal(untouchedResponse.headers.get('x-tintin-checkout-schema-fix'), 'not-needed');
assert.equal(await untouchedResponse.text(), compatibleSource);

const headResponse = await callFunction(incompatibleSource, 'HEAD');
assert.equal(headResponse.status, 200);
assert.equal(headResponse.headers.get('x-tintin-checkout-schema-fix'), null);

console.log('Checkout schema hotfix: 3/3 comprobaciones correctas.');
