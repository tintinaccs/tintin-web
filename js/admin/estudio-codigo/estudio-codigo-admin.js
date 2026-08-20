// =============================================================
// TINTIN — Estudio de Código
// Super Admin only. GitHub es la fuente oficial; ningún secreto vive acá.
// =============================================================

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN } from '../../core/auth/roles.js';

const API = '/api/code-studio';
const MONACO_BASE = 'https://unpkg.com/monaco-editor@0.52.2/min/vs';
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
  eventsTimer: null,
  reconcileTimer: null,
  lastEvents: []
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

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
  node.className = `cs-toast${bad ? ' bad' : ''}`;
  node.textContent = message;
  document.body.appendChild(node);
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
  navButton.innerHTML = '<span class="adm-nav-icon" aria-hidden="true">⌘</span> Estudio de Código';
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
    button.innerHTML = '<span class="adm-nav-icon">⌘</span>Código';
    mobile.appendChild(button);
  }

  const section = document.createElement('div');
  section.className = 'adm-section';
  section.id = 'section-estudio-codigo';
  section.innerHTML = `
    <div class="cs-shell">
      <div class="cs-top">
        <div class="cs-brand">Estudio de Código Tintin</div>
        <div class="cs-status"><span class="cs-dot" id="cs-dot"></span><span id="cs-status">Comprobando GitHub…</span></div>
        <div class="cs-spacer"></div>
        <div class="cs-branch" id="cs-branch">main</div>
        <button class="cs-btn" id="cs-sync" type="button">Sincronizar</button>
        <button class="cs-btn" id="cs-branch-new" type="button">Nueva rama</button>
        <button class="cs-btn" id="cs-preview" type="button" disabled>Preview</button>
        <button class="cs-btn cs-btn-primary" id="cs-commit" type="button" disabled>Guardar commit</button>
        <button class="cs-btn" id="cs-pr" type="button" disabled>Abrir PR</button>
        <button class="cs-btn" id="cs-ai-toggle" type="button">IA</button>
      </div>
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
              <button class="cs-bottom-tab active" data-bottom="problems" type="button">Problemas</button>
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
            <textarea class="cs-ai-input" id="cs-ai-input" maxlength="6000" placeholder="¿Qué querés analizar o cambiar?"></textarea>
            <div class="cs-ai-actions"><button class="cs-btn cs-btn-primary" id="cs-ai-send" type="button">Analizar</button></div>
          </div>
        </aside>
      </div>
    </div>`;
  document.querySelector('.adm-main')?.appendChild(section);

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
  state.visible = true;
  if (!state.ready) bootstrap();
  startRealtimeLoops();
}

function setProgress(value) {
  const bar = $('#cs-progress');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function updateTopStatus() {
  const dot = $('#cs-dot');
  const label = $('#cs-status');
  const branch = $('#cs-branch');
  const commit = $('#cs-commit');
  const pr = $('#cs-pr');
  const preview = $('#cs-preview');
  if (!label) return;
  if (!state.github?.appConfigured) {
    label.textContent = state.github?.error || 'GitHub App sin configurar';
    dot.className = 'cs-dot bad';
  } else {
    label.textContent = `${state.github.repository} · ${String(state.headSha || state.github.mainSha || '').slice(0, 8)}`;
    dot.className = 'cs-dot ok';
  }
  branch.textContent = state.branch || 'main · solo lectura';
  const dirty = [...state.tabs.values()].some(tab => tab.dirty);
  commit.disabled = !state.branch || !dirty;
  pr.disabled = !state.branch || dirty;
  preview.disabled = !state.branch;
}

async function bootstrap() {
  setProgress(12);
  try {
    const data = await api('bootstrap');
    state.github = data.github;
    state.headSha = data.github?.mainSha || '';
    state.ready = true;
    updateTopStatus();
    await refreshTree();
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  } catch (error) {
    setProgress(0);
    toast(error.message, true);
    state.github = { appConfigured: false, error: error.message };
    updateTopStatus();
  }
}

async function refreshTree() {
  const root = $('#cs-tree');
  if (!root) return;
  root.innerHTML = '<div class="cs-muted" style="padding:8px">Cargando…</div>';
  try {
    const data = await api(`tree?ref=${encodeURIComponent(state.currentRef)}`);
    root.innerHTML = '';
    renderEntries(root, data.entries, 0);
  } catch (error) {
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
    if (state.bottom === 'problems') setTimeout(renderProblems, 150);
    if (state.bottom === 'changes') setTimeout(renderChanges, 150);
  });
}

async function ensureMonaco() {
  if (state.monaco) return state.monaco;
  if (window.monaco) {
    state.monaco = window.monaco;
    return state.monaco;
  }
  return new Promise(resolve => {
    if (window.__tintinMonacoLoading) {
      const timer = setInterval(() => {
        if (window.monaco || window.__tintinMonacoFailed) {
          clearInterval(timer);
          state.monaco = window.monaco || null;
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
}

function activateTab(path) {
  state.activePath = path;
  renderTabs();
  renderEditor();
  updateAiContext();
  if (state.bottom === 'problems') renderProblems();
  if (state.bottom === 'changes') renderChanges();
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
        theme: 'vs-dark',
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
  try {
    const result = await api('branch', { method: 'POST', body: JSON.stringify({ label, expectedMainSha: state.github.mainSha }) });
    state.branch = result.branch;
    state.currentRef = result.branch;
    state.headSha = result.sha;
    for (const tab of state.tabs.values()) {
      const fresh = await api(`file?ref=${encodeURIComponent(state.branch)}&path=${encodeURIComponent(tab.path)}`);
      tab.sha = fresh.sha; tab.baseline = fresh.content; tab.content = fresh.content; tab.dirty = false; tab.operation = 'update';
      if (tab.model) { tab.suppress = true; tab.model.setValue(fresh.content); tab.suppress = false; }
    }
    renderEditor(); renderTabs(); updateTopStatus(); await refreshTree();
    setProgress(100); setTimeout(() => setProgress(0), 400);
    toast(`Rama creada: ${result.branch}`);
  } catch (error) {
    setProgress(0); toast(error.message, true);
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
      } catch (error) {
        setProgress(0);
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
    body: `<div class="cs-field"><label>Título</label><input id="cs-pr-title" class="cs-input" maxlength="180" value="feat: integrar Estudio de Código Tintin"></div><div class="cs-field"><label>Descripción</label><textarea id="cs-pr-body" class="cs-input" rows="8">Cambio preparado desde una rama aislada del Estudio de Código Tintin.\n\nRequiere CI verde, preview y revisión humana antes de fusionar.</textarea></div><div class="cs-list">${compare.compare.files.map(file => `<div class="cs-list-item"><strong>${escapeHtml(file.filename)}</strong> · +${file.additions} / -${file.deletions}</div>`).join('')}</div>`,
    onConfirm: async backdrop => {
      const data = await api('pr', { method: 'POST', body: JSON.stringify({ branch: state.branch, title: backdrop.querySelector('#cs-pr-title').value, body: backdrop.querySelector('#cs-pr-body').value }) });
      state.pullRequest = data.pullRequest;
      toast(`PR #${data.pullRequest.number} abierto. La fusión queda para revisión humana.`);
      await renderChecks();
    }
  });
}

async function syncState() {
  if (!state.ready) return;
  try {
    const data = await api('bootstrap');
    if (data.github?.appConfigured) {
      const previousMain = state.github?.mainSha;
      state.github = data.github;
      if (!state.branch) state.headSha = data.github.mainSha;
      updateTopStatus();
      if (previousMain && previousMain !== data.github.mainSha && state.branch) {
        $('#cs-banner').innerHTML = '<strong>GitHub cambió:</strong> main avanzó desde que creaste tu rama. Revisá el comparador antes de continuar; no se hará ninguna sobreescritura silenciosa.';
      }
    }
  } catch {}
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
    window.open(ready.environmentUrl, '_blank', 'noopener,noreferrer');
  } catch (error) { toast(error.message, true); }
}

async function renderProblems() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'problems') return;
  if (!state.monaco) {
    host.innerHTML = '<div class="cs-muted">Monaco no está disponible; se mantiene el editor de texto seguro, pero no hay diagnósticos de lenguaje.</div>';
    return;
  }
  const markers = state.monaco.editor.getModelMarkers({}).filter(marker => {
    const path = marker.resource?.path?.replace(/^\//, '');
    return state.tabs.has(path);
  });
  if (!markers.length) {
    host.innerHTML = '<div class="cs-muted">Sin marcadores de sintaxis/lenguaje reportados por Monaco.</div>';
    return;
  }
  host.innerHTML = `<div class="cs-list">${markers.map(marker => `<div class="cs-list-item ${marker.severity >= 8 ? 'cs-problem-error' : 'cs-problem-warn'}"><div class="cs-list-title">${escapeHtml(marker.resource.path.replace(/^\//, ''))}:${marker.startLineNumber}:${marker.startColumn}</div><div>${escapeHtml(marker.message)}</div></div>`).join('')}</div>`;
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
    state.diffEditor = state.monaco.editor.createDiffEditor($('#cs-diff-host'), { theme: 'vs-dark', automaticLayout: true, readOnly: true, renderSideBySide: true, minimap: { enabled: false } });
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

async function renderChecks() {
  const host = $('#cs-bottom-content');
  if (state.bottom === 'checks' && host) host.innerHTML = '<div class="cs-muted">Cargando checks…</div>';
  let sha = state.pullRequest?.headSha || state.headSha;
  if (!sha) return;
  try {
    if (state.pullRequest?.number) {
      const pr = await api(`pr?number=${state.pullRequest.number}`);
      state.pullRequest = pr.pullRequest;
      sha = state.pullRequest.headSha;
    }
    const data = await api(`checks?sha=${encodeURIComponent(sha)}`);
    if (state.bottom !== 'checks' || !host) return;
    host.innerHTML = `<div class="cs-list">${data.checks.map(check => `<div class="cs-list-item"><div class="cs-list-title">${check.conclusion === 'success' ? '✓' : check.status === 'completed' ? '!' : '…'} ${escapeHtml(check.name)}</div><div class="cs-muted">${escapeHtml(check.status)} · ${escapeHtml(check.conclusion || 'pendiente')}</div></div>`).join('') || '<div class="cs-muted">GitHub todavía no reporta checks para este commit.</div>'}</div>${state.pullRequest?.url ? `<p class="cs-muted" style="margin-top:8px">La aprobación y fusión final se hacen como revisión humana en GitHub: <a href="${escapeHtml(state.pullRequest.url)}" target="_blank" rel="noopener noreferrer">abrir PR #${state.pullRequest.number}</a>.</p>` : ''}`;
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
    host.innerHTML = `<div class="cs-map">${graph.nodes.map(node => `<button type="button" class="cs-node" data-node="${escapeHtml(node.id)}">${escapeHtml(node.type)} · ${escapeHtml(node.label)}</button>`).join('')}</div><div style="margin-top:10px">${graph.edges.map(edge => `<div class="cs-edge ${edge.evidence}"><strong>${escapeHtml(edge.evidence)}</strong> · ${escapeHtml(edge.source)} → ${escapeHtml(edge.target)} · ${escapeHtml(edge.kind)}${edge.path ? ` · ${escapeHtml(edge.path)}${edge.line ? ':' + edge.line : ''}` : ''}</div>`).join('') || '<div class="cs-muted">No se encontraron conexiones literales en los archivos abiertos.</div>'}</div>`;
    host.querySelectorAll('[data-node]').forEach(node => node.addEventListener('click', () => {
      const id = node.dataset.node;
      if (state.tabs.has(id)) activateTab(id);
      else if (!id.startsWith('http') && !id.startsWith('/api/') && id.includes('/')) openFile(id).catch(() => {});
    }));
  } catch (error) { host.innerHTML = `<div class="cs-list-item cs-problem-error">${escapeHtml(error.message)}</div>`; }
}

async function fetchEventsSnapshot() {
  try {
    const token = await currentToken();
    const response = await fetch(`${API}/events`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) return;
    const text = await response.text();
    const match = text.match(/event:\s*snapshot\s*\ndata:\s*(\{.*\})/);
    if (match) state.lastEvents = JSON.parse(match[1]).events || [];
    if (state.bottom === 'events') renderEvents();
  } catch {}
}

function renderEvents() {
  const host = $('#cs-bottom-content');
  if (!host || state.bottom !== 'events') return;
  host.innerHTML = `<div class="cs-list">${state.lastEvents.map(event => `<div class="cs-list-item"><div class="cs-list-title">${escapeHtml(event.event)} · ${escapeHtml(event.action || 'evento')}</div><div class="cs-muted">${escapeHtml(event.ref || '')} ${escapeHtml(String(event.sha || '').slice(0, 8))} · ${escapeHtml(event.receivedAt || '')}</div></div>`).join('') || '<div class="cs-muted">Sin webhooks recientes. El panel también reconcilia periódicamente con GitHub.</div>'}</div>`;
}

async function sendAi() {
  const input = $('#cs-ai-input');
  const output = $('#cs-ai-output');
  const question = input.value.trim();
  if (!question) return;
  output.textContent = 'Analizando únicamente evidencia verificada de GitHub…';
  try {
    const data = await api('ai/analyze', { method: 'POST', body: JSON.stringify({ question, branch: state.currentRef, paths: [...state.tabs.keys()].slice(0, 12) }) });
    output.textContent = data.proposal.text;
  } catch (error) {
    output.textContent = error.message;
    toast(error.message, true);
  }
}

function updateAiContext() {
  const node = $('#cs-ai-context');
  if (!node) return;
  const paths = [...state.tabs.keys()];
  node.innerHTML = paths.length ? `<strong>Contexto GitHub:</strong><br>${paths.map(path => `${escapeHtml(path)}${state.tabs.get(path).dirty ? ' · local modificado' : ''}`).join('<br>')}` : 'Abrí archivos para darle contexto verificable al asistente.';
}

function startRealtimeLoops() {
  if (!state.eventsTimer) state.eventsTimer = setInterval(() => { if (state.visible) fetchEventsSnapshot(); }, 15000);
  if (!state.reconcileTimer) state.reconcileTimer = setInterval(() => { if (state.visible) syncState(); }, 60000);
  fetchEventsSnapshot();
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
  $('#cs-preview')?.addEventListener('click', previewDeployment);
  $('#cs-ai-send')?.addEventListener('click', sendAi);
  $('#cs-ai-close')?.addEventListener('click', () => $('#cs-ai')?.classList.add('cs-collapsed'));
  $('#cs-ai-toggle')?.addEventListener('click', () => $('#cs-ai')?.classList.toggle('cs-collapsed'));
  document.querySelectorAll('.cs-bottom-tab').forEach(button => button.addEventListener('click', () => switchBottom(button.dataset.bottom)));
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
    if (adminNav && adminNav.dataset.section && adminNav.dataset.section !== 'estudio-codigo') state.visible = false;
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
