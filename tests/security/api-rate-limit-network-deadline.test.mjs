import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { reserveSharedRateLimit } from '../../cloudflare/rate-limit-compartido.js';

test('el deadline aborta OAuth, GET y commit REST reales; una cancelación OAuth no se cachea', { timeout: 10_000 }, async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'demo-tintin-rate-deadline', client_email: 'fixture@example.invalid',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }) };
  const originalFetch = globalThis.fetch;
  let phase;
  let reached;
  let oauthCalls = 0;
  const abortedStages = [];
  const stall = (stage, signal) => new Promise((_resolve, reject) => {
    assert.ok(signal instanceof AbortSignal);
    reached();
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
      const entered = new Promise(resolve => { reached = resolve; });
      const attempt = reserveSharedRateLimit(env, {
        id: 'network-deadline', identity: randomUUID(), limit: 1,
      }, { timeoutMs: 50 });
      const rejected = assert.rejects(attempt, { status: 503, code: 'rate_limit_unavailable' });
      // Medir el deadline de red con reloj controlado, sin depender del
      // tiempo de firma RSA ni de la carga de otros tests en el runner.
      await entered;
      context.mock.timers.tick(49);
      assert.equal(abortedStages.includes(phase), false);
      context.mock.timers.tick(1);
      await rejected;
    }
    assert.deepEqual(abortedStages, ['oauth', 'get', 'commit']);
    assert.equal(oauthCalls, 2, 'OAuth cancelado se pide de nuevo; sólo el token completado se reutiliza');
  } finally {
    globalThis.fetch = originalFetch;
    context.mock.timers.reset();
  }
});
