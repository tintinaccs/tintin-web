import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/seguridad-cloudinary.js';

const REPOSITORY = 'tintinaccs/tintin-web';
const WORKFLOW_FILE = 'diagnostico-maestro.yml';
const BASE_BRANCH = 'main';
const PRODUCTION_ORIGIN = 'https://tintinaccesorios.pages.dev';
const GITHUB_API = 'https://api.github.com';

const AREA_DEFINITIONS = [
  ['static', '1 ·', 'Integridad y diagnóstico estructural'],
  ['commerce', '2 ·', 'Comercio, pedidos, carrito y datos'],
  ['public-ui', '3 ·', 'Cliente, visual, responsive y accesibilidad'],
  ['admin-ui', '4 ·', 'Super Admin, visual y operación'],
  ['performance', '5 ·', 'Performance, fluidez, carga y caché'],
  ['security', '6 ·', 'Seguridad, CSP, App Check y dependencias'],
  ['rules', '7 ·', 'Firestore Rules e identidad'],
  ['production', '8 ·', 'Producción real'],
  ['summary', '9 ·', 'Informe Maestro y gate final']
];

function cleanToken(env = {}) {
  return String(env.GITHUB_TOKEN || env.GH_TOKEN || '').trim();
}

function githubHeaders(token = '') {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'Tintin-Diagnostico-Maestro-Admin',
    'x-github-api-version': '2022-11-28'
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function githubRequest(path, { token = '', method = 'GET', body } = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      ...githubHeaders(token),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 204) return { response, data: null };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(data?.message || `GitHub respondió HTTP ${response.status}`));
    error.status = response.status;
    error.github = data;
    throw error;
  }
  return { response, data };
}

function stateFor(status, conclusion) {
  if (status !== 'completed') {
    return status === 'in_progress' ? 'RUNNING' : 'QUEUED';
  }
  if (conclusion === 'success') return 'PASS';
  if (conclusion === 'skipped' || conclusion === 'neutral') return 'SKIPPED';
  return 'FAIL';
}

function compactStep(step) {
  return {
    number: step.number,
    name: String(step.name || ''),
    status: String(step.status || ''),
    conclusion: step.conclusion || null,
    startedAt: step.started_at || null,
    completedAt: step.completed_at || null
  };
}

function compactJob(job, key, fallbackLabel) {
  if (!job) {
    return {
      key,
      label: fallbackLabel,
      state: 'QUEUED',
      status: 'queued',
      conclusion: null,
      startedAt: null,
      completedAt: null,
      failedSteps: [],
      steps: []
    };
  }
  const steps = Array.isArray(job.steps) ? job.steps.map(compactStep) : [];
  const failedSteps = steps.filter(step =>
    step.status === 'completed' &&
    step.conclusion &&
    !['success', 'skipped', 'neutral'].includes(step.conclusion)
  );
  return {
    key,
    label: String(job.name || fallbackLabel).replace(/^\d+\s*·\s*/, ''),
    state: stateFor(job.status, job.conclusion),
    status: job.status,
    conclusion: job.conclusion || null,
    startedAt: job.started_at || null,
    completedAt: job.completed_at || null,
    htmlUrl: job.html_url || null,
    failedSteps,
    steps
  };
}

function compactRun(run) {
  return {
    id: run.id,
    runNumber: run.run_number,
    attempt: run.run_attempt,
    state: stateFor(run.status, run.conclusion),
    status: run.status,
    conclusion: run.conclusion || null,
    headSha: run.head_sha || null,
    headBranch: run.head_branch || null,
    event: run.event || null,
    createdAt: run.created_at || null,
    updatedAt: run.updated_at || null,
    htmlUrl: run.html_url || null
  };
}

async function listMasterRuns(token) {
  const encodedWorkflow = encodeURIComponent(WORKFLOW_FILE);
  const { data } = await githubRequest(
    `/repos/${REPOSITORY}/actions/workflows/${encodedWorkflow}/runs?branch=${encodeURIComponent(BASE_BRANCH)}&per_page=8`,
    { token }
  );
  return Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
}

async function loadCurrentCommit(token) {
  const { data } = await githubRequest(`/repos/${REPOSITORY}/branches/${encodeURIComponent(BASE_BRANCH)}`, { token });
  return String(data?.commit?.sha || '') || null;
}

async function loadRunJobs(runId, token) {
  const { data } = await githubRequest(`/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=100`, { token });
  return Array.isArray(data?.jobs) ? data.jobs : [];
}

function findJob(jobs, prefix) {
  return jobs.find(job => String(job.name || '').trim().startsWith(prefix)) || null;
}

function buildLatest(run, jobs, currentCommit) {
  if (!run) return null;
  const areas = AREA_DEFINITIONS.map(([key, prefix, label]) => compactJob(findJob(jobs, prefix), key, label));
  const staticJob = findJob(jobs, '1 ·');
  const globalCiStep = staticJob?.steps?.find(step =>
    /Verificar estado global del commit en GitHub\/CI/i.test(String(step.name || ''))
  ) || null;
  const finishedJobs = jobs.filter(job => job.status === 'completed').length;
  const totalJobs = Math.max(AREA_DEFINITIONS.length, jobs.length);
  const failedAreas = areas.filter(area => area.state === 'FAIL');
  const failedSteps = areas.flatMap(area => area.failedSteps.map(step => ({
    area: area.key,
    areaLabel: area.label,
    ...step
  })));

  return {
    ...compactRun(run),
    currentCommit,
    isCurrentCommit: Boolean(currentCommit && run.head_sha === currentCommit),
    productionOrigin: PRODUCTION_ORIGIN,
    progress: {
      completed: finishedJobs,
      total: totalJobs,
      percent: totalJobs ? Math.max(0, Math.min(100, Math.round((finishedJobs / totalJobs) * 100))) : 0
    },
    githubGlobal: globalCiStep ? {
      state: stateFor(globalCiStep.status, globalCiStep.conclusion),
      status: globalCiStep.status,
      conclusion: globalCiStep.conclusion || null,
      startedAt: globalCiStep.started_at || null,
      completedAt: globalCiStep.completed_at || null
    } : {
      state: run.status === 'completed' ? 'FAIL' : 'QUEUED',
      status: 'not_reported',
      conclusion: null,
      startedAt: null,
      completedAt: null
    },
    areas,
    counts: {
      pass: areas.filter(area => area.state === 'PASS').length,
      fail: failedAreas.length,
      running: areas.filter(area => area.state === 'RUNNING').length,
      queued: areas.filter(area => area.state === 'QUEUED').length,
      skipped: areas.filter(area => area.state === 'SKIPPED').length,
      failedSteps: failedSteps.length
    },
    failures: failedSteps
  };
}

function safeError(error, fallback) {
  const message = String(error?.message || '');
  if (error?.status === 403 && /rate limit/i.test(message)) {
    return 'GitHub alcanzó temporalmente el límite de consultas. Volvé a actualizar en unos minutos.';
  }
  if (error?.status === 403) return 'GitHub rechazó la operación por permisos insuficientes.';
  if (error?.status === 404) return 'No se encontró el workflow del Diagnóstico Maestro.';
  return fallback;
}

async function handleGet(env) {
  const token = cleanToken(env);
  const runs = await listMasterRuns(token);
  const latestRun = runs[0] || null;
  const [jobs, currentCommit] = await Promise.all([
    latestRun ? loadRunJobs(latestRun.id, token) : Promise.resolve([]),
    loadCurrentCommit(token)
  ]);
  return {
    ok: true,
    repository: REPOSITORY,
    branch: BASE_BRANCH,
    workflow: WORKFLOW_FILE,
    triggerConfigured: Boolean(token),
    currentCommit,
    latest: buildLatest(latestRun, jobs, currentCommit),
    history: runs.map(compactRun),
    checkedAt: new Date().toISOString()
  };
}

async function handlePost(request, env) {
  const token = cleanToken(env);
  if (!token) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'La ejecución desde el panel todavía no tiene configurado el token privado de GitHub en Cloudflare.',
        code: 'github_token_missing'
      }
    };
  }

  const raw = await request.text();
  if (raw.length > 3000) {
    return { status: 400, body: { ok: false, error: 'Solicitud inválida.' } };
  }
  let body = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return { status: 400, body: { ok: false, error: 'Solicitud inválida.' } };
    }
  }

  const runs = await listMasterRuns(token);
  const active = runs.find(run => ['queued', 'in_progress', 'waiting', 'pending'].includes(run.status));
  if (active) {
    return {
      status: 202,
      body: {
        ok: true,
        alreadyRunning: true,
        run: compactRun(active)
      }
    };
  }

  const includeProduction = body.includeProduction !== false;
  await githubRequest(
    `/repos/${REPOSITORY}/actions/workflows/${encodeURIComponent(WORKFLOW_FILE)}/dispatches`,
    {
      token,
      method: 'POST',
      body: {
        ref: BASE_BRANCH,
        inputs: {
          production_origin: PRODUCTION_ORIGIN,
          include_production: String(includeProduction)
        }
      }
    }
  );

  return {
    status: 202,
    body: {
      ok: true,
      queued: true,
      branch: BASE_BRANCH,
      includeProduction,
      requestedAt: new Date().toISOString()
    }
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  }

  try {
    await requireSuperAdmin(request);
    if (request.method === 'GET') {
      const payload = await handleGet(env);
      return jsonResponse(payload, 200, origin, requestUrl);
    }
    const result = await handlePost(request, env);
    return jsonResponse(result.body, result.status, origin, requestUrl);
  } catch (error) {
    console.error('[master-diagnostics]', error?.message || error);
    const fallback = request.method === 'POST'
      ? 'No se pudo iniciar el Diagnóstico Maestro.'
      : 'No se pudo consultar el Diagnóstico Maestro.';
    const message = safeError(error, fallback);
    const status = error?.status === 401 ? 401 : (error?.status === 403 ? 502 : 500);
    return jsonResponse({ ok: false, error: message }, status, origin, requestUrl);
  }
}
