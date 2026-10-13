import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import {
  authenticatedRatePolicy,
  enforceAuthenticatedRateLimit,
  limitByIp,
  reserveSharedRateLimit,
} from '../../cloudflare/rate-limit-compartido.js';
import { rateLimitErrorResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { handlePhoneAvailability } from '../../functions/api/phone-availability.js';

function sharedStore() {
  const documents = new Map();
  let revision = 0;
  let reads = 0;
  const deps = {
    async get(_env, path) {
      reads += 1;
      return structuredClone(documents.get(path) || null);
    },
    async commit(_env, writes) {
      for (const write of writes) {
        const existing = documents.get(write.path);
        const condition = write.currentDocument;
        if ((condition.exists === false && existing) ||
            (condition.updateTime && existing?.updateTime !== condition.updateTime)) {
          throw Object.assign(new Error('conflict'), { code: 'version_conflict', status: 409 });
        }
        documents.set(write.path, { fields: structuredClone(write.fields), updateTime: String(++revision) });
      }
    },
    now: () => 1_000_000,
    pause: async () => {},
  };
  return { documents, deps, reads: () => reads, writes: () => revision };
}

test('200 solicitudes desde dos isolates comparten una reserva CAS sin superar la cuota', async () => {
  const isolates = await Promise.all([1, 2].map(value => import(`../../cloudflare/rate-limit-compartido.js?isolate=${value}-${randomUUID()}`)));
  const store = sharedStore();
  const policy = { id: 'concurrent-test', identity: randomUUID(), limit: 20, windowMs: 60_000 };
  const results = await Promise.allSettled(Array.from({ length: 200 }, (_unused, index) =>
    isolates[index % 2].reserveSharedRateLimit({}, policy, store.deps)));
  const accepted = results.filter(result => result.status === 'fulfilled');
  assert.ok(accepted.length > 0 && accepted.length <= policy.limit);
  assert.equal(store.writes(), accepted.length);
  assert.equal(store.documents.size, 1);
  assert.equal(decodeFirestoreFields([...store.documents.values()][0].fields).count, accepted.length);
  for (const result of results.filter(value => value.status === 'rejected')) {
    assert.ok([429, 503].includes(result.reason.status), 'una reserva conflictiva falla cerrada');
  }
});

test('un isolate nuevo ve la cuota consumida; sólo se cachean denegaciones', async () => {
  const store = sharedStore();
  const policy = { id: 'reset-test', identity: randomUUID(), limit: 1 };
  await reserveSharedRateLimit({}, policy, store.deps);
  await assert.rejects(() => reserveSharedRateLimit({}, policy, store.deps), { status: 429 });
  const reads = store.reads();
  await assert.rejects(() => reserveSharedRateLimit({}, policy, store.deps), { status: 429 });
  assert.equal(store.reads(), reads, 'una denegación cacheada no vuelve a leer Firestore');
  const cold = await import(`../../cloudflare/rate-limit-compartido.js?cold=${randomUUID()}`);
  await assert.rejects(() => cold.reserveSharedRateLimit({}, policy, store.deps), { status: 429 });
  store.deps.now = () => 1_060_001;
  assert.equal((await cold.reserveSharedRateLimit({}, policy, store.deps)).allowed, true);
  assert.equal(store.documents.size, 1, 'el bucket se reutiliza en la ventana siguiente');
});

test('el UID verificado mantiene cuota al cambiar IP y otro UID conserva su propia cuota', async () => {
  const store = sharedStore();
  const uid = randomUUID();
  for (let index = 0; index < 30; index += 1) {
    const request = new Request('https://example.com/api/phone-availability', {
      method: 'POST', headers: { 'cf-connecting-ip': `192.0.2.${index}`, 'x-user-id': randomUUID() },
    });
    await enforceAuthenticatedRateLimit(request, {}, { uid }, store.deps);
  }
  const request = new Request('https://example.com/api/username-availability?uid=other', { method: 'POST' });
  await assert.rejects(() => enforceAuthenticatedRateLimit(request, {}, { uid }, store.deps), { status: 429 });
  assert.equal((await enforceAuthenticatedRateLimit(request, {}, { uid: randomUUID() }, store.deps)).allowed, true);
});

test('IP compartida ignora User-Agent y X-Forwarded-For; no almacena la dirección en texto', async () => {
  const store = sharedStore();
  const policy = { id: `ip-${randomUUID()}`, limit: 1 };
  const request = value => new Request('https://example.com/api/health', {
    headers: { 'cf-connecting-ip': '203.0.113.43', 'user-agent': value, 'x-forwarded-for': value },
  });
  await limitByIp(request('first'), {}, policy, store.deps);
  await assert.rejects(() => limitByIp(request('second'), {}, policy, store.deps), { status: 429 });
  assert.match([...store.documents.keys()][0], /^apiRateLimits\/[a-f0-9]{64}$/);
  assert.equal(JSON.stringify([...store.documents]).includes('203.0.113.43'), false);
  await assert.rejects(() => limitByIp(new Request('https://example.com'), {}, policy, store.deps), { status: 503 });
});

test('Firestore no disponible, configuración ausente o contador corrupto bloquean antes del proveedor', async () => {
  const policy = { id: 'unavailable-test', identity: randomUUID(), limit: 2 };
  await assert.rejects(() => reserveSharedRateLimit({}, policy), { status: 503, code: 'rate_limit_unavailable' });
  for (const get of [
    async () => { throw new Error('network'); },
    async () => ({ updateTime: 'v1', fields: {} }),
    async () => ({ fields: { count: { integerValue: '0' }, resetAt: { integerValue: '2000000' } } }),
  ]) {
    let commits = 0;
    await assert.rejects(() => reserveSharedRateLimit({}, policy, {
      get, commit: async () => { commits += 1; },
    }), { status: 503 });
    assert.equal(commits, 0);
  }
});

test('una reserva que agotó conflictos no se concede', async () => {
  let commits = 0;
  await assert.rejects(() => reserveSharedRateLimit({}, {
    id: 'conflict-test', identity: randomUUID(), limit: 10,
  }, {
    get: async () => null,
    commit: async () => { commits += 1; throw Object.assign(new Error('conflict'), { code: 'version_conflict' }); },
    pause: async () => {},
  }), { status: 503 });
  assert.equal(commits, 5);
});

test('una lectura o commit colgado se aborta y responde 503 dentro del plazo', async () => {
  for (const hanging of ['get', 'commit']) {
    const signals = [];
    let calls = 0;
    const stalled = (_env, _value, { signal }) => {
      signals.push(signal);
      calls += 1;
      // También se limita un adaptador que ignora el abort: nunca concede la
      // petición más tarde. Los adaptadores REST reales reciben esta señal.
      return new Promise(() => {});
    };
    const deps = {
      get: async (_env, _path, { signal }) => { signals.push(signal); return null; },
      commit: async () => {}, timeoutMs: 15,
      [hanging]: stalled,
    };
    await assert.rejects(() => reserveSharedRateLimit({}, {
      id: 'deadline-test', identity: randomUUID(), limit: 2,
    }, deps), { status: 503, code: 'rate_limit_unavailable' });
    assert.equal(calls, 1);
    assert.ok(signals.every(signal => signal.aborted));
  }
});

test('cuotas mantienen status y Retry-After aun en endpoints con clasificador anterior', async () => {
  const request = new Request('https://example.com/api/phone-availability', {
    method: 'POST', headers: { origin: 'https://example.com' }, body: '{}',
  });
  for (const status of [429, 503]) {
    let reads = 0;
    const error = Object.assign(new Error('limit'), {
      code: status === 429 ? 'rate_limited' : 'rate_limit_unavailable', status,
      ...(status === 429 ? { retryAfter: 34 } : {}),
    });
    const response = await handlePhoneAvailability({ request, env: {} }, {
      requireUser: async () => { throw error; }, get: async () => { reads += 1; },
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('retry-after'), status === 429 ? '34' : null);
    assert.equal(reads, 0);
    assert.equal((await response.json()).code, error.code);
  }
  assert.equal(rateLimitErrorResponse(new Error('normal'), '', ''), null);
});

test('políticas agrupan rutas sensibles sin depender de IDs enviados por el navegador', () => {
  assert.deepEqual(authenticatedRatePolicy(new Request('https://example.com/api/paypal-create-order')), {
    id: 'user-checkout', limit: 12, windowMs: 60_000,
  });
  assert.equal(authenticatedRatePolicy(new Request('https://example.com/api/test-email')).limit, 4);
  const security = readFileSync(new URL('../../cloudflare/seguridad-cloudinary.js', import.meta.url), 'utf8');
  assert.match(security, /const user = await verifyFirebaseIdToken\(token\);\s+await enforceAuthenticatedRateLimit\(request, env, user\)/);
});
