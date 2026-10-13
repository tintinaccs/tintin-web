const buckets = new Map();
const MAX_BUCKETS = 5_000;
let overflowBucket = null;
let nextCleanupAt = 0;

function now() {
  return Date.now();
}

function clientKey(request) {
  // Cloudflare fija esta cabecera en el borde. User-Agent y X-Forwarded-For
  // pueden variar por solicitud y no deben crear contadores nuevos.
  // Sin identidad del borde, compartir el bucket conservador (p. ej. local).
  return String(request.headers.get('cf-connecting-ip') || '').trim() || 'unknown';
}

export function rateLimit(request, { id = 'default', limit = 30, windowMs = 60_000 } = {}) {
  const key = `${id}:${clientKey(request)}`;
  const current = now();
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS && current >= nextCleanupAt) {
    nextCleanupAt = current + 10_000;
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(bucketKey);
    }
  }
  const overflow = !buckets.has(key) && buckets.size >= MAX_BUCKETS;
  const existing = overflow ? overflowBucket : buckets.get(key);
  const state = !existing || existing.resetAt <= current
    ? { count: 0, resetAt: current + windowMs }
    : existing;

  state.count += 1;
  if (overflow) {
    // No expulsar identidades activas: permitiría reiniciar su cuota. Durante
    // saturación las nuevas identidades comparten una reserva conservadora.
    state.resetAt = Math.max(state.resetAt, current + windowMs);
    overflowBucket = state;
  } else buckets.set(key, state);

  const remaining = Math.max(0, limit - state.count);
  return {
    allowed: state.count <= limit,
    remaining,
    retryAfter: Math.max(1, Math.ceil((state.resetAt - current) / 1000)),
    headers: {
      'x-ratelimit-limit': String(limit),
      'x-ratelimit-remaining': String(remaining),
      'x-ratelimit-reset': String(Math.ceil(state.resetAt / 1000))
    }
  };
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?595\s*)?(?:0?9\d{2})[\s.-]*\d{3}[\s.-]*\d{3}(?!\d)/g;
const TOKEN_RE = /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\b/gi;
const QUERY_RE = /([?&](?:token|key|secret|auth|email|phone|uid|session|code)=)[^&#\s]+/gi;

export function sanitizeText(value, max = 240) {
  return String(value || '')
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(TOKEN_RE, '[token]')
    .replace(QUERY_RE, '$1[redacted]')
    .replace(/https?:\/\/[^\s?#]+\?[^\s#]+/gi, match => match.split('?')[0])
    .slice(0, max);
}

export function safePath(value) {
  try {
    const url = new URL(String(value || ''), 'https://tintin.invalid');
    return String(url.pathname || '/').slice(0, 180);
  } catch {
    return '/';
  }
}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...extraHeaders
    }
  });
}
