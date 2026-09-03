// TINTIN — Estudio de Código: restauración explícita desde historial.
// Módulo separado para mantener el runtime principal enfocado en edición.

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { SUPER_ADMIN } from '../../core/auth/roles.js';

const API = '/api/code-studio';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

async function token() {
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN) throw new Error('Sesión Super Admin no disponible');
  return user.getIdToken();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${await token()}`);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${API}/${path}`, { ...options, headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
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

function currentBranch() {
  const value = document.querySelector('#cs-branch')?.textContent?.trim() || '';
  if (!value || value.startsWith('main')) return '';
  return value;
}

function selectedPath() {
  const selected = document.querySelector('.cs-tree-row.selected[data-type="file"]');
  return selected?.dataset?.path || '';
}

async function chooseHistoricalCommit(branch, path) {
  const query = new URLSearchParams({ branch, path });
  const data = await api(`history?${query.toString()}`);
  const history = data.history || [];
  if (!history.length) throw new Error('No hay historial disponible para ese archivo');

  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'cs-modal-backdrop';
    backdrop.innerHTML = `<div class="cs-modal"><div class="cs-modal-head"><strong>Restaurar ${escapeHtml(path)}</strong><span class="cs-spacer"></span><button type="button" class="cs-btn" data-close>✕</button></div><div class="cs-modal-body"><p class="cs-muted">Elegí una versión histórica. La restauración crea un commit nuevo: no borra ni reescribe el historial existente.</p><div class="cs-list">${history.slice(0, 30).map(item => `<button type="button" class="cs-list-item" data-sha="${escapeHtml(item.sha)}" style="text-align:left;color:inherit;cursor:pointer"><div class="cs-list-title"><span class="cs-code">${escapeHtml(item.sha.slice(0, 8))}</span> ${escapeHtml(String(item.message || '').split('\n')[0])}</div><div class="cs-muted">${escapeHtml(item.author)} · ${escapeHtml(item.date)}</div></button>`).join('')}</div></div><div class="cs-modal-foot"><button type="button" class="cs-btn" data-close>Cancelar</button></div></div>`;
    const close = value => { backdrop.remove(); resolve(value); };
    backdrop.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => close('')));
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(''); });
    backdrop.querySelectorAll('[data-sha]').forEach(button => button.addEventListener('click', () => close(button.dataset.sha || '')));
    document.body.appendChild(backdrop);
  });
}

async function restoreSelected() {
  const branch = currentBranch();
  if (!branch) return toast('La restauración solo se hace dentro de una rama de trabajo, nunca sobre main.', true);
  let path = selectedPath();
  if (!path) path = String(prompt('Ruta del archivo a restaurar:') || '').trim();
  if (!path) return;

  try {
    const sourceRef = await chooseHistoricalCommit(branch, path);
    if (!sourceRef) return;
    const headData = await api(`history?${new URLSearchParams({ branch }).toString()}`);
    const expectedHeadSha = headData.history?.[0]?.sha || '';
    if (!expectedHeadSha) throw new Error('No se pudo confirmar el HEAD actual de la rama');
    if (!confirm(`¿Restaurar ${path} desde ${sourceRef.slice(0, 8)}? Se creará un commit nuevo y reversible.`)) return;

    const result = await api('restore', {
      method: 'POST',
      body: JSON.stringify({ branch, expectedHeadSha, sourceRef, paths: [path] })
    });
    toast(`Restauración guardada en ${result.restore.commitSha.slice(0, 8)}.`);
    document.querySelector('#cs-sync')?.click();
  } catch (error) {
    toast(error.message, true);
  }
}

function install() {
  const top = document.querySelector('.cs-top');
  if (!top || document.querySelector('#cs-restore')) return false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cs-btn';
  button.id = 'cs-restore';
  button.textContent = 'Restaurar';
  button.title = 'Restaurar un archivo desde un commit anterior creando un commit nuevo';
  const pr = document.querySelector('#cs-pr');
  const fallback = document.querySelector('#cs-ai-toggle');
  const anchor = pr || fallback;
  const toolbar = anchor?.closest('.cs-toolbar') || top.querySelector('.cs-toolbar') || top;
  toolbar.insertBefore(button, anchor?.parentElement === toolbar ? anchor : null);
  button.addEventListener('click', restoreSelected);
  return true;
}

const observer = new MutationObserver(() => {
  try {
    if (install()) observer.disconnect();
  } catch (error) {
    observer.disconnect();
    console.error('[code-studio] No se pudo instalar la acción Restaurar.', error);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
install();
