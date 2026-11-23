import { dispatchSocialPushEvent } from '../../cloudflare/servicio-push.js';
import {
  GITHUB_INCIDENT_AUDIENCE,
  GITHUB_INCIDENT_WORKFLOW,
  GITHUB_INCIDENT_WORKFLOW_REF,
  githubIncident,
  githubIncidentPush,
} from '../../cloudflare/incidentes-github.mjs';
import { verifyGitHubActionsOidc } from './github-actions-oidc.js';
import { jsonResponse, rateLimit, readLimitedJson } from './operational-guard.js';

export async function handleGitHubIncidentPush({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return jsonResponse({ ok: false, error: 'missing_oidc_token' }, 401);

  const limit = rateLimit(request, { id: 'github-incident-push', limit: 12 });
  if (!limit.allowed) {
    return jsonResponse({ ok: false, error: 'rate_limited' }, 429, {
      ...limit.headers, 'retry-after': String(limit.retryAfter),
    });
  }

  let claims;
  try {
    claims = await verifyGitHubActionsOidc(token, {
      audience: GITHUB_INCIDENT_AUDIENCE,
      workflowRef: GITHUB_INCIDENT_WORKFLOW_REF,
      allowedEvents: ['workflow_run', 'schedule', 'workflow_dispatch'],
    });
  } catch (error) {
    const unavailable = /^oidc_jwks_(?:http_|unavailable)/.test(error?.code || '');
    return jsonResponse({ ok: false, error: unavailable ? 'oidc_unavailable' : 'invalid_oidc_token' }, unavailable ? 503 : 401);
  }

  let incident;
  try {
    incident = githubIncident(await readLimitedJson(request, 1024));
  } catch (error) {
    const tooLarge = error?.status === 413;
    return jsonResponse({ ok: false, error: tooLarge ? 'payload_too_large' : 'invalid_incident' }, tooLarge ? 413 : 400);
  }

  if (!incident) return jsonResponse({ ok: false, error: 'invalid_incident' }, 400);
  if (claims.event_name !== 'workflow_run' || incident.workflow === GITHUB_INCIDENT_WORKFLOW) {
    if (incident.runId !== String(claims.run_id) || incident.attempt !== String(claims.run_attempt)
      || incident.workflow !== GITHUB_INCIDENT_WORKFLOW || incident.conclusion !== 'failure') {
      return jsonResponse({ ok: false, error: 'invalid_run_claim' }, 403);
    }
  }

  try {
    const result = await dispatchSocialPushEvent(env, githubIncidentPush(incident));
    const status = result.duplicate ? 'duplicate' : result.skipped || result.status || 'failed';
    const ok = result.ok && status !== 'in_progress' && status !== 'failed';
    return jsonResponse({ ok, status, accepted: result.successCount || 0 }, ok ? 200 : 503, limit.headers);
  } catch {
    console.error('github_incident_push_failed');
    return jsonResponse({ ok: false, status: 'dispatch_failed' }, 503, limit.headers);
  }
}
