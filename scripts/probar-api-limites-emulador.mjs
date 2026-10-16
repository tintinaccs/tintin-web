import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { decodeFirestoreFields } from '../cloudflare/firebase-admin-ligero.js';

const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/);
const project = 'demo-tintin-api-limits';
const prefix = `projects/${project}/databases/(default)/documents/`;
const root = `http://${host}/v1/${prefix.slice(0, -1)}`;
const headers = { authorization: 'Bearer owner', 'content-type': 'application/json' };
const paths = new Set();
const deps = {
  async get(_env, path, { signal } = {}) {
    paths.add(path);
    const response = await fetch(`${root}/${path}`, { headers, ...(signal ? { signal } : {}) });
    if (response.status === 404) return null;
    assert.equal(response.status, 200);
    return response.json();
  },
  async commit(_env, writes, { signal } = {}) {
    const response = await fetch(`${root}:commit`, {
      method: 'POST', headers, ...(signal ? { signal } : {}),
      body: JSON.stringify({ writes: writes.map(write => ({
        update: { name: prefix + write.path, fields: write.fields },
        currentDocument: write.currentDocument,
      })) }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw Object.assign(new Error('emulator_commit_failed'), {
        status: response.status,
        code: body.error?.status === 'FAILED_PRECONDITION' || response.status === 409 ? 'version_conflict' : 'emulator_failure',
      });
    }
    return body;
  },
};

test('Firestore real: 200 peticiones desde isolates distintos nunca superan 20 reservas', async () => {
  // Preparar el proyecto emulado antes de medir las 200 reservas concurrentes.
  // Su primera conexión no forma parte del plazo de respuesta de la API.
  const warmup = await fetch(`${root}/apiRateLimits/warmup`, { headers, signal: AbortSignal.timeout(30_000) });
  assert.ok([200, 404].includes(warmup.status));
  const writeWarmup = await fetch(`${root}:commit`, {
    method: 'POST', headers, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ writes: [{ update: { name: prefix + 'apiRateLimits/warmup', fields: { count: { integerValue: '0' } } } }] }),
  });
  assert.equal(writeWarmup.status, 200, await writeWarmup.text());
  const isolates = await Promise.all([1, 2].map(value => import(`../cloudflare/rate-limit-compartido.js?isolate=${value}-${randomUUID()}`)));
  const policy = { id: 'api-concurrency', identity: randomUUID(), limit: 20, windowMs: 60_000 };
  const results = await Promise.allSettled(Array.from({ length: 200 }, (_value, index) =>
    isolates[index % 2].reserveSharedRateLimit({}, policy, deps)));
  const accepted = results.filter(result => result.status === 'fulfilled').length;
  assert.ok(accepted > 0 && accepted <= policy.limit, `reservas concedidas: ${accepted}`);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => [429, 503].includes(result.reason.status)));
  assert.equal(paths.size, 1);
  const path = [...paths][0];
  const document = await deps.get({}, path);
  const reserved = decodeFirestoreFields(document.fields).count;
  // Un commit puede confirmarse en Firestore justo antes de cancelar el HTTP.
  // Eso consume cuota aunque la API falle cerrada: nunca permite cuota extra.
  assert.ok(reserved >= accepted && reserved <= policy.limit);
  // Completa las reservas remanentes de forma secuencial y comprueba que una
  // tercera instancia fría lee la cuota agotada, sin permiso local implícito.
  let additional = 0;
  for (let index = 0; index < policy.limit; index += 1) {
    try {
      await isolates[0].reserveSharedRateLimit({}, policy, deps);
      additional += 1;
    } catch (error) {
      assert.equal(error.status, 429);
      break;
    }
  }
  assert.ok(accepted + additional <= policy.limit);
  assert.equal(decodeFirestoreFields((await deps.get({}, path)).fields).count, policy.limit);
  const cold = await import(`../cloudflare/rate-limit-compartido.js?cold=${randomUUID()}`);
  await assert.rejects(() => cold.reserveSharedRateLimit({}, policy, deps), { status: 429, code: 'rate_limited' });
  console.log(`Firestore API quota: ${accepted}/200 reservas concurrentes, límite20 confirmado por isolate frío.`);
});
