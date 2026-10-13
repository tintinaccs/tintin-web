import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/_middleware.js';

for (const [testIndex, [path, method, limit]] of [
  ['/api/health', 'GET', 12],
  ['/api/health', 'HEAD', 12],
  ['/api/username-availability', 'POST', 30],
  ['/api/phone-availability', 'POST', 30],
  ['/api/telemetry', 'POST', 40],
  ['/api/public-catalog', 'GET', 60],
  ['/api/visual-builder-public', 'GET', 60],
  ['/api/visual-studio-global-public', 'GET', 60]
].entries()) {
  test(`${method} ${path} bloquea antes de ejecutar consultas tras ${limit} peticiones`, async () => {
    let calls = 0;
    let reservations = 0;
    const deps = { sharedLimit: async () => { reservations += 1; } };
    const ip = `192.0.2.${101 + testIndex}`;
    const context = index => ({
      request: new Request(`https://example.com${path}`, {
        method, headers: { 'cf-connecting-ip': ip, 'user-agent': `changing-${index}` }
      }),
      next: async () => { calls += 1; return Response.json({ ok: true }); }
    });
    for (let index = 0; index < limit; index += 1) {
      assert.equal((await onRequest(context(index), deps)).status, 200);
    }
    const blocked = await onRequest(context(limit), deps);
    assert.equal(blocked.status, 429);
    assert.equal(calls, limit);
    assert.equal(reservations, limit);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  });
}

test('una cuota compartida agotada bloquea antes del backend aunque el contador local tenga espacio', async () => {
  let calls = 0;
  const response = await onRequest({
    request: new Request('https://example.com/api/health', { headers: { 'cf-connecting-ip': '192.0.2.89' } }),
    next: async () => { calls += 1; return Response.json({ ok: true }); }
  }, { sharedLimit: async () => { throw Object.assign(new Error('limited'), { code: 'rate_limited', retryAfter: 23 }); } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '23');
  assert.equal(calls, 0);
});

test('si falla el almacenamiento de la cuota no ejecuta el backend', async () => {
  let calls = 0;
  const response = await onRequest({
    request: new Request('https://example.com/api/health', { headers: { 'cf-connecting-ip': '192.0.2.90' } }),
    env: {},
    next: async () => { calls += 1; return Response.json({ ok: true }); }
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});
