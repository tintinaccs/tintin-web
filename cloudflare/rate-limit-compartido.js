import {
  decodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  fsInteger,
} from './firebase-admin-ligero.js';

const RESERVE_TRIES = 5;
const deniedBuckets = new Map();
const MAX_DENIED_BUCKETS = 5_000;

function unavailable() {
  return Object.assign(new Error('No se pudo comprobar el límite de solicitudes. Reintentá en un momento.'), {
    status: 503, code: 'rate_limit_unavailable',
  });
}

function denied(resetAt, current) {
  return Object.assign(new Error('Demasiadas solicitudes. Esperá un momento antes de reintentar.'), {
    status: 429, code: 'rate_limited', retryAfter: Math.max(1, Math.ceil((resetAt - current) / 1000)),
  });
}

async function bucketPath(id, identity) {
  const bytes = new TextEncoder().encode(JSON.stringify([id, identity]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  return `apiRateLimits/${hash}`;
}

/**
 * Reserva antes de contactar proveedores. GET + precondición updateTime/exists
 * hacen que distintas instancias compartan la misma cuota sin perder incrementos.
 * Sólo se cachean DENEGACIONES: reiniciar un isolate nunca concede cuota nueva.
 * Es un control de abuso; cada comprobación remota consume Firestore y no es un
 * tope financiero. La colección es privada por la regla final de default deny.
 */
export async function reserveSharedRateLimit(env, { id, identity, limit, windowMs = 60_000 }, {
  get = firestoreAdminGet,
  commit = firestoreAdminCommit,
  now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 5_000,
} = {}) {
  if (!/^[a-z0-9_-]{1,80}$/.test(String(id || '')) || !identity || String(identity).length > 1024 ||
      !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1000) {
    throw unavailable();
  }
  const path = await bucketPath(id, String(identity));
  const cachedResetAt = deniedBuckets.get(path);
  if (cachedResetAt > now()) throw denied(cachedResetAt, now());
  if (cachedResetAt) deniedBuckets.delete(path);

  const controller = new AbortController();
  const deadline = new Promise((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(unavailable()), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(5_000, Number(timeoutMs) || 5_000)));
  try {
    for (let attempt = 0; attempt < RESERVE_TRIES; attempt += 1) {
      if (controller.signal.aborted) throw unavailable();
      const document = await Promise.race([get(env, path, { signal: controller.signal }), deadline]);
      const current = now();
      const previous = document ? decodeFirestoreFields(document.fields) : null;
      if (document && (!document.updateTime || !Number.isSafeInteger(previous?.count) ||
          previous.count < 0 || !Number.isSafeInteger(previous.resetAt))) throw unavailable();
      const active = document && previous.resetAt > current;
      const count = active ? previous.count : 0;
      const resetAt = active ? previous.resetAt : current + windowMs;
      if (count >= limit) {
        if (deniedBuckets.size >= MAX_DENIED_BUCKETS) {
          for (const [key, expiry] of deniedBuckets) if (expiry <= current) deniedBuckets.delete(key);
        }
        if (deniedBuckets.size < MAX_DENIED_BUCKETS) deniedBuckets.set(path, resetAt);
        throw denied(resetAt, current);
      }
      try {
        await Promise.race([commit(env, [{
          path,
          fields: { count: fsInteger(count + 1), resetAt: fsInteger(resetAt) },
          currentDocument: document ? { updateTime: document.updateTime } : { exists: false },
        }], { signal: controller.signal }), deadline]);
        return { allowed: true, remaining: Math.max(0, limit - count - 1), resetAt };
      } catch (error) {
        if (error?.code !== 'version_conflict' && error?.status !== 409) throw error;
        if (attempt + 1 < RESERVE_TRIES) await pause(5 * (2 ** attempt) + Math.floor(Math.random() * 10));
      }
    }
  } catch (error) {
    if (error?.code === 'rate_limited') throw error;
    throw unavailable();
  } finally {
    clearTimeout(timer);
  }
  throw unavailable();
}

export async function limitByIp(request, env, policy, deps) {
  // Cloudflare escribe esta cabecera. No se aceptan X-Forwarded-For/User-Agent.
  const ip = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (!ip || ip.length > 80) throw unavailable();
  return reserveSharedRateLimit(env, { ...policy, identity: `ip:${ip}` }, deps);
}

export function authenticatedRatePolicy(request) {
  const path = new URL(request.url).pathname;
  if (/^\/api\/(?:apps-script-bridge|order-email|paypal-create-order|paypal-capture-order|wholesale-quote)$/.test(path)) {
    return { id: 'user-checkout', limit: 12, windowMs: 60_000 };
  }
  if (/^\/api\/(?:profile-avatar-upload|cloudinary-sign-upload|cloudinary-sign-audio-upload|cloudinary-delete)$/.test(path)) {
    return { id: 'user-upload', limit: 20, windowMs: 60_000 };
  }
  if (/^\/api\/(?:username|phone)-availability$/.test(path)) {
    return { id: 'user-identity', limit: 30, windowMs: 60_000 };
  }
  if (path === '/api/test-email') return { id: 'user-test-email', limit: 4, windowMs: 60_000 };
  if (path === '/api/engagement') return { id: 'user-engagement', limit: 45, windowMs: 60_000 };
  if (path === '/api/master-diagnostics') return { id: 'user-diagnostics', limit: 120, windowMs: 60_000 };
  if (path.startsWith('/api/push-')) return { id: 'user-push', limit: 20, windowMs: 60_000 };
  if (path.startsWith('/api/admin-')) return { id: 'user-admin', limit: 60, windowMs: 60_000 };
  return { id: 'user-api', limit: 120, windowMs: 60_000 };
}

/** user proviene siempre del token ya verificado, nunca de URL, body o cabeceras. */
export async function enforceAuthenticatedRateLimit(request, env, user, deps) {
  if (!user?.uid) throw unavailable();
  return reserveSharedRateLimit(env, {
    ...authenticatedRatePolicy(request), identity: `uid:${user.uid}`,
  }, deps);
}
