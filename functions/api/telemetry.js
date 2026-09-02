import { jsonResponse, rateLimit, safePath, sanitizeText } from '../lib/operational-guard.js';

const ALLOWED_KINDS = new Set(['js_error','promise_error','resource_error','api_error','performance','offline','recovered']);
const ALLOWED_METRICS = new Set(['LCP','CLS','INP','FCP','TTFB','request_ms','request_ms_avg','request_ms_max']);

function normalizeEvent(input) {
  const kind = ALLOWED_KINDS.has(input?.kind) ? input.kind : 'js_error';
  const metric = ALLOWED_METRICS.has(input?.metric) ? input.metric : '';
  const numericValue = Number(input?.value);
  const numericCount = Number(input?.count);
  return {
    kind,
    route: safePath(input?.route),
    code: sanitizeText(input?.code, 80),
    message: sanitizeText(input?.message, 220),
    metric,
    value: Number.isFinite(numericValue) ? Math.round(numericValue * 100) / 100 : null,
    count: Number.isFinite(numericCount) ? Math.max(0, Math.min(10_000, Math.round(numericCount))) : null,
    online: input?.online !== false,
    at: new Date().toISOString()
  };
}

async function forward(env, event) {
  const url = String(env?.OBSERVABILITY_WEBHOOK_URL || '').trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return;
    await fetch(parsed.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: 'tintin-web', event }),
      signal: AbortSignal.timeout(4000)
    });
  } catch (error) {
    console.error('[telemetry-forward]', sanitizeText(error?.message || error, 160));
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  const limiter = rateLimit(request, { id: 'telemetry', limit: 40, windowMs: 60_000 });
  if (!limiter.allowed) {
    return jsonResponse({ ok: false, code: 'rate_limited' }, 429, {
      ...limiter.headers,
      'retry-after': String(limiter.retryAfter)
    });
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 8_192) return jsonResponse({ ok: false, code: 'payload_too_large' }, 413, limiter.headers);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false, code: 'invalid_json' }, 400, limiter.headers); }
  const events = Array.isArray(body?.events) ? body.events.slice(0, 20) : [body];
  const normalized = events.map(normalizeEvent);

  for (const event of normalized) console.log('[telemetry]', JSON.stringify(event));
  if (typeof waitUntil === 'function') {
    for (const event of normalized) waitUntil(forward(env, event));
  }

  return jsonResponse({ ok: true, accepted: normalized.length }, 202, limiter.headers);
}

export function onRequestGet() {
  return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405, { allow: 'POST' });
}
