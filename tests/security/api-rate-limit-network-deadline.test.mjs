import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { reserveSharedRateLimit } from '../../cloudflare/rate-limit-compartido.js';

test('el deadline aborta OAuth, GET y commit REST reales; una cancelación OAuth no se cachea', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'demo-tintin-rate-deadline', client_email: 'fixture@example.invalid',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }) };
  const originalFetch = globalThis.fetch;
  let phase;
  let oauthCalls = 0;
  const abortedStages = [];
  const stall = (stage, signal) => new Promise((_resolve, reject) => {
    assert.ok(signal instanceof AbortSignal);
    const abort = () => {
      abortedStages.push(stage);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/')) {
      oauthCalls += 1;
      if (phase === 'oauth') return stall('oauth', init.signal);
      return Response.json({ access_token: 'isolated-test-token', expires_in: 3600 });
    }
    assert.ok(String(url).startsWith('https://firestore.googleapis.com/'));
    if (init.method === 'POST') return stall('commit', init.signal);
    if (phase === 'get') return stall('get', init.signal);
    return new Response('', { status: 404 });
  };
  try {
    for (phase of ['oauth', 'get', 'commit']) {
      await assert.rejects(() => reserveSharedRateLimit(env, {
        id: 'network-deadline', identity: randomUUID(), limit: 1,
      }, { timeoutMs: 50 }), { status: 503, code: 'rate_limit_unavailable' });
    }
    assert.deepEqual(abortedStages, ['oauth', 'get', 'commit']);
    assert.equal(oauthCalls, 2, 'OAuth cancelado se pide de nuevo; sólo el token completado se reutiliza');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
