const buckets = new Map();

function now() {
  return Date.now();
}

function clientKey(request) {
  const ip = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = String(request.headers.get('user-agent') || '').slice(0, 80);
  return `${ip || 'unknown'}|${ua}`;
}

export function rateLimit(request, { id = 'default', limit = 30, windowMs = 60_000 } = {}) {
  const key = `${id}:${clientKey(request)}`;
  const current = now();
  const existing = buckets.get(key);
  const state = !existing || existing.resetAt <= current
    ? { count: 0, resetAt: current + windowMs }
    : existing;

  state.count += 1;
  buckets.set(key, state);

  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(bucketKey);
      if (buckets.size <= 4_000) break;
    }
  }

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
