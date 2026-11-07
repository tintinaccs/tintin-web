/* =============================================================
   TINTIN — Modo edición en la página real (solo Super Admin)

   Se activa con `?ttEdit=1`. Reutiliza el contrato existente del constructor
   visual: lee y publica por /api/visual-builder (acción `publish`, con las
   precondiciones de versión), así la tienda se actualiza por el mismo
   `site_content` que ya escuchan las páginas en tiempo real.

   - Texto: se edita directamente sobre el elemento (campos del esquema).
   - Fotos de bloques: clic → elegir archivo → se sube a la biblioteca.
   - Casillas: cada sección/bloque se puede subir, bajar, llevar al tope o al final.
   - Guardar publica; Cancelar descarta; Vista previa oculta los controles.
   ============================================================= */

import { auth } from '../firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { apiUrl } from '../firebase/origen-funciones.js?v=tintin-20261017-domain-cutover-1';
import { subscribeAuthState } from '../auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { SUPER_ADMIN } from '../auth/roles.js?v=tintin-20261017-domain-cutover-1';
import {
  detectContentPageId, getNested, getPageSchema, normalizeContentValue, sanitizeContentText, setNested,
} from './esquema-contenido.js?v=tintin-suitcase-20261104-1';
import { moveBlock, moveSection } from './orden-casillas.js?v=tintin-suitcase-20261104-1';
import { applyVisualBuilderConfig, initVisualBuilderRuntime } from './editor-visual-runtime.js?v=tintin-suitcase-20261104-1-p1106';

const IMAGE_BLOCK_TYPES = new Set(['banner', 'section', 'columns', 'testimonial']);
const clone = value => JSON.parse(JSON.stringify(value));

export function isEditModeRequested(search = location.search) {
  return new URLSearchParams(search).get('ttEdit') === '1';
}

/* ---------- Estado ---------- */

const state = {
  pageId: '', schema: null, config: null, content: null, version: 0, revision: '',
  dirty: false, busy: false, preview: false, hasDraft: false, textBound: new WeakMap(),
};

async function token() {
  const user = auth.currentUser;
  if (!user) throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  return user.getIdToken();
}

async function api(method, body) {
  const url = method === 'GET' ? `${apiUrl('visual-builder')}?page=${encodeURIComponent(state.pageId)}` : apiUrl('visual-builder');
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `No se pudo completar la solicitud (HTTP ${response.status}).`);
  return data;
}

/* ---------- UI mínima ---------- */

function injectStyles() {
  if (document.getElementById('tt-edit-mode-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-edit-mode-style';
  style.textContent = `
html.tt-edit-on [data-tt-edit-text]{outline:1px dashed rgba(184,76,114,.55);outline-offset:3px;border-radius:3px;cursor:text;min-width:2ch}
html.tt-edit-on [data-tt-edit-text]:focus{outline:2px solid #b84c72;background:rgba(252,228,236,.35)}
html.tt-edit-on [data-tt-edit-img]{outline:2px dashed rgba(184,76,114,.65);outline-offset:-2px;cursor:pointer}
html.tt-edit-on .tt-edit-cell{position:relative;box-shadow:inset 0 0 0 1px rgba(184,76,114,.28)}
.tt-edit-tools{position:absolute;top:8px;left:8px;z-index:1240;display:flex;gap:2px;align-items:center;padding:3px;background:#fff;border:1px solid #f0b9cf;border-radius:999px;box-shadow:0 4px 14px rgba(184,76,114,.22);font:12px/1 Montserrat,sans-serif;color:#7a2d4d}
.tt-edit-tools span{padding:0 8px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt-edit-tools button{all:unset;box-sizing:border-box;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;cursor:pointer;font-size:14px}
.tt-edit-tools button:hover:not(:disabled){background:#fce4ec}
.tt-edit-tools button:disabled{opacity:.3;cursor:default}
.tt-edit-tools button:focus-visible,.tt-edit-bar button:focus-visible{outline:2px solid #b84c72;outline-offset:1px}
html.tt-edit-preview .tt-edit-tools{display:none}
html.tt-edit-preview [data-tt-edit-text],html.tt-edit-preview [data-tt-edit-img],html.tt-edit-preview .tt-edit-cell{outline:none;box-shadow:none;cursor:auto}
.tt-edit-bar{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:1300;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);padding:8px 10px;background:#fff;border:1px solid #f0b9cf;border-radius:999px;box-shadow:0 10px 30px rgba(60,20,40,.22);font:13px/1.2 Montserrat,sans-serif;color:#4a1f33}
.tt-edit-bar .tt-edit-msg{padding:0 8px;max-width:46ch}
.tt-edit-bar .tt-edit-msg[data-kind=error]{color:#b3261e}
.tt-edit-bar button{all:unset;box-sizing:border-box;min-height:36px;padding:0 14px;display:inline-flex;align-items:center;border-radius:999px;border:1px solid #f0b9cf;cursor:pointer;font-weight:600}
.tt-edit-bar button.tt-primary{background:#b84c72;border-color:#b84c72;color:#fff}
.tt-edit-bar button:disabled{opacity:.45;cursor:default}
@media (max-width:560px){.tt-edit-bar{border-radius:18px;bottom:calc(76px + env(safe-area-inset-bottom,0px))}}
`;
  document.head.appendChild(style);
}

let bar = null;
let message = null;
const buttons = {};

function setMessage(text, kind = 'info') {
  if (!message) return;
  message.textContent = text;
  message.dataset.kind = kind;
}

function syncBar() {
  if (!bar) return;
  buttons.save.disabled = state.busy || !state.dirty;
  buttons.cancel.disabled = state.busy;
  buttons.preview.textContent = state.preview ? 'Seguir editando' : 'Vista previa';
}

function buildBar() {
  bar = document.createElement('div');
  bar.className = 'tt-edit-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Modo edición');
  message = document.createElement('span');
  message.className = 'tt-edit-msg';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const make = (key, label, onClick, cls = '') => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.className = cls;
    button.addEventListener('click', onClick);
    buttons[key] = button; return button;
  };
  bar.append(message,
    make('preview', 'Vista previa', togglePreview),
    make('cancel', 'Cancelar', cancel),
    make('save', 'Guardar', save, 'tt-primary'));
  document.body.appendChild(bar);
  syncBar();
}

function markDirty() {
  state.dirty = true;
  setMessage('Cambios sin guardar. Al guardar se publican en la tienda.');
  syncBar();
}

function togglePreview() {
  state.preview = !state.preview;
  document.documentElement.classList.toggle('tt-edit-preview', state.preview);
  document.querySelectorAll('[data-tt-edit-text]').forEach(node => { node.contentEditable = state.preview ? 'false' : editableValue(); });
  syncBar();
}

function editableValue() {
  return typeof CSS !== 'undefined' && CSS.supports?.('-webkit-user-modify', 'read-write-plaintext-only') ? 'plaintext-only' : 'true';
}

/* ---------- Texto en línea ---------- */

function findRoots(sectionSchema) {
  try { return [...document.querySelectorAll(sectionSchema.root)]; } catch { return []; }
}

function findTarget(root, item) {
  let matches = [];
  try {
    if (root.matches?.(item.selector)) matches.push(root);
    matches.push(...root.querySelectorAll(item.selector));
  } catch { return null; }
  return matches[item.index == null ? 0 : item.index] || null;
}

function readText(node, multiline) {
  const raw = multiline ? node.innerText : node.textContent;
  return String(raw || '').replace(/ /g, ' ').replace(/\r/g, '').replace(multiline ? /\n{3,}/g : /\s*\n\s*/g, multiline ? '\n\n' : ' ').trim();
}

function bindTextFields() {
  Object.entries(state.schema.sections).forEach(([sectionId, sectionSchema]) => {
    const seen = new Map();
    sectionSchema.fields.forEach(item => { if (item.type !== 'href') seen.set(`${item.selector}::${item.index ?? 0}`, item); });
    findRoots(sectionSchema).forEach(root => {
      seen.forEach(item => {
        const node = findTarget(root, item);
        if (!node || node.dataset.ttEditText || node.closest('.tt-edit-tools')) return;
        node.dataset.ttEditText = `${sectionId}.${item.key}`;
        node.contentEditable = state.preview ? 'false' : editableValue();
        node.spellcheck = true;
        const multiline = item.type === 'multiline';
        node.addEventListener('keydown', event => { if (event.key === 'Enter' && !multiline) event.preventDefault(); });
        node.addEventListener('paste', event => {
          event.preventDefault();
          const text = (event.clipboardData?.getData('text/plain') || '').replace(multiline ? /\r/g : /\s*\r?\n\s*/g, multiline ? '' : ' ');
          document.execCommand('insertText', false, text);
        });
        node.addEventListener('input', () => {
          const section = state.content[sectionId] || (state.content[sectionId] = {});
          const value = sanitizeContentText(normalizeContentValue(state.pageId, sectionId, item.key, readText(node, multiline)), item.maxLength);
          if (getNested(section, item.key) === value) return;
          setNested(section, item.key, value);
          markDirty();
        });
      });
    });
  });
}

/* ---------- Casillas + fotos ---------- */

let imageInput = null;

function pickImage(blockId, img) {
  if (!imageInput) {
    imageInput = document.createElement('input');
    imageInput.type = 'file'; imageInput.accept = 'image/jpeg,image/png,image/webp'; imageInput.hidden = true;
    document.body.appendChild(imageInput);
  }
  imageInput.value = '';
  imageInput.onchange = async () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    state.busy = true; syncBar(); setMessage('Subiendo foto…');
    try {
      const { uploadImageToLibrary } = await import('../../components/images/biblioteca-multimedia.js?v=tintin-20261030-audit-integrity-1');
      const result = await uploadImageToLibrary(file, { section: 'modo-edicion', alt: img.alt || '' });
      const block = state.config.customBlocks.find(item => item.id === blockId);
      if (!block) throw new Error('El bloque ya no existe.');
      block.image = result.url;
      render();
      markDirty();
    } catch (error) {
      setMessage(error?.message || 'No se pudo subir la foto.', 'error');
    } finally {
      state.busy = false; syncBar();
    }
  };
  imageInput.click();
}

function labelFor(kind, id) {
  if (kind === 'section') return state.schema.sections[id]?.label || id;
  const block = state.config.customBlocks.find(item => item.id === id);
  return block?.label || block?.title || block?.type || 'Bloque';
}

function addTools(node, kind, id, canMove) {
  if (node.querySelector(':scope > .tt-edit-tools')) return;
  node.classList.add('tt-edit-cell');
  const tools = document.createElement('div');
  tools.className = 'tt-edit-tools';
  tools.contentEditable = 'false';
  const label = document.createElement('span');
  label.textContent = labelFor(kind, id);
  tools.appendChild(label);
  [['top', '⤒', 'Llevar al inicio de la página'], ['up', '↑', 'Subir'], ['down', '↓', 'Bajar'], ['bottom', '⤓', 'Llevar al final de la página']].forEach(([to, glyph, title]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = glyph; button.title = title; button.setAttribute('aria-label', `${title}: ${label.textContent}`);
    button.disabled = !canMove || state.busy;
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); move(kind, id, to); });
    tools.appendChild(button);
  });
  node.prepend(tools);
}

function decorate() {
  const sectionIds = Object.keys(state.schema.sections);
  sectionIds.forEach(id => {
    const sectionSchema = state.schema.sections[id];
    if (sectionSchema.global || sectionSchema.visualEditable === false && sectionSchema.movable !== true) return;
    const roots = findRoots(sectionSchema);
    if (roots[0]) addTools(roots[0], 'section', id, sectionSchema.movable === true);
  });
  document.querySelectorAll('[data-tt-visual-block]').forEach(node => {
    const id = node.dataset.ttVisualBlock;
    addTools(node, 'block', id, true);
    const block = state.config.customBlocks.find(item => item.id === id);
    if (block && IMAGE_BLOCK_TYPES.has(block.type)) {
      node.querySelectorAll('img').forEach(img => {
        if (img.dataset.ttEditImg) return;
        img.dataset.ttEditImg = id;
        img.title = 'Clic para cambiar la foto';
        img.addEventListener('click', event => { if (state.preview) return; event.preventDefault(); event.stopPropagation(); pickImage(id, img); });
      });
    }
  });
  bindTextFields();
}

function render() {
  applyVisualBuilderConfig(state.pageId, state.config);
  decorate();
}

function move(kind, id, to) {
  if (state.busy) return;
  const before = JSON.stringify([state.config.sectionOrder, state.config.customBlocks]);
  if (kind === 'section') state.config.sectionOrder = moveSection(state.schema, state.config.sectionOrder, id, to);
  else state.config.customBlocks = moveBlock(state.schema, state.config.sectionOrder, state.config.customBlocks, id, to);
  if (JSON.stringify([state.config.sectionOrder, state.config.customBlocks]) === before) return;
  render();
  markDirty();
  const node = kind === 'section'
    ? findRoots(state.schema.sections[id])[0]
    : document.querySelector(`[data-tt-visual-block="${CSS.escape(id)}"]`);
  node?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/* ---------- Guardar / cancelar ---------- */

async function save() {
  if (!state.dirty || state.busy) return;
  state.busy = true; syncBar(); setMessage('Publicando…');
  try {
    const data = await api('POST', {
      action: 'publish', pageId: state.pageId, config: state.config, content: state.content,
      expectedVersion: state.version, expectedContentRevision: state.revision,
    });
    state.version = data.version; state.dirty = false;
    const fresh = await api('GET');
    state.revision = fresh.contentRevision;
    setMessage(`Publicado (versión ${data.version}). La tienda ya está actualizada.`);
  } catch (error) {
    setMessage(error?.message || 'No se pudo publicar.', 'error');
  } finally {
    state.busy = false; syncBar();
  }
}

function leave() {
  const url = new URL(location.href);
  url.searchParams.delete('ttEdit'); url.searchParams.delete('ttSection');
  location.assign(url.toString());
}

function cancel() {
  if (state.dirty && !confirm('¿Descartar los cambios sin guardar?')) return;
  state.dirty = false;
  leave();
}

/* ---------- Arranque ---------- */

async function start() {
  const pageId = detectContentPageId();
  const schema = pageId ? getPageSchema(pageId) : null;
  if (!schema) return;
  injectStyles();
  Object.assign(state, { pageId, schema });
  buildBar();
  setMessage('Cargando modo edición…');
  document.documentElement.classList.add('tt-edit-on');
  try {
    const data = await api('GET');
    state.version = data.state.version; state.revision = data.contentRevision;
    state.config = clone(data.state.config); state.content = clone(data.content);
    state.hasDraft = Boolean(data.draft);
    await initVisualBuilderRuntime(pageId);
    for (let i = 0; i < 35 && !['ready', 'fallback'].includes(document.documentElement.dataset.ttVisualBuilder || ''); i++) await new Promise(r => setTimeout(r, 100));
    render();
    window.addEventListener('tintin:visual-builder-ready', () => decorate());
    window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
    const target = new URLSearchParams(location.search).get('ttSection');
    const sectionSchema = target && schema.sections[target];
    findRoots(sectionSchema || {})[0]?.scrollIntoView({ block: 'start' });
    setMessage(state.hasDraft
      ? 'Modo edición. Hay un borrador del editor avanzado: al guardar se reemplaza por estos cambios.'
      : 'Modo edición: tocá un texto para escribir, una foto para cambiarla, o usá las flechas para mover.');
  } catch (error) {
    setMessage(error?.message || 'No se pudo cargar el modo edición.', 'error');
  }
  syncBar();
}

export function initEditMode() {
  if (!isEditModeRequested() || typeof document === 'undefined') return;
  let started = false;
  subscribeAuthState(user => {
    if (started || !user || user.isAnonymous || user.email !== SUPER_ADMIN) return;
    started = true;
    const run = () => start();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
  });
}

initEditMode();
