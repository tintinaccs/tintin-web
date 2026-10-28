import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/api/telemetry.js';

test('telemetría aplica el límite de bytes aunque Content-Length falte o sea menor', async () => {
  for (const length of [undefined, '1']) {
    let forwarded = 0;
    const headers = { 'content-type': 'application/json', 'cf-connecting-ip': length ? '192.0.2.171' : '192.0.2.172' };
    if (length) headers['content-length'] = length;
    const request = new Request('https://tintin.test/api/telemetry', {
      method: 'POST', headers, body: JSON.stringify({ message: 'á'.repeat(4500) }),
    });
    const response = await onRequestPost({ request, env: {}, waitUntil: () => { forwarded++; } });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, 'payload_too_large');
    assert.equal(forwarded, 0);
  }
});

test('telemetría cancela un stream que supera el límite antes de procesar eventos', async () => {
  let cancelled = false, forwarded = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('x'.repeat(8193)));
    },
    cancel() { cancelled = true; },
  });
  const response = await onRequestPost({
    request: new Request('https://tintin.test/api/telemetry', { method: 'POST', body, duplex: 'half', headers: { 'cf-connecting-ip': '192.0.2.173' } }),
    env: {}, waitUntil: () => { forwarded = true; },
  });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(forwarded, false);
});

test('telemetría mantiene JSON válido y rechaza JSON inválido pequeño', async () => {
  for (const [body, expected] of [[JSON.stringify({ kind: 'performance', metric: 'LCP', value: 123 }), 202], ['{', 400]]) {
    const request = new Request('https://tintin.test/api/telemetry', { method: 'POST', body, headers: { 'cf-connecting-ip': '192.0.2.174' } });
    assert.equal((await onRequestPost({ request, env: {} })).status, expected);
  }
});
