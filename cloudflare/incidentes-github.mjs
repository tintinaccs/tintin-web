export const GITHUB_INCIDENT_TYPE = 'admin.github.incident';
export const GITHUB_INCIDENT_AUDIENCE = 'tintin-github-incident-push';
export const GITHUB_INCIDENT_REPOSITORY = 'tintinaccs/tintin-web';
export const GITHUB_INCIDENT_WORKFLOW = 'Mantenimiento — dependencias y flujos protegidos';
export const GITHUB_INCIDENT_WORKFLOW_REF = `${GITHUB_INCIDENT_REPOSITORY}/.github/workflows/auditoria-dependencias.yml@refs/heads/main`;

const CONCLUSIONS = new Map([
  ['failure', 'falló'],
  ['timed_out', 'agotó el tiempo de ejecución'],
  ['startup_failure', 'no pudo iniciar'],
  ['action_required', 'requiere intervención'],
  ['stale', 'quedó obsoleto'],
  ['cancelled', 'se canceló'],
]);

export function githubIncident(run) {
  const runId = String(run?.runId ?? '');
  const attempt = String(run?.attempt ?? '');
  const workflow = typeof run?.workflow === 'string'
    ? run.workflow.replace(/[^\p{L}\p{N} ._—-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 95)
    : '';
  const conclusion = run?.conclusion;
  if (!/^[1-9]\d{0,19}$/.test(runId) || !/^[1-9]\d{0,5}$/.test(attempt)
    || !workflow || !CONCLUSIONS.has(conclusion)) return null;
  return { runId, attempt, workflow, conclusion };
}

export function githubIncidentFromEvent({ eventName, event, runId, attempt, jobResults = [] }) {
  const run = event?.workflow_run;
  if (eventName === 'workflow_run' && run?.name !== GITHUB_INCIDENT_WORKFLOW
    && event?.repository?.full_name === GITHUB_INCIDENT_REPOSITORY
    && run?.head_repository?.full_name === GITHUB_INCIDENT_REPOSITORY
    && (run.head_branch === 'main' || (run.event === 'pull_request' && run.conclusion !== 'cancelled'))) {
    const upstream = githubIncident({
      runId: run.id, attempt: run.run_attempt, workflow: run.name, conclusion: run.conclusion,
    });
    if (upstream) return upstream;
  }
  if (['workflow_run', 'schedule', 'workflow_dispatch'].includes(eventName) && jobResults.includes('failure')) {
    return githubIncident({ runId, attempt, workflow: GITHUB_INCIDENT_WORKFLOW, conclusion: 'failure' });
  }
  return null;
}

export function githubIncidentPush(incident) {
  const { runId, attempt, workflow, conclusion } = incident;
  const eventId = `${GITHUB_INCIDENT_TYPE}:${runId}:${attempt}`;
  return {
    type: GITHUB_INCIDENT_TYPE,
    eventId,
    tag: eventId,
    title: 'Tintín · GitHub Actions',
    body: `${workflow} ${CONCLUSIONS.get(conclusion)}. Ejecución ${runId}.`,
    url: `/admin.html?section=notificaciones-push&githubRun=${runId}`,
  };
}
