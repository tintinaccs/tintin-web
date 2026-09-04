import { drainOrderEmailQueueScheduled } from '../../cloudflare/resiliencia-correo-pedido.js';
import {
  GitHubActionsOidcError,
  verifyGitHubActionsOidc,
} from '../lib/github-actions-oidc.js';
import { jsonResponse, rateLimit, sanitizeText } from '../lib/operational-guard.js';

const MAX_PER_MINUTE = 6;
const OIDC_AUDIENCE = 'tintin-order-email-retry';
const OIDC_WORKFLOW_REF = 'tintinaccs/tintin-web/.github/workflows/drenar-cola-correo-pedidos.yml@refs/heads/main';

function bearerToken(request) {
  const authorization = String(request.headers.get('authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = rateLimit(request, {
    id: 'order-email-drain',
    limit: MAX_PER_MINUTE,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return jsonResponse(
      { ok: false, error: 'rate_limited' },
      429,
      { ...limit.headers, 'retry-after': String(limit.retryAfter) },
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return jsonResponse({ ok: false, error: 'missing_oidc_token' }, 401, limit.headers);
  }

  let claims;
  try {
    claims = await verifyGitHubActionsOidc(token, {
      audience: OIDC_AUDIENCE,
      workflowRef: OIDC_WORKFLOW_REF,
    });
  } catch (error) {
    const code = error instanceof GitHubActionsOidcError ? error.code : 'invalid_oidc_token';
    console.warn('order_email_drain_oidc_rejected', code);
    return jsonResponse({ ok: false, error: code }, 401, limit.headers);
  }

  try {
    const result = await drainOrderEmailQueueScheduled(env, { limit: 25 });
    const payload = {
      ok: true,
      checked: Number(result?.checked || 0),
      drained: Number(result?.drained || 0),
      deadLettered: Number(result?.deadLettered || 0),
      remaining: Number(result?.remaining || 0),
      source: 'github-actions-oidc',
      runId: String(claims?.run_id || '').slice(0, 40),
      runAttempt: String(claims?.run_attempt || '').slice(0, 20),
    };
    console.log('order_email_drain', JSON.stringify(payload));
    return jsonResponse(payload, 200, limit.headers);
  } catch (error) {
    const detail = sanitizeText(error?.message || error, 220);
    const configurationError = /FIREBASE_SERVICE_ACCOUNT|RESEND_API_KEY|no est[aá] configurad/i.test(detail);
    console.error('order_email_drain_failed', detail);
    return jsonResponse(
      {
        ok: false,
        error: configurationError ? 'backend_configuration_missing' : 'order_email_drain_failed',
        detail,
      },
      configurationError ? 503 : 502,
      limit.headers,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }
  return onRequestPost(context);
}
