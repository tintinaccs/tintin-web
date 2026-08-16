#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))), '..');
const outputDir = path.join(root, 'artifacts', 'master', 'static');
const evidenceJson = path.join(outputDir, 'github-ci-global.json');
const evidenceMarkdown = path.join(outputDir, 'github-ci-global.md');
const staticResult = path.join(outputDir, 'result.json');
const staticSummary = path.join(outputDir, 'SUMMARY.md');
const mergeMode = process.argv.includes('--merge');

const repo = String(process.env.GITHUB_REPOSITORY || '').trim();
const sha = String(process.env.GITHUB_SHA || '').trim();
const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);
const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
const waitSeconds = Math.max(0, Number(process.env.MASTER_CI_WAIT_SECONDS || 600));
const pollSeconds = Math.max(5, Number(process.env.MASTER_CI_POLL_SECONDS || 15));

const blockingConclusions = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'startup_failure',
  'stale'
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function durationLabel(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

async function githubApi(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tintin-diagnostico-maestro'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} en ${endpoint}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

function isCurrentMasterCheck(check) {
  if (!currentRunId) return false;
  const needle = `/actions/runs/${currentRunId}/`;
  return [check?.html_url, check?.details_url]
    .filter(Boolean)
    .some(url => String(url).includes(needle));
}

function latestLegacyStatuses(statuses) {
  const latest = new Map();
  for (const item of statuses || []) {
    const context = String(item?.context || 'sin-contexto');
    if (!latest.has(context)) latest.set(context, item);
  }
  return [...latest.values()];
}

async function collectState() {
  const [runsPayload, checksPayload, suitesPayload, statusesPayload] = await Promise.all([
    githubApi(`/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=100`),
    githubApi(`/commits/${encodeURIComponent(sha)}/check-runs?filter=all&per_page=100`),
    githubApi(`/commits/${encodeURIComponent(sha)}/check-suites?per_page=100`),
    githubApi(`/commits/${encodeURIComponent(sha)}/statuses?per_page=100`)
  ]);

  const workflowRuns = (runsPayload.workflow_runs || []).filter(run => Number(run.id) !== currentRunId);
  const checkRuns = (checksPayload.check_runs || []).filter(check => !isCurrentMasterCheck(check));
  const legacyStatuses = latestLegacyStatuses(statusesPayload || []);

  const failedWorkflowRuns = workflowRuns.filter(run =>
    run.status === 'completed' && blockingConclusions.has(String(run.conclusion || '').toLowerCase())
  );
  const pendingWorkflowRuns = workflowRuns.filter(run => run.status !== 'completed');

  const failedCheckRuns = checkRuns.filter(check =>
    check.status === 'completed' && blockingConclusions.has(String(check.conclusion || '').toLowerCase())
  );
  const pendingCheckRuns = checkRuns.filter(check => check.status !== 'completed');
  const completedWithoutConclusion = checkRuns.filter(check => check.status === 'completed' && !check.conclusion);

  const failedLegacyStatuses = legacyStatuses.filter(status => ['failure', 'error'].includes(String(status.state || '').toLowerCase()));
  const pendingLegacyStatuses = legacyStatuses.filter(status => String(status.state || '').toLowerCase() === 'pending');

  const emptyQueuedSuites = (suitesPayload.check_suites || []).filter(suite =>
    suite.status !== 'completed' && Number(suite.latest_check_runs_count || 0) === 0
  );

  return {
    workflowRuns,
    checkRuns,
    legacyStatuses,
    failedWorkflowRuns,
    pendingWorkflowRuns,
    failedCheckRuns,
    pendingCheckRuns,
    completedWithoutConclusion,
    failedLegacyStatuses,
    pendingLegacyStatuses,
    emptyQueuedSuites
  };
}

function renderEvidence(payload) {
  const failures = [
    ...payload.failedWorkflowRuns.map(run => `Workflow: ${run.name} — ${run.conclusion}`),
    ...payload.failedCheckRuns.map(check => `Check: ${check.name} — ${check.conclusion}`),
    ...payload.completedWithoutConclusion.map(check => `Check: ${check.name} — completado sin conclusión`),
    ...payload.failedLegacyStatuses.map(status => `Status: ${status.context} — ${status.state}`)
  ];
  const pending = [
    ...payload.pendingWorkflowRuns.map(run => `Workflow: ${run.name} — ${run.status}`),
    ...payload.pendingCheckRuns.map(check => `Check: ${check.name} — ${check.status}`),
    ...payload.pendingLegacyStatuses.map(status => `Status: ${status.context} — ${status.state}`)
  ];
  const emptySuites = payload.emptyQueuedSuites.map(suite => `${suite.app?.name || suite.app?.slug || 'app externa'} — ${suite.status}`);

  const lines = [
    '# Salud global GitHub/CI del commit',
    '',
    `Estado: **${payload.status}**`,
    '',
    `Commit: \`${sha}\``,
    `Workflow actual excluido del cómputo: \`${currentRunId || 'desconocido'}\``,
    `Workflow runs externos observados: ${payload.workflowRuns.length}`,
    `Check runs externos observados: ${payload.checkRuns.length}`,
    `Estados legacy observados: ${payload.legacyStatuses.length}`,
    '',
    '## Fallos bloqueantes',
    '',
    failures.length ? failures.map(item => `- ${item}`).join('\n') : '- Ninguno.',
    '',
    '## Checks reales pendientes al cierre',
    '',
    pending.length ? pending.map(item => `- ${item}`).join('\n') : '- Ninguno.',
    '',
    '## Suites externas vacías/no materializadas',
    '',
    emptySuites.length
      ? `${emptySuites.map(item => `- ${item}`).join('\n')}\n\nEstas suites se registran como advertencia, pero no bloquean por sí solas porque no generaron ningún check-run real.`
      : '- Ninguna.',
    '',
    `Esperó hasta ${waitSeconds}s por checks reales pendientes antes de cerrar.`,
    ''
  ];

  return lines.join('\n');
}

async function verifyGlobalCi() {
  ensureDir(outputDir);
  const started = Date.now();

  if (!repo || !sha || !token) {
    const payload = {
      schemaVersion: 1,
      status: 'FAIL',
      reason: 'Faltan GITHUB_REPOSITORY, GITHUB_SHA o GITHUB_TOKEN; no es válido declarar CI global como verificada.',
      repository: repo || null,
      commit: sha || null,
      currentRunId: currentRunId || null,
      failedWorkflowRuns: [],
      pendingWorkflowRuns: [],
      failedCheckRuns: [],
      pendingCheckRuns: [],
      completedWithoutConclusion: [],
      failedLegacyStatuses: [],
      pendingLegacyStatuses: [],
      emptyQueuedSuites: [],
      workflowRuns: [],
      checkRuns: [],
      legacyStatuses: [],
      durationMs: Date.now() - started,
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(evidenceJson, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    fs.writeFileSync(evidenceMarkdown, renderEvidence(payload), 'utf8');
    console.error(payload.reason);
    process.exit(1);
  }

  const deadline = Date.now() + waitSeconds * 1000;
  let state;

  try {
    while (true) {
      state = await collectState();
      const pendingCount = state.pendingWorkflowRuns.length + state.pendingCheckRuns.length + state.pendingLegacyStatuses.length;
      if (pendingCount === 0 || Date.now() >= deadline) break;
      console.log(`GitHub/CI: ${pendingCount} check(s) real(es) todavía pendientes; reintentando en ${pollSeconds}s...`);
      await sleep(pollSeconds * 1000);
    }
  } catch (error) {
    const payload = {
      schemaVersion: 1,
      status: 'FAIL',
      reason: String(error?.message || error),
      repository: repo,
      commit: sha,
      currentRunId: currentRunId || null,
      failedWorkflowRuns: [],
      pendingWorkflowRuns: [],
      failedCheckRuns: [],
      pendingCheckRuns: [],
      completedWithoutConclusion: [],
      failedLegacyStatuses: [],
      pendingLegacyStatuses: [],
      emptyQueuedSuites: [],
      workflowRuns: [],
      checkRuns: [],
      legacyStatuses: [],
      durationMs: Date.now() - started,
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(evidenceJson, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    fs.writeFileSync(evidenceMarkdown, renderEvidence(payload), 'utf8');
    console.error(payload.reason);
    process.exit(1);
  }

  const failures = state.failedWorkflowRuns.length + state.failedCheckRuns.length + state.completedWithoutConclusion.length + state.failedLegacyStatuses.length;
  const unresolved = state.pendingWorkflowRuns.length + state.pendingCheckRuns.length + state.pendingLegacyStatuses.length;
  const status = failures || unresolved ? 'FAIL' : 'PASS';
  const payload = {
    schemaVersion: 1,
    status,
    repository: repo,
    commit: sha,
    currentRunId: currentRunId || null,
    waitedSeconds: Math.round((Date.now() - started) / 1000),
    maxWaitSeconds: waitSeconds,
    ...state,
    durationMs: Date.now() - started,
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(evidenceJson, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  const markdown = renderEvidence(payload);
  fs.writeFileSync(evidenceMarkdown, markdown, 'utf8');
  console.log(markdown);

  if (status !== 'PASS') {
    console.error(`GitHub/CI global no está limpio: ${failures} fallo(s), ${unresolved} pendiente(s) real(es).`);
    process.exit(1);
  }
}

function mergeIntoStaticResult() {
  ensureDir(outputDir);
  if (!fs.existsSync(staticResult)) {
    console.error(`No existe ${staticResult}; no se puede integrar la salud global de CI.`);
    process.exit(1);
  }

  const result = JSON.parse(fs.readFileSync(staticResult, 'utf8'));
  let health;
  if (fs.existsSync(evidenceJson)) {
    health = JSON.parse(fs.readFileSync(evidenceJson, 'utf8'));
  } else {
    health = {
      status: 'FAIL',
      durationMs: 0,
      reason: 'La verificación GitHub/CI no produjo evidencia.'
    };
  }

  result.checks = (result.checks || []).filter(check => check.id !== 'github-ci-global');
  result.checks.push({
    id: 'github-ci-global',
    label: 'Estado global del commit en GitHub/CI (incluye la X roja de checks)',
    command: 'GitHub REST: Actions + Check Runs + commit statuses',
    status: health.status === 'PASS' ? 'PASS' : 'FAIL',
    exitCode: health.status === 'PASS' ? 0 : 1,
    durationMs: Number(health.durationMs || 0),
    log: 'github-ci-global.md',
    signal: null,
    error: health.status === 'PASS' ? null : (health.reason || 'GitHub reportó checks fallidos o pendientes sin resolver.')
  });
  result.status = result.checks.some(check => check.status === 'FAIL') ? 'FAIL' : 'PASS';
  result.completedAt = new Date().toISOString();

  fs.writeFileSync(staticResult, JSON.stringify(result, null, 2) + '\n', 'utf8');

  const rows = result.checks.map(item =>
    `| ${item.status} | ${String(item.label || '').replace(/\|/g, '\\|')} | ${item.exitCode ?? '-'} | ${durationLabel(Number(item.durationMs || 0))} | \`${item.log || '-'}\` |`
  ).join('\n');
  fs.writeFileSync(
    staticSummary,
    `# ${result.title}\n\nEstado: **${result.status}**\n\n| Estado | Verificación | Código | Duración | Evidencia |\n|---|---|---:|---:|---|\n${rows}\n`,
    'utf8'
  );

  console.log(`Salud GitHub/CI integrada en static/result.json: ${health.status}. Estado combinado: ${result.status}.`);
}

if (mergeMode) mergeIntoStaticResult();
else await verifyGlobalCi();
