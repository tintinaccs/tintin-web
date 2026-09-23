import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/product.js';

function context(url) {
  return {
    request: new Request(url, { method: 'GET' }),
    env: {
      ASSETS: {
        fetch: async () => new Response('<html><head></head><body></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        })
      }
    }
  };
}

test('/product sin id no es indexable', async () => {
  const res = await onRequest(context('https://example.test/product'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
});

test('/product con id inválido no es indexable', async () => {
  const res = await onRequest(context('https://example.test/product?id=../etc/passwd'));
  assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
});
