// =============================================================
// TINTIN — Estudio de Código
// Super Admin only. GitHub es la fuente oficial; ningún secreto vive acá.
// =============================================================

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { SUPER_ADMIN } from '../../core/auth/roles.js';

const API = '/api/code-studio';
const MONACO_BASE = '/js/vendor/monaco/vs';
const EXTERNAL_HOSTS = new Set(['console.firebase.google.com', 'dash.cloudflare.com', 'github.com', 'docs.github.com', 'tintinaccesorios.pages.dev']);
const PHASES = Object.freeze({
  disconnected: { label: 'Sin conexión', tone: 'bad' },
  clean: { label: 'Sincronizado', tone: 'ok' },
  dirty: { label: 'Cambios locales', tone: 'warn' },
  saving: { label: 'Guardando', tone: 'running' },
  committing: { label: 'Creando commit', tone: 'running' },
  syncing: { label: 'Sincronizando', tone: 'running' },
  checks_queued: { label: 'Checks en cola', tone: 'warn' },
  checks_running: { label: 'Checks ejecutándose', tone: 'running' },
  checks_failed: { label: 'Checks fallidos', tone: 'bad' },
  ready_to_merge: { label: 'Listo para merge', tone: 'ok' },
  merge_requested: { label: 'Merge solicitado', tone: 'running' },
  merging: { label: 'Mergeando', tone: 'running' },
  merged: { label: 'Merge completado', tone: 'ok' },
  deploying: { label: 'Desplegando', tone: 'running' },
  published: { label: 'Publicado', tone: 'ok' },
  deploy_failed: { label: 'Error de despliegue', tone: 'bad' },
  conflict: { label: 'Conflicto', tone: 'warn' },
  error: { label: 'Error', tone: 'bad' }
});
const state = {
  ready: false,
  visible: false,
  github: null,
  currentRef: 'main',
  branch: '',
  headSha: '',
  tabs: new Map(),
  activePath: '',
  selectedPath: '',
  selectedType: '',
  selectedRow: null,
  editor: null,
  diffEditor: null,
  monaco: null,
  fallback: null,
  pullRequest: null,
  bottom: 'problems',
  reconcileTimer: null,
  realtimeController: null,
  realtimeReconnectTimer: null,
  realtimeConnected: false,
  lastEvents: [],
  lastSyncAt: '',
  phase: 'syncing',
  phaseDetail: 'Comprobando GitHub…',
  checks: [],
  aiProposal: null,
  mergedSha: '',
  graphScale: 1,
  graphFocus: '',
  problemsTimer: null,
  markersSubscription: null
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const safeExternalHref = value => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && EXTERNAL_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : '';
  } catch { return ''; }
};

function classifyRisk(path) {
  const value = String(path || '').toLowerCase();
  const red = ['.github/workflows/', 'firestore.rules', '_headers', '_routes.json', 'config/csp-runtime', 'scripts/generar-csp-cloudflare', 'cloudflare/seguridad-', 'cloudflare/firebase-admin-', 'functions/api/paypal-', 'functions/api/admin-', 'js/core/auth/', 'checkout.html', 'js/pages/checkout/'];
  const orange = ['functions/', 'cloudflare/', 'scripts/', 'package.json', 'package-lock.json', 'admin.html', 'js/admin/admin-app.js'];
  if (red.some(prefix => value === prefix || value.startsWith(prefix))) return 'red';
  if (orange.some(prefix => value === prefix || value.startsWith(prefix))) return 'orange';
  if (/\.(?:js|mjs|cjs|json|html|css|rules|yml|yaml)$/i.test(value)) return 'yellow';
  return 'green';
}

function inferLanguage(path) {
  const value = String(path || '').toLowerCase();
  if (/\.(?:js|mjs|cjs|jsx)$/.test(value)) return 'javascript';
  if (/\.tsx?$/.test(value)) return 'typescript';
  if (/\.json$/.test(value)) return 'json';
  if (/\.html?$/.test(value)) return 'html';
  if (/\.css$/.test(value)) return 'css';
  if (/\.md$/.test(value)) return 'markdown';
  if (/\.ya?ml$/.test(value)) return 'yaml';
  if (/\.xml$/.test(value)) return 'xml';
  if (/\.py$/.test(value)) return 'python';
  if (/\.sql$/.test(value)) return 'sql';
  return 'plaintext';
}

async function currentToken(force = false) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN) throw new Error('Sesión Super Admin no disponible');
  return user.getIdToken(Boolean(force));
}

async function api(path, options = {}) {
  const token = await currentToken(Boolean(options.forceToken));
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${token}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${API}/${path}`.replace(/\/$/, ''), { ...options, headers, cache: 'no-store' });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const error = new Error(typeof data === 'object' ? data.error || `Error ${response.status}` : String(data || `Error ${response.status}`));
    error.status = response.status;
    error.code = typeof data === 'object' ? data.code || '' : '';
    throw error;
  }
  return data;
}

function toast(message, bad = false) {
  document.querySelectorAll('.cs-toast').forEach(node => node.remove());
  const node = document.createElement('div');
  node.className = `cs-toast cs-toast-inline${bad ? ' bad' : ''}`;
  node.setAttribute('role', bad ? 'alert' : 'status');
  node.setAttribute('aria-live', bad ? 'assertive' : 'polite');
  node.textContent = message;
  (document.querySelector('#section-estudio-codigo .cs-shell') || document.body).appendChild(node);
  setTimeout(() => node.remove(), 5200);
}

function modal({ title, body, confirmText = 'Confirmar', danger = false, onConfirm }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'cs-modal-backdrop';
    backdrop.innerHTML = `<div class="cs-modal"><div class="cs-modal-head"><strong>${escapeHtml(title)}</strong><span class="cs-spacer"></span><button type="button" class="cs-btn" data-close>✕</button></div><div class="cs-modal-body">${body}</div><div class="cs-modal-foot"><button type="button" class="cs-btn" data-close>Cancelar</button><button type="button" class="cs-btn ${danger ? 'cs-btn-danger' : 'cs-btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button></div></div>`;
    const close = value => { backdrop.remove(); resolve(value); };
    backdrop.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => close(false)));
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(false); });
    backdrop.querySelector('[data-confirm]').addEventListener('click', async () => {
      const button = backdrop.querySelector('[data-confirm]');
      button.disabled = true;
      try {
        if (onConfirm) await onConfirm(backdrop);
        close(true);
      } catch (error) {
        button.disabled = false;
        toast(error.message, true);
      }
    });
    document.body.appendChild(backdrop);
  });
}

function makeShell() {
  if ($('#section-estudio-codigo')) return;
  const nav = $('#adm-nav');
  const navButton = document.createElement('button');
  navButton.type = 'button';
  navButton.className = 'adm-nav-item';
  navButton.id = 'nav-estudio-codigo';
  navButton.dataset.section = 'estudio-codigo';
  navButton.innerHTML = '<span class="adm-nav-icon" aria-hidden="true">⌘</span> Editor de Código';
  const anchor = $('#nav-correos');
  if (nav && anchor) nav.insertBefore(navButton, anchor);
  else nav?.appendChild(navButton);

  const mobile = $('#adm-mobile-tabs');
  if (mobile) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'adm-mobile-tab';
    button.dataset.section = 'estudio-codigo';
    button.id = 'mtab-estudio-codigo';
    button.innerHTML = '<span class="adm-nav-icon">⌘</span>Editor';
    mobile.appendChild(button);
  }

  const section = document.createElement('div');
  section.className = 'adm-section';
  section.id = 'section-estudio-codigo';
  section.innerHTML = `
    <div class="cs-shell">
      <div class="cs-top">
        <div class="cs-top-main">
          <div class="cs-identity">
            <div class="cs-brand">Editor de Código</div>
            <button class="cs-status" id="cs-github-center-toggle" type="button" aria-expanded="false" aria-controls="cs-github-center"><span class="cs-dot" id="cs-dot"></span><span id="cs-status">Comprobando GitHub…</span></button>
          </div>
          <div class="cs-branch" id="cs-branch" title="Rama activa">main</div>
        </div>
        <div class="cs-toolbar" aria-label="Acciones del editor">
          <button class="cs-btn" id="cs-sync" type="button">Sincronizar</button>
          <button class="cs-btn" id="cs-branch-new" type="button">Nueva rama</button>
          <button class="cs-btn" id="cs-preview" type="button" disabled>Preview</button>
          <button class="cs-btn cs-btn-primary" id="cs-commit" type="button" disabled>Guardar commit</button>
          <button class="cs-btn" id="cs-pr" type="button" disabled>Abrir PR</button>
          <button class="cs-btn cs-btn-primary" id="cs-merge" type="button" disabled>Mergear</button>
          <button class="cs-btn" id="cs-ai-toggle" type="button">IA</button>
        </div>
      </div>
      <aside class="cs-github-center cs-hidden" id="cs-github-center" aria-live="polite">
        <div class="cs-pane-title"><span>Centro GitHub en vivo</span><button class="cs-icon-btn" id="cs-github-center-close" type="button" aria-label="Cerrar estado de GitHub">✕</button></div>
        <div class="cs-github-center-body" id="cs-github-center-body"></div>
      </aside>
      <div class="cs-progress"><span id="cs-progress" style="width:0%"></span></div>
      <div class="cs-banner" id="cs-banner"><strong>Seguridad:</strong> lectura desde GitHub oficial. Nunca se escribe directo a main y la publicación final requiere revisión humana.</div>
      <div class="cs-grid">
        <aside class="cs-side">
          <div class="cs-pane-title"><span>Explorador</span><span class="cs-tools"><button class="cs-icon-btn" id="cs-new-file" title="Nuevo archivo" type="button">＋</button><button class="cs-icon-btn" id="cs-rename" title="Renombrar o mover" type="button">↪</button><button class="cs-icon-btn" id="cs-delete" title="Eliminar" type="button">⌫</button><button class="cs-icon-btn" id="cs-tree-refresh" title="Actualizar" type="button">↻</button></span></div>
          <input id="cs-search" class="cs-search" type="search" placeholder="Buscar en todo el repositorio…" autocomplete="off">
          <div id="cs-tree" class="cs-tree"><div class="cs-empty">Cargando árbol…</div></div>
        </aside>
        <main class="cs-editor">
          <div id="cs-tabs" class="cs-tabs"></div>
          <div id="cs-editor-host" class="cs-editor-host"><div class="cs-empty">Elegí un archivo del explorador.</div></div>
          <section class="cs-bottom">
            <div class="cs-bottom-tabs">
              <button class="cs-bottom-tab active" data-bottom="problems" type="button">Problemas <span class="cs-problem-count" id="cs-problem-count" hidden>0</span></button>
              <button class="cs-bottom-tab" data-bottom="changes" type="button">Cambios</button>
              <button class="cs-bottom-tab" data-bottom="history" type="button">Historial</button>
              <button class="cs-bottom-tab" data-bottom="checks" type="button">Checks</button>
              <button class="cs-bottom-tab" data-bottom="map" type="button">Mapa</button>
              <button class="cs-bottom-tab" data-bottom="events" type="button">Tiempo real</button>
            </div>
            <div id="cs-bottom-content" class="cs-bottom-content"><div class="cs-muted">Sin problemas detectados.</div></div>
          </section>
        </main>
        <aside class="cs-ai" id="cs-ai">
          <div class="cs-pane-title"><span>Asistente IA</span><button class="cs-icon-btn" id="cs-ai-close" type="button">✕</button></div>
          <div class="cs-ai-body">
            <div class="cs-ai-context" id="cs-ai-context">Usa únicamente los archivos abiertos como contexto verificado.</div>
            <div class="cs-ai-output" id="cs-ai-output">Diagnóstico, propuesta, impacto, pruebas y rollback aparecerán acá. La IA no puede publicar.</div>
            <div class="cs-ai-proposal-actions cs-hidden" id="cs-ai-proposal-actions"><button class="cs-btn" id="cs-ai-discard" type="button">Descartar</button><button class="cs-btn cs-btn-primary" id="cs-ai-apply" type="button">Aplicar a buffers</button></div>
            <textarea class="cs-ai-input" id="cs-ai-input" maxlength="6000" placeholder="¿Qué querés analizar o cambiar?"></textarea>
            <div class="cs-ai-actions"><button class="cs-btn cs-btn-primary" id="cs-ai-send" type="button">Analizar</button></div>
          </div>
        </aside>
      </div>
    </div>`;
  document.querySelector('.adm-content')?.appendChild(section);
  if (window.matchMedia('(max-width: 1200px)').matches) $('#cs-ai')?.classList.add('cs-collapsed');

  [navButton, $('#mtab-estudio-codigo')].filter(Boolean).forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    showStudio();
  }));
}

function showStudio() {
  document.querySelectorAll('.adm-section').forEach(section => section.classList.remove('active'));
  document.querySelectorAll('.adm-nav-item,.adm-mobile-tab').forEach(button => button.classList.remove('active'));
  $('#section-estudio-codigo')?.classList.add('active');
  $('#nav-estudio-codigo')?.classList.add('active');
  $('#mtab-estudio-codigo')?.classList.add('active');
  document.body.classList.add('code-studio-open');
  const topbarTitle = $('#adm-topbar-title');
  if (topbarTitle) topbarTitle.textContent = 'Editor de Código';
  window.scrollTo({ top: 0, behavior: 'auto' });
  state.visible = true;
  if (!state.ready) bootstrap();
  startRealtimeLoops();
}

function setProgress(value) {
  const bar = $('#cs-progress');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function setPhase(phase, detail = '') {
  state.phase = PHASES[phase] ? phase : 'error';
  state.phaseDetail = String(detail || PHASES[state.phase].label).slice(0, 500);
  state.lastSyncAt = new Date().toISOString();
  updateTopStatus();
}

function checksSummary() {
  const checks = state.checks || [];
  const failed = checks.filter(check => check.status === 'completed' && !['success', 'neutral', 'skipped'].includes(check.conclusion));
  const pending = checks.filter(check => check.status !== 'completed');
  return { total: checks.length, failed, pending, green: checks.length > 0 && !failed.length && !pending.length };
}

function derivePhase() {
  if (!state.github?.appConfigured) return 'disconnected';
  if (['saving', 'committing', 'syncing', 'merge_requested', 'merging', 'merged', 'deploying', 'published', 'deploy_failed', 'conflict', 'error'].includes(state.phase)) return state.phase;
  if ([...state.tabs.values()].some(tab => tab.dirty)) return 'dirty';
  if (state.pullRequest?.state === 'open') {
    const summary = checksSummary();
    if (summary.failed.length) return 'checks_failed';
    if (summary.pending.some(check => check.status === 'in_progress')) return 'checks_running';
    if (summary.pending.length || !summary.total) return 'checks_queued';
    if (summary.green) return 'ready_to_merge';
  }
  return 'clean';
}

function renderGithubCenter() {
  const host = $('#cs-github-center-body');
  if (!host) return;
  const phase = PHASES[derivePhase()] || PHASES.error;
  const summary = checksSummary();
  host.innerHTML = `
    <div class="cs-status-grid">
      <span>Repositorio</span><strong>${escapeHtml(state.github?.repository || 'Sin configurar')}</strong>
      <span>Rama</span><strong>${escapeHtml(state.branch || 'main · solo lectura')}</strong>
      <span>Commit</span><strong class="cs-code">${escapeHtml(String(state.headSha || state.github?.mainSha || '').slice(0, 12) || '—')}</strong>
      <span>Pull request</span><strong>${state.pullRequest?.number ? `#${state.pullRequest.number} · ${escapeHtml(state.pullRequest.state || '')}` : '—'}</strong>
      <span>Checks</span><strong>${summary.total ? `${summary.total - summary.failed.length - summary.pending.length}/${summary.total} aprobados` : '—'}</strong>
      <span>Estado</span><strong>${escapeHtml(phase.label)}</strong>
      <span>Última señal</span><strong>${escapeHtml(state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleTimeString() : '—')}</strong>
      <span>Canal</span><strong>${state.realtimeConnected ? 'SSE conectado' : 'Reconciliación API'}</strong>
    </div>
    ${state.phaseDetail ? `<div class="cs-banner"><strong>Detalle:</strong> ${escapeHtml(state.phaseDetail)}</div>` : ''}
    ${safeExternalHref(state.pullRequest?.url) ? `<a class="cs-btn cs-external-link" href="${escapeHtml(safeExternalHref(state.pullRequest.url))}" target="_blank" rel="noopener noreferrer">Referencia del PR</a>` : ''}`;
}

function updateTopStatus() {
  const dot = $('#cs-dot');
  const label = $('#cs-status');
  const branch = $('#cs-branch');
  const commit = $('#cs-commit');
  const pr = $('#cs-pr');
  const merge = $('#cs-merge');
  const preview = $('#cs-preview');
  if (!label) return;
  if (!state.github?.appConfigured) {
    label.textContent = 'Conexión GitHub pendiente';
    dot.className = 'cs-dot bad';
  } else {
    const currentPhase = derivePhase();
    const phase = PHASES[currentPhase] || PHASES.error;
    label.textContent = `${phase.label} · ${String(state.headSha || state.github.mainSha || '').slice(0, 8)}`;
    dot.className = `cs-dot ${phase.tone}`;
  }
  branch.textContent = state.branch || 'main · solo lectura';
  const dirty = [...state.tabs.values()].some(tab => tab.dirty);
  commit.disabled = !state.branch || !dirty;
  pr.disabled = !state.branch || dirty;
  preview.disabled = !state.branch;
  if (merge) merge.disabled = !state.pullRequest?.number || dirty || !checksSummary().green || derivePhase() === 'merging';
  renderGithubCenter();
}

function renderGithubUnavailable(message = '') {
  const root = $('#cs-tree');
  const search = $('#cs-search');
  const rawDetail = String(message || 'La conexión privada con GitHub todavía no está configurada.');
  const detail = /instalaci[oó]n/i.test(rawDetail)
    ? 'Falta registrar en Cloudflare el identificador de la instalación de GitHub App.'
    : /clave privada/i.test(rawDetail)
      ? 'Falta configurar en Cloudflare la clave privada de la GitHub App.'
      : /github app/i.test(rawDetail)
        ? 'Faltan datos privados de la GitHub App en Cloudflare.'
        : rawDetail;
  if (search) search.disabled = true;
  if (root) {
    root.innerHTML = `<div class="cs-connection-state" role="status"><strong>Conexión con GitHub pendiente</strong><p>${escapeHtml(detail)}</p><p>Cuando la configuración privada esté completa, presioná <strong>Sincronizar</strong>. El editor nunca expondrá credenciales en el navegador.</p></div>`;
  }
}

async function bootstrap() {
  setProgress(12);
  try {
    const data = await api('bootstrap');
    state.github = data.github;
    state.headSha = data.github?.mainSha || '';
    state.ready = true;
    if (!data.github?.appConfigured) {
      const detail = data.github?.error || 'GitHub App sin configurar';
      setProgress(0);
      setPhase('disconnected', detail);
      renderGithubUnavailable(detail);
      return;
    }
    const rememberedBranch = sessionStorage.getItem('tintin.codeStudio.branch') || '';
    if (rememberedBranch && data.github?.appConfigured) {
      try {
        const workspace = await api(`workspace?branch=${encodeURIComponent(rememberedBranch)}`);
        state.branch = workspace.workspace.branch;
        state.currentRef = workspace.workspace.branch;
        state.headSha = workspace.workspace.headSha;
        state.pullRequest = workspace.workspace.pullRequest;
      } catch {
        sessionStorage.removeItem('tintin.codeStudio.branch');
      }
    }
    setPhase('clean', 'Repositorio y rama reconciliados con GitHub.');
    await refreshTree();
    if (state.pullRequest?.headSha) await refreshChecksState(false);
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  } catch (error) {
    setProgress(0);
    toast(error.message, true);
    state.github = { appConfigured: false, error: error.message };
    setPhase('disconnected', error.message);
    renderGithubUnavailable(error.message);
  }
}

async function refreshTree() {
  const root = $('#cs-tree');
  if (!root) return;
  if (!state.github?.appConfigured) {
    renderGithubUnavailable(state.github?.error);
    return;
  }
  const search = $('#cs-search');
  if (search) search.disabled = false;
  root.innerHTML = '<div class="cs-muted" style="padding:8px">Cargando…</div>';
  try {
    const data = await api(`tree?ref=${encodeURIComponent(state.currentRef)}`);
    root.innerHTML = '';
    renderEntries(root, data.entries, 0);
  } catch (error) {
    if (error.status === 503) {
      state.github = { ...(state.github || {}), appConfigured: false, error: error.message };
      setPhase('disconnected', error.message);
      renderGithubUnavailable(error.message);
      return;
    }
    root.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderEntries(container, entries, depth) {
  for (const entry of entries) {
    const wrapper = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'cs-tree-row';
    row.style.paddingLeft = `${6 + depth * 13}px`;
    row.dataset.path = entry.path;
    row.dataset.type = entry.type;
    row.innerHTML = `<span>${entry.type === 'dir' ? '▸' : '·'}</span><span class="cs-tree-name">${escapeHtml(entry.name)}</span><span class="cs-tree-meta">${entry.type === 'file' && classifyRisk(entry.path) !== 'green' ? `<span class="cs-badge ${classifyRisk(entry.path)}">${classifyRisk(entry.path)}</span>` : ''}${state.tabs.get(entry.path)?.dirty ? '<span class="cs-badge dirty">●</span>' : ''}</span>`;
    wrapper.appendChild(row);
    container.appendChild(wrapper);
    row.addEventListener('click', async event => {
      event.stopPropagation();
      selectTreeRow(row, entry);
      if (entry.type === 'dir') await toggleFolder(wrapper, row, entry.path, depth);
      else await openFile(entry.path);
    });
  }
}

function selectTreeRow(row, entry) {
  state.selectedRow?.classList.remove('selected');
  row.classList.add('selected');
  state.selectedRow = row;
  state.selectedPath = entry.path;
  state.selectedType = entry.type;
}

async function toggleFolder(wrapper, row, path, depth) {
  const existing = wrapper.querySelector(':scope > .cs-tree-children');
  if (existing) {
    const hidden = existing.classList.toggle('cs-hidden');
    row.firstElementChild.textContent = hidden ? '▸' : '▾';
    return;
  }
  row.firstElementChild.textContent = '…';
  try {
    const data = await api(`tree?ref=${encodeURIComponent(state.currentRef)}&path=${encodeURIComponent(path)}`);
    const children = document.createElement('div');
    children.className = 'cs-tree-children';
    wrapper.appendChild(children);
    renderEntries(children, data.entries, depth + 1);
    row.firstElementChild.textContent = '▾';
  } catch (error) {
    row.firstElementChild.textContent = '!';
    toast(error.message, true);
  }
}

async function openFile(path, options = {}) {
  if (state.tabs.has(path)) {
    activateTab(path);
    return state.tabs.get(path);
  }
  setProgress(20);
  try {
    const data = options.newFile ? {
      path,
      sha: null,
      content: options.content || '',
      language: inferLanguage(path),
      risk: classifyRisk(path)
    } : await api(`file?ref=${encodeURIComponent(state.currentRef)}&path=${encodeURIComponent(path)}`);
    const tab = {
      path: data.path,
      sha: data.sha,
      baseline: data.content,
      content: data.content,
      language: data.language || inferLanguage(path),
      risk: data.risk || classifyRisk(path),
      dirty: Boolean(options.newFile),
      operation: options.newFile ? 'create' : 'update',
      model: null,
      suppress: false
    };
    state.tabs.set(path, tab);
    await ensureMonaco();
    createModel(tab);
    renderTabs();
    activateTab(path);
    setProgress(100);
    setTimeout(() => setProgress(0), 350);
    updateTopStatus();
    return tab;
  } catch (error) {
    setProgress(0);
    toast(error.message, true);
    throw error;
  }
}

function createModel(tab) {
  if (!state.monaco || tab.model) return;
  const uri = state.monaco.Uri.parse(`file:///${tab.path}`);
  tab.model = state.monaco.editor.createModel(tab.content, tab.language, uri);
  tab.model.onDidChangeContent(() => {
    if (tab.suppress) return;
    tab.content = tab.model.getValue();
    tab.dirty = tab.operation !== 'update' || tab.content !== tab.baseline;
    renderTabs();
    updateTopStatus();
    scheduleProblemsRender();
    if (state.bottom === 'changes') setTimeout(renderChanges, 150);
  });
  scheduleProblemsRender();
}

function scheduleProblemsRender(delay = 180) {
  clearTimeout(state.problemsTimer);
  state.problemsTimer = setTimeout(() => {
    state.problemsTimer = null;
    renderProblems();
  }, delay);
}

function configureMonacoDiagnostics(monaco) {
  const language = monaco?.languages?.typescript;
  const diagnostics = {
    noSyntaxValidation: false,
    noSemanticValidation: true,
    noSuggestionDiagnostics: false,
    onlyVisible: false
  };
  language?.javascriptDefaults?.setDiagnosticsOptions(diagnostics);
  language?.typescriptDefaults?.setDiagnosticsOptions(diagnostics);
  language?.javascriptDefaults?.setEagerModelSync(true);
  language?.typescriptDefaults?.setEagerModelSync(true);

  state.markersSubscription?.dispose?.();
  state.markersSubscription = monaco.editor.onDidChangeMarkers(() => scheduleProblemsRender(60));
}

async function ensureMonaco() {
  if (state.monaco) return state.monaco;
  if (window.monaco) {
    state.monaco = window.monaco;
    if (!state.markersSubscription) configureMonacoDiagnostics(state.monaco);
    return state.monaco;
  }
  return new Promise(resolve => {
    if (window.__tintinMonacoLoading) {
      const timer = setInterval(() => {
        if (window.monaco || window.__tintinMonacoFailed) {
          clearInterval(timer);
          state.monaco = window.monaco || null;
          if (state.monaco && !state.markersSubscription) configureMonacoDiagnostics(state.monaco);
          resolve(state.monaco);
        }
      }, 80);
      return;
    }
    window.__tintinMonacoLoading = true;
    try {
      window.MonacoEnvironment = {
        getWorkerUrl() {
          const worker = `self.MonacoEnvironment={baseUrl:'${MONACO_BASE}/'};importScripts('${MONACO_BASE}/base/worker/workerMain.js');`;
          return URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }));
        }
      };
      const loader = document.createElement('script');
      loader.src = `${MONACO_BASE}/loader.js`;
      loader.crossOrigin = 'anonymous';
      loader.onload = () => {
        try {
          window.require.config({ paths: { vs: MONACO_BASE } });
          window.require(['vs/editor/editor.main'], () => {
            state.monaco = window.monaco;
            configureMonacoDiagnostics(state.monaco);
            window.__tintinMonacoLoading = false;
            resolve(state.monaco);
          }, () => {
            window.__tintinMonacoFailed = true;
            window.__tintinMonacoLoading = false;
            resolve(null);
          });
        } catch {
          window.__tintinMonacoFailed = true;
          window.__tintinMonacoLoading = false;
          resolve(null);
        }
      };
      loader.onerror = () => {
        window.__tintinMonacoFailed = true;
        window.__tintinMonacoLoading = false;
        resolve(null);
      };
      document.head.appendChild(loader);
    } catch {
      window.__tintinMonacoFailed = true;
      window.__tintinMonacoLoading = false;
      resolve(null);
    }
  });
}

function renderTabs() {
  const host = $('#cs-tabs');
  if (!host) return;
  host.innerHTML = '';
  for (const tab of state.tabs.values()) {
    const node = document.createElement('div');
    node.className = `cs-tab${tab.path === state.activePath ? ' active' : ''}`;
    node.innerHTML = `${tab.dirty ? '<span class="cs-tab-dot"></span>' : ''}<span>${escapeHtml(tab.path.split('/').pop())}</span><span class="cs-badge ${tab.risk}">${tab.risk}</span><button class="cs-tab-x" type="button" aria-label="Cerrar">×</button>`;
    node.addEventListener('click', event => { if (!event.target.closest('.cs-tab-x')) activateTab(tab.path); });
    node.querySelector('.cs-tab-x').addEventListener('click', event => { event.stopPropagation(); closeTab(tab.path); });
    host.appendChild(node);
  }
}

function closeTab(path) {
  const tab = state.tabs.get(path);
  if (!tab) return;
  if (tab.dirty && !confirm(`Hay cambios sin guardar en ${path}. ¿Cerrar igualmente?`)) return;
  tab.model?.dispose();
  state.tabs.delete(path);
  if (state.activePath === path) state.activePath = [...state.tabs.keys()].at(-1) || '';
  renderTabs();
  renderEditor();
  updateTopStatus();
  scheduleProblemsRender(0);
}

function activateTab(path) {
  state.activePath = path;
  renderTabs();
  renderEditor();
  updateAiContext();
  if (state.bottom === 'problems') renderProblems();
  if (state.bottom === 'changes') renderChanges();
}

async function revealEditorLocation(path, line = 1, column = 1) {
  const tab = await openFile(path);
  activateTab(tab.path);
  const position = { lineNumber: Math.max(1, Number(line) || 1), column: Math.max(1, Number(column) || 1) };
  if (state.editor) {
    state.editor.setPosition(position);
    state.editor.revealPositionInCenter(position);
    state.editor.focus();
  } else if (state.fallback) {
    const lines = state.fallback.value.split('\n');
    const offset = lines.slice(0, position.lineNumber - 1).reduce((total, value) => total + value.length + 1, 0) + position.column - 1;
    state.fallback.focus();
    state.fallback.setSelectionRange(offset, offset);
  }
}

function renderEditor() {
  const host = $('#cs-editor-host');
  const tab = state.tabs.get(state.activePath);
  if (!host) return;
  if (!tab) {
    state.editor?.dispose();
    state.editor = null;
    host.innerHTML = '<div class="cs-empty">Elegí un archivo del explorador.</div>';
    return;
  }
  if (state.monaco && tab.model) {
    state.fallback = null;
    if (!state.editor) {
      host.innerHTML = '';
      state.editor = state.monaco.editor.create(host, {
        model: tab.model,
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 12,
        tabSize: 2,
        wordWrap: 'off',
        glyphMargin: true,
        folding: true,
        renderWhitespace: 'selection',
        readOnly: !state.branch || tab.operation === 'delete'
      });
    } else {
      state.editor.setModel(tab.model);
      state.editor.updateOptions({ readOnly: !state.branch || tab.operation === 'delete' });
    }
  } else {
    state.editor?.dispose();
    state.editor = null;
    host.innerHTML = `<textarea class="cs-fallback" spellcheck="false" ${!state.branch || tab.operation === 'delete' ? 'readonly' : ''}></textarea>`;
    state.fallback = host.querySelector('textarea');
    state.fallback.value = tab.content;
    state.fallback.addEventListener('input', () => {
      tab.content = state.fallback.value;
      tab.dirty = tab.operation !== 'update' || tab.content !== tab.baseline;
      renderTabs(); updateTopStatus(); renderChanges();
    });
  }
}

async function createBranch() {
  if (!state.github?.appConfigured) return toast('Configurá primero la GitHub App del Estudio.', true);
  const label = prompt('Nombre corto para este trabajo:', 'cambio-tintin');
  if (!label) return;
  setProgress(30);
  setPhase('syncing', 'Creando una rama aislada desde el SHA verificado de main.');
  try {
    const result = await api('branch', { method: 'POST', body: JSON.stringify({ label, expectedMainSha: state.github.mainSha }) });
    state.branch = result.branch;
    state.currentRef = result.branch;
    state.headSha = result.sha;
    sessionStorage.setItem('tintin.codeStudio.branch', result.branch);
    for (const tab of state.tabs.values()) {
      const fresh = await api(`file?ref=${encodeURIComponent(state.branch)}&path=${encodeURIComponent(tab.path)}`);
      tab.sha = fresh.sha; tab.baseline = fresh.content; tab.content = fresh.content; tab.dirty = false; tab.operation = 'update';
      if (tab.model) { tab.suppress = true; tab.model.setValue(fresh.content); tab.suppress = false; }
    }
    renderEditor(); renderTabs(); updateTopStatus(); await refreshTree();
    setProgress(100); setTimeout(() => setProgress(0), 400);
    toast(`Rama creada: ${result.branch}`);
    setPhase('clean', `Rama ${result.branch} creada y sincronizada.`);
  } catch (error) {
    setProgress(0); setPhase(error.status === 409 ? 'conflict' : 'error', error.message); toast(error.message, true);
  }
}

async function newFile() {
  if (!state.branch) return toast('Primero creá una rama de trabajo.', true);
  const path = prompt('Ruta del nuevo archivo, relativa al repositorio:');
  if (!path) return;
  if (state.tabs.has(path)) return activateTab(path);
  await openFile(path, { newFile: true, content: '' });
}

async function renameSelected() {
  if (!state.branch) return toast('Primero creá una rama de trabajo.', true);
  if (!state.selectedPath || state.selectedType !== 'file') return toast('Seleccioná un archivo.', true);
  const oldPath = state.selectedPath;
  const newPath = prompt('Nueva ruta o nombre:', oldPath);
  if (!newPath || newPath === oldPath) return;
  const oldTab = await openFile(oldPath);
  if (oldTab.dirty && oldTab.operation !== 'update') return toast('Resolvé primero los cambios pendientes de ese archivo.', true);
  const newTab = await openFile(newPath, { newFile: true, content: oldTab.content });
  newTab.dirty = true;
  oldTab.operation = 'delete';
  oldTab.dirty = true;
  renderTabs(); renderEditor(); updateTopStatus(); renderChanges();
}

async function deleteSelected() {
  if (!state.branch) return toast('Primero creá una rama de trabajo.', true);
  if (!state.selectedPath || state.selectedType !== 'file') return toast('Seleccioná un archivo.', true);
  const tab = await openFile(state.selectedPath);
  if (!confirm(`¿Marcar ${tab.path} para eliminar? El cambio no llega a GitHub hasta el commit.`)) return;
  tab.operation = 'delete';
  tab.dirty = true;
  renderTabs(); renderEditor(); updateTopStatus(); renderChanges();
}

function dirtyTabs() {
  return [...state.tabs.values()].filter(tab => tab.dirty);
}

async function commitChanges() {
  const changed = dirtyTabs();
  if (!state.branch || !changed.length) return;
  const summary = changed.map(tab => `<div class="cs-list-item"><div class="cs-list-title"><span class="cs-badge ${tab.risk}">${tab.risk}</span>${escapeHtml(tab.operation)} · ${escapeHtml(tab.path)}</div></div>`).join('');
  await modal({
    title: `Revisar ${changed.length} cambio(s) antes del commit`,
    confirmText: 'Crear commit',
    danger: changed.some(tab => tab.risk === 'red'),
    body: `<div class="cs-list">${summary}</div><div class="cs-field" style="margin-top:12px"><label>Mensaje del commit</label><input id="cs-commit-message" class="cs-input" maxlength="180" value="feat(code-studio): aplicar cambios revisados"></div><p class="cs-muted">Si existe un conflicto remoto, no se sobrescribe nada y tus buffers locales se conservan.</p>`,
    onConfirm: async backdrop => {
      const message = backdrop.querySelector('#cs-commit-message').value;
      setProgress(35);
      const changes = changed.map(tab => ({ path: tab.path, operation: tab.operation, content: tab.content, baseSha: tab.operation === 'create' ? null : tab.sha }));
      try {
        setPhase('committing', `Creando commit con ${changes.length} archivo(s) y SHA esperado.`);
        const result = await api('commit', { method: 'POST', body: JSON.stringify({ branch: state.branch, expectedHeadSha: state.headSha, message, changes }) });
        state.headSha = result.commitSha;
        for (const tab of changed) {
          if (tab.operation === 'delete') {
            tab.model?.dispose(); state.tabs.delete(tab.path); continue;
          }
          const fresh = await api(`file?ref=${encodeURIComponent(state.branch)}&path=${encodeURIComponent(tab.path)}`);
          tab.sha = fresh.sha; tab.baseline = fresh.content; tab.content = fresh.content; tab.operation = 'update'; tab.dirty = false;
          if (tab.model && tab.model.getValue() !== fresh.content) { tab.suppress = true; tab.model.setValue(fresh.content); tab.suppress = false; }
        }
        if (!state.tabs.has(state.activePath)) state.activePath = [...state.tabs.keys()].at(-1) || '';
        renderTabs(); renderEditor(); updateTopStatus(); await refreshTree(); await renderChanges();
        setProgress(100); setTimeout(() => setProgress(0), 450);
        toast(`Commit ${result.commitSha.slice(0, 8)} guardado en ${state.branch}.`);
        setPhase('syncing', `Commit ${result.commitSha.slice(0, 8)} enviado; esperando checks de GitHub.`);
      } catch (error) {
        setProgress(0);
        setPhase(error.status === 409 ? 'conflict' : 'error', error.message);
        if (error.code === 'recent_auth_required') {
          toast('Reautenticación reciente requerida. Cerrá sesión y volvé a entrar antes de modificar archivos rojos.', true);
        }
        throw error;
      }
    }
  });
}

async function openPr() {
  if (!state.branch || dirtyTabs().length) return toast('Guardá primero todos los cambios en un commit.', true);
  const compare = await api(`compare?branch=${encodeURIComponent(state.branch)}`);
  if (!compare.compare?.aheadBy) return toast('No hay cambios para abrir un PR.', true);
  await modal({
    title: 'Abrir Pull Request',
    confirmText: 'Abrir PR',
    body: `<div class="cs-field"><label>Título</label><input id="cs-pr-title" class="cs-input" maxlength="180" value="feat: integrar Editor de Código Tintin"></div><div class="cs-field"><label>Descripción</label><textarea id="cs-pr-body" class="cs-input" rows="8">Cambio preparado desde una rama aislada del Editor de Código Tintin.\n\nRequiere CI verde, preview y revisión humana antes de fusionar.</textarea></div><div class="cs-list">${compare.compare.files.map(file => `<div class="cs-list-item"><strong>${escapeHtml(file.filename)}</strong> · +${file.additions} / -${file.deletions}</div>`).join('')}</div>`,
    onConfirm: async backdrop => {
      setPhase('syncing', 'Creando pull request en GitHub.');
      const data = await api('pr', { method: 'POST', body: JSON.stringify({ branch: state.branch, title: backdrop.querySelector('#cs-pr-title').value, body: backdrop.querySelector('#cs-pr-body').value }) });
      state.pullRequest = data.pullRequest;
      toast(`PR #${data.pullRequest.number} abierto. Podrás aprobar y mergear desde Tintin cuando todo esté verde.`);
      setPhase('checks_queued', `PR #${data.pullRequest.number} abierto; esperando checks y preview.`);
      await renderChecks();
    }
  });
}

async function mergeFromStudio() {
  if (!state.pullRequest?.number || !checksSummary().green) return toast('El PR, sus checks y el preview deben estar listos.', true);
  const number = state.pullRequest.number;
  const expected = `MERGEAR #${number}`;
  await modal({
    title: `Aprobación final del PR #${number}`,
    confirmText: 'Fusionar en main',
    danger: true,
    body: `<p>Esta es la única acción que modifica <strong>main</strong>. Escribí <strong>${escapeHtml(expected)}</strong> para confirmar después de revisar diff, checks y preview.</p><div class="cs-field"><label>Confirmación exacta</label><input id="cs-merge-confirmation" class="cs-input" autocomplete="off"></div><p class="cs-muted">La sesión debe ser reciente. GitHub seguirá siendo el historial y motor de CI, pero no necesitás salir de Tintin.</p>`,
    onConfirm: async backdrop => {
      const confirmation = backdrop.querySelector('#cs-merge-confirmation').value.trim();
      if (confirmation !== expected) throw new Error(`Escribí exactamente ${expected}`);
      setPhase('merge_requested', `Aprobación humana recibida para el PR #${number}.`);
      setProgress(35);
      try {
        setPhase('merging', `GitHub está fusionando el PR #${number}.`);
        const data = await api('merge', {
          method: 'POST',
          forceToken: true,
          body: JSON.stringify({ number, expectedHeadSha: state.pullRequest.headSha, confirmation })
        });
        state.mergedSha = data.merge?.sha || '';
        state.pullRequest = { ...state.pullRequest, state: 'closed', merged: true };
        setPhase('merged', `PR #${number} fusionado en ${state.mergedSha.slice(0, 8)}.`);
        setProgress(72);
        setPhase('deploying', 'Merge correcto; esperando el despliegue de producción informado por GitHub/Cloudflare.');
        toast(`PR #${number} fusionado. El panel seguirá el despliegue en vivo.`);
      } catch (error) {
        setProgress(0);
        setPhase(error.status === 409 ? 'conflict' : 'error', error.message);
        if (error.code === 'recent_auth_required') toast('Volvé a iniciar sesión para renovar la autenticación y repetí la aprobación.', true);
        throw error;
      }
    }
  });
}

async function syncState() {
  if (!state.ready) return;
  try {
    const data = await api('bootstrap');
    if (!data.github?.appConfigured) {
      const detail = data.github?.error || 'GitHub App sin configurar';
      state.github = { ...data.github, appConfigured: false, error: detail };
      setPhase('disconnected', detail);
      renderGithubUnavailable(detail);
      return;
    }
    if (data.github?.appConfigured) {
      const previousMain = state.github?.mainSha;
      state.github = data.github;
      if (!state.branch) state.headSha = data.github.mainSha;
      if (state.branch) {
        try {
          const workspace = await api(`workspace?branch=${encodeURIComponent(state.branch)}`);
          state.headSha = workspace.workspace.headSha;
          state.pullRequest = workspace.workspace.pullRequest;
        } catch (error) {
          if (error.status === 404) sessionStorage.removeItem('tintin.codeStudio.branch');
        }
      }
      state.lastSyncAt = new Date().toISOString();
      if (!['merging', 'merged', 'deploying', 'published', 'deploy_failed'].includes(state.phase)) state.phase = 'clean';
      updateTopStatus();
      if (previousMain && previousMain !== data.github.mainSha && state.branch) {
        $('#cs-banner').innerHTML = '<strong>GitHub cambió:</strong> main avanzó desde que creaste tu rama. Revisá el comparador antes de continuar; no se hará ninguna sobreescritura silenciosa.';
      }
    }
  } catch (error) {
    state.realtimeConnected = false;
    setPhase('disconnected', error.message || 'No se pudo reconciliar con GitHub.');
  }
}

async function previewDeployment() {
  if (!state.headSha) return;
  try {
    const data = await api(`deployments?sha=${encodeURIComponent(state.headSha)}`);
    const candidates = data.deployments || [];
    const ready = candidates.find(item => item.state === 'success' && /^https:\/\//i.test(item.environmentUrl || ''));
    if (!ready) {
      toast(candidates.length ? 'El preview todavía no está listo.' : 'GitHub todavía no reporta un deployment para este commit.', true);
      return;
    }
    const previewUrl = safeExternalHref(ready.environmentUrl);
    if (!previewUrl) throw new Error('GitHub informó un preview fuera de los dominios autorizados');
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  } catch (error) { toast(error.message, true); }
}

async function renderProblems() {
  const host = $('#cs-bottom-content');
  const counter = $('#cs-problem-count');
  if (!host) return;
  if (!state.monaco) {
    if (counter) { counter.hidden = true; counter.textContent = '0'; }
    if (state.bottom === 'problems') host.innerHTML = '<div class="cs-muted">Monaco no está disponible; se mantiene el editor de texto seguro, pero no hay diagnósticos de lenguaje.</div>';
    return;
  }
  const markers = state.monaco.editor.getModelMarkers({}).filter(marker => {
    const path = marker.resource?.path?.replace(/^\//, '');
    return state.tabs.has(path);
  }).sort((left, right) => right.severity - left.severity
    || left.resource.path.localeCompare(right.resource.path)
    || left.startLineNumber - right.startLineNumber
    || left.startColumn - right.startColumn);

  const errors = markers.filter(marker => marker.severity === state.monaco.MarkerSeverity.Error).length;
  const warnings = markers.filter(marker => marker.severity === state.monaco.MarkerSeverity.Warning).length;
  if (counter) {
    counter.textContent = String(errors + warnings);
    counter.hidden = errors + warnings === 0;
    counter.classList.toggle('has-errors', errors > 0);
    counter.setAttribute('aria-label', `${errors} errores y ${warnings} advertencias`);
  }
  if (state.bottom !== 'problems') return;
  if (!markers.length) {
    const opened = state.tabs.size;
    host.innerHTML = `<div class="cs-problem-summary cs-problem-summary-ok"><strong>✓ Sin problemas detectados</strong><span>Monaco revisó ${opened} archivo(s) abierto(s). El análisis se actualiza mientras escribís.</span></div>`;
    return;
  }
  const summary = [
    errors ? `${errors} error${errors === 1 ? '' : 'es'}` : '',
    warnings ? `${warnings} advertencia${warnings === 1 ? '' : 's'}` : '',
    markers.length - errors - warnings ? `${markers.length - errors - warnings} sugerencia(s)` : ''
  ].filter(Boolean).join(' · ');
  host.innerHTML = `<div class="cs-problem-summary"><strong>${escapeHtml(summary)}</strong><span>Seleccioná un problema para abrir su ubicación exacta.</span></div><div class="cs-list">${markers.map(marker => {
    const path = marker.resource.path.replace(/^\//, '');
    const severity = marker.severity === state.monaco.MarkerSeverity.Error
      ? 'error'
      : marker.severity === state.monaco.MarkerSeverity.Warning ? 'warn' : 'info';
    const label = severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Sugerencia';
    const source = marker.source ? ` · ${escapeHtml(marker.source)}` : '';
    return `<button type="button" class="cs-list-item cs-problem-item cs-problem-${severity}" data-problem-path="${escapeHtml(path)}" data-problem-line="${marker.startLineNumber}" data-problem-column="${marker.startColumn}"><span class="cs-problem-icon" aria-hidden="true">${severity === 'error' ? '×' : severity === 'warn' ? '!' : 'i'}</span><span class="cs-problem-copy"><span class="cs-list-title">${escapeHtml(label)} · ${escapeHtml(path)}:${marker.startLineNumber}:${marker.startColumn}${source}</span><span>${escapeHtml(marker.message)}</span></span></button>`;
  }).join('')}</div>`;
}

async function renderChanges() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'changes') return;
  state.diffEditor?.dispose(); state.diffEditor = null;
  const changed = dirtyTabs();
  if (!changed.length && state.branch) {
    try {
      const data = await api(`compare?branch=${encodeURIComponent(state.branch)}`);
      if (!data.compare.files.length) return void (host.innerHTML = '<div class="cs-muted">La rama no tiene diferencias contra main.</div>');
      host.innerHTML = `<div class="cs-list">${data.compare.files.map(file => `<div class="cs-list-item"><div class="cs-list-title">${escapeHtml(file.status)} · ${escapeHtml(file.filename)}</div><div class="cs-muted">+${file.additions} / -${file.deletions} · ${file.changes} cambios</div><pre class="cs-diff">${escapeHtml(file.patch || 'Diff no disponible para este archivo.')}</pre></div>`).join('')}</div>`;
      return;
    } catch (error) { host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; return; }
  }
  if (!changed.length) return void (host.innerHTML = '<div class="cs-muted">Sin cambios locales.</div>');
  const active = state.tabs.get(state.activePath);
  if (state.monaco && active?.dirty && active.operation !== 'delete') {
    host.innerHTML = '<div style="height:165px" id="cs-diff-host"></div>';
    const original = state.monaco.editor.createModel(active.operation === 'create' ? '' : active.baseline, active.language);
    const modified = state.monaco.editor.createModel(active.content, active.language);
    state.diffEditor = state.monaco.editor.createDiffEditor($('#cs-diff-host'), { theme: 'vs', automaticLayout: true, readOnly: true, renderSideBySide: true, minimap: { enabled: false } });
    state.diffEditor.setModel({ original, modified });
    state.diffEditor.onDidDispose(() => { original.dispose(); modified.dispose(); });
  } else {
    host.innerHTML = `<div class="cs-list">${changed.map(tab => `<div class="cs-list-item"><div class="cs-list-title"><span class="cs-badge ${tab.risk}">${tab.risk}</span>${escapeHtml(tab.operation)} · ${escapeHtml(tab.path)}</div></div>`).join('')}</div>`;
  }
}

async function renderHistory() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'history') return;
  host.innerHTML = '<div class="cs-muted">Cargando historial…</div>';
  try {
    const query = new URLSearchParams({ branch: state.currentRef });
    if (state.activePath) query.set('path', state.activePath);
    const data = await api(`history?${query.toString()}`);
    host.innerHTML = `<div class="cs-list">${data.history.map(item => `<div class="cs-list-item"><div class="cs-list-title"><span class="cs-code">${escapeHtml(item.sha.slice(0, 8))}</span> ${escapeHtml(item.message.split('\n')[0])}</div><div class="cs-muted">${escapeHtml(item.author)} · ${escapeHtml(item.date)}</div></div>`).join('') || '<div class="cs-muted">Sin historial.</div>'}</div>`;
  } catch (error) { host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; }
}

async function refreshChecksState(showLoading = true) {
  const host = $('#cs-bottom-content');
  if (showLoading && state.bottom === 'checks' && host) host.innerHTML = '<div class="cs-muted">Cargando checks…</div>';
  let sha = state.pullRequest?.headSha || state.headSha;
  if (!sha) return [];
  if (state.pullRequest?.number) {
    const pr = await api(`pr?number=${state.pullRequest.number}`);
    state.pullRequest = pr.pullRequest;
    sha = state.pullRequest.headSha;
  }
  const data = await api(`checks?sha=${encodeURIComponent(sha)}`);
  state.checks = data.checks || [];
  const summary = checksSummary();
  if (!['merging', 'merged', 'deploying', 'published', 'deploy_failed'].includes(state.phase)) {
    if (summary.failed.length) state.phase = 'checks_failed';
    else if (summary.pending.some(check => check.status === 'in_progress')) state.phase = 'checks_running';
    else if (summary.pending.length || !summary.total) state.phase = 'checks_queued';
    else if (summary.green && state.pullRequest?.state === 'open') state.phase = 'ready_to_merge';
    else state.phase = 'clean';
  }
  state.lastSyncAt = new Date().toISOString();
  updateTopStatus();
  return state.checks;
}

async function renderChecks() {
  const host = $('#cs-bottom-content');
  try {
    const checks = await refreshChecksState(true);
    if (state.bottom !== 'checks' || !host) return;
    host.innerHTML = `<div class="cs-list">${checks.map(check => { const href = safeExternalHref(check.detailsUrl || check.url); return `<a class="cs-list-item cs-check-link"${href ? ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"` : ''}><div class="cs-list-title">${check.conclusion === 'success' ? '✓' : check.status === 'completed' ? '✕' : '…'} ${escapeHtml(check.name)}</div><div class="cs-muted">${escapeHtml(check.status)} · ${escapeHtml(check.conclusion || 'pendiente')}</div></a>`; }).join('') || '<div class="cs-muted">GitHub todavía no reporta checks para este commit.</div>'}</div>${state.pullRequest?.number ? `<p class="cs-muted" style="margin-top:8px">PR #${state.pullRequest.number}. Cuando checks y preview estén verdes, la aprobación humana se realiza con “Mergear” dentro de Tintin.</p>` : ''}`;
  } catch (error) { if (state.bottom === 'checks' && host) host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; }
}

async function renderMap() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'map') return;
  const paths = [...state.tabs.keys()].slice(0, 25);
  if (!paths.length) return void (host.innerHTML = '<div class="cs-muted">Abrí archivos para construir conexiones con evidencia.</div>');
  host.innerHTML = '<div class="cs-muted">Analizando imports, llamadas, APIs y colecciones con evidencia…</div>';
  try {
    const data = await api('graph', { method: 'POST', body: JSON.stringify({ branch: state.currentRef, paths }) });
    const graph = data.graph;
    const columns = { file: 80, 'file-reference': 80, class: 360, function: 360, api: 670, collection: 670, 'external-link': 670, 'external-service': 670 };
    const counters = new Map();
    const positions = new Map(graph.nodes.map(node => {
      const x = columns[node.type] ?? 500;
      const row = counters.get(x) || 0;
      counters.set(x, row + 1);
      return [node.id, { x, y: 30 + row * 58 }];
    }));
    const height = Math.max(170, ...[...positions.values()].map(position => position.y + 50));
    const lines = graph.edges.map(edge => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return '';
      return `<path class="cs-graph-line ${escapeHtml(edge.evidence)}" d="M ${source.x + 150} ${source.y + 17} C ${source.x + 210} ${source.y + 17}, ${target.x - 60} ${target.y + 17}, ${target.x} ${target.y + 17}"><title>${escapeHtml(`${edge.kind} · ${edge.path || ''}:${edge.line || ''}`)}</title></path>`;
    }).join('');
    const nodes = graph.nodes.map(node => {
      const position = positions.get(node.id);
      const location = node.path ? `${node.path}:${node.line || 1}` : node.url ? new URL(node.url).hostname : node.id;
      return `<button type="button" class="cs-graph-node ${escapeHtml(node.type)}" style="left:${position.x}px;top:${position.y}px" data-graph-id="${escapeHtml(node.id)}"><span>${escapeHtml(node.label)}</span><small>${escapeHtml(node.type)} · ${escapeHtml(location)}</small></button>`;
    }).join('');
    host.innerHTML = `<div class="cs-graph-toolbar"><strong>Mapa de impacto verificable</strong><span class="cs-spacer"></span><button class="cs-btn" data-graph-zoom="out" type="button">−</button><button class="cs-btn" data-graph-zoom="reset" type="button">Centrar</button><button class="cs-btn" data-graph-zoom="in" type="button">＋</button></div><div class="cs-graph-viewport"><div class="cs-graph-canvas" style="width:900px;height:${height}px;transform:scale(${state.graphScale})"><svg width="900" height="${height}" aria-hidden="true">${lines}</svg>${nodes}</div></div><div class="cs-graph-legend">Archivo → símbolo → API, Firestore o servicio. Verde: confirmado; amarillo: probable; gris: informativo.</div>`;
    host.querySelectorAll('[data-graph-id]').forEach(button => button.addEventListener('click', async () => {
      const node = graph.nodes.find(item => item.id === button.dataset.graphId);
      if (!node) return;
      if (node.url) {
        try {
          const url = new URL(node.url);
          if (url.protocol !== 'https:' || !EXTERNAL_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Enlace externo no autorizado');
          window.open(url.toString(), '_blank', 'noopener,noreferrer');
        } catch (error) { toast(error.message, true); }
        return;
      }
      if (node.path) await revealEditorLocation(node.path, node.line, node.column).catch(error => toast(error.message, true));
    }));
    host.querySelectorAll('[data-graph-zoom]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.graphZoom === 'in') state.graphScale = Math.min(1.6, state.graphScale + 0.15);
      if (button.dataset.graphZoom === 'out') state.graphScale = Math.max(0.55, state.graphScale - 0.15);
      if (button.dataset.graphZoom === 'reset') state.graphScale = 1;
      host.querySelector('.cs-graph-canvas').style.transform = `scale(${state.graphScale})`;
    }));
  } catch (error) { host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; }
}

async function processRealtimeSnapshot(payload) {
  state.lastEvents = Array.isArray(payload?.events) ? payload.events : [];
  state.lastSyncAt = new Date().toISOString();
  const deploymentEvent = state.lastEvents.find(event => event.event === 'deployment_status' && (!state.mergedSha || !event.sha || event.sha === state.mergedSha));
  if (deploymentEvent && state.phase === 'deploying') {
    if (deploymentEvent.state === 'success') { setProgress(100); setPhase('published', 'Cloudflare confirmó el despliegue de producción.'); }
    else if (['failure', 'error', 'inactive'].includes(deploymentEvent.state)) { setProgress(0); setPhase('deploy_failed', `El despliegue terminó en estado ${deploymentEvent.state}.`); }
    else if (state.mergedSha) setPhase('deploying', `Despliegue de producción: ${deploymentEvent.state || 'en curso'}.`);
  }
  if (state.lastEvents.some(event => ['check_run', 'check_suite', 'workflow_run', 'pull_request'].includes(event.event))) refreshChecksState(false).catch(() => {});
  updateTopStatus();
  if (state.bottom === 'events') renderEvents();
}

async function connectRealtimeEvents() {
  if (state.realtimeController) return;
  const controller = new AbortController();
  state.realtimeController = controller;
  try {
    const token = await currentToken();
    const response = await fetch(`${API}/events`, { headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' }, cache: 'no-store', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Canal en vivo no disponible (${response.status})`);
    state.realtimeConnected = true;
    updateTopStatus();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const rawData = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (eventName === 'snapshot' && rawData) {
          try { await processRealtimeSnapshot(JSON.parse(rawData)); } catch {}
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') state.phaseDetail = `Canal en vivo reconectando: ${error.message}`;
  } finally {
    if (state.realtimeController === controller) state.realtimeController = null;
    state.realtimeConnected = false;
    updateTopStatus();
    clearTimeout(state.realtimeReconnectTimer);
    state.realtimeReconnectTimer = setTimeout(() => { if (state.visible) connectRealtimeEvents(); }, 1500);
  }
}

function renderEvents() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'events') return;
  host.innerHTML = `<div class="cs-list">${state.lastEvents.map(event => `<div class="cs-list-item"><div class="cs-list-title">${escapeHtml(event.event)} · ${escapeHtml(event.action || event.state || 'evento')}</div><div class="cs-muted">${escapeHtml(event.ref || '')} ${escapeHtml(String(event.sha || '').slice(0, 8))}${event.state ? ` · ${escapeHtml(event.state)}` : ''} · ${escapeHtml(event.receivedAt || '')}</div></div>`).join('') || '<div class="cs-muted">Sin webhooks recientes. El canal SSE está autenticado y el panel también reconcilia periódicamente con GitHub.</div>'}</div>`;
}

async function sendAi() {
  const input = $('#cs-ai-input');
  const output = $('#cs-ai-output');
  const question = input.value.trim();
  if (!question) return;
  output.textContent = 'Analizando únicamente evidencia verificada de GitHub…';
  try {
    const data = await api('ai/analyze', { method: 'POST', body: JSON.stringify({ question, branch: state.currentRef, paths: [...state.tabs.keys()].slice(0, 12) }) });
    const result = data.proposal;
    const proposal = result.proposal || { summary: result.text, changes: [] };
    state.aiProposal = proposal;
    const section = (title, values) => Array.isArray(values) && values.length ? `<h4>${title}</h4><ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '';
    output.innerHTML = `<h3>Propuesta basada en GitHub</h3><p>${escapeHtml(proposal.summary || result.text)}</p>${section('Diagnóstico', proposal.diagnosis)}${section('Impacto', proposal.impact)}${section('Pruebas sugeridas', proposal.tests)}${proposal.rollback ? `<h4>Rollback</h4><p>${escapeHtml(proposal.rollback)}</p>` : ''}<h4>Cambios completos</h4>${proposal.changes?.length ? proposal.changes.map(change => `<div class="cs-list-item"><strong>${escapeHtml(change.path)}</strong><br><span class="cs-muted">Actualización completa · base ${escapeHtml(String(change.baseSha || '').slice(0, 8))}</span></div>`).join('') : '<p class="cs-muted">La IA no propuso modificaciones aplicables.</p>'}`;
    $('#cs-ai-proposal-actions')?.classList.toggle('cs-hidden', !proposal.changes?.length);
  } catch (error) {
    output.textContent = error.message;
    toast(error.message, true);
  }
}

async function applyAiProposal() {
  const changes = state.aiProposal?.changes || [];
  if (!state.branch) return toast('Creá o recuperá una rama antes de aplicar cambios.', true);
  if (!changes.length) return;
  for (const change of changes) {
    const tab = await openFile(change.path);
    if (tab.dirty || tab.sha !== change.baseSha) throw new Error(`${change.path} cambió desde el análisis. Volvé a pedir la revisión para evitar sobrescribir trabajo.`);
  }
  for (const change of changes) {
    const tab = state.tabs.get(change.path);
    tab.content = change.content;
    tab.dirty = tab.content !== tab.baseline;
    if (tab.model) tab.model.setValue(tab.content);
  }
  renderTabs(); updateTopStatus(); updateAiContext(); switchBottom('changes');
  $('#cs-ai-proposal-actions')?.classList.add('cs-hidden');
  toast(`${changes.length} archivo(s) aplicados únicamente a buffers locales. Revisalos antes del commit.`);
}

function discardAiProposal() {
  state.aiProposal = null;
  $('#cs-ai-proposal-actions')?.classList.add('cs-hidden');
  $('#cs-ai-output').textContent = 'Propuesta descartada. No se modificó ningún archivo.';
}

function updateAiContext() {
  const node = $('#cs-ai-context');
  if (!node) return;
  const paths = [...state.tabs.keys()];
  node.innerHTML = paths.length ? `<strong>Contexto GitHub:</strong><br>${paths.map(path => `${escapeHtml(path)}${state.tabs.get(path).dirty ? ' · local modificado' : ''}`).join('<br>')}` : 'Abrí archivos para darle contexto verificable al asistente.';
}

function startRealtimeLoops() {
  if (!state.reconcileTimer) state.reconcileTimer = setInterval(() => { if (state.visible) syncState(); }, 60000);
  connectRealtimeEvents();
}

async function globalSearch() {
  const input = $('#cs-search');
  const query = input.value.trim();
  if (!query) return refreshTree();
  if (query.length < 2) return;
  const host = $('#cs-tree');
  host.innerHTML = '<div class="cs-muted" style="padding:8px">Buscando…</div>';
  try {
    const data = await api(`search?q=${encodeURIComponent(query)}`);
    host.innerHTML = '';
    renderEntries(host, data.results.map(item => ({ ...item, type: 'file', name: item.path })), 0);
  } catch (error) { host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; }
}

function switchBottom(name) {
  state.bottom = name;
  document.querySelectorAll('.cs-bottom-tab').forEach(button => button.classList.toggle('active', button.dataset.bottom === name));
  if (name === 'problems') renderProblems();
  if (name === 'changes') renderChanges();
  if (name === 'history') renderHistory();
  if (name === 'checks') renderChecks();
  if (name === 'map') renderMap();
  if (name === 'events') renderEvents();
}

function bindUi() {
  $('#cs-sync')?.addEventListener('click', async () => { await syncState(); await refreshTree(); toast('Estado reconciliado con GitHub.'); });
  $('#cs-tree-refresh')?.addEventListener('click', refreshTree);
  $('#cs-branch-new')?.addEventListener('click', createBranch);
  $('#cs-new-file')?.addEventListener('click', newFile);
  $('#cs-rename')?.addEventListener('click', renameSelected);
  $('#cs-delete')?.addEventListener('click', deleteSelected);
  $('#cs-commit')?.addEventListener('click', commitChanges);
  $('#cs-pr')?.addEventListener('click', openPr);
  $('#cs-merge')?.addEventListener('click', mergeFromStudio);
  $('#cs-preview')?.addEventListener('click', previewDeployment);
  $('#cs-ai-send')?.addEventListener('click', sendAi);
  $('#cs-ai-apply')?.addEventListener('click', () => applyAiProposal().catch(error => toast(error.message, true)));
  $('#cs-ai-discard')?.addEventListener('click', discardAiProposal);
  $('#cs-ai-close')?.addEventListener('click', () => $('#cs-ai')?.classList.add('cs-collapsed'));
  $('#cs-ai-toggle')?.addEventListener('click', () => $('#cs-ai')?.classList.toggle('cs-collapsed'));
  $('#cs-github-center-toggle')?.addEventListener('click', () => {
    const panel = $('#cs-github-center');
    const hidden = panel?.classList.toggle('cs-hidden');
    $('#cs-github-center-toggle')?.setAttribute('aria-expanded', String(!hidden));
  });
  $('#cs-github-center-close')?.addEventListener('click', () => {
    $('#cs-github-center')?.classList.add('cs-hidden');
    $('#cs-github-center-toggle')?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.cs-bottom-tab').forEach(button => button.addEventListener('click', () => switchBottom(button.dataset.bottom)));
  $('#cs-bottom-content')?.addEventListener('click', event => {
    const problem = event.target.closest('[data-problem-path]');
    if (!problem) return;
    revealEditorLocation(problem.dataset.problemPath, problem.dataset.problemLine, problem.dataset.problemColumn)
      .catch(error => toast(error.message, true));
  });
  let searchTimer;
  $('#cs-search')?.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(globalSearch, 350); });
  document.addEventListener('keydown', event => {
    if (!state.visible) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); commitChanges(); }
    if (mod && event.key.toLowerCase() === 'p') { event.preventDefault(); $('#cs-search')?.focus(); }
    if (mod && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); $('#cs-search')?.focus(); }
  });
  document.addEventListener('click', event => {
    const adminNav = event.target.closest('.adm-nav-item,.adm-mobile-tab');
    if (adminNav && adminNav.dataset.section && adminNav.dataset.section !== 'estudio-codigo') {
      state.visible = false;
      document.body.classList.remove('code-studio-open');
    }
  }, true);
}

async function init() {
  try {
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    else await new Promise(resolve => setTimeout(resolve, 600));
  } catch {}
  const user = auth.currentUser;
  if (!user || String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN) return;
  makeShell();
  bindUi();
}

init();
