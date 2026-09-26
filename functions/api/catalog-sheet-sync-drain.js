import { drainCatalogSheetSyncQueueScheduled } from '../../cloudflare/resiliencia-sync-catalogo.js';
import { drainEngagementSheetSyncQueueScheduled } from '../../cloudflare/resiliencia-sync-participacion.js';
import {
  GITHUB_ACTIONS_OIDC_AUDIENCE,
  GitHubActionsOidcError,
  verifyGitHubActionsOidc,
} from '../lib/github-actions-oidc.js';
import { jsonResponse, rateLimit, sanitizeText } from '../lib/operational-guard.js';

const MAX_PER_MINUTE = 6;
// Una tarea puede contener hasta 20 productos. El drenaje obtiene producto e
// inventario por cada uno, por lo que procesar varias tareas en la misma
// invocación excede el límite de subsolicitudes de Cloudflare. El workflow se
// ejecuta cada 15 minutos y avanza la cola de forma segura, una tarea por vez.
const SCHEDULED_DRAIN_LIMIT = 1;
// Reseñas y "me gusta" usan el mismo Apps Script y el mismo secreto. Cada
// evento cuesta ~4 subsolicitudes (reclamo, POST + redirección, borrado): tres
// por corrida, sumadas al catálogo, quedan lejos del límite de 50.
const ENGAGEMENT_DRAIN_LIMIT = 3;

function bearerToken(request) {
  const authorization = String(request.headers.get('authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = rateLimit(request, {
    id: 'catalog-sheet-sync-drain',
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
      audience: GITHUB_ACTIONS_OIDC_AUDIENCE,
    });
  } catch (error) {
    const code = error instanceof GitHubActionsOidcError ? error.code : 'invalid_oidc_token';
    console.warn('catalog_sheet_sync_oidc_rejected', code);
    return jsonResponse({ ok: false, error: code }, 401, limit.headers);
  }

  try {
    // Una invocación procesa una sola tarea: junto con batchGet mantiene el
    // drenaje muy por debajo de las 50 subrequests del plan gratuito.
    // El scheduler cada 15 minutos continúa la cola sin perder reintentos.
    const result = await drainCatalogSheetSyncQueueScheduled(env, { limit: SCHEDULED_DRAIN_LIMIT });
    const engagement = await drainEngagementSheetSyncQueueScheduled(env, { limit: ENGAGEMENT_DRAIN_LIMIT });
    const payload = {
      ok: true,
      checked: Number(result?.checked || 0),
      drained: Number(result?.drained || 0),
      deadLettered: Number(result?.deadLettered || 0),
      remaining: Number(result?.remaining || 0),
      engagement: {
        checked: Number(engagement?.checked || 0),
        drained: Number(engagement?.drained || 0),
        deadLettered: Number(engagement?.deadLettered || 0),
        remaining: Number(engagement?.remaining || 0),
      },
      source: 'github-actions-oidc',
      runId: String(claims?.run_id || '').slice(0, 40),
      runAttempt: String(claims?.run_attempt || '').slice(0, 20),
    };
    console.log('catalog_sheet_sync_drain', JSON.stringify(payload));
    return jsonResponse(payload, 200, limit.headers);
  } catch (error) {
    const detail = sanitizeText(error?.message || error, 220);
    const configurationError = /FIREBASE_SERVICE_ACCOUNT|SHEETS_ENGAGEMENT_SECRET|no est[aá] configurad/i.test(detail);
    console.error('catalog_sheet_sync_drain_failed', detail);
    return jsonResponse(
      {
        ok: false,
        error: configurationError ? 'backend_configuration_missing' : 'catalog_sheet_sync_failed',
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
