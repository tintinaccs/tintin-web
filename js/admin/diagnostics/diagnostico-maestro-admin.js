import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const API_URL = '/api/master-diagnostics';
const STYLE_URL = '/css/admin/diagnostico-maestro.css?v=tintin-20260817-master-diagnostics-3';
const POLL_MS = 12000;
const STATE_LABELS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  RUNNING: 'EN EJECUCIÓN',
  QUEUED: 'EN COLA',
  SKIPPED: 'OMITIDO',
  NOT_VERIFIED: 'NO SE PUDO VERIFICAR',
  UNKNOWN: 'SIN DATOS'
};

let mounted = false;
let loading = false;
let pollTimer = null;
let lastPayload = null;
let dispatchPollsRemaining = 0;
let awaitingRunAfterId = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function shortSha(value) {
  const sha = String(value || '');
  return sha ? sha.slice(0, 10) : '—';
}

function stateLabel(state) {
  return STATE_LABELS[state] || state || STATE_LABELS.UNKNOWN;
}

function loadStylesheet() {
  const previous = document.querySelector('link[href^="/css/admin/diagnostico-maestro.css"]');
  if (previous?.href.includes('master-diagnostics-3')) return;
  previous?.remove();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  document.head.appendChild(link);
}

function masterCardMarkup() {
  return `
    <div class="adm-card adm-master-diagnostic-card" id="adm-master-diagnostic-card">
      <div class="adm-card-head adm-master-diagnostic-head">
        <div>
          <div class="adm-card-title">Diagnóstico Maestro Tintin</div>
          <p>Resultado único del diagnóstico: código, checkout, Cliente, Super Admin, responsive, accesibilidad, performance, seguridad, Firestore, producción y estado global de GitHub/CI.</p>
        </div>
        <div class="adm-master-actions">
          <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="btn-refresh-master-diagnostics">Actualizar</button>
          <button type="button" class="adm-btn adm-btn-primary" id="btn-run-master-diagnostics">Ejecutar Diagnóstico Maestro</button>
        </div>
      </div>
      <div class="adm-card-body">
        <div class="adm-master-state-row">
          <span class="adm-master-state" id="master-diagnostic-state" data-state="UNKNOWN">SIN DATOS</span>
          <span class="adm-master-freshness" id="master-diagnostic-freshness">Consultando GitHub/CI…</span>
        </div>
        <div class="adm-master-notice notice-info" id="master-diagnostic-notice">
          <span class="adm-master-loading">Cargando el último Diagnóstico Maestro…</span>
        </div>
        <div class="adm-master-meta" id="master-diagnostic-meta" hidden></div>
        <div class="adm-master-progress-wrap" id="master-diagnostic-progress-wrap" hidden>
          <div class="adm-master-progress-label"><span id="master-diagnostic-progress-text">Progreso</span><strong id="master-diagnostic-progress-percent">0%</strong></div>
          <div class="adm-master-progress" aria-hidden="true"><span id="master-diagnostic-progress-bar"></span></div>
        </div>
        <div class="adm-master-kpis" id="master-diagnostic-kpis" hidden></div>
        <div class="adm-master-areas" id="master-diagnostic-areas"></div>
        <details class="adm-master-history" id="master-diagnostic-history" hidden>
          <summary>Historial reciente de ejecuciones</summary>
          <div class="adm-master-history-list" id="master-diagnostic-history-list"></div>
        </details>
      </div>
    </div>`;
}

function mount() {
  if (mounted) return true;
  const section = $('section-diagnostico');
  if (!section) return false;
  loadStylesheet();

  section.querySelectorAll('.adm-diagnostic-card, .adm-local-diagnostic-card').forEach(card => card.remove());
  const wrapper = document.createElement('div');
  wrapper.innerHTML = masterCardMarkup().trim();
  section.prepend(wrapper.firstElementChild);

  $('btn-refresh-master-diagnostics')?.addEventListener('click', () => loadMaster());
  $('btn-run-master-diagnostics')?.addEventListener('click', runMaster);
  mounted = true;
  return true;
}

function setState(state = 'UNKNOWN') {
  const node = $('master-diagnostic-state');
  if (!node) return;
  node.dataset.state = state;
  node.textContent = stateLabel(state);
}

function showNotice(message, type = 'info') {
  const node = $('master-diagnostic-notice');
  if (!node) return;
  node.hidden = !message;
  node.className = `adm-master-notice notice-${type}`;
  node.textContent = message || '';
}

function renderMeta(latest) {
  const node = $('master-diagnostic-meta');
  if (!node) return;
  if (!latest) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  node.hidden = false;
  const runValue = latest.htmlUrl
    ? `<a href="${escapeHtml(latest.htmlUrl)}" target="_blank" rel="noopener noreferrer">#${escapeHtml(latest.runNumber || latest.id)} · intento ${escapeHtml(latest.attempt || 1)}</a>`
    : `#${escapeHtml(latest.runNumber || latest.id || '—')}`;
  node.innerHTML = `
    <div class="adm-master-meta-item"><span>Commit auditado</span><strong title="${escapeHtml(latest.headSha || '')}">${escapeHtml(shortSha(latest.headSha))}</strong></div>
    <div class="adm-master-meta-item"><span>Run de GitHub</span>${runValue}</div>
    <div class="adm-master-meta-item"><span>Última actualización</span><strong>${escapeHtml(formatDate(latest.updatedAt))}</strong></div>
    <div class="adm-master-meta-item"><span>Producción</span><strong>${escapeHtml(latest.productionOrigin || '—')}</strong></div>`;
}

function renderProgress(latest) {
  const wrap = $('master-diagnostic-progress-wrap');
  const bar = $('master-diagnostic-progress-bar');
  const label = $('master-diagnostic-progress-text');
  const percentNode = $('master-diagnostic-progress-percent');
  if (!wrap || !bar || !label || !percentNode) return;
  if (!latest) {
    wrap.hidden = true;
    return;
  }
  const progress = latest.progress || { completed: 0, total: 0, percent: 0 };
  const percent = latest.status === 'completed' ? 100 : Number(progress.percent || 0);
  wrap.hidden = false;
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  label.textContent = `${progress.completed || 0} de ${progress.total || 0} áreas cerradas`;
  percentNode.textContent = `${Math.max(0, Math.min(100, percent))}%`;
}

function renderKpis(latest) {
  const node = $('master-diagnostic-kpis');
  if (!node) return;
  if (!latest) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  const counts = latest.counts || {};
  const values = [
    ['PASS', counts.pass || 0],
    ['FAIL', counts.fail || 0],
    ['No verificado', counts.notVerified || 0],
    ['Checks fallidos', counts.failedSteps || 0],
    ['CI externos', counts.externalFailures || 0]
  ];
  node.hidden = false;
  node.innerHTML = values.map(([label, value]) => `
    <div class="adm-master-kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

function renderArea(area, extraClass = '') {
  const failed = Array.isArray(area.failedSteps) ? area.failedSteps : [];
  const failureList = failed.length
    ? `<ul class="adm-master-area-failures">${failed.slice(0, 8).map(step => `<li>${escapeHtml(step.name)} · ${escapeHtml(step.conclusion || 'falló')}</li>`).join('')}</ul>`
    : '';
  const timing = area.completedAt
    ? `Finalizó ${formatDate(area.completedAt)}`
    : area.startedAt
      ? `Inició ${formatDate(area.startedAt)}`
      : area.state === 'NOT_VERIFIED'
        ? 'La ejecución terminó sin evidencia verificable para esta área'
        : 'Esperando ejecución';
  return `
    <article class="adm-master-area ${extraClass}">
      <div class="adm-master-area-head">
        <div class="adm-master-area-title">${escapeHtml(area.label)}</div>
        <span class="adm-master-area-state" data-state="${escapeHtml(area.state || 'UNKNOWN')}">${escapeHtml(stateLabel(area.state))}</span>
      </div>
      <div class="adm-master-area-detail">${escapeHtml(timing)}</div>
      ${failureList}
    </article>`;
}

function renderAreas(latest) {
  const node = $('master-diagnostic-areas');
  if (!node) return;
  if (!latest) {
    node.innerHTML = '<div class="adm-master-empty">No se pudo recuperar una ejecución del Diagnóstico Maestro. Usá Actualizar para reintentar.</div>';
    return;
  }
  const global = latest.githubGlobal || { state: 'UNKNOWN', status: 'not_reported', failures: [] };
  const externalFailures = Array.isArray(global.failures) ? global.failures : [];
  let globalFailures = externalFailures.map(check => ({
    name: check.app ? `${check.name} (${check.app})` : check.name,
    conclusion: check.conclusion || 'failure'
  }));
  if (!globalFailures.length && ['FAIL', 'NOT_VERIFIED'].includes(global.state)) {
    globalFailures = [{
      name: global.state === 'NOT_VERIFIED'
        ? 'El chequeo global de GitHub/CI no produjo evidencia verificable'
        : 'El estado global de GitHub/CI no pasó',
      conclusion: global.conclusion || global.status
    }];
  }
  const globalArea = {
    label: 'GitHub / CI global del commit',
    state: global.state,
    startedAt: global.startedAt,
    completedAt: global.completedAt,
    failedSteps: globalFailures
  };
  node.innerHTML = [
    renderArea(globalArea, 'adm-master-github-global'),
    ...(latest.areas || []).map(area => renderArea(area))
  ].join('');
}

function renderHistory(history = []) {
  const root = $('master-diagnostic-history');
  const list = $('master-diagnostic-history-list');
  if (!root || !list) return;
  if (!history.length) {
    root.hidden = true;
    list.replaceChildren();
    return;
  }
  root.hidden = false;
  list.innerHTML = history.map(run => `
    <div class="adm-master-history-item">
      <span class="adm-master-area-state" data-state="${escapeHtml(run.state || 'UNKNOWN')}">${escapeHtml(stateLabel(run.state))}</span>
      <strong>Run #${escapeHtml(run.runNumber || run.id || '—')} · ${escapeHtml(shortSha(run.headSha))}</strong>
      <time datetime="${escapeHtml(run.updatedAt || '')}">${escapeHtml(formatDate(run.updatedAt))}</time>
    </div>`).join('');
}

function render(payload) {
  lastPayload = payload;
  const latest = payload?.latest || null;
  if (dispatchPollsRemaining > 0 && latest?.id && latest.id !== awaitingRunAfterId) {
    dispatchPollsRemaining = 0;
    awaitingRunAfterId = null;
  }

  const runButton = $('btn-run-master-diagnostics');
  const refreshButton = $('btn-refresh-master-diagnostics');
  const freshness = $('master-diagnostic-freshness');
  const workflowActive = latest && ['RUNNING', 'QUEUED'].includes(latest.state);
  const waitingForDispatch = dispatchPollsRemaining > 0;
  const isActive = Boolean(workflowActive || waitingForDispatch);

  setState(waitingForDispatch && !workflowActive ? 'QUEUED' : (latest?.state || 'UNKNOWN'));
  if (freshness) {
    freshness.className = 'adm-master-freshness';
    if (!latest) {
      freshness.textContent = 'Resultado no disponible';
    } else if (latest.isCurrentCommit) {
      freshness.classList.add('is-current');
      freshness.textContent = `main auditado · ${shortSha(latest.currentCommit)}`;
    } else {
      freshness.classList.add('is-stale');
      freshness.textContent = `Resultado anterior · main actual ${shortSha(payload.currentCommit)}`;
    }
  }

  if (waitingForDispatch && !workflowActive) {
    showNotice('GitHub recibió la solicitud. Esperando que aparezca la nueva ejecución del Diagnóstico Maestro…', 'info');
  } else if (!latest) {
    showNotice('No se pudo recuperar todavía un resultado del Diagnóstico Maestro. La lectura no depende de la credencial de ejecución; usá Actualizar para reintentar.', 'warning');
  } else if (workflowActive) {
    showNotice('El Diagnóstico Maestro está corriendo. Esta vista se actualizará automáticamente mientras GitHub termina las suites.', 'info');
  } else if (latest.state === 'FAIL') {
    showNotice('El último Diagnóstico Maestro o el estado global de GitHub/CI tiene fallos. Las áreas rojas de abajo muestran dónde falló.', 'error');
  } else if (latest.state === 'NOT_VERIFIED' || Number(latest.counts?.notVerified || 0) > 0 || latest.githubGlobal?.state === 'NOT_VERIFIED') {
    showNotice('La ejecución terminó, pero falta evidencia verificable en una o más áreas. No se considera PASS hasta que todo quede confirmado.', 'warning');
  } else if (!latest.isCurrentCommit) {
    showNotice('El último resultado corresponde a un commit anterior. Ejecutá nuevamente el Maestro para auditar el main actual.', 'warning');
  } else {
    showNotice('El último Diagnóstico Maestro pasó y corresponde al commit actual de main.', 'info');
  }

  if (runButton) {
    runButton.disabled = Boolean(isActive || !payload.triggerConfigured || loading);
    runButton.title = payload.triggerConfigured
      ? (isActive ? 'Ya hay un Diagnóstico Maestro solicitado o en ejecución.' : 'Ejecuta el workflow maestro sobre main, incluyendo producción.')
      : 'La lectura de resultados funciona. Para iniciar una nueva ejecución desde el panel falta la credencial privada del backend.';
    runButton.textContent = isActive ? 'Diagnóstico en ejecución…' : 'Ejecutar Diagnóstico Maestro';
  }
  if (refreshButton) refreshButton.disabled = loading;

  renderMeta(latest);
  renderProgress(latest);
  renderKpis(latest);
  renderAreas(latest);
  renderHistory(payload?.history || []);
  schedulePoll(latest?.state);
}

function schedulePoll(state) {
  clearTimeout(pollTimer);
  pollTimer = null;
  const workflowActive = ['RUNNING', 'QUEUED'].includes(state);
  if (!workflowActive && dispatchPollsRemaining <= 0) return;
  if (!workflowActive && dispatchPollsRemaining > 0) dispatchPollsRemaining -= 1;
  pollTimer = window.setTimeout(() => loadMaster({ silent: true }), POLL_MS);
}

async function authorizedFetch(method, body, forceToken = false) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== String(SUPER_ADMIN).toLowerCase()) {
    throw new Error('La sesión de Super Admin no está disponible.');
  }
  const idToken = await user.getIdToken(forceToken);
  return fetch(API_URL, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      authorization: `Bearer ${idToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function requestJson(method = 'GET', body) {
  let response = await authorizedFetch(method, body, false);
  if (response.status === 401) response = await authorizedFetch(method, body, true);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || `El backend respondió HTTP ${response.status}.`);
  }
  return data;
}

async function loadMaster({ silent = false } = {}) {
  if (loading) return;
  loading = true;
  const refreshButton = $('btn-refresh-master-diagnostics');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Actualizando…';
  }
  if (!silent && !lastPayload) {
    setState('UNKNOWN');
    showNotice('Cargando el último Diagnóstico Maestro…', 'info');
  }
  let succeeded = false;
  try {
    const payload = await requestJson('GET');
    lastPayload = payload;
    succeeded = true;
  } catch (error) {
    console.error('[Diagnóstico Maestro Admin]', error);
    setState(lastPayload?.latest?.state || 'NOT_VERIFIED');
    showNotice(error.message || 'No se pudo consultar el Diagnóstico Maestro.', 'error');
    clearTimeout(pollTimer);
    pollTimer = null;
  } finally {
    loading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Actualizar';
    }
    if (succeeded && lastPayload) render(lastPayload);
  }
}

async function runMaster() {
  if (loading) return;
  loading = true;
  const button = $('btn-run-master-diagnostics');
  if (button) {
    button.disabled = true;
    button.textContent = 'Solicitando ejecución…';
  }
  showNotice('Solicitando una nueva ejecución del Diagnóstico Maestro sobre main…', 'info');
  try {
    const previousRunId = lastPayload?.latest?.id || null;
    const result = await requestJson('POST', { includeProduction: true });
    awaitingRunAfterId = previousRunId;
    dispatchPollsRemaining = 10;
    showNotice(
      result.alreadyRunning
        ? 'Ya había un Diagnóstico Maestro en ejecución. Voy a seguir mostrando ese run.'
        : 'Diagnóstico Maestro enviado a GitHub. Esperando que aparezca la nueva ejecución…',
      'info'
    );
    window.setTimeout(() => {
      loading = false;
      loadMaster();
    }, 1800);
  } catch (error) {
    console.error('[Diagnóstico Maestro Admin] No se pudo iniciar:', error);
    loading = false;
    dispatchPollsRemaining = 0;
    awaitingRunAfterId = null;
    showNotice(error.message || 'No se pudo iniciar el Diagnóstico Maestro.', 'error');
    if (button) {
      button.disabled = Boolean(lastPayload && !lastPayload.triggerConfigured);
      button.textContent = 'Ejecutar Diagnóstico Maestro';
    }
  }
}

function startForSuperAdmin(user) {
  if (!user || String(user.email || '').toLowerCase() !== String(SUPER_ADMIN).toLowerCase()) return;
  if (!mount()) {
    window.setTimeout(() => startForSuperAdmin(user), 100);
    return;
  }
  loadMaster();
}

onAuthStateChanged(auth, user => {
  if (!user) {
    clearTimeout(pollTimer);
    pollTimer = null;
    dispatchPollsRemaining = 0;
    awaitingRunAfterId = null;
    return;
  }
  startForSuperAdmin(user);
});
