import { auth } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  CONTENT_PAGE_IDS, SITE_CONTENT_SCHEMA, getNested, getPageDefaults, getPageSchema,
  mergeContent, sanitizeContentHref, setNested,
} from '../../core/store/esquema-contenido.js?v=tintin-20260809-visual-builder-1';

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const defaultStyle = () => ({ background: '', textColor: '', accentColor: '', spacing: 'normal', width: 'contained', align: 'center', radius: 'none', shadow: 'none', animation: 'none' });
// Debe coincidir con VISUAL_TOP_ANCHOR en cloudflare/visual-builder-core.js.
const TOP_ANCHOR = '__top__';
const BLOCK_TYPE_LABELS = {
  banner: 'Banner', text: 'Texto', products: 'Productos reales', gallery: 'Galería', promotion: 'Promoción',
  button: 'Botón', section: 'Sección libre segura', collections: 'Colecciones', testimonial: 'Testimonio de clienta',
  video: 'Video', faq: 'Preguntas frecuentes', columns: 'Imagen y texto en columnas', divider: 'Separador',
};
let pageId = 'index';
let config = null;
let content = null;
let version = 0;
let contentRevision = '';
let history = [];
let selected = null;
let undoStack = [];
let redoStack = [];
let dirty = false;
let initialized = false;
let busyState = false;

function setStatus(message, kind = '') {
  const node = $('visual-status');
  node.textContent = message;
  node.className = `visual-editor-status${kind ? ` is-${kind}` : ''}`;
}

function defaultConfig(id) {
  return { pageId: id, sections: Object.fromEntries(Object.keys(getPageSchema(id)?.sections || {}).map(sectionId => [sectionId, defaultStyle()])), customBlocks: [] };
}

function normalizedConfig(raw) {
  const base = defaultConfig(pageId);
  Object.keys(base.sections).forEach(id => { base.sections[id] = { ...defaultStyle(), ...(raw?.sections?.[id] || {}) }; });
  base.customBlocks = Array.isArray(raw?.customBlocks) ? raw.customBlocks : [];
  return base;
}

async function api(method = 'GET', body) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN) throw new Error('Acceso exclusivo de Super Admin.');
  const token = await user.getIdToken();
  const url = method === 'GET' ? `/api/visual-builder?page=${encodeURIComponent(pageId)}` : '/api/visual-builder';
  const response = await fetch(url, {
    method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { code: data.code, status: response.status });
  return data;
}

function snapshot() { return clone({ config, content, selected }); }
function restoreSnapshot(value) { config = clone(value.config); content = clone(value.content); selected = clone(value.selected); dirty = true; renderAll(); }
function remember() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack = []; }
function changed(message = 'Tenés cambios sin publicar.') {
  dirty = true;
  setStatus(message);
  updateActions();
  postPreview();
}
function mutate(callback, options = {}) {
  remember(); callback(); changed(options.message); renderSectionList(); if (options.properties !== false) renderProperties();
}

function updateActions() {
  $('visual-undo').disabled = busyState || !undoStack.length;
  $('visual-redo').disabled = busyState || !redoStack.length;
  ['visual-save', 'visual-cancel', 'visual-publish'].forEach(id => { if ($(id)) $(id).disabled = busyState || !dirty; });
  ['visual-add', 'visual-page'].forEach(id => { if ($(id)) $(id).disabled = busyState; });
}
function busy(value) { busyState = value; updateActions(); if (value) setStatus('Procesando de forma segura…'); }

function make(tag, className = '', text = '') {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== '') node.textContent = text; return node;
}

function renderPages() {
  const select = $('visual-page'); select.replaceChildren();
  CONTENT_PAGE_IDS.forEach(id => { const option = make('option', '', SITE_CONTENT_SCHEMA[id].label); option.value = id; select.appendChild(option); });
  select.value = pageId;
}

function renderBlockTypeOptions() {
  const select = $('visual-new-block'); if (!select.childElementCount) {
    Object.entries(BLOCK_TYPE_LABELS).forEach(([type, label]) => { const option = make('option', '', label); option.value = type; select.appendChild(option); });
  }
}

function renderSectionList() {
  const root = $('visual-section-list'); root.replaceChildren();
  Object.entries(getPageSchema(pageId)?.sections || {}).forEach(([id, schema]) => {
    const row = make('div', 'visual-section-item');
    const button = make('button', `visual-section-select${selected?.kind === 'section' && selected.id === id ? ' active' : ''}`, schema.label);
    button.type = 'button'; button.dataset.kind = 'section'; button.dataset.id = id;
    const badge = make('span', 'visual-section-badge', 'existente'); button.appendChild(badge); row.appendChild(button); root.appendChild(row);
  });
  (config?.customBlocks || []).forEach((block, index) => {
    const row = make('div', 'visual-section-item');
    const button = make('button', `visual-section-select${selected?.kind === 'block' && selected.id === block.id ? ' active' : ''}`, block.title || `Bloque ${index + 1}`);
    button.type = 'button'; button.dataset.kind = 'block'; button.dataset.id = block.id;
    button.appendChild(make('span', 'visual-section-badge', BLOCK_TYPE_LABELS[block.type] || block.type)); row.appendChild(button); root.appendChild(row);
  });
}

function field(label, control, full = false) {
  const wrap = make('div', `visual-property${full ? ' full' : ''}`); const lab = make('label', '', label);
  if (control.id) lab.htmlFor = control.id; wrap.append(lab, control); return wrap;
}

function inputControl(value, onChange, options = {}) {
  const node = options.multiline ? document.createElement('textarea') : document.createElement('input');
  node.className = 'adm-input'; node.value = value ?? ''; node.maxLength = options.max || 1200;
  if (!options.multiline) node.type = options.type || 'text';
  node.addEventListener('input', () => mutate(() => onChange(node.value), { properties: false }));
  return node;
}

function selectControl(value, values, onChange) {
  const node = make('select', 'adm-select');
  values.forEach(([key, label]) => { const option = make('option', '', label); option.value = key; node.appendChild(option); });
  node.value = value; node.addEventListener('change', () => mutate(() => onChange(node.value), { properties: false })); return node;
}

function colorControl(style, key) {
  const row = make('div', 'visual-color-row'); const picker = document.createElement('input'); picker.type = 'color'; picker.value = /^#[0-9a-f]{6}$/i.test(style[key]) ? style[key] : '#ffffff';
  const text = document.createElement('input'); text.className = 'adm-input'; text.value = style[key] || ''; text.placeholder = 'Color original'; text.pattern = '#[0-9A-Fa-f]{6}';
  const reset = make('button', 'adm-btn adm-btn-outline adm-btn-sm visual-reset-color', '↺'); reset.type = 'button'; reset.title = 'Usar color original';
  picker.addEventListener('input', () => mutate(() => { style[key] = picker.value; }, { properties: false }));
  text.addEventListener('change', () => { const value = text.value.trim(); if (value && !/^#[0-9a-f]{6}$/i.test(value)) { setStatus('Usá un color hexadecimal completo, por ejemplo #fbe4ec.', 'error'); text.value = style[key] || ''; return; } mutate(() => { style[key] = value.toLowerCase(); }, { properties: false }); });
  reset.addEventListener('click', () => mutate(() => { style[key] = ''; }, {})); row.append(picker, text, reset); return row;
}

function appendStyleFields(grid, style) {
  grid.append(
    field('Fondo', colorControl(style, 'background'), true), field('Texto', colorControl(style, 'textColor'), true), field('Acento y botones', colorControl(style, 'accentColor'), true),
    field('Espacio', selectControl(style.spacing, [['compact','Compacto'],['normal','Normal'],['roomy','Amplio']], value => { style.spacing = value; })),
    field('Ancho', selectControl(style.width, [['contained','Contenido'],['wide','Ancho'],['full','Pantalla completa']], value => { style.width = value; })),
    field('Alineación', selectControl(style.align, [['left','Izquierda'],['center','Centro'],['right','Derecha']], value => { style.align = value; })),
    field('Bordes', selectControl(style.radius, [['none','Sin redondeo'],['small','Suave'],['medium','Medio'],['large','Grande']], value => { style.radius = value; })),
    field('Sombra', selectControl(style.shadow, [['none','Sin sombra'],['soft','Suave'],['medium','Marcada'],['large','Grande']], value => { style.shadow = value; })),
    field('Animación', selectControl(style.animation, [
      ['none','Sin animación'], ['fade','Aparecer'], ['slide-up','Subir suavemente'], ['slide-down','Bajar suavemente'],
      ['slide-left','Entrar desde la derecha'], ['slide-right','Entrar desde la izquierda'], ['scale','Zoom suave'], ['pop','Rebote suave'],
    ], value => { style.animation = value; }))
  );
}

function effectiveFields(schema) {
  const seen = new Map();
  schema.fields.forEach(item => seen.set(`${item.selector}:${item.index ?? 0}:${item.type === 'href' ? 'href' : 'text'}`, item));
  return [...seen.values()];
}

function renderExistingProperties(root, sectionId) {
  const schema = getPageSchema(pageId).sections[sectionId];
  root.appendChild(make('p', 'visual-property-help', `Sección existente: ${schema.label}. Los cambios se aplican sobre sus elementos reales.`));
  const values = content[sectionId] || {};
  const grid = make('div', 'visual-property-grid');
  if (schema.allowVisibility) {
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = values.visible !== false;
    checkbox.addEventListener('change', () => mutate(() => { values.visible = checkbox.checked; }, { properties: false }));
    grid.appendChild(field('Mostrar en la tienda', checkbox, true));
  }
  effectiveFields(schema).forEach(item => {
    const current = getNested(values, item.key) ?? item.default ?? '';
    const control = inputControl(current, value => {
      const safe = item.type === 'href' ? sanitizeContentHref(value, item.default || '') : String(value).slice(0, item.maxLength);
      setNested(values, item.key, safe);
    }, { multiline: item.type === 'multiline', type: item.type === 'href' ? 'url' : 'text', max: item.maxLength });
    grid.appendChild(field(item.label, control, true));
  });
  appendStyleFields(grid, config.sections[sectionId]); root.appendChild(grid);
}

const TEXT_BLOCK_LABELS = {
  testimonial: { eyebrow: 'Cargo o dato breve', title: 'Nombre de la clienta', text: 'Testimonio' },
  faq: { eyebrow: 'Texto pequeño (opcional)', title: 'Título de la lista', text: 'Introducción (opcional)' },
};

function renderBlockProperties(root, block) {
  const grid = make('div', 'visual-property-grid');
  const sectionOptions = [
    [TOP_ANCHOR, 'Arriba de todo (antes de la primera sección)'],
    ...Object.entries(getPageSchema(pageId).sections).map(([id, schema]) => [id, `Debajo de ${schema.label}`]),
  ];
  grid.appendChild(field('Ubicación', selectControl(block.afterSection, sectionOptions, value => { block.afterSection = value; }), true));
  if (block.type !== 'divider') {
    const labels = TEXT_BLOCK_LABELS[block.type] || { eyebrow: 'Texto pequeño', title: 'Título', text: 'Descripción' };
    grid.append(
      field(labels.eyebrow, inputControl(block.eyebrow, value => { block.eyebrow = value; }, { max: 80 }), true),
      field(labels.title, inputControl(block.title, value => { block.title = value; }, { max: 180 }), true),
      field(labels.text, inputControl(block.text, value => { block.text = value; }, { multiline: true, max: 1200 }), true)
    );
  } else {
    root.appendChild(make('p', 'visual-property-help', 'El separador solo usa una línea fina para marcar el corte entre secciones — no lleva texto.'));
  }
  if (['banner','promotion','button','section','columns'].includes(block.type)) {
    grid.append(field('Texto del botón', inputControl(block.buttonLabel, value => { block.buttonLabel = value; }, { max: 80 }), true), field('Destino del botón', inputControl(block.href, value => { block.href = value; }, { type: 'url', max: 500 }), true));
  }
  if (['banner','section','columns'].includes(block.type)) {
    grid.append(field('Imagen (Cloudinary o biblioteca)', inputControl(block.image, value => { block.image = value; }, { type: 'url', max: 1000 }), true), field('Descripción de imagen', inputControl(block.imageAlt, value => { block.imageAlt = value; }, { max: 140 }), true));
  }
  if (block.type === 'testimonial') {
    grid.append(field('Foto de la clienta (opcional)', inputControl(block.image, value => { block.image = value; }, { type: 'url', max: 1000 }), true));
  }
  if (block.type === 'columns') {
    grid.appendChild(field('Imagen a la', selectControl(block.imageSide, [['left','Izquierda'],['right','Derecha']], value => { block.imageSide = value; })));
  }
  if (block.type === 'video') {
    grid.appendChild(field('Video (link "insertar" de YouTube, Vimeo o Cloudinary)', inputControl(block.videoUrl, value => { block.videoUrl = value; }, { type: 'url', max: 500 }), true));
    root.appendChild(make('p', 'visual-property-help', 'Pegá el link para insertar/embed (por ejemplo https://www.youtube.com/embed/XXXXXXXXXXX), no el link normal del video.'));
  }
  if (['products','collections'].includes(block.type)) {
    const count = document.createElement('input'); count.className = 'adm-input'; count.type = 'number'; count.min = '1'; count.max = '8'; count.value = block.count || 4;
    count.addEventListener('change', () => mutate(() => { block.count = Math.max(1, Math.min(8, Number(count.value) || 4)); }, { properties: false }));
    grid.appendChild(field('Cantidad', count));
    if (block.type === 'products') grid.appendChild(field('Categoría (opcional)', inputControl(block.category, value => { block.category = value; }, { max: 120 })));
  }
  if (block.type === 'gallery') {
    const images = inputControl((block.images || []).map(item => `${item.src}|${item.alt || ''}`).join('\n'), value => {
      block.images = value.split('\n').slice(0, 8).map(line => { const [src, ...alt] = line.split('|'); return { src: src.trim(), alt: alt.join('|').trim() }; }).filter(item => item.src);
    }, { multiline: true, max: 8000 });
    grid.appendChild(field('Imágenes (una URL por línea; | descripción)', images, true));
  }
  if (block.type === 'faq') {
    const items = inputControl((block.items || []).map(item => `${item.q}|${item.a}`).join('\n'), value => {
      block.items = value.split('\n').slice(0, 8).map(line => { const [q, ...a] = line.split('|'); return { q: q.trim(), a: a.join('|').trim() }; }).filter(item => item.q && item.a);
    }, { multiline: true, max: 8000 });
    grid.appendChild(field('Preguntas y respuestas (una por línea: Pregunta | Respuesta)', items, true));
  }
  appendStyleFields(grid, block.style); root.appendChild(grid);
  const zone = make('div', 'visual-danger-zone');
  const index = config.customBlocks.findIndex(item => item.id === block.id);
  const last = config.customBlocks.length - 1;
  const reorder = (from, to) => mutate(() => { const [item] = config.customBlocks.splice(from, 1); config.customBlocks.splice(to, 0, item); });
  [['⇑ Al principio', 0], ['↑ Subir', index - 1], ['↓ Bajar', index + 1], ['⇓ Al final', last]].forEach(([label, target]) => {
    const button = make('button', 'adm-btn adm-btn-outline adm-btn-sm', label); button.type = 'button';
    button.disabled = target < 0 || target > last || target === index;
    button.addEventListener('click', () => reorder(index, target)); zone.appendChild(button);
  });
  const remove = make('button', 'adm-btn adm-btn-danger adm-btn-sm', 'Quitar bloque'); remove.type = 'button'; remove.addEventListener('click', () => { if (confirm('¿Quitar este bloque del borrador?')) mutate(() => { config.customBlocks = config.customBlocks.filter(item => item.id !== block.id); selected = { kind: 'section', id: Object.keys(getPageSchema(pageId).sections)[0] }; }); }); zone.appendChild(remove); root.appendChild(zone);
}

function renderProperties() {
  const root = $('visual-properties'); root.replaceChildren();
  if (!selected) { root.appendChild(make('div', 'visual-empty', 'Elegí una sección.')); return; }
  if (selected.kind === 'section') renderExistingProperties(root, selected.id);
  else { const block = config.customBlocks.find(item => item.id === selected.id); if (block) renderBlockProperties(root, block); }
}

function renderHistory() {
  const root = $('visual-history-list'); root.replaceChildren();
  if (!history.length) { root.appendChild(make('div', 'visual-empty', 'Todavía no hay versiones publicadas.')); return; }
  history.forEach(item => {
    const row = make('div', 'visual-history-item'); const info = make('div'); info.appendChild(make('strong', '', `Versión ${item.version} · ${item.action === 'restore' ? 'restauración' : 'publicación'}`));
    info.appendChild(make('small', '', `${item.actorEmail || ''} · ${new Date(item.createdAt).toLocaleString('es-PY')}`)); row.appendChild(info);
    if (['publish','restore'].includes(item.action) && item.version > 0) { const button = make('button', 'adm-btn adm-btn-outline adm-btn-sm', 'Restaurar'); button.type = 'button'; button.dataset.restore = item.id; row.appendChild(button); }
    root.appendChild(row);
  });
}

function postPreview() {
  const frame = $('visual-preview-frame');
  if (!frame?.contentWindow || !config || !content) return;
  frame.contentWindow.postMessage({ type: 'tintin:visual-preview', pageId, config, content }, location.origin);
}

function loadPreview() {
  const frame = $('visual-preview-frame'); const path = getPageSchema(pageId)?.path || 'index.html';
  frame.src = `${path}?ttVisualPreview=1`;
  frame.onload = () => { postPreview(); window.setTimeout(postPreview, 300); window.setTimeout(postPreview, 1200); };
}

function renderAll() {
  renderPages(); renderBlockTypeOptions(); renderSectionList(); renderProperties(); renderHistory(); $('visual-version').textContent = `Versión publicada: ${version}`; updateActions(); postPreview();
}

async function loadPage() {
  busy(true);
  try {
    const data = await api(); version = Number(data.state?.version || 0); contentRevision = String(data.contentRevision || ''); history = data.history || [];
    config = normalizedConfig(data.draft?.config || data.state?.config || {});
    content = clone(data.draft?.content || data.content || getPageDefaults(pageId));
    content = mergeContent(getPageDefaults(pageId), content);
    const first = Object.keys(getPageSchema(pageId).sections)[0]; selected = { kind: 'section', id: first };
    undoStack = []; redoStack = []; dirty = Boolean(data.draft); renderAll(); loadPreview();
    if (data.draft && (Number(data.draft.basedOnVersion) !== version || String(data.draft.basedOnContentRevision || '') !== contentRevision)) setStatus('Este borrador parte de una versión anterior. Revisalo antes de publicar.', 'error');
    else setStatus(data.draft ? 'Borrador recuperado. Nada está publicado todavía.' : 'Página lista para editar.', 'saved');
  } catch (error) { setStatus(error.message, 'error'); }
  finally { busy(false); }
}

function addBlock() {
  const type = $('visual-new-block').value; const ids = Object.keys(getPageSchema(pageId).sections);
  const block = {
    id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, afterSection: selected?.kind === 'section' ? selected.id : ids[0],
    eyebrow: 'TINTÍN', title: type === 'products' ? 'Productos destacados' : 'Nueva sección', text: '',
    buttonLabel: ['banner','promotion','button','section','columns'].includes(type) ? 'Ver más' : '', href: 'catalogo.html',
    image: '', imageAlt: '', count: 4, category: '', videoUrl: '', imageSide: 'left', images: [], items: [], style: defaultStyle(),
  };
  mutate(() => { config.customBlocks.push(block); selected = { kind: 'block', id: block.id }; });
}

async function saveDraft() {
  busy(true);
  try {
    await api('POST', { action: 'save', pageId, config, content });
    dirty = false;
    setStatus('Borrador guardado. La tienda pública no cambió.', 'saved');
    return true;
  } catch (error) {
    setStatus(error.message, 'error');
    return false;
  } finally { busy(false); }
}
async function publish() {
  const summary = `${Object.keys(config.sections).length} secciones existentes y ${config.customBlocks.length} bloques adicionales en ${getPageSchema(pageId).label}.`;
  if (!confirm(`Se publicarán los cambios de diseño y contenido como una versión nueva.\n\n${summary}\n\n¿Confirmás?`)) return;
  busy(true); try { const data = await api('POST', { action: 'publish', pageId, config, content, expectedVersion: version, expectedContentRevision: contentRevision }); version = data.version; dirty = false; undoStack = []; redoStack = []; setStatus(`Versión ${version} publicada correctamente.`, 'saved'); await loadPage(); } catch (error) { setStatus(error.message, 'error'); } finally { busy(false); }
}
async function cancel() {
  if (dirty && !confirm('¿Descartar el borrador y volver a la última versión publicada?')) return;
  busy(true); try { await api('POST', { action: 'cancel', pageId }); await loadPage(); setStatus('Borrador cancelado. La versión publicada no cambió.', 'saved'); } catch (error) { setStatus(error.message, 'error'); } finally { busy(false); }
}
async function restore(historyId) {
  if (!confirm('La versión elegida se publicará como una versión nueva. ¿Restaurar?')) return;
  busy(true); try { await api('POST', { action: 'restore', pageId, historyId, expectedVersion: version, expectedContentRevision: contentRevision }); await loadPage(); setStatus('Versión restaurada correctamente.', 'saved'); } catch (error) { setStatus(error.message, 'error'); } finally { busy(false); }
}

function bind() {
  $('visual-section-list').addEventListener('click', event => { const button = event.target.closest('[data-kind]'); if (!button) return; selected = { kind: button.dataset.kind, id: button.dataset.id }; renderSectionList(); renderProperties(); });
  $('visual-add').addEventListener('click', addBlock);
  $('visual-page').addEventListener('change', async event => {
    const nextPage = event.target.value;
    if (dirty) {
      if (!confirm('Hay cambios sin publicar. Se guardarán como borrador antes de cambiar de página. ¿Continuar?')) { event.target.value = pageId; return; }
      if (!await saveDraft()) { event.target.value = pageId; return; }
    }
    pageId = nextPage;
    await loadPage();
  });
  $('visual-save').addEventListener('click', saveDraft); $('visual-publish').addEventListener('click', publish); $('visual-cancel').addEventListener('click', cancel);
  $('visual-undo').addEventListener('click', () => { if (!undoStack.length) return; redoStack.push(snapshot()); restoreSnapshot(undoStack.pop()); });
  $('visual-redo').addEventListener('click', () => { if (!redoStack.length) return; undoStack.push(snapshot()); restoreSnapshot(redoStack.pop()); });
  document.querySelectorAll('[data-visual-device]').forEach(button => button.addEventListener('click', () => {
    $('visual-preview-stage').dataset.device = button.dataset.visualDevice;
    document.querySelectorAll('[data-visual-device]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  $('visual-history-list').addEventListener('click', event => { const button = event.target.closest('[data-restore]'); if (button) restore(button.dataset.restore); });
  window.addEventListener('beforeunload', event => { if (!dirty) return; event.preventDefault(); event.returnValue = ''; });
  window.AdminUnsaved?.register?.('visual-builder', { hasChanges: () => dirty, message: 'CAMBIOS SIN PUBLICAR en el editor visual.' });
}

onAuthStateChanged(auth, user => {
  const allowed = String(user?.email || '').trim().toLowerCase() === SUPER_ADMIN;
  $('visual-editor').hidden = !allowed;
  if (!allowed || initialized) return;
  initialized = true; bind(); loadPage();
});
