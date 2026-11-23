import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { GITHUB_INCIDENT_AUDIENCE, githubIncidentFromEvent } from '../cloudflare/incidentes-github.mjs';

async function deliver(incident, { verifyOnly }) {
  const config = JSON.parse(await readFile(new URL('../config/public-site.json', import.meta.url), 'utf8'));
  const target = new URL('/api/push-admin?source=github-actions', config.origin);
  const oidc = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  oidc.searchParams.set('audience', GITHUB_INCIDENT_AUDIENCE);
  const identity = await fetch(oidc, {
    headers: { authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!identity.ok) throw new Error(`OIDC de GitHub respondió HTTP ${identity.status}`);
  const { value: token } = await identity.json();
  if (!token) throw new Error('GitHub no devolvió un token OIDC');

  // El último intento supera la reserva temporal de un evento en proceso.
  for (const delay of [0, 5_000, 62_000]) {
    if (delay) await setTimeout(delay);
    const response = await fetch(target, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(verifyOnly ? {} : incident),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (verifyOnly && response?.status === 400 && (await response.json()).error === 'invalid_incident') {
      console.log('OIDC aceptado. La solicitud de comprobación no creó un evento push.');
      return;
    }
    if (response?.ok) {
      if (verifyOnly) throw new Error('La comprobación push devolvió una respuesta inesperada');
      const { status, accepted } = await response.json();
      console.log(JSON.stringify({ runId: incident.runId, attempt: incident.attempt, status, accepted }));
      if (['no_devices', 'disabled', 'paused_by_superadmin', 'partial'].includes(status)) {
        console.warn(`::warning::La alerta de GitHub tiene entrega push limitada: ${status}`);
      }
      return;
    }
    if (response && response.status < 500 && response.status !== 429) {
      throw new Error(`El endpoint push respondió HTTP ${response.status}`);
    }
  }
  throw new Error('El endpoint push sigue indisponible tras los reintentos');
}

try {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const incident = githubIncidentFromEvent({
    eventName: process.env.GITHUB_EVENT_NAME,
    event,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    jobResults: [process.env.AUDIT_RESULT, process.env.AUTOMATIC_RESULT],
  });
  const verifyOnly = process.env.VERIFY_PUSH === 'true';
  if (incident || verifyOnly) await deliver(incident, { verifyOnly });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
