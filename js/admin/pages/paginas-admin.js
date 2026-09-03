import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SUPER_ADMIN = 'tintinaccs@gmail.com';
const ROOT_ID = 'tt-pages-admin-root';
let pages = [];
let customPages = [];
let unsubscribe = null;
let editing = null;
let ready = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const slugify = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const cleanHtml = value => String(value || '').slice(0, 100000);
const dateLabel = value => { try { const date = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-PY', { dateStyle:'medium', timeStyle:'short' }).format(date); } catch { return '—'; } };

// Rutas que ya forman parte del sitio. Se muestran en el mismo inventario que
// las páginas creadas desde Firestore, pero se mantienen como "Sistema": no se
// pueden borrar ni editar desde este CRUD para evitar romper la aplicación.
const BUILTIN_PAGES = [
  ['Inicio', '/', 'index.html'],
  ['Catálogo', '/catalogo', 'catalogo.html'],
  ['Colecciones', '/collections', 'collections.html'],
  ['Producto', '/product', 'product.html'],
  ['Checkout', '/checkout', 'checkout.html'],
  ['Nosotros', '/nosotros', 'nosotros.html'],
  ['Sobre Tintin', '/about', 'about.html'],
  ['Contacto', '/contact', 'contact.html'],
  ['Preguntas frecuentes', '/preguntas-frecuentes', 'preguntas-frecuentes.html'],
  ['Envíos', '/envios', 'envios.html'],
  ['Cambios y devoluciones', '/cambios-devoluciones', 'cambios-devoluciones.html'],
  ['Privacidad', '/privacidad', 'privacidad.html'],
  ['Términos y condiciones', '/terminos', 'terminos.html'],
  ['Ingreso', '/login', 'login.html'],
  ['Perfil', '/perfil', 'perfil.html'],
  ['Página no encontrada', '/404', '404.html'],
].map(([title, slug, path]) => ({ id:`builtin:${slug}`, title, slug, path, pageType:'builtin', published:true, template:'Tintin', updatedAt:null }));

function root() { return document.getElementById(ROOT_ID); }
function canUse() { return String(auth.currentUser?.email || '').toLowerCase() === SUPER_ADMIN; }
function showError(message) { const el = document.getElementById('tt-pages-error'); if (el) { el.textContent = message; el.classList.add('is-visible'); } }
function clearError() { document.getElementById('tt-pages-error')?.classList.remove('is-visible'); }

function render() {
  const host = root();
  if (!host || !canUse()) return;
  if (editing) { renderEditor(host); return; }
  const query = String(document.getElementById('tt-pages-search')?.value || '').toLowerCase().trim();
  const filter = document.getElementById('tt-pages-filter')?.value || 'all';
  const filtered = pages.filter(page => (!query || `${page.title} ${page.slug}`.toLowerCase().includes(query)) && (filter === 'all' || (filter === 'live' ? page.published !== false : page.published === false)));
  host.innerHTML = `<div class="tt-pages-admin">
    <div class="tt-pages-head"><div><h2>Páginas</h2><p>Administrá las páginas existentes de Tintin y creá nuevas páginas personalizadas desde un solo módulo.</p></div><div class="tt-pages-actions"><button type="button" class="adm-btn adm-btn-primary" id="tt-pages-new">+ Nueva página</button></div></div>
    <div class="tt-pages-toolbar"><div class="tt-pages-filters"><input class="adm-input" id="tt-pages-search" type="search" placeholder="Buscar por título o slug…" value="${esc(query)}"><select class="adm-input" id="tt-pages-filter"><option value="all" ${filter==='all'?'selected':''}>Todas</option><option value="live" ${filter==='live'?'selected':''}>Publicadas</option><option value="draft" ${filter==='draft'?'selected':''}>Borradores</option></select></div><span class="adm-badge">${filtered.length} de ${pages.length}</span></div>
    <div class="tt-pages-notice">Las páginas del sistema son las rutas que ya existen en la web. Las personalizadas se publican en <strong>/pages/slug</strong>; los borradores no son visibles públicamente.</div>
    <div class="tt-pages-table">${filtered.length ? `<table><thead><tr><th>Título</th><th>Tipo</th><th>Visibilidad</th><th>Plantilla</th><th>Actualización</th><th></th></tr></thead><tbody>${filtered.map(page => { const builtin = page.pageType === 'builtin'; const href = builtin ? page.path : `/pages/${encodeURIComponent(page.slug)}`; return `<tr><td><span class="tt-pages-title">${esc(page.title || page.slug)}</span><span class="tt-pages-slug">${esc(href)}</span></td><td><span class="tt-pages-status ${builtin ? 'is-system' : 'is-custom'}">${builtin ? 'Sistema' : 'Personalizada'}</span></td><td><span class="tt-pages-status ${page.published !== false ? 'is-live':'is-draft'}">${page.published !== false ? 'Publicada':'Borrador'}</span></td><td>${esc(page.template || 'standard')}</td><td>${esc(dateLabel(page.updatedAt))}</td><td><div class="tt-pages-actions-cell">${builtin ? `<a class="adm-btn adm-btn-sm" href="${esc(href)}" target="_blank" rel="noopener">Ver</a>` : `<button type="button" class="adm-btn adm-btn-sm" data-page-edit="${esc(page.slug)}">Editar</button>${page.published !== false ? `<a class="adm-btn adm-btn-sm" href="${esc(href)}" target="_blank" rel="noopener">Ver</a>`:''}<button type="button" class="adm-btn adm-btn-sm" data-page-duplicate="${esc(page.slug)}">Duplicar</button><button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-page-delete="${esc(page.slug)}">Eliminar</button>`}</div></td></tr>`; }).join('')}</tbody></table>` : '<div class="tt-pages-empty">No se encontraron páginas con esos filtros.</div>'}</div>
  </div>`;
  host.querySelector('#tt-pages-new')?.addEventListener('click', () => openEditor());
  host.querySelector('#tt-pages-search')?.addEventListener('input', render);
  host.querySelector('#tt-pages-filter')?.addEventListener('change', render);
  host.querySelectorAll('[data-page-edit]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.pageEdit)));
  host.querySelectorAll('[data-page-duplicate]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.pageDuplicate, true)));
  host.querySelectorAll('[data-page-delete]').forEach(button => button.addEventListener('click', () => removePage(button.dataset.pageDelete)));
}

function renderEditor(host) {
  const page = editing.data;
  const isNew = !editing.original;
  host.innerHTML = `<div class="tt-pages-admin tt-pages-editor"><div class="tt-pages-editor-head"><div><h2>${isNew ? 'Nueva página' : 'Editar página'}</h2><p>Configurá contenido, URL, SEO y publicación.</p></div><button type="button" class="adm-btn" id="tt-pages-back">← Volver a páginas</button></div><div id="tt-pages-error" class="tt-pages-error"></div><div class="adm-card"><div class="adm-card-body"><div class="tt-pages-form-grid"><div class="tt-pages-field"><label for="tt-page-title">Título *</label><input id="tt-page-title" class="adm-input" maxlength="120" value="${esc(page.title)}" placeholder="Ej: Guía de regalos Tintin"></div><div class="tt-pages-field"><label for="tt-page-slug">Slug *</label><input id="tt-page-slug" class="adm-input" maxlength="120" value="${esc(page.slug)}" placeholder="guia-de-regalos"><small>Solo minúsculas, números y guiones. La URL será /pages/slug.</small></div><div class="tt-pages-field full"><label for="tt-page-content">Contenido</label><textarea id="tt-page-content" class="adm-input" maxlength="100000" placeholder="Escribí el contenido de la página…">${esc(page.contentHtml)}</textarea><small>HTML básico permitido: títulos, párrafos, listas, enlaces e imágenes. No incluyas scripts.</small></div><div class="tt-pages-field"><label for="tt-page-template">Plantilla</label><select id="tt-page-template" class="adm-input"><option value="standard" ${page.template==='standard'?'selected':''}>Tintin estándar</option><option value="editorial" ${page.template==='editorial'?'selected':''}>Editorial</option><option value="minimal" ${page.template==='minimal'?'selected':''}>Minimal</option></select></div><div class="tt-pages-field"><label>Visibilidad</label><label class="tt-pages-toggle"><input id="tt-page-published" type="checkbox" class="tt-mini-switch" ${page.published !== false ? 'checked':''}> Publicada en el sitio</label></div><div class="tt-pages-field full"><label for="tt-page-meta-title">Título SEO</label><input id="tt-page-meta-title" class="adm-input" maxlength="160" value="${esc(page.metaTitle)}" placeholder="Título que verá Google"><label for="tt-page-meta-description">Descripción SEO</label><textarea id="tt-page-meta-description" class="adm-input" rows="3" maxlength="320" placeholder="Descripción breve para buscadores…">${esc(page.metaDescription)}</textarea></div></div><div class="tt-pages-preview"><strong>URL pública</strong><a id="tt-page-preview-link" href="/pages/${encodeURIComponent(page.slug || 'nuevo')}" target="_blank" rel="noopener">/pages/${esc(page.slug || 'nuevo')}</a></div><div class="tt-pages-actions"><button type="button" class="adm-btn adm-btn-primary" id="tt-pages-save">Guardar página</button><button type="button" class="adm-btn" id="tt-pages-cancel">Cancelar</button></div></div></div></div>`;
  host.querySelector('#tt-pages-back')?.addEventListener('click', closeEditor);
  host.querySelector('#tt-pages-cancel')?.addEventListener('click', closeEditor);
  host.querySelector('#tt-page-title')?.addEventListener('input', event => { if (isNew && !page.slug) { page.slug = slugify(event.target.value); const input = host.querySelector('#tt-page-slug'); if (input) input.value = page.slug; updatePreviewLink(); } });
  host.querySelector('#tt-page-slug')?.addEventListener('input', event => { event.target.value = slugify(event.target.value); updatePreviewLink(); });
  host.querySelector('#tt-pages-save')?.addEventListener('click', savePage);
  function updatePreviewLink() { const slug = slugify(host.querySelector('#tt-page-slug')?.value || 'nuevo'); const link = host.querySelector('#tt-page-preview-link'); if (link) { link.href = `/pages/${encodeURIComponent(slug)}`; link.textContent = `/pages/${slug}`; } }
}

function openEditor(slug = '', duplicate = false) {
  if (!canUse()) return;
  const source = pages.find(page => page.slug === slug);
  const data = source ? { ...source, ...(duplicate ? { title: `${source.title} (copia)`, slug: `${source.slug}-copia`, published: false } : {}) } : { title:'', slug:'', contentHtml:'', template:'standard', published:false, metaTitle:'', metaDescription:'' };
  editing = { original: duplicate ? null : source, data };
  render();
  document.getElementById('tt-page-title')?.focus();
}
function closeEditor() { editing = null; clearError(); render(); }

async function savePage() {
  if (!canUse() || !editing) return;
  clearError();
  const title = String(document.getElementById('tt-page-title')?.value || '').trim().slice(0, 120);
  const slug = slugify(document.getElementById('tt-page-slug')?.value || '');
  if (!title || !slug) return showError('Completá un título y un slug válido.');
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return showError('El slug solo puede contener minúsculas, números y guiones.');
  if (pages.some(page => page.slug === slug && page.slug !== editing.original?.slug)) return showError('Ya existe una página con ese slug.');
  const button = document.getElementById('tt-pages-save');
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
  try {
    const payload = { pageType:'custom', title, slug, contentHtml:cleanHtml(document.getElementById('tt-page-content')?.value), template:document.getElementById('tt-page-template')?.value || 'standard', published:document.getElementById('tt-page-published')?.checked === true, metaTitle:String(document.getElementById('tt-page-meta-title')?.value || '').trim().slice(0,160), metaDescription:String(document.getElementById('tt-page-meta-description')?.value || '').trim().slice(0,320), updatedAt:serverTimestamp(), updatedBy:auth.currentUser.email.toLowerCase() };
    if (editing.original?.slug && editing.original.slug !== slug) await deleteDoc(doc(db, 'site_content', editing.original.slug));
    await setDoc(doc(db, 'site_content', slug), payload, { merge:true });
    window.logAudit?.(editing.original ? 'editar_pagina' : 'crear_pagina', 'pagina', slug, title, `Página ${editing.original ? 'editada':'creada'}`, { published:payload.published });
    editing = null; window.toast?.('Página guardada correctamente');
  } catch (error) { showError(error?.message || 'No se pudo guardar la página.'); if (button) { button.disabled = false; button.textContent = 'Guardar página'; } }
}

async function removePage(slug) {
  if (!canUse() || !confirm(`¿Eliminar definitivamente la página “${slug}”?`)) return;
  try { await deleteDoc(doc(db, 'site_content', slug)); window.logAudit?.('eliminar_pagina', 'pagina', slug, slug, 'Página eliminada'); window.toast?.('Página eliminada'); } catch (error) { window.toast?.(`No se pudo eliminar: ${error?.message || error}`); }
}

function subscribe() {
  if (unsubscribe || !canUse()) return;
  unsubscribe = onSnapshot(collection(db, 'site_content'), snapshot => { customPages = snapshot.docs.map(item => ({ id:item.id, ...item.data() })).filter(page => page.pageType === 'custom').sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'es')); pages = [...BUILTIN_PAGES, ...customPages]; ready = true; render(); }, error => { ready = false; pages = [...BUILTIN_PAGES]; const host = root(); if (host) { render(); host.insertAdjacentHTML('afterbegin', `<div class="tt-pages-error is-visible">No se pudieron cargar las páginas personalizadas: ${esc(error?.message || error)}</div>`); } });
}

window.TintinPagesAdminRefresh = () => { if (canUse()) { subscribe(); render(); } };
onAuthStateChanged(auth, user => { if (String(user?.email || '').toLowerCase() === SUPER_ADMIN) { subscribe(); render(); } });
