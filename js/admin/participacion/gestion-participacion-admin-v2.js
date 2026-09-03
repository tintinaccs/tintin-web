import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, limit, onSnapshot, query, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SUPER_ADMIN = 'tintinaccs@gmail.com';
const DEFAULT_SETTINGS = {
  autoMarkSeenReviews: true,
  autoMarkSeenLikes: true,
  showProductImages: true,
  denseMode: false,
  confirmDestructive: true,
  reviewPageSize: 20,
  likePageSize: 24,
  reviewDefaultSort: 'newest',
  likeDefaultSort: 'newest',
  rememberView: true,
};
const DEFAULT_QUICK_REPLIES = [
  'Gracias por compartir tu experiencia.',
  'Nos alegra mucho que te haya gustado.',
  'Gracias por avisarnos. Te escribiremos para ayudarte.',
];
const ENGAGEMENT_REALTIME_LIMIT = 250;

let user = null;
let reviews = [];
let likes = [];
let usersByUid = new Map();
let quickReplies = [...DEFAULT_QUICK_REPLIES];
let settings = { ...DEFAULT_SETTINGS };
let reviewPage = 1;
let likePage = 1;
let reviewView = 'inbox';
let likeView = 'activity';
let selectedReviews = new Set();
let selectedLikes = new Set();
let currentDrawer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const asDate = value => value?.toDate?.() || (value instanceof Date ? value : value ? new Date(value) : null);
const timeValue = value => asDate(value)?.getTime?.() || 0;
const formatDate = value => {
  const date = asDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin fecha';
};
const formatShortDate = value => {
  const date = asDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sin fecha';
};
const daysAgo = (value, days) => {
  if (days === 'all') return true;
  const timestamp = timeValue(value);
  return timestamp >= Date.now() - Number(days) * 86400000;
};
const isToday = value => {
  const date = asDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(item => item[0] || '').join('').toUpperCase() || '?';
const stars = rating => `<span class="eg-stars" aria-label="${Number(rating) || 0} de 5 estrellas">${'★'.repeat(Math.max(0, Math.min(5, Number(rating) || 0)))}${'☆'.repeat(Math.max(0, 5 - (Number(rating) || 0)))}</span>`;
const safeUrl = value => {
  const raw = String(value || '').trim();
  return /^(https?:)?\/\//i.test(raw) || raw.startsWith('/') ? raw : '';
};
const productHref = (productId, reviewId = '') => `/product?id=${encodeURIComponent(productId || '')}${reviewId ? `#review-${encodeURIComponent(reviewId)}` : ''}`;

async function api(input) {
  if (!user) throw new Error('Sesión no disponible');
  const token = await user.getIdToken();
  const response = await fetch('/api/admin-engagement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo guardar el cambio');
  return result;
}

function profileFor(uid) {
  return usersByUid.get(String(uid || '')) || {};
}
function profileName(item) {
  const profile = profileFor(item.ownerUid);
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    || profile.name || profile.displayName || item.realName || 'Clienta Tintin';
}
function avatarMarkup(item, size = 'md') {
  const profile = profileFor(item.ownerUid);
  const photo = safeUrl(profile.photoURL || item.actorPhotoUrl);
  const name = profileName(item);
  if (photo) return `<img class="eg-avatar eg-avatar-${size}" src="${escapeHtml(photo)}" alt="" loading="lazy">`;
  return `<span class="eg-avatar eg-avatar-${size} eg-avatar-fallback" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}
function productImage(item, size = 'card') {
  if (!settings.showProductImages) return '';
  const image = safeUrl(item.productImageUrl);
  if (!image) return `<span class="eg-product-image eg-product-image-${size} eg-product-image-empty" aria-hidden="true">◇</span>`;
  return `<img class="eg-product-image eg-product-image-${size}" src="${escapeHtml(image)}" alt="" loading="lazy">`;
}
function badge(text, tone = 'neutral') {
  return `<span class="eg-badge eg-badge-${tone}">${escapeHtml(text)}</span>`;
}
function reviewStatusBadges(review) {
  const result = [];
  if (review.deleted) result.push(badge('Eliminada', 'danger'));
  else if (review.adminArchived) result.push(badge('Archivada', 'muted'));
  else if (review.visible) result.push(badge('Publicada', 'success'));
  else result.push(badge('Oculta', 'warning'));
  if (review.unread) result.push(badge('Nueva', 'accent'));
  if (review.adminPinned) result.push(badge('Destacada', 'accent'));
  if (review.storeLiked) result.push(badge('Le gusta a Tintin', 'pink'));
  return result.join('');
}
function likeStatusBadges(item) {
  const result = [];
  if (item.archived) result.push(badge('Archivado', 'muted'));
  else result.push(badge('Favorito activo', 'success'));
  if (item.unread) result.push(badge('Nuevo', 'accent'));
  return result.join('');
}
function reviewNeedsReply(review) {
  if (review.deleted) return false;
  const conversation = Array.isArray(review.conversation) ? review.conversation : [];
  if (!conversation.length) return true;
  return conversation.at(-1)?.authorType !== 'store';
}
function reviewHasStoreReply(review) {
  return (review.conversation || []).some(item => item.authorType === 'store');
}

function hydrateSections() {
  const reviewsSection = $('#section-resenas');
  const likesSection = $('#section-me-gusta');
  if (reviewsSection) {
    reviewsSection.innerHTML = `
      <div class="eg-shell" data-eg-module="reviews">
        <header class="eg-page-head">
          <div>
            <div class="eg-eyebrow">Participación</div>
            <h1>Reseñas</h1>
            <p>Moderá opiniones, respondé conversaciones y detectá qué productos generan mejores experiencias.</p>
          </div>
          <div class="eg-head-actions">
            <button type="button" class="adm-btn adm-btn-outline" data-eg-export="reviews">Exportar CSV</button>
            <button type="button" class="adm-btn adm-btn-primary" data-eg-review-view="settings">Configuración</button>
          </div>
        </header>
        <div class="eg-kpis" id="eg-review-kpis"></div>
        <nav class="eg-segments" aria-label="Vistas de reseñas">
          <button type="button" data-eg-review-view="inbox">Bandeja</button>
          <button type="button" data-eg-review-view="products">Productos</button>
          <button type="button" data-eg-review-view="clients">Clientas</button>
          <button type="button" data-eg-review-view="analytics">Analítica</button>
          <button type="button" data-eg-review-view="settings">Configuración</button>
        </nav>

        <section data-eg-review-panel="inbox">
          <div class="eg-toolbar">
            <label class="eg-search"><span>Buscar</span><input class="adm-input" id="reviews-search" type="search" placeholder="Clienta, correo, producto, comentario…"></label>
            <label><span>Estado</span><select class="adm-select" id="reviews-filter">
              <option value="all">Todas</option><option value="unread">Nuevas</option><option value="visible">Publicadas</option>
              <option value="hidden">Ocultas</option><option value="archived">Archivadas</option><option value="deleted">Eliminadas</option>
            </select></label>
            <label><span>Puntuación</span><select class="adm-select" id="reviews-rating">
              <option value="all">Todas</option><option value="5">5 estrellas</option><option value="4">4 estrellas</option>
              <option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option>
            </select></label>
            <label><span>Respuesta</span><select class="adm-select" id="reviews-reply">
              <option value="all">Todas</option><option value="pending">Sin responder</option><option value="answered">Respondidas</option>
              <option value="customer-last">Clienta respondió última</option>
            </select></label>
            <label><span>Periodo</span><select class="adm-select" id="reviews-period">
              <option value="all">Todo el historial</option><option value="1">Hoy / 24 h</option><option value="7">7 días</option>
              <option value="30">30 días</option><option value="90">90 días</option>
            </select></label>
            <label><span>Orden</span><select class="adm-select" id="reviews-sort">
              <option value="newest">Más nuevas</option><option value="oldest">Más antiguas</option><option value="rating-desc">Mejor puntuación</option>
              <option value="rating-asc">Peor puntuación</option><option value="likes-desc">Más Me gusta</option>
            </select></label>
          </div>
          <div class="eg-filter-chips" id="eg-review-quick-filters">
            <button type="button" data-review-quick="unread">Nuevas</button>
            <button type="button" data-review-quick="pending">Sin responder</button>
            <button type="button" data-review-quick="low">1–2 estrellas</button>
            <button type="button" data-review-quick="hidden">Ocultas</button>
            <button type="button" data-review-quick="storeLiked"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.6 6.6 4.6 5.1c2.2-1.1 4.6-.4 6 1.4l1.4 1.8 1.4-1.8c1.4-1.8 3.8-2.5 6-1.4 3 1.5 3.6 5 1.9 7.8C18.7 16.65 12 21 12 21z"/></svg> Tintin</button>
          </div>
          <div class="eg-bulkbar" id="eg-review-bulk" hidden>
            <strong id="eg-review-selected-count">0 seleccionadas</strong>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-review-bulk="seen">Marcar leídas</button>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-review-bulk="publish">Publicar</button>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-review-bulk="hide">Ocultar</button>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-review-bulk="archive">Archivar</button>
            <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-eg-review-bulk="delete">Eliminar</button>
            <button type="button" class="eg-link-btn" data-eg-review-bulk="clear">Limpiar selección</button>
          </div>
          <div id="reviews-admin-list" class="eg-list"><div class="eg-empty">Cargando reseñas…</div></div>
          <div class="eg-pagination" id="eg-review-pagination"></div>
        </section>

        <section data-eg-review-panel="products" hidden><div id="eg-review-products"></div></section>
        <section data-eg-review-panel="clients" hidden><div id="eg-review-clients"></div></section>
        <section data-eg-review-panel="analytics" hidden><div id="eg-review-analytics"></div></section>
        <section data-eg-review-panel="settings" hidden><div id="eg-review-settings"></div></section>
      </div>`;
  }
  if (likesSection) {
    likesSection.innerHTML = `
      <div class="eg-shell" data-eg-module="likes">
        <header class="eg-page-head">
          <div>
            <div class="eg-eyebrow">Interés comercial</div>
            <h1>Me gusta</h1>
            <p>Entendé qué desean tus clientas, qué productos acumulan favoritos y administrá la actividad sin alterar sus listas por accidente.</p>
          </div>
          <div class="eg-head-actions">
            <button type="button" class="adm-btn adm-btn-outline" data-eg-export="likes">Exportar CSV</button>
            <button type="button" class="adm-btn adm-btn-primary" data-eg-like-view="settings">Configuración</button>
          </div>
        </header>
        <div class="eg-kpis" id="eg-like-kpis"></div>
        <nav class="eg-segments" aria-label="Vistas de Me gusta">
          <button type="button" data-eg-like-view="activity">Actividad</button>
          <button type="button" data-eg-like-view="products">Productos</button>
          <button type="button" data-eg-like-view="clients">Clientas</button>
          <button type="button" data-eg-like-view="analytics">Analítica</button>
          <button type="button" data-eg-like-view="settings">Configuración</button>
        </nav>

        <section data-eg-like-panel="activity">
          <div class="eg-toolbar">
            <label class="eg-search"><span>Buscar</span><input class="adm-input" id="likes-search" type="search" placeholder="Clienta, correo o producto…"></label>
            <label><span>Estado</span><select class="adm-select" id="likes-filter">
              <option value="active">Favoritos activos</option><option value="all">Todos</option><option value="unread">Nuevos</option><option value="archived">Archivados</option>
            </select></label>
            <label><span>Periodo</span><select class="adm-select" id="likes-period">
              <option value="all">Todo el historial</option><option value="1">Hoy / 24 h</option><option value="7">7 días</option>
              <option value="30">30 días</option><option value="90">90 días</option>
            </select></label>
            <label><span>Orden</span><select class="adm-select" id="likes-sort">
              <option value="newest">Más nuevos</option><option value="oldest">Más antiguos</option><option value="product">Producto A–Z</option><option value="client">Clienta A–Z</option>
            </select></label>
          </div>
          <div class="eg-bulkbar" id="eg-like-bulk" hidden>
            <strong id="eg-like-selected-count">0 seleccionados</strong>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-like-bulk="seen">Marcar leídos</button>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-like-bulk="archive">Archivar actividad</button>
            <button type="button" class="adm-btn adm-btn-sm" data-eg-like-bulk="restore">Desarchivar</button>
            <button type="button" class="eg-link-btn" data-eg-like-bulk="clear">Limpiar selección</button>
          </div>
          <div class="eg-callout"><strong>Importante:</strong> Archivar solo organiza este panel. “Quitar de favoritos” sí modifica la lista de la clienta y está separado dentro de las acciones avanzadas.</div>
          <div id="likes-admin-list" class="eg-list eg-list-likes"><div class="eg-empty">Cargando Me gusta…</div></div>
          <div class="eg-pagination" id="eg-like-pagination"></div>
        </section>
        <section data-eg-like-panel="products" hidden><div id="eg-like-products"></div></section>
        <section data-eg-like-panel="clients" hidden><div id="eg-like-clients"></div></section>
        <section data-eg-like-panel="analytics" hidden><div id="eg-like-analytics"></div></section>
        <section data-eg-like-panel="settings" hidden><div id="eg-like-settings"></div></section>
      </div>`;
  }

  if (!$('#eg-drawer-root')) document.body.insertAdjacentHTML('beforeend', '<div id="eg-drawer-root"></div><div id="eg-modal-root"></div><div id="eg-toast-root" aria-live="polite"></div>');
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(count);
  el.hidden = count === 0;
}
function toast(message, tone = 'success') {
  const root = $('#eg-toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `eg-toast eg-toast-${tone}`;
  node.textContent = message;
  root.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => { node.classList.remove('is-visible'); setTimeout(() => node.remove(), 220); }, 3200);
}

function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
  if (!settings.confirmDestructive) return Promise.resolve(true);
  return new Promise(resolve => {
    const root = $('#eg-modal-root');
    root.innerHTML = `<div class="eg-modal-backdrop" data-eg-modal-close>
      <div class="eg-modal" role="dialog" aria-modal="true" aria-labelledby="eg-confirm-title">
        <div class="eg-modal-icon ${danger ? 'is-danger' : ''}">${danger ? '!' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'}</div>
        <h2 id="eg-confirm-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="eg-modal-actions">
          <button type="button" class="adm-btn adm-btn-outline" data-eg-confirm="no">Cancelar</button>
          <button type="button" class="adm-btn ${danger ? 'adm-btn-danger' : 'adm-btn-primary'}" data-eg-confirm="yes">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    </div>`;
    const finish = value => { root.innerHTML = ''; resolve(value); };
    root.onclick = event => {
      if (event.target.closest('[data-eg-confirm="yes"]')) finish(true);
      else if (event.target.closest('[data-eg-confirm="no"]') || event.target.matches('[data-eg-modal-close]')) finish(false);
    };
  });
}

function editReviewDialog(review) {
  return new Promise(resolve => {
    const root = $('#eg-modal-root');
    root.innerHTML = `<div class="eg-modal-backdrop">
      <form class="eg-modal eg-modal-wide" id="eg-review-edit-form">
        <div class="eg-modal-head"><div><div class="eg-eyebrow">Edición administrativa</div><h2>Editar reseña</h2></div><button type="button" class="eg-icon-btn" data-eg-edit-cancel aria-label="Cerrar">×</button></div>
        <label class="eg-field"><span>Puntuación</span><select class="adm-select" name="rating">${[5,4,3,2,1].map(n => `<option value="${n}" ${Number(review.rating) === n ? 'selected' : ''}>${n} estrella${n === 1 ? '' : 's'}</option>`).join('')}</select></label>
        <label class="eg-field"><span>Comentario</span><textarea class="adm-input eg-textarea" name="comment" rows="7" maxlength="1600" required>${escapeHtml(review.comment)}</textarea></label>
        <div class="eg-callout">La edición queda registrada en el historial interno de la reseña.</div>
        <div class="eg-modal-actions"><button type="button" class="adm-btn adm-btn-outline" data-eg-edit-cancel>Cancelar</button><button class="adm-btn adm-btn-primary" type="submit">Guardar cambios</button></div>
      </form>
    </div>`;
    const finish = value => { root.innerHTML = ''; resolve(value); };
    $$('[data-eg-edit-cancel]', root).forEach(button => button.onclick = () => finish(null));
    $('#eg-review-edit-form', root).onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      finish({ rating: Number(form.get('rating')), comment: String(form.get('comment') || '').trim() });
    };
  });
}

function switchReviewView(view) {
  reviewView = view;
  $$('[data-eg-review-view]').forEach(button => button.classList.toggle('is-active', button.dataset.egReviewView === view));
  $$('[data-eg-review-panel]').forEach(panel => { panel.hidden = panel.dataset.egReviewPanel !== view; });
  if (settings.rememberView) localStorage.setItem('tt-admin-review-view', view);
  if (view === 'settings') renderSettings();
}
function switchLikeView(view) {
  likeView = view;
  $$('[data-eg-like-view]').forEach(button => button.classList.toggle('is-active', button.dataset.egLikeView === view));
  $$('[data-eg-like-panel]').forEach(panel => { panel.hidden = panel.dataset.egLikePanel !== view; });
  if (settings.rememberView) localStorage.setItem('tt-admin-like-view', view);
  if (view === 'settings') renderSettings();
}

function kpiCard(label, value, hint = '', tone = '') {
  return `<div class="eg-kpi ${tone ? `eg-kpi-${tone}` : ''}"><div class="eg-kpi-label">${escapeHtml(label)}</div><div class="eg-kpi-value">${escapeHtml(value)}</div>${hint ? `<div class="eg-kpi-hint">${escapeHtml(hint)}</div>` : ''}</div>`;
}

function renderReviewKpis() {
  const active = reviews.filter(item => !item.deleted);
  const unread = active.filter(item => item.unread).length;
  const pending = active.filter(reviewNeedsReply).length;
  const average = active.length ? (active.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / active.length).toFixed(1) : '0.0';
  const hidden = active.filter(item => !item.visible).length;
  $('#eg-review-kpis').innerHTML = [
    kpiCard('Reseñas activas', String(active.length), `${reviews.filter(item => item.deleted).length} eliminadas`),
    kpiCard('Nuevas', String(unread), 'Pendientes de revisar', unread ? 'accent' : ''),
    kpiCard('Sin responder', String(pending), 'Conversación pendiente', pending ? 'warning' : ''),
    kpiCard('Promedio', `${average} ★`, 'Puntuación general', 'pink'),
    kpiCard('Ocultas', String(hidden), 'No visibles públicamente'),
  ].join('');
}
function renderLikeKpis() {
  const active = likes.filter(item => !item.archived);
  const today = active.filter(item => isToday(item.createdAt)).length;
  const unread = active.filter(item => item.unread).length;
  const clients = new Set(active.map(item => item.ownerUid).filter(Boolean)).size;
  const grouped = groupLikesByProduct(active);
  const top = grouped[0];
  $('#eg-like-kpis').innerHTML = [
    kpiCard('Favoritos activos', String(active.length), `${likes.filter(item => item.archived).length} archivados`),
    kpiCard('Nuevos hoy', String(today), 'Interés de hoy', today ? 'accent' : ''),
    kpiCard('Sin revisar', String(unread), 'Actividad nueva', unread ? 'warning' : ''),
    kpiCard('Clientas', String(clients), 'Con al menos un favorito', 'pink'),
    kpiCard('Más deseado', top ? String(top.count) : '0', top?.productName || 'Sin datos'),
  ].join('');
}

function reviewFiltered() {
  const term = ($('#reviews-search')?.value || '').trim().toLowerCase();
  const status = $('#reviews-filter')?.value || 'all';
  const rating = $('#reviews-rating')?.value || 'all';
  const reply = $('#reviews-reply')?.value || 'all';
  const period = $('#reviews-period')?.value || 'all';
  const sort = $('#reviews-sort')?.value || settings.reviewDefaultSort;
  let data = reviews.filter(review => {
    if (status === 'unread' && !review.unread) return false;
    if (status === 'visible' && (!review.visible || review.deleted || review.adminArchived)) return false;
    if (status === 'hidden' && (review.visible || review.deleted)) return false;
    if (status === 'archived' && !review.adminArchived) return false;
    if (status === 'deleted' && !review.deleted) return false;
    if (status !== 'deleted' && review.deleted && status !== 'all') return false;
    if (rating !== 'all' && Number(review.rating) !== Number(rating)) return false;
    if (reply === 'pending' && !reviewNeedsReply(review)) return false;
    if (reply === 'answered' && !reviewHasStoreReply(review)) return false;
    if (reply === 'customer-last' && (review.conversation || []).at(-1)?.authorType !== 'customer') return false;
    if (!daysAgo(review.createdAt, period)) return false;
    if (term && ![profileName(review), review.realName, review.email, review.productName, review.comment, review.reviewId]
      .some(value => String(value || '').toLowerCase().includes(term))) return false;
    return true;
  });
  data.sort((a, b) => {
    if (sort === 'oldest') return timeValue(a.createdAt) - timeValue(b.createdAt);
    if (sort === 'rating-desc') return Number(b.rating) - Number(a.rating);
    if (sort === 'rating-asc') return Number(a.rating) - Number(b.rating);
    if (sort === 'likes-desc') return Number(b.likeCount || 0) - Number(a.likeCount || 0);
    return timeValue(b.createdAt) - timeValue(a.createdAt);
  });
  return data;
}
function likeFiltered() {
  const term = ($('#likes-search')?.value || '').trim().toLowerCase();
  const status = $('#likes-filter')?.value || 'active';
  const period = $('#likes-period')?.value || 'all';
  const sort = $('#likes-sort')?.value || settings.likeDefaultSort;
  let data = likes.filter(item => {
    if (status === 'active' && item.archived) return false;
    if (status === 'archived' && !item.archived) return false;
    if (status === 'unread' && !item.unread) return false;
    if (!daysAgo(item.createdAt, period)) return false;
    if (term && ![profileName(item), item.realName, item.email, item.productName, item.likeId]
      .some(value => String(value || '').toLowerCase().includes(term))) return false;
    return true;
  });
  data.sort((a, b) => {
    if (sort === 'oldest') return timeValue(a.createdAt) - timeValue(b.createdAt);
    if (sort === 'product') return String(a.productName || '').localeCompare(String(b.productName || ''), 'es');
    if (sort === 'client') return profileName(a).localeCompare(profileName(b), 'es');
    return timeValue(b.createdAt) - timeValue(a.createdAt);
  });
  return data;
}

function reviewCard(review) {
  const checked = selectedReviews.has(review.reviewId) ? 'checked' : '';
  const tags = Array.isArray(review.adminTags) ? review.adminTags : [];
  return `<article class="eg-card ${review.unread ? 'is-unread' : ''}" data-review-id="${escapeHtml(review.reviewId)}">
    <div class="eg-card-select"><input type="checkbox" aria-label="Seleccionar reseña" data-eg-select-review="${escapeHtml(review.reviewId)}" ${checked}></div>
    <div class="eg-card-main">
      <div class="eg-card-top">
        <div class="eg-person">${avatarMarkup(review)}<div><strong>${escapeHtml(profileName(review))}</strong><span>${escapeHtml(review.email || 'Sin correo')}</span></div></div>
        <div class="eg-badges">${reviewStatusBadges(review)}</div>
      </div>
      <div class="eg-review-rating">${stars(review.rating)} <strong>${Number(review.rating) || 0}/5</strong><span>${formatShortDate(review.createdAt)}</span></div>
      <p class="eg-comment">${escapeHtml(review.comment || 'Sin comentario')}</p>
      ${tags.length ? `<div class="eg-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="eg-product-strip">${productImage(review, 'sm')}<div><span class="eg-field-label">Producto</span><strong>${escapeHtml(review.productName || 'Producto')}</strong></div><a href="${productHref(review.productId, review.reviewId)}" target="_blank" rel="noopener">Ver publicación ↗</a></div>
      <div class="eg-card-footer">
        <div class="eg-mini-metrics">
          <span><b>${Number(review.likeCount) || 0}</b> Me gusta</span>
          <span><b>${(review.conversation || []).length}</b> mensajes</span>
          <span>${reviewNeedsReply(review) ? '<b class="eg-warning-text">Respuesta pendiente</b>' : 'Al día'}</span>
        </div>
        <div class="eg-actions">
          <button type="button" class="adm-btn adm-btn-sm adm-btn-primary" data-eg-action="reviewReply" data-id="${escapeHtml(review.reviewId)}">Responder</button>
          <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-eg-open-review="${escapeHtml(review.reviewId)}">Detalles</button>
          <details class="eg-more"><summary aria-label="Más acciones">•••</summary><div>
            <button type="button" data-eg-action="reviewLike" data-id="${escapeHtml(review.reviewId)}">${review.storeLiked ? 'Quitar Me gusta de Tintin' : 'Me gusta como Tintin'}</button>
            <button type="button" data-eg-action="reviewVisibility" data-id="${escapeHtml(review.reviewId)}">${review.visible ? 'Ocultar publicación' : 'Publicar reseña'}</button>
            <button type="button" data-eg-action="reviewPin" data-id="${escapeHtml(review.reviewId)}">${review.adminPinned ? 'Quitar destacado' : 'Destacar en admin'}</button>
            <button type="button" data-eg-action="reviewArchive" data-id="${escapeHtml(review.reviewId)}">${review.adminArchived ? 'Desarchivar' : 'Archivar en admin'}</button>
            <button type="button" data-eg-action="reviewSeenToggle" data-id="${escapeHtml(review.reviewId)}">${review.unread ? 'Marcar como leída' : 'Marcar como nueva'}</button>
            <button type="button" data-eg-action="reviewEdit" data-id="${escapeHtml(review.reviewId)}">Editar reseña</button>
            ${review.deleted
              ? `<button type="button" data-eg-action="reviewRestore" data-id="${escapeHtml(review.reviewId)}">Restaurar reseña</button>`
              : `<button type="button" class="is-danger" data-eg-action="reviewDelete" data-id="${escapeHtml(review.reviewId)}">Eliminar reseña</button>`}
          </div></details>
        </div>
      </div>
    </div>
  </article>`;
}
function likeCard(item) {
  const checked = selectedLikes.has(item.likeId) ? 'checked' : '';
  return `<article class="eg-card eg-like-card ${item.unread ? 'is-unread' : ''} ${item.archived ? 'is-archived' : ''}" data-like-id="${escapeHtml(item.likeId)}">
    <div class="eg-card-select"><input type="checkbox" aria-label="Seleccionar Me gusta" data-eg-select-like="${escapeHtml(item.likeId)}" ${checked}></div>
    <div class="eg-card-main">
      <div class="eg-card-top">
        <div class="eg-person">${avatarMarkup(item)}<div><strong>${escapeHtml(profileName(item))}</strong><span>${escapeHtml(item.email || 'Sin correo')}</span></div></div>
        <div class="eg-badges">${likeStatusBadges(item)}</div>
      </div>
      <div class="eg-like-product">
        ${productImage(item, 'card')}
        <div><span class="eg-field-label">Producto guardado</span><h3>${escapeHtml(item.productName || 'Producto')}</h3><p>${formatDate(item.createdAt)}</p></div>
      </div>
      ${item.adminNote ? `<div class="eg-note-preview"><span>Nota interna</span>${escapeHtml(item.adminNote)}</div>` : ''}
      <div class="eg-card-footer">
        <div class="eg-mini-metrics"><span>ID producto: <b>${escapeHtml(String(item.productId || '').slice(0, 18))}</b></span></div>
        <div class="eg-actions">
          <a class="adm-btn adm-btn-sm adm-btn-outline" href="${productHref(item.productId)}" target="_blank" rel="noopener">Ver producto</a>
          <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-eg-open-like="${escapeHtml(item.likeId)}">Detalles</button>
          <details class="eg-more"><summary aria-label="Más acciones">•••</summary><div>
            <button type="button" data-eg-action="likeArchive" data-id="${escapeHtml(item.likeId)}">${item.archived ? 'Desarchivar actividad' : 'Archivar actividad'}</button>
            <button type="button" data-eg-action="likeSeenToggle" data-id="${escapeHtml(item.likeId)}">${item.unread ? 'Marcar como leído' : 'Marcar como nuevo'}</button>
            <button type="button" class="is-danger" data-eg-action="likeDelete" data-id="${escapeHtml(item.likeId)}">Quitar de favoritos de la clienta</button>
          </div></details>
        </div>
      </div>
    </div>
  </article>`;
}

function renderReviews() {
  renderReviewKpis();
  const root = $('#reviews-admin-list');
  if (!root) return;
  const data = reviewFiltered();
  const pageSize = Math.max(10, Math.min(100, Number(settings.reviewPageSize) || 20));
  const pages = Math.max(1, Math.ceil(data.length / pageSize));
  reviewPage = Math.min(reviewPage, pages);
  const slice = data.slice((reviewPage - 1) * pageSize, reviewPage * pageSize);
  root.innerHTML = slice.length ? slice.map(reviewCard).join('') : '<div class="eg-empty"><strong>No encontramos reseñas</strong><span>Probá cambiando los filtros o el periodo.</span></div>';
  renderPagination('review', data.length, reviewPage, pages);
  renderReviewProducts();
  renderReviewClients();
  renderReviewAnalytics();
  updateBulkBars();
}
function renderLikes() {
  renderLikeKpis();
  const root = $('#likes-admin-list');
  if (!root) return;
  const data = likeFiltered();
  const pageSize = Math.max(10, Math.min(100, Number(settings.likePageSize) || 24));
  const pages = Math.max(1, Math.ceil(data.length / pageSize));
  likePage = Math.min(likePage, pages);
  const slice = data.slice((likePage - 1) * pageSize, likePage * pageSize);
  root.innerHTML = slice.length ? slice.map(likeCard).join('') : '<div class="eg-empty"><strong>No encontramos actividad</strong><span>Probá cambiando los filtros o el periodo.</span></div>';
  renderPagination('like', data.length, likePage, pages);
  renderLikeProducts();
  renderLikeClients();
  renderLikeAnalytics();
  updateBulkBars();
}
function renderPagination(type, total, page, pages) {
  const root = $(`#eg-${type}-pagination`);
  if (!root) return;
  root.innerHTML = `<span>${plural(total, type === 'review' ? 'resultado' : 'registro')}</span><div><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-eg-page="${type}" data-dir="-1" ${page <= 1 ? 'disabled' : ''}>Anterior</button><strong>Página ${page} de ${pages}</strong><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-eg-page="${type}" data-dir="1" ${page >= pages ? 'disabled' : ''}>Siguiente</button></div>`;
}

function groupReviewsByProduct(source = reviews.filter(item => !item.deleted)) {
  const map = new Map();
  source.forEach(item => {
    const key = item.productId || item.productName || 'sin-producto';
    const row = map.get(key) || { productId: item.productId, productName: item.productName || 'Producto', productImageUrl: item.productImageUrl, count: 0, total: 0, hidden: 0, pending: 0, likes: 0 };
    row.count += 1; row.total += Number(item.rating) || 0; row.hidden += item.visible ? 0 : 1; row.pending += reviewNeedsReply(item) ? 1 : 0; row.likes += Number(item.likeCount) || 0;
    map.set(key, row);
  });
  return [...map.values()].map(row => ({ ...row, average: row.count ? row.total / row.count : 0 })).sort((a, b) => b.count - a.count);
}
function groupLikesByProduct(source = likes.filter(item => !item.archived)) {
  const map = new Map();
  source.forEach(item => {
    const key = item.productId || item.productName || 'sin-producto';
    const row = map.get(key) || { productId: item.productId, productName: item.productName || 'Producto', productImageUrl: item.productImageUrl, count: 0, clients: new Set(), lastAt: item.createdAt };
    row.count += 1; if (item.ownerUid) row.clients.add(item.ownerUid); if (timeValue(item.createdAt) > timeValue(row.lastAt)) row.lastAt = item.createdAt;
    map.set(key, row);
  });
  return [...map.values()].map(row => ({ ...row, clientCount: row.clients.size })).sort((a, b) => b.count - a.count);
}
function groupReviewsByClient() {
  const map = new Map();
  reviews.filter(item => !item.deleted).forEach(item => {
    const key = item.ownerUid || item.email || item.realName;
    const row = map.get(key) || { ownerUid: item.ownerUid, email: item.email, realName: profileName(item), count: 0, total: 0, pending: 0, lastAt: item.createdAt };
    row.count += 1; row.total += Number(item.rating) || 0; row.pending += reviewNeedsReply(item) ? 1 : 0; if (timeValue(item.createdAt) > timeValue(row.lastAt)) row.lastAt = item.createdAt;
    map.set(key, row);
  });
  return [...map.values()].map(row => ({ ...row, average: row.count ? row.total / row.count : 0 })).sort((a, b) => b.count - a.count);
}
function groupLikesByClient() {
  const map = new Map();
  likes.filter(item => !item.archived).forEach(item => {
    const key = item.ownerUid || item.email || item.realName;
    const row = map.get(key) || { ownerUid: item.ownerUid, email: item.email, realName: profileName(item), count: 0, products: [], lastAt: item.createdAt };
    row.count += 1; row.products.push(item.productName); if (timeValue(item.createdAt) > timeValue(row.lastAt)) row.lastAt = item.createdAt;
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}
function tableShell(title, subtitle, columns, rows) {
  return `<div class="eg-data-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div>
    <div class="eg-table-wrap"><table class="eg-table"><thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${columns.length}">Sin datos todavía.</td></tr>`}</tbody></table></div>`;
}
function renderReviewProducts() {
  const root = $('#eg-review-products'); if (!root) return;
  const rows = groupReviewsByProduct().map(row => `<tr><td><div class="eg-table-product">${productImage(row, 'table')}<div><strong>${escapeHtml(row.productName)}</strong><span>${escapeHtml(row.productId || '')}</span></div></div></td><td>${row.count}</td><td>${row.average.toFixed(1)} ★</td><td>${row.pending}</td><td>${row.hidden}</td><td>${row.likes}</td><td><a href="${productHref(row.productId)}" target="_blank" rel="noopener">Abrir ↗</a></td></tr>`).join('');
  root.innerHTML = tableShell('Rendimiento por producto', 'Qué productos reciben más reseñas y dónde quedan conversaciones pendientes.', ['Producto','Reseñas','Promedio','Sin responder','Ocultas','Me gusta',''], rows);
}
function renderLikeProducts() {
  const root = $('#eg-like-products'); if (!root) return;
  const rows = groupLikesByProduct().map((row, index) => `<tr><td><div class="eg-rank">#${index + 1}</div></td><td><div class="eg-table-product">${productImage(row, 'table')}<div><strong>${escapeHtml(row.productName)}</strong><span>${escapeHtml(row.productId || '')}</span></div></div></td><td><strong>${row.count}</strong></td><td>${row.clientCount}</td><td>${formatShortDate(row.lastAt)}</td><td><a href="${productHref(row.productId)}" target="_blank" rel="noopener">Abrir ↗</a></td></tr>`).join('');
  root.innerHTML = tableShell('Productos más deseados', 'Ranking basado en favoritos activos actuales.', ['#','Producto','Me gusta','Clientas','Último interés',''], rows);
}
function renderReviewClients() {
  const root = $('#eg-review-clients'); if (!root) return;
  const rows = groupReviewsByClient().map(row => `<tr><td><div class="eg-table-person">${avatarMarkup(row, 'sm')}<div><strong>${escapeHtml(row.realName)}</strong><span>${escapeHtml(row.email || '')}</span></div></div></td><td>${row.count}</td><td>${row.average.toFixed(1)} ★</td><td>${row.pending}</td><td>${formatShortDate(row.lastAt)}</td><td><button type="button" class="eg-table-link" data-view-profile data-owner-uid="${escapeHtml(row.ownerUid || '')}" data-email="${escapeHtml(row.email || '')}">Ver perfil</button></td></tr>`).join('');
  root.innerHTML = tableShell('Clientas que reseñan', 'Historial agregado de participación por cuenta.', ['Clienta','Reseñas','Promedio','Pendientes','Última reseña',''], rows);
}
function renderLikeClients() {
  const root = $('#eg-like-clients'); if (!root) return;
  const rows = groupLikesByClient().map(row => `<tr><td><div class="eg-table-person">${avatarMarkup(row, 'sm')}<div><strong>${escapeHtml(row.realName)}</strong><span>${escapeHtml(row.email || '')}</span></div></div></td><td><strong>${row.count}</strong></td><td>${escapeHtml(row.products.slice(0, 3).join(' · '))}${row.products.length > 3 ? ` +${row.products.length - 3}` : ''}</td><td>${formatShortDate(row.lastAt)}</td><td><button type="button" class="eg-table-link" data-view-profile data-owner-uid="${escapeHtml(row.ownerUid || '')}" data-email="${escapeHtml(row.email || '')}">Ver perfil</button></td></tr>`).join('');
  root.innerHTML = tableShell('Clientas con favoritos', 'Quiénes guardan más productos y qué les interesa.', ['Clienta','Favoritos','Productos','Última actividad',''], rows);
}

function barRow(label, value, max, suffix = '') {
  const pct = max ? Math.max(2, Math.round(value / max * 100)) : 0;
  return `<div class="eg-bar-row"><span>${escapeHtml(label)}</span><div><i style="width:${pct}%"></i></div><strong>${escapeHtml(`${value}${suffix}`)}</strong></div>`;
}
function renderReviewAnalytics() {
  const root = $('#eg-review-analytics'); if (!root) return;
  const active = reviews.filter(item => !item.deleted);
  const distribution = [5,4,3,2,1].map(rating => ({ rating, count: active.filter(item => Number(item.rating) === rating).length }));
  const max = Math.max(1, ...distribution.map(item => item.count));
  const products = groupReviewsByProduct().slice(0, 8);
  root.innerHTML = `<div class="eg-analytics-grid">
    <div class="eg-panel"><div class="eg-panel-head"><div><h2>Distribución de puntuaciones</h2><p>Reseñas activas</p></div></div>${distribution.map(item => barRow(`${item.rating} ★`, item.count, max)).join('')}</div>
    <div class="eg-panel"><div class="eg-panel-head"><div><h2>Estado operativo</h2><p>Qué necesita atención</p></div></div>
      ${barRow('Sin responder', active.filter(reviewNeedsReply).length, Math.max(1, active.length))}
      ${barRow('Nuevas', active.filter(item => item.unread).length, Math.max(1, active.length))}
      ${barRow('Ocultas', active.filter(item => !item.visible).length, Math.max(1, active.length))}
      ${barRow('Editadas', active.filter(item => Number(item.editCount) > 0).length, Math.max(1, active.length))}
    </div>
    <div class="eg-panel eg-panel-wide"><div class="eg-panel-head"><div><h2>Productos con más reseñas</h2><p>Top 8 del historial activo</p></div></div>
      ${products.length ? products.map(row => barRow(row.productName, row.count, Math.max(1, products[0].count))).join('') : '<div class="eg-empty">Sin datos.</div>'}
    </div>
  </div>`;
}
function renderLikeAnalytics() {
  const root = $('#eg-like-analytics'); if (!root) return;
  const active = likes.filter(item => !item.archived);
  const products = groupLikesByProduct(active).slice(0, 10);
  const max = Math.max(1, ...products.map(item => item.count));
  const ranges = [
    ['Hoy', active.filter(item => isToday(item.createdAt)).length],
    ['Últimos 7 días', active.filter(item => daysAgo(item.createdAt, 7)).length],
    ['Últimos 30 días', active.filter(item => daysAgo(item.createdAt, 30)).length],
    ['Últimos 90 días', active.filter(item => daysAgo(item.createdAt, 90)).length],
  ];
  root.innerHTML = `<div class="eg-analytics-grid">
    <div class="eg-panel eg-panel-wide"><div class="eg-panel-head"><div><h2>Ranking de deseo</h2><p>Favoritos activos por producto</p></div></div>
      ${products.length ? products.map(row => barRow(row.productName, row.count, max)).join('') : '<div class="eg-empty">Sin datos.</div>'}
    </div>
    <div class="eg-panel"><div class="eg-panel-head"><div><h2>Actividad reciente</h2><p>Acumulado por ventana</p></div></div>${ranges.map(row => barRow(row[0], row[1], Math.max(1, active.length))).join('')}</div>
    <div class="eg-panel"><div class="eg-panel-head"><div><h2>Calidad de la bandeja</h2><p>Gestión administrativa</p></div></div>
      ${barRow('Revisados', active.filter(item => !item.unread).length, Math.max(1, active.length))}
      ${barRow('Sin revisar', active.filter(item => item.unread).length, Math.max(1, active.length))}
      ${barRow('Archivados', likes.filter(item => item.archived).length, Math.max(1, likes.length))}
    </div>
  </div>`;
}

function settingsMarkup(kind) {
  const isReviews = kind === 'reviews';
  return `<div class="eg-settings-layout">
    <aside class="eg-settings-nav"><strong>${isReviews ? 'Reseñas' : 'Me gusta'}</strong><span>Preferencias del panel</span></aside>
    <div class="eg-settings-main">
      <div class="eg-settings-card">
        <div class="eg-settings-card-head"><div><h2>Comportamiento</h2><p>Estos ajustes se guardan en Firestore y se aplican a este panel.</p></div></div>
        <label class="eg-setting-row"><div><strong>Marcar como visto al entrar</strong><span>${isReviews ? 'Quita automáticamente el indicador “Nueva” al abrir Reseñas.' : 'Quita automáticamente el indicador “Nuevo” al abrir Me gusta.'}</span></div><input type="checkbox" data-eg-setting="${isReviews ? 'autoMarkSeenReviews' : 'autoMarkSeenLikes'}" ${settings[isReviews ? 'autoMarkSeenReviews' : 'autoMarkSeenLikes'] ? 'checked' : ''}></label>
        <label class="eg-setting-row"><div><strong>Mostrar imágenes de producto</strong><span>Miniaturas en tarjetas, tablas y paneles de detalle.</span></div><input type="checkbox" data-eg-setting="showProductImages" ${settings.showProductImages ? 'checked' : ''}></label>
        <label class="eg-setting-row"><div><strong>Vista compacta</strong><span>Reduce espacios para revisar más registros en pantalla.</span></div><input type="checkbox" data-eg-setting="denseMode" ${settings.denseMode ? 'checked' : ''}></label>
        <label class="eg-setting-row"><div><strong>Confirmar acciones destructivas</strong><span>Pide confirmación antes de eliminar reseñas o quitar favoritos de una clienta.</span></div><input type="checkbox" data-eg-setting="confirmDestructive" ${settings.confirmDestructive ? 'checked' : ''}></label>
        <label class="eg-setting-row"><div><strong>Recordar la última vista</strong><span>Vuelve a Bandeja, Productos, Analítica o Configuración donde lo dejaste.</span></div><input type="checkbox" data-eg-setting="rememberView" ${settings.rememberView ? 'checked' : ''}></label>
      </div>
      <div class="eg-settings-card">
        <div class="eg-settings-card-head"><div><h2>Bandeja</h2><p>Orden y cantidad de registros por página.</p></div></div>
        <label class="eg-setting-select"><div><strong>Registros por página</strong></div><select class="adm-select" data-eg-setting="${isReviews ? 'reviewPageSize' : 'likePageSize'}">${[10,20,24,30,50,100].map(n => `<option value="${n}" ${Number(settings[isReviews ? 'reviewPageSize' : 'likePageSize']) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="eg-setting-select"><div><strong>Orden predeterminado</strong></div><select class="adm-select" data-eg-setting="${isReviews ? 'reviewDefaultSort' : 'likeDefaultSort'}">
          ${isReviews
            ? `<option value="newest" ${settings.reviewDefaultSort === 'newest' ? 'selected' : ''}>Más nuevas</option><option value="oldest" ${settings.reviewDefaultSort === 'oldest' ? 'selected' : ''}>Más antiguas</option><option value="rating-desc" ${settings.reviewDefaultSort === 'rating-desc' ? 'selected' : ''}>Mejor puntuación</option><option value="rating-asc" ${settings.reviewDefaultSort === 'rating-asc' ? 'selected' : ''}>Peor puntuación</option>`
            : `<option value="newest" ${settings.likeDefaultSort === 'newest' ? 'selected' : ''}>Más nuevos</option><option value="oldest" ${settings.likeDefaultSort === 'oldest' ? 'selected' : ''}>Más antiguos</option><option value="product" ${settings.likeDefaultSort === 'product' ? 'selected' : ''}>Producto A–Z</option><option value="client" ${settings.likeDefaultSort === 'client' ? 'selected' : ''}>Clienta A–Z</option>`}
        </select></label>
      </div>
      ${isReviews ? `<div class="eg-settings-card"><div class="eg-settings-card-head"><div><h2>Respuestas rápidas</h2><p>Editá, ordená o agregá textos para responder desde el panel lateral.</p></div><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-eg-add-quick>+ Agregar</button></div><div id="eg-quick-replies-editor" class="eg-quick-editor">${quickReplies.map((text, index) => `<div><span>${index + 1}</span><input class="adm-input" value="${escapeHtml(text)}" maxlength="240"><button type="button" class="eg-icon-btn" data-eg-remove-quick aria-label="Eliminar">×</button></div>`).join('')}</div></div>` : `<div class="eg-settings-card"><div class="eg-settings-card-head"><div><h2>Seguridad de favoritos</h2><p>El panel diferencia claramente entre archivar una actividad y modificar la cuenta de una clienta.</p></div></div><div class="eg-callout"><strong>Archivar actividad</strong> nunca elimina el favorito real. La acción “Quitar de favoritos de la clienta” vive dentro de acciones avanzadas y requiere confirmación.</div></div>`}
      <div class="eg-settings-save"><button type="button" class="adm-btn adm-btn-primary" data-eg-save-settings="${kind}">Guardar configuración</button></div>
    </div>
  </div>`;
}
function renderSettings() {
  const reviewRoot = $('#eg-review-settings');
  const likeRoot = $('#eg-like-settings');
  if (reviewRoot) reviewRoot.innerHTML = settingsMarkup('reviews');
  if (likeRoot) likeRoot.innerHTML = settingsMarkup('likes');
  document.documentElement.classList.toggle('eg-dense', Boolean(settings.denseMode));
}

function openReviewDrawer(reviewId, focusReply = false) {
  const review = reviews.find(item => item.reviewId === reviewId);
  if (!review) return;
  currentDrawer = { type: 'review', id: reviewId };
  const conversation = Array.isArray(review.conversation) ? review.conversation : [];
  const history = Array.isArray(review.history) ? [...review.history].reverse() : [];
  const tags = Array.isArray(review.adminTags) ? review.adminTags : [];
  $('#eg-drawer-root').innerHTML = `<div class="eg-drawer-backdrop" data-eg-close-drawer></div><aside class="eg-drawer" role="dialog" aria-modal="true" aria-label="Detalle de reseña">
    <div class="eg-drawer-head"><div><div class="eg-eyebrow">Detalle de reseña</div><h2>${escapeHtml(profileName(review))}</h2></div><button type="button" class="eg-icon-btn eg-icon-btn-lg" data-eg-close-drawer aria-label="Cerrar">×</button></div>
    <div class="eg-drawer-scroll">
      <div class="eg-drawer-status">${reviewStatusBadges(review)}</div>
      <section class="eg-detail-product">${productImage(review, 'detail')}<div><span class="eg-field-label">Producto</span><h3>${escapeHtml(review.productName || 'Producto')}</h3><a href="${productHref(review.productId, review.reviewId)}" target="_blank" rel="noopener">Ver publicación ↗</a></div></section>
      <section class="eg-detail-section"><div class="eg-detail-section-head"><h3>Reseña</h3><button type="button" class="eg-table-link" data-eg-action="reviewEdit" data-id="${escapeHtml(review.reviewId)}">Editar</button></div><div class="eg-rating-large">${stars(review.rating)} <strong>${review.rating}/5</strong></div><p class="eg-detail-comment">${escapeHtml(review.comment)}</p></section>
      <section class="eg-detail-section"><h3>Información</h3><div class="eg-detail-grid">
        <div><span>Clienta</span><strong>${escapeHtml(profileName(review))}</strong></div>
        <div><span>Correo</span><strong>${escapeHtml(review.email || 'Sin correo')}</strong></div>
        <div><span>Publicada</span><strong>${formatDate(review.createdAt)}</strong></div>
        <div><span>Actualizada</span><strong>${formatDate(review.updatedAt)}</strong></div>
        <div><span>ID reseña</span><code>${escapeHtml(review.reviewId || '')}</code></div>
        <div><span>ID producto</span><code>${escapeHtml(review.productId || '')}</code></div>
      </div><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-view-profile data-owner-uid="${escapeHtml(review.ownerUid || '')}" data-email="${escapeHtml(review.email || '')}">Ver perfil completo</button></section>
      <section class="eg-detail-section"><div class="eg-detail-section-head"><h3>Conversación</h3><span>${plural(conversation.length, 'mensaje')}</span></div>
        <div class="eg-conversation">${conversation.length ? conversation.map(item => `<div class="eg-message ${item.authorType === 'store' ? 'is-store' : 'is-customer'}"><div><strong>${item.authorType === 'store' ? 'Tintin Accesorios' : escapeHtml(profileName(review))}</strong><span>${formatDate(item.createdAt)}</span></div><p>${escapeHtml(item.text)}</p></div>`).join('') : '<div class="eg-empty eg-empty-small">Todavía no hay respuestas.</div>'}</div>
        ${review.deleted ? '' : `<div class="eg-reply-box"><textarea class="adm-input eg-textarea" id="eg-drawer-reply" rows="3" maxlength="1200" placeholder="Responder como Tintin Accesorios…"></textarea><div><select class="adm-select" id="eg-drawer-quick"><option value="">Respuesta rápida…</option>${quickReplies.map(text => `<option value="${escapeHtml(text)}">${escapeHtml(text)}</option>`).join('')}</select><button type="button" class="adm-btn adm-btn-primary" data-eg-action="reviewReplySend" data-id="${escapeHtml(review.reviewId)}">Responder</button></div></div>`}
      </section>
      <section class="eg-detail-section"><h3>Gestión interna</h3>
        <label class="eg-field"><span>Etiquetas internas</span><input class="adm-input" id="eg-review-tags" value="${escapeHtml(tags.join(', '))}" placeholder="VIP, reclamo, seguimiento…"></label>
        <label class="eg-field"><span>Nota interna</span><textarea class="adm-input eg-textarea" id="eg-review-note" rows="4" maxlength="1600" placeholder="Solo visible en administración…">${escapeHtml(review.adminNote || '')}</textarea></label>
        <button type="button" class="adm-btn adm-btn-sm adm-btn-primary" data-eg-action="reviewSaveMeta" data-id="${escapeHtml(review.reviewId)}">Guardar nota y etiquetas</button>
      </section>
      <section class="eg-detail-section"><div class="eg-detail-section-head"><h3>Historial</h3><span>${plural(history.length, 'evento')}</span></div><div class="eg-timeline">${history.length ? history.map(item => `<div><i></i><p><strong>${escapeHtml(historyLabel(item.action))}</strong><span>${formatDate(item.changedAt)} · ${escapeHtml(item.changedBy || '')}</span>${item.text ? `<small>${escapeHtml(item.text)}</small>` : ''}</p></div>`).join('') : '<div class="eg-empty eg-empty-small">Sin cambios administrativos.</div>'}</div></section>
      <section class="eg-detail-section eg-danger-zone"><h3>Acciones</h3><div class="eg-action-grid">
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="reviewVisibility" data-id="${escapeHtml(review.reviewId)}">${review.visible ? 'Ocultar' : 'Publicar'}</button>
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="reviewLike" data-id="${escapeHtml(review.reviewId)}">${review.storeLiked ? 'Quitar Me gusta' : 'Me gusta como Tintin'}</button>
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="reviewPin" data-id="${escapeHtml(review.reviewId)}">${review.adminPinned ? 'Quitar destacado' : 'Destacar'}</button>
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="reviewArchive" data-id="${escapeHtml(review.reviewId)}">${review.adminArchived ? 'Desarchivar' : 'Archivar'}</button>
        ${review.deleted ? `<button type="button" class="adm-btn adm-btn-primary" data-eg-action="reviewRestore" data-id="${escapeHtml(review.reviewId)}">Restaurar</button>` : `<button type="button" class="adm-btn adm-btn-danger" data-eg-action="reviewDelete" data-id="${escapeHtml(review.reviewId)}">Eliminar reseña</button>`}
      </div></section>
    </div>
  </aside>`;
  if (focusReply) setTimeout(() => $('#eg-drawer-reply')?.focus(), 50);
}
function openLikeDrawer(likeId) {
  const item = likes.find(entry => entry.likeId === likeId);
  if (!item) return;
  currentDrawer = { type: 'like', id: likeId };
  $('#eg-drawer-root').innerHTML = `<div class="eg-drawer-backdrop" data-eg-close-drawer></div><aside class="eg-drawer" role="dialog" aria-modal="true" aria-label="Detalle de Me gusta">
    <div class="eg-drawer-head"><div><div class="eg-eyebrow">Detalle de favorito</div><h2>${escapeHtml(profileName(item))}</h2></div><button type="button" class="eg-icon-btn eg-icon-btn-lg" data-eg-close-drawer aria-label="Cerrar">×</button></div>
    <div class="eg-drawer-scroll">
      <div class="eg-drawer-status">${likeStatusBadges(item)}</div>
      <section class="eg-detail-product">${productImage(item, 'detail')}<div><span class="eg-field-label">Producto favorito</span><h3>${escapeHtml(item.productName || 'Producto')}</h3><a href="${productHref(item.productId)}" target="_blank" rel="noopener">Ver producto ↗</a></div></section>
      <section class="eg-detail-section"><h3>Información</h3><div class="eg-detail-grid">
        <div><span>Clienta</span><strong>${escapeHtml(profileName(item))}</strong></div>
        <div><span>Correo</span><strong>${escapeHtml(item.email || 'Sin correo')}</strong></div>
        <div><span>Guardado</span><strong>${formatDate(item.createdAt)}</strong></div>
        <div><span>Actualizado</span><strong>${formatDate(item.updatedAt)}</strong></div>
        <div><span>ID favorito</span><code>${escapeHtml(item.likeId || '')}</code></div>
        <div><span>ID producto</span><code>${escapeHtml(item.productId || '')}</code></div>
      </div><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-view-profile data-owner-uid="${escapeHtml(item.ownerUid || '')}" data-email="${escapeHtml(item.email || '')}">Ver perfil completo</button></section>
      <section class="eg-detail-section"><h3>Gestión interna</h3><label class="eg-field"><span>Nota interna</span><textarea class="adm-input eg-textarea" id="eg-like-note" rows="5" maxlength="1600" placeholder="Ej.: consultó por stock, posible compra…">${escapeHtml(item.adminNote || '')}</textarea></label><button type="button" class="adm-btn adm-btn-sm adm-btn-primary" data-eg-action="likeSaveNote" data-id="${escapeHtml(item.likeId)}">Guardar nota</button></section>
      <section class="eg-detail-section"><h3>Acciones administrativas</h3><div class="eg-action-grid">
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="likeArchive" data-id="${escapeHtml(item.likeId)}">${item.archived ? 'Desarchivar actividad' : 'Archivar actividad'}</button>
        <button type="button" class="adm-btn adm-btn-outline" data-eg-action="likeSeenToggle" data-id="${escapeHtml(item.likeId)}">${item.unread ? 'Marcar leído' : 'Marcar nuevo'}</button>
      </div></section>
      <section class="eg-detail-section eg-danger-zone"><h3>Zona sensible</h3><p>Esta acción sí modifica la cuenta de la clienta: el producto desaparecerá de sus favoritos.</p><button type="button" class="adm-btn adm-btn-danger" data-eg-action="likeDelete" data-id="${escapeHtml(item.likeId)}">Quitar de favoritos de la clienta</button></section>
    </div>
  </aside>`;
}
function closeDrawer() { $('#eg-drawer-root').innerHTML = ''; currentDrawer = null; }
function refreshDrawer() {
  if (!currentDrawer) return;
  if (currentDrawer.type === 'review') openReviewDrawer(currentDrawer.id);
  else openLikeDrawer(currentDrawer.id);
}
function historyLabel(action) {
  const labels = {
    published:'Publicada', hidden:'Ocultada', store_liked:'Me gusta de Tintin', store_unliked:'Se quitó Me gusta de Tintin',
    store_reply:'Respuesta de Tintin', admin_edit:'Editada por administración', deleted:'Eliminada', restored:'Restaurada',
    customer_edit:'Editada por la clienta', archived:'Archivada en administración', unarchived:'Desarchivada',
    pinned:'Destacada', unpinned:'Se quitó destacado', admin_meta:'Nota/etiquetas actualizadas',
  };
  return labels[action] || String(action || 'Cambio').replace(/_/g, ' ');
}

async function performReviewAction(action, reviewId, trigger = null) {
  const review = reviews.find(item => item.reviewId === reviewId);
  if (!review) return;
  if (trigger) trigger.disabled = true;
  try {
    if (action === 'reviewReply') { openReviewDrawer(reviewId, true); return; }
    if (action === 'reviewReplySend') {
      const text = ($('#eg-drawer-reply')?.value || '').trim();
      if (!text) throw new Error('Escribí una respuesta antes de enviar');
      await api({ action: 'reviewReply', reviewId, text });
      toast('Respuesta enviada');
      return;
    }
    if (action === 'reviewEdit') {
      const payload = await editReviewDialog(review);
      if (!payload) return;
      await api({ action: 'reviewEdit', reviewId, ...payload });
      toast('Reseña actualizada');
      return;
    }
    if (action === 'reviewDelete') {
      const ok = await confirmDialog({ title:'Eliminar reseña', message:'La reseña dejará de verse públicamente. Podrás restaurarla desde Eliminadas.', confirmText:'Eliminar reseña', danger:true });
      if (!ok) return;
      await api({ action:'reviewDelete', reviewId });
      toast('Reseña eliminada');
      return;
    }
    if (action === 'reviewRestore') { await api({ action:'reviewRestore', reviewId }); toast('Reseña restaurada'); return; }
    if (action === 'reviewVisibility') { await api({ action:'reviewVisibility', reviewId, visible: !review.visible }); toast(review.visible ? 'Reseña ocultada' : 'Reseña publicada'); return; }
    if (action === 'reviewLike') { await api({ action:'reviewLike', reviewId, liked: !review.storeLiked }); toast(review.storeLiked ? 'Me gusta retirado' : 'Me gusta de Tintin agregado'); return; }
    if (action === 'reviewPin') { await api({ action:'reviewPin', reviewId, pinned: !review.adminPinned }); toast(review.adminPinned ? 'Destacado retirado' : 'Reseña destacada'); return; }
    if (action === 'reviewArchive') { await api({ action:'reviewArchive', reviewId, archived: !review.adminArchived }); toast(review.adminArchived ? 'Reseña desarchivada' : 'Reseña archivada'); return; }
    if (action === 'reviewSeenToggle') { await api({ action: review.unread ? 'reviewSeen' : 'reviewUnread', reviewId }); return; }
    if (action === 'reviewSaveMeta') {
      const note = ($('#eg-review-note')?.value || '').trim();
      const tags = ($('#eg-review-tags')?.value || '').split(',').map(value => value.trim()).filter(Boolean);
      await api({ action:'reviewMeta', reviewId, note, tags });
      toast('Gestión interna guardada');
      return;
    }
  } catch (error) { toast(error.message, 'error'); }
  finally { if (trigger) trigger.disabled = false; }
}
async function performLikeAction(action, likeId, trigger = null) {
  const item = likes.find(entry => entry.likeId === likeId);
  if (!item) return;
  if (trigger) trigger.disabled = true;
  try {
    if (action === 'likeArchive') {
      await api({ action:'likeArchive', likeId, archived: !item.archived });
      toast(item.archived ? 'Actividad desarchivada' : 'Actividad archivada');
      return;
    }
    if (action === 'likeSeenToggle') { await api({ action: item.unread ? 'likeSeen' : 'likeUnread', likeId }); return; }
    if (action === 'likeSaveNote') {
      await api({ action:'likeNote', likeId, note: ($('#eg-like-note')?.value || '').trim() });
      toast('Nota interna guardada');
      return;
    }
    if (action === 'likeDelete') {
      const ok = await confirmDialog({ title:'Quitar favorito de la clienta', message:`${profileName(item)} dejará de tener “${item.productName || 'este producto'}” en sus favoritos. Esta acción no es un simple archivado.`, confirmText:'Quitar favorito', danger:true });
      if (!ok) return;
      await api({ action:'likeDelete', likeId });
      closeDrawer();
      toast('Favorito eliminado de la cuenta');
      return;
    }
  } catch (error) { toast(error.message, 'error'); }
  finally { if (trigger) trigger.disabled = false; }
}

async function markCurrentSeen(type) {
  const enabled = type === 'reviews' ? settings.autoMarkSeenReviews : settings.autoMarkSeenLikes;
  if (!enabled) return;
  const items = (type === 'reviews' ? reviews : likes).filter(item => item.unread).slice(0, 100);
  await Promise.allSettled(items.map(item => api(type === 'reviews' ? { action:'reviewSeen', reviewId:item.reviewId } : { action:'likeSeen', likeId:item.likeId })));
}
function updateBulkBars() {
  const reviewBar = $('#eg-review-bulk');
  const likeBar = $('#eg-like-bulk');
  if (reviewBar) { reviewBar.hidden = selectedReviews.size === 0; $('#eg-review-selected-count').textContent = `${selectedReviews.size} seleccionada${selectedReviews.size === 1 ? '' : 's'}`; }
  if (likeBar) { likeBar.hidden = selectedLikes.size === 0; $('#eg-like-selected-count').textContent = `${selectedLikes.size} seleccionado${selectedLikes.size === 1 ? '' : 's'}`; }
}
async function bulkReviews(action, trigger) {
  if (action === 'clear') { selectedReviews.clear(); renderReviews(); return; }
  const ids = [...selectedReviews];
  if (!ids.length) return;
  if (action === 'delete') {
    const ok = await confirmDialog({ title:'Eliminar reseñas seleccionadas', message:`Se eliminarán ${ids.length} reseñas y dejarán de verse públicamente.`, confirmText:'Eliminar seleccionadas', danger:true });
    if (!ok) return;
  }
  trigger.disabled = true;
  const actionMap = { seen:'reviewSeen', publish:'reviewVisibility', hide:'reviewVisibility', archive:'reviewArchive', delete:'reviewDelete' };
  const results = await Promise.allSettled(ids.map(id => {
    const input = { action: actionMap[action], reviewId:id };
    if (action === 'publish') input.visible = true;
    if (action === 'hide') input.visible = false;
    if (action === 'archive') input.archived = true;
    return api(input);
  }));
  trigger.disabled = false;
  selectedReviews.clear();
  const okCount = results.filter(item => item.status === 'fulfilled').length;
  toast(`${okCount} reseña${okCount === 1 ? '' : 's'} actualizada${okCount === 1 ? '' : 's'}`);
}
async function bulkLikes(action, trigger) {
  if (action === 'clear') { selectedLikes.clear(); renderLikes(); return; }
  const ids = [...selectedLikes];
  if (!ids.length) return;
  trigger.disabled = true;
  const results = await Promise.allSettled(ids.map(id => {
    if (action === 'seen') return api({ action:'likeSeen', likeId:id });
    return api({ action:'likeArchive', likeId:id, archived: action === 'archive' });
  }));
  trigger.disabled = false;
  selectedLikes.clear();
  const okCount = results.filter(item => item.status === 'fulfilled').length;
  toast(`${okCount} registro${okCount === 1 ? '' : 's'} actualizado${okCount === 1 ? '' : 's'}`);
}

function viewProfile(ownerUid, email) {
  const profile = profileFor(ownerUid);
  const query = profile.email || email || '';
  window.location.hash = '#usuarios';
  setTimeout(() => {
    const search = $('#user-search');
    if (!search) return;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.focus();
  }, 0);
}
function exportCsv(type) {
  const source = type === 'reviews' ? reviewFiltered() : likeFiltered();
  const rows = type === 'reviews'
    ? [['Nombre','Correo','Producto','Puntuación','Comentario','Estado','Sin responder','Me gusta','Creada','Actualizada'], ...source.map(item => [profileName(item), item.email, item.productName, item.rating, item.comment, item.deleted ? 'Eliminada' : item.adminArchived ? 'Archivada' : item.visible ? 'Publicada' : 'Oculta', reviewNeedsReply(item) ? 'Sí' : 'No', item.likeCount || 0, formatDate(item.createdAt), formatDate(item.updatedAt)])]
    : [['Nombre','Correo','Producto','Estado','Creado','Actualizado','Nota interna'], ...source.map(item => [profileName(item), item.email, item.productName, item.archived ? 'Archivado' : 'Favorito activo', formatDate(item.createdAt), formatDate(item.updatedAt), item.adminNote || ''])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff', csv], { type:'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = `${type === 'reviews' ? 'resenas' : 'me-gusta'}-tintin-${new Date().toISOString().slice(0,10)}.csv`;
  anchor.click(); URL.revokeObjectURL(href);
  toast('CSV exportado');
}

async function saveSettings(kind, trigger) {
  trigger.disabled = true;
  try {
    const scope = kind === 'reviews' ? $('[data-eg-review-panel="settings"]') : $('[data-eg-like-panel="settings"]');
    $$('[data-eg-setting]', scope).forEach(input => {
      const key = input.dataset.egSetting;
      settings[key] = input.type === 'checkbox' ? input.checked : (key.endsWith('PageSize') ? Number(input.value) : input.value);
    });
    if (kind === 'reviews') {
      quickReplies = $$('#eg-quick-replies-editor input', scope).map(input => input.value.trim().slice(0,240)).filter(Boolean).slice(0,20);
      await setDoc(doc(db, 'settings', 'reviewQuickReplies'), { items:quickReplies, updatedAt:new Date() }, { merge:true });
    }
    await setDoc(doc(db, 'settings', 'engagementAdmin'), { ...settings, updatedAt:new Date() }, { merge:true });
    applySettings();
    toast('Configuración guardada');
  } catch (error) { toast(error.message, 'error'); }
  finally { trigger.disabled = false; }
}
function applySettings() {
  document.documentElement.classList.toggle('eg-dense', Boolean(settings.denseMode));
  if ($('#reviews-sort') && !$('#reviews-sort').dataset.userChanged) $('#reviews-sort').value = settings.reviewDefaultSort;
  if ($('#likes-sort') && !$('#likes-sort').dataset.userChanged) $('#likes-sort').value = settings.likeDefaultSort;
  renderReviews(); renderLikes(); renderSettings();
}

function bindEvents() {
  document.addEventListener('input', event => {
    if (event.target.matches('#reviews-search,#reviews-filter,#reviews-rating,#reviews-reply,#reviews-period,#reviews-sort')) {
      if (event.target.id === 'reviews-sort') event.target.dataset.userChanged = '1';
      reviewPage = 1; renderReviews();
    }
    if (event.target.matches('#likes-search,#likes-filter,#likes-period,#likes-sort')) {
      if (event.target.id === 'likes-sort') event.target.dataset.userChanged = '1';
      likePage = 1; renderLikes();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-eg-select-review]')) {
      event.target.checked ? selectedReviews.add(event.target.dataset.egSelectReview) : selectedReviews.delete(event.target.dataset.egSelectReview);
      updateBulkBars();
    }
    if (event.target.matches('[data-eg-select-like]')) {
      event.target.checked ? selectedLikes.add(event.target.dataset.egSelectLike) : selectedLikes.delete(event.target.dataset.egSelectLike);
      updateBulkBars();
    }
    if (event.target.matches('#eg-drawer-quick') && event.target.value) {
      const field = $('#eg-drawer-reply'); if (field) { field.value = event.target.value; field.focus(); }
    }
  });
  document.addEventListener('click', async event => {
    const reviewViewButton = event.target.closest('[data-eg-review-view]');
    if (reviewViewButton) { switchReviewView(reviewViewButton.dataset.egReviewView); return; }
    const likeViewButton = event.target.closest('[data-eg-like-view]');
    if (likeViewButton) { switchLikeView(likeViewButton.dataset.egLikeView); return; }

    const quick = event.target.closest('[data-review-quick]');
    if (quick) {
      const mode = quick.dataset.reviewQuick;
      if (mode === 'unread') $('#reviews-filter').value = 'unread';
      if (mode === 'pending') $('#reviews-reply').value = 'pending';
      if (mode === 'hidden') $('#reviews-filter').value = 'hidden';
      if (mode === 'low') { $('#reviews-rating').value = 'all'; $('#reviews-search').value = ''; }
      if (mode === 'storeLiked') { $('#reviews-search').value = ''; }
      $$('#eg-review-quick-filters button').forEach(btn => btn.classList.toggle('is-active', btn === quick));
      if (mode === 'low' || mode === 'storeLiked') {
        const original = reviews;
        if (mode === 'low') reviews = original.filter(item => Number(item.rating) <= 2);
        else reviews = original.filter(item => item.storeLiked);
        renderReviews();
        reviews = original;
      } else renderReviews();
      return;
    }

    const openReview = event.target.closest('[data-eg-open-review]');
    if (openReview) { openReviewDrawer(openReview.dataset.egOpenReview); return; }
    const openLike = event.target.closest('[data-eg-open-like]');
    if (openLike) { openLikeDrawer(openLike.dataset.egOpenLike); return; }
    if (event.target.closest('[data-eg-close-drawer]')) { closeDrawer(); return; }

    const action = event.target.closest('[data-eg-action]');
    if (action) {
      const name = action.dataset.egAction;
      if (name.startsWith('review')) await performReviewAction(name, action.dataset.id, action);
      else await performLikeAction(name, action.dataset.id, action);
      return;
    }

    const reviewBulk = event.target.closest('[data-eg-review-bulk]');
    if (reviewBulk) { await bulkReviews(reviewBulk.dataset.egReviewBulk, reviewBulk); return; }
    const likeBulk = event.target.closest('[data-eg-like-bulk]');
    if (likeBulk) { await bulkLikes(likeBulk.dataset.egLikeBulk, likeBulk); return; }

    const page = event.target.closest('[data-eg-page]');
    if (page) {
      if (page.dataset.egPage === 'review') { reviewPage += Number(page.dataset.dir); renderReviews(); }
      else { likePage += Number(page.dataset.dir); renderLikes(); }
      return;
    }

    const exportButton = event.target.closest('[data-eg-export]');
    if (exportButton) { exportCsv(exportButton.dataset.egExport); return; }
    const profileButton = event.target.closest('[data-view-profile]');
    if (profileButton) { event.preventDefault(); viewProfile(profileButton.dataset.ownerUid, profileButton.dataset.email); return; }

    const addQuick = event.target.closest('[data-eg-add-quick]');
    if (addQuick) {
      $('#eg-quick-replies-editor').insertAdjacentHTML('beforeend', `<div><span>+</span><input class="adm-input" maxlength="240" placeholder="Nueva respuesta rápida"><button type="button" class="eg-icon-btn" data-eg-remove-quick aria-label="Eliminar">×</button></div>`);
      $$('#eg-quick-replies-editor input').at(-1)?.focus();
      return;
    }
    const removeQuick = event.target.closest('[data-eg-remove-quick]');
    if (removeQuick) { removeQuick.closest('div').remove(); return; }
    const saveButton = event.target.closest('[data-eg-save-settings]');
    if (saveButton) { await saveSettings(saveButton.dataset.egSaveSettings, saveButton); return; }

    const card = event.target.closest('.eg-card');
    if (card && !event.target.closest('a,button,input,select,summary,details')) {
      if (card.dataset.reviewId) openReviewDrawer(card.dataset.reviewId);
      else if (card.dataset.likeId) openLikeDrawer(card.dataset.likeId);
    }
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if ($('#eg-modal-root')?.innerHTML) $('#eg-modal-root').innerHTML = ''; else closeDrawer(); } });
  document.querySelectorAll('[data-section="resenas"]').forEach(button => button.addEventListener('click', () => markCurrentSeen('reviews')));
  document.querySelectorAll('[data-section="me-gusta"]').forEach(button => button.addEventListener('click', () => markCurrentSeen('likes')));
}

function initViews() {
  if (settings.rememberView) {
    reviewView = localStorage.getItem('tt-admin-review-view') || 'inbox';
    likeView = localStorage.getItem('tt-admin-like-view') || 'activity';
  }
  switchReviewView(['inbox','products','clients','analytics','settings'].includes(reviewView) ? reviewView : 'inbox');
  switchLikeView(['activity','products','clients','analytics','settings'].includes(likeView) ? likeView : 'activity');
}

hydrateSections();
bindEvents();
renderSettings();
initViews();

onAuthStateChanged(auth, async current => {
  if (current?.email?.toLowerCase() !== SUPER_ADMIN) return;
  user = current;
  await appCheckReady;

  onSnapshot(query(collection(db, 'users'), limit(ENGAGEMENT_REALTIME_LIMIT)), snapshot => {
    usersByUid = new Map(snapshot.docs.map(item => [item.id, item.data()]));
    renderReviews(); renderLikes(); refreshDrawer();
  });
  onSnapshot(query(collection(db, 'reviewRecords'), limit(ENGAGEMENT_REALTIME_LIMIT)), snapshot => {
    reviews = snapshot.docs.map(item => ({ ...item.data(), reviewId: item.data().reviewId || item.id })).sort((a,b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    setBadge('reviews-unread-badge', reviews.filter(item => item.unread).length);
    renderReviews(); refreshDrawer();
  });
  onSnapshot(query(collection(db, 'likeRecords'), limit(ENGAGEMENT_REALTIME_LIMIT)), snapshot => {
    likes = snapshot.docs.map(item => ({ ...item.data(), likeId: item.data().likeId || item.id })).sort((a,b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    setBadge('likes-unread-badge', likes.filter(item => item.unread).length);
    renderLikes(); refreshDrawer();
  });
  onSnapshot(doc(db, 'settings', 'reviewQuickReplies'), snapshot => {
    if (Array.isArray(snapshot.data()?.items)) quickReplies = snapshot.data().items.map(value => String(value || '').trim()).filter(Boolean).slice(0,20);
    renderSettings(); refreshDrawer();
  });
  onSnapshot(doc(db, 'settings', 'engagementAdmin'), snapshot => {
    settings = { ...DEFAULT_SETTINGS, ...(snapshot.data() || {}) };
    applySettings();
  });
});
