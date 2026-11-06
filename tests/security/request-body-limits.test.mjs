import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { readLimitedText, readLimitedJson } from '../../functions/lib/operational-guard.js';
import { onRequest as paypalWebhook } from '../../functions/api/paypal-webhook.js';
import { onRequest as adminOrder } from '../../functions/api/admin-order-mutation.js';
import { handleEmailOtpSend } from '../../functions/api/email-otp-send.js';
import { handleEmailOtpVerify } from '../../functions/api/email-otp-verify.js';

function streamRequest(path, size, length) {
  let cancelled = false, pulls = 0;
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(size).fill(120)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const headers = { origin: 'https://tintin.test' };
  if (length !== undefined) headers['content-length'] = length;
  return {
    request: new Request('https://tintin.test/api/' + path, { method: 'POST', headers, body, duplex: 'half' }),
    state: () => ({ cancelled, pulls }),
  };
}

test('el lector limita bytes aunque falte Content-Length o el valor declarado sea falso', async () => {
  for (const declared of [undefined, '1', '999999']) {
    const { request, state } = streamRequest('fixture', 33, declared);
    await assert.rejects(readLimitedText(request, 32), error => error.status === 413);
    assert.deepEqual(state(), { cancelled: true, pulls: 1 });
  }
});

test('el lector conserva el texto firmado y decodifica UTF-8 partido entre chunks', async () => {
  const text = ' {"texto":"á💗"}\n', bytes = new TextEncoder().encode(text);
  let offset = 0;
  const request = new Request('https://tintin.test/', { method: 'POST', duplex: 'half', body: new ReadableStream({
    pull(controller) { if (offset === bytes.length) controller.close(); else controller.enqueue(bytes.slice(offset, ++offset)); },
  }) });
  assert.equal(await readLimitedText(request, bytes.length), text);
  await assert.rejects(readLimitedText(new Request('https://tintin.test/', { method: 'POST', body: text }), text.length), error => error.status === 413);
});

test('JSON vacío o inválido conserva SyntaxError; un exceso no se convierte en JSON vacío', async () => {
  await assert.rejects(readLimitedJson(new Request('https://tintin.test/'), 10), SyntaxError);
  await assert.rejects(readLimitedJson(new Request('https://tintin.test/', { method: 'POST', body: '{' }), 10), SyntaxError);
  assert.deepEqual(await readLimitedJson(new Request('https://tintin.test/', { method: 'POST', body: '{"ok":true}' }), 11), { ok: true });
});

test('un fallo al cancelar el stream no oculta el rechazo 413', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5)); }, cancel() { throw new Error('cancel failed'); } });
  await assert.rejects(readLimitedText(new Request('https://tintin.test/', { method: 'POST', body, duplex: 'half' }), 4), error => error.status === 413);
});

test('webhook y pedidos rechazan streams largos antes de consumir el resto o llamar servicios', async () => {
  const previousFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => { externalCalls++; throw new Error('Unexpected external request'); };
  try {
    for (const [path, handler, size] of [
      ['paypal-webhook', paypalWebhook, 100001],
      ['admin-order-mutation', adminOrder, 750001],
      ['email-otp-send', handleEmailOtpSend, 2001],
      ['email-otp-verify', handleEmailOtpVerify, 2001],
    ]) {
      const { request, state } = streamRequest(path, size, '1');
      const response = await handler({ request, env: { RESEND_API_KEY: 'fixture-only' } });
      assert.equal(response.status, 413, path);
      assert.deepEqual(state(), { cancelled: true, pulls: 1 }, path);
    }
    assert.equal(externalCalls, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('los endpoints JSON/texto no vuelven a materializar cuerpos sin límite', async () => {
  for (const file of await fs.readdir('functions/api')) {
    if (!file.endsWith('.js')) continue;
    const source = await fs.readFile('functions/api/' + file, 'utf8');
    assert.doesNotMatch(source, /request\.(?:text|json)\s*\(/, file);
  }
});
