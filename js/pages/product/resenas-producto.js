import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-2';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, startAfter } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { heartIconMarkup } from '../../components/favorites/icono-corazon.js?v=tintin-20260817-heart-icon-1';
import { isValidReviewRating, syncReviewPublishState, reportMissingReviewRating } from './validacion-puntuacion-resena.js?v=tintin-20260831-review-rating-required-1';

const productId = String(new URLSearchParams(location.search).get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 180);
let currentUser = null;
let reviews = [];
let likedReviewIds = new Set();
let likedReplyIds = new Set();
let stats = { count: 0, average: 0, distribution: {} };
let productLikeCount = 0;
let productLiked = false;
let selectedRating = 0;
let unsubscribeReviews = null;
let unsubscribeStats = null;
let unsubscribeLikes = null;
let deepLinkHandled = false;
const PENDING_INTENT_KEY = 'tt_product_community_intent_v2';
const PROFILE_AVATAR_FALLBACK = '/assets-tintin/images/general/logo.png';
const PUBLIC_REVIEWS_LIMIT = 100;
let publicReviewCursor = null;
let publicReviewsHaveMore = false;
let publicReviewsLoadingMore = false;

function productReturnPath() {
  return `/product?id=${encodeURIComponent(productId)}#product-reviews`;
}

function savePendingIntent(action, payload = {}) {
  try {
    sessionStorage.setItem(PENDING_INTENT_KEY, JSON.stringify({ productId, action, payload, createdAt: Date.now() }));
  } catch {}
}

function takePendingIntent() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PENDING_INTENT_KEY) || 'null');
    if (!parsed || parsed.productId !== productId || Date.now() - Number(parsed.createdAt || 0) > 2 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

function clearPendingIntent() {
  try { sessionStorage.removeItem(PENDING_INTENT_KEY); } catch {}
}

function requestCommunityLogin(action, payload = {}) {
  savePendingIntent(action, payload);
  window.location.assign(`/login?from=${encodeURIComponent(productReturnPath())}`);
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function displayPublicName(value, authorType = 'customer') {
  if (authorType === 'store') return 'Tintin Accesorios';
  const raw = String(value || 'Clienta Tintin').trim();
  if (raw.includes('***')) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => `${Array.from(part)[0] || 'C'}***`).join(' ') || 'Clienta Tintin';
}

function dateValue(value) {
  const date = value?.toDate?.() || new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function relativeDate(value) {
  const date = dateValue(value);
  const elapsedMs = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 15) return 'Ahora';
  if (seconds < 60) return `Hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return date.toLocaleDateString('es-PY', { weekday: 'long' });
  return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function fullDateTitle(value) {
  return dateValue(value).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeRating(value) {
  return Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
}

function starText(rating) {
  const value = normalizeRating(rating);
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
}

function reviewIdOf(review) {
  return String(review?.reviewId || review?.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 180);
}

function replyIdOf(reply) {
  return String(reply?.replyId || reply?.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 180);
}

function avatarMarkup(photoUrl, name, extraClass = '') {
  const url = safeImageUrl(photoUrl);
  const label = displayPublicName(name);
  const source = url || PROFILE_AVATAR_FALLBACK;
  return `<span class="tt-community-avatar${url ? '' : ' is-fallback'} ${extraClass}"><img src="${escapeHtml(source)}" alt="${escapeHtml(url ? '' : label)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}

function upsertLocalReview(review) {
  const id = reviewIdOf(review);
  if (!id) return;
  const index = reviews.findIndex(item => reviewIdOf(item) === id);
  if (index >= 0) reviews[index] = { ...reviews[index], ...review };
  else reviews.push(review);
}

function ensureSection() {
  let section = document.getElementById('product-reviews');
  if (section) return section;
  section = document.createElement('section');
  section.id = 'product-reviews';
  section.className = 'tt-reviews-product tt-product-community';
  section.innerHTML = `
    <div class="tt-reviews-shell">
      <div class="tt-reviews-layout">
        <aside class="tt-reviews-summary" aria-labelledby="product-reviews-title">
          <p class="tt-section-sub">Comunidad Tintin</p>
          <h2 class="tt-section-title" id="product-reviews-title">Opiniones y comentarios</h2>
          <div id="product-review-summary" aria-live="polite"></div>
        </aside>
        <div class="tt-reviews-main" id="product-reviews-content">
          <div class="tt-community-notice" id="product-community-notice" role="status" aria-live="polite" hidden></div>
          <div id="product-review-form"></div>
          <div class="tt-review-list" id="product-review-list" aria-live="polite"></div>
        </div>
      </div>
    </div>`;

  const socialBar = document.querySelector('.tt-product-social-bar');
  const related = document.querySelector('.tt-related-section, .tt-related-products, #related-products');
  const tinsel = document.querySelector('.tinsel, #tinsel-root');
  const productDetail = document.getElementById('product-detail');
  if (socialBar?.parentNode) socialBar.insertAdjacentElement('afterend', section);
  else if (related?.parentNode) related.parentNode.insertBefore(section, related);
  else if (tinsel?.parentNode) tinsel.insertAdjacentElement('afterend', section);
  else if (productDetail?.parentNode) productDetail.insertAdjacentElement('afterend', section);
  else document.body.insertBefore(section, document.querySelector('.tt-footer'));
  return section;
}

async function requestApi(input, method = 'POST', action = 'reviewInteractions', forceRefresh = false) {
  const user = auth.currentUser || currentUser;
  if (!user) {
    const error = new Error('Iniciá sesión para participar');
    error.requiresLogin = true;
    throw error;
  }
  let token;
  try {
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    token = await user.getIdToken(forceRefresh);
  } catch {
    try { token = await (auth.currentUser || user).getIdToken(true); }
    catch {
      const error = new Error('Para confirmar esta acción necesitás volver a iniciar sesión. Conservamos lo que escribiste y te devolvemos aquí.');
      error.status = 401;
      error.requiresLogin = true;
      throw error;
    }
  }
  const url = method === 'GET'
    ? `/api/engagement?action=${encodeURIComponent(action)}&productId=${encodeURIComponent(productId)}`
    : '/api/engagement';
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    body: method === 'POST' ? JSON.stringify(input) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    const error = new Error(result.error || 'No se pudo completar la acción');
    error.status = response.status;
    error.code = result.code || '';
    error.retryAfterMs = Number(result.retryAfterMs) || 0;
    error.requiresLogin = response.status === 401;
    throw error;
  }
  return result;
}

async function api(input, method = 'POST', action = 'reviewInteractions') {
  try { return await requestApi(input, method, action); }
  catch (error) {
    if (error?.status !== 401 || !auth.currentUser) throw error;
    try { return await requestApi(input, method, action, true); }
    catch (retryError) {
      if (retryError?.status === 401) {
        const preserved = new Error('Para confirmar esta acción necesitás volver a iniciar sesión. Conservamos lo que escribiste y te devolvemos aquí.');
        preserved.status = 401;
        preserved.requiresLogin = true;
        throw preserved;
      }
      throw retryError;
    }
  }
}

function renderSummary() {
  const root = document.getElementById('product-review-summary');
  if (!root) return;
  const count = Math.max(0, Number(stats.count) || 0);
  const average = Math.max(0, Math.min(5, Number(stats.average) || 0));
  const distribution = stats.distribution || {};
  const rows = [5,4,3,2,1].map(rating => {
    const amount = Math.max(0, Number(distribution[rating] ?? distribution[String(rating)]) || 0);
    const percent = count ? Math.min(100, Math.round((amount / count) * 100)) : 0;
    return `<div class="tt-review-stats-row"><span class="tt-review-stats-label">${rating} <span aria-hidden="true">★</span></span><span class="tt-review-stats-track"><span class="tt-review-stats-fill" style="--tt-rating-fill:${percent}%"></span></span><span class="tt-review-stats-meta">${amount}</span></div>`;
  }).join('');
  root.innerHTML = `
    <div class="tt-community-metrics">
      <div class="tt-reviews-score"><strong>${count ? average.toFixed(1).replace('.', ',') : '—'}</strong><span>de 5</span></div>
      <div><div class="tt-review-stars" aria-label="${average.toFixed(1)} de 5 estrellas">${starText(Math.round(average))}</div><div class="tt-review-date">${count} opinión${count === 1 ? '' : 'es'}</div></div>
    </div>
    <div class="tt-review-stats-distribution" aria-label="Distribución de puntuaciones">${rows}</div>`;
}

function showCommunityNotice(message) {
  const notice = document.getElementById('product-community-notice');
  if (!notice) return;
  notice.textContent = message || '';
  notice.hidden = !message;
}

function highlightDeepLink() {
  if (deepLinkHandled) return;
  const match = String(location.hash || '').match(/^#(review|reply)-([A-Za-z0-9_-]+)$/);
  if (!match) return;
  const target = document.getElementById(`${match[1]}-${match[2]}`);
  if (!target) return;
  deepLinkHandled = true;
  requestAnimationFrame(() => {
    target.classList.add('tt-review-deeplink-highlight');
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.classList.remove('tt-review-deeplink-highlight'), 2200);
  });
}

function renderReply(reviewId, reply) {
  const replyId = replyIdOf(reply);
  const liked = likedReplyIds.has(replyId);
  const count = Math.max(0, Number(reply.likeCount) || 0);
  const authorType = reply.authorType === 'store' ? 'store' : 'customer';
  const name = displayPublicName(reply.publicName, authorType);
  return `<div class="tt-review-thread-message${authorType === 'store' ? ' is-store' : ''}" id="reply-${escapeHtml(replyId)}">
    ${avatarMarkup(reply.publicPhotoUrl, name, 'is-small')}
    <div class="tt-review-thread-body">
      <div class="tt-review-thread-meta"><strong class="tt-review-thread-author">${escapeHtml(name)}</strong><time title="${escapeHtml(fullDateTitle(reply.createdAt))}">${escapeHtml(relativeDate(reply.createdAt))}</time></div>
      <p class="tt-review-thread-text">${escapeHtml(reply.text)}</p>
      <div class="tt-review-social-actions">
        ${currentUser ? `<button type="button" class="tt-review-like-button${liked ? ' is-liked is-locked' : ''}" data-reply-like="${escapeHtml(replyId)}" data-review-id="${escapeHtml(reviewId)}" aria-pressed="${liked}" ${liked ? 'disabled' : ''}><span aria-hidden="true">${heartIconMarkup(liked)}</span><span>${liked ? 'Te gusta' : (count ? `${count} Me gusta` : 'Me gusta')}</span></button>` : `<span class="tt-review-like-count">${count ? `${heartIconMarkup(true)} ${count} Me gusta` : ''}</span>`}
      </div>
    </div>
  </div>`;
}

function renderReview(review) {
  const id = reviewIdOf(review);
  const liked = likedReviewIds.has(id);
  const likeCount = Math.max(0, Number(review.likeCount) || 0);
  const conversation = Array.isArray(review.conversation) ? review.conversation : [];
  const isStore = review.publicName === 'Tintin Accesorios';
  const name = displayPublicName(review.publicName, isStore ? 'store' : 'customer');
  return `<article class="tt-review-card" id="review-${escapeHtml(id)}" data-review-card="${escapeHtml(id)}">
    <div class="tt-review-head">
      <div class="tt-review-author-wrap">${avatarMarkup(review.publicPhotoUrl, name)}<div><div class="tt-review-author">${escapeHtml(name)}</div><div class="tt-review-stars" aria-label="${Number(review.rating)} de 5 estrellas">${starText(review.rating)}</div></div></div>
      <time class="tt-review-date" datetime="${dateValue(review.createdAt).toISOString()}" title="${escapeHtml(fullDateTitle(review.createdAt))}">${escapeHtml(relativeDate(review.createdAt))}</time>
    </div>
    <p class="tt-review-comment">${escapeHtml(review.comment)}</p>
    ${review.storeLiked ? `<div class="tt-review-store-like">${heartIconMarkup(true)} A Tintin Accesorios le gustó esta reseña</div>` : ''}
    <div class="tt-review-social-actions">
      ${currentUser ? `<button type="button" class="tt-review-like-button${liked ? ' is-liked is-locked' : ''}" data-review-like="${escapeHtml(id)}" aria-pressed="${liked}" ${liked ? 'disabled' : ''}><span aria-hidden="true">${heartIconMarkup(liked)}</span><span>${liked ? 'Te gusta' : (likeCount ? `${likeCount} Me gusta` : 'Me gusta')}</span></button><button type="button" class="tt-review-reply-toggle" data-reply-toggle="${escapeHtml(id)}">Responder</button>` : `<button type="button" class="tt-review-reply-login" data-reply-login="${escapeHtml(id)}">Iniciá sesión para responder</button>`}
    </div>
    ${conversation.length ? `<div class="tt-review-thread">${conversation.map(reply => renderReply(id, reply)).join('')}</div>` : ''}
    <form class="tt-review-reply-form" data-reply-form="${escapeHtml(id)}" hidden><textarea class="tt-review-reply-input" name="reply" maxlength="1200" required placeholder="Escribí una respuesta…"></textarea><div class="tt-review-reply-actions"><button type="button" data-reply-cancel="${escapeHtml(id)}">Cancelar</button><button type="submit" class="tt-btn">Responder</button></div><div role="alert" data-reply-error></div></form>
  </article>`;
}

function renderReviews() {
  const root = document.getElementById('product-review-list');
  if (!root) return;
  const sorted = [...reviews].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  root.innerHTML = sorted.length
    ? sorted.map(renderReview).join('')
    : '<div class="tt-review-empty">Todavía no hay comentarios. Podés ser la primera en compartir tu opinión.</div>';
  if (sorted.length && publicReviewsHaveMore) {
    root.insertAdjacentHTML('beforeend', '<button type="button" class="tt-btn tt-review-load-more" data-review-load-more>Cargar más opiniones</button>');
  }
  document.querySelectorAll('[data-product-comment-count]').forEach(node => { node.textContent = String(reviews.length); });
  highlightDeepLink();
}

async function loadMorePublicReviews(button) {
  if (publicReviewsLoadingMore || !publicReviewsHaveMore || !publicReviewCursor) return;
  publicReviewsLoadingMore = true;
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try {
    const snapshot = await getDocs(query(
      collection(db, 'products', productId, 'reviews'),
      orderBy('createdAt', 'desc'),
      startAfter(publicReviewCursor),
      limit(PUBLIC_REVIEWS_LIMIT)
    ));
    reviews = [...reviews, ...snapshot.docs.map(document => ({ id: document.id, ...document.data() }))]
      .filter((review, index, list) => reviewIdOf(review) && list.findIndex(item => reviewIdOf(item) === reviewIdOf(review)) === index);
    publicReviewCursor = snapshot.docs.at(-1) || publicReviewCursor;
    publicReviewsHaveMore = snapshot.size === PUBLIC_REVIEWS_LIMIT;
    renderReviews();
  } catch {
    showCommunityNotice('No pudimos cargar más opiniones. Volvé a intentar en unos segundos.');
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  } finally {
    publicReviewsLoadingMore = false;
  }
}

function renderProductLike() {
  const button = document.getElementById('btn-product-like');
  if (!button) return;
  button.setAttribute('aria-pressed', String(productLiked));
  button.setAttribute('aria-label', productLiked ? 'Ya te gusta este producto' : 'Me gusta este producto');
  button.classList.toggle('is-liked', productLiked);
  button.classList.toggle('is-locked', productLiked);
  button.disabled = productLiked;
  button.querySelector('[data-product-like-label]')?.replaceChildren(document.createTextNode(productLiked ? 'Te gusta' : 'Me gusta'));
  button.querySelector('[data-product-like-count]')?.replaceChildren(document.createTextNode(String(productLikeCount)));
  document.querySelectorAll('[data-product-popular-badge]').forEach(node => { node.hidden = productLikeCount < 15; });
}

async function loadPublicLikeStats() {
  try {
    const response = await fetch(`/api/engagement?action=productLikes&productId=${encodeURIComponent(productId)}`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok === true) {
      productLikeCount = Number(result.likeCount) || 0;
      renderProductLike();
    }
  } catch {}
}

async function loadPublicReviewStats() {
  try {
    const response = await fetch(`/api/engagement?action=reviewStats&productId=${encodeURIComponent(productId)}`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok === true && result.stats) {
      stats = result.stats;
      renderSummary();
    }
  } catch {}
}

function ratingButtons() {
  return `<div class="tt-rating-field"><span class="tt-rating-label">Tu puntuación <em>obligatoria</em></span><div class="tt-rating-scale"><div class="tt-rating-input" role="radiogroup" aria-label="Puntuación de la reseña" data-rating-value="${selectedRating}">${[1,2,3,4,5].map(value => `<button type="button" role="radio" aria-checked="${selectedRating === value}" tabindex="${selectedRating ? (selectedRating === value ? 0 : -1) : (value === 1 ? 0 : -1)}" class="${selectedRating >= value ? 'is-active' : ''}${selectedRating === value ? ' is-current' : ''}" data-review-rating="${value}" aria-label="${value} estrella${value === 1 ? '' : 's'}">★</button>`).join('')}</div><div class="tt-rating-numbers" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div></div><span class="tt-rating-status" data-rating-status aria-live="polite">${selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Elegí de 1 a 5 estrellas'}</span></div>`;
}

function syncRatingButtons(previewRating = null) {
  const group = document.querySelector('.tt-rating-input');
  if (!group) return;
  const preview = previewRating === null ? null : normalizeRating(previewRating);
  const effective = preview === null ? selectedRating : preview;
  group.dataset.ratingValue = String(selectedRating);
  group.querySelectorAll('[data-review-rating]').forEach(button => {
    const value = normalizeRating(button.dataset.reviewRating);
    button.classList.toggle('is-active', effective > 0 && value <= effective);
    button.classList.toggle('is-current', preview === null && selectedRating === value);
    button.setAttribute('aria-checked', String(selectedRating === value));
    button.tabIndex = selectedRating ? (selectedRating === value ? 0 : -1) : (value === 1 ? 0 : -1);
  });
  const status = group.parentElement?.querySelector('[data-rating-status]');
  if (status) status.textContent = selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Elegí de 1 a 5 estrellas';
  syncReviewPublishState(document.getElementById('tt-review-editor'), selectedRating);
}

function setSelectedRating(value, { focus = false } = {}) {
  const next = normalizeRating(value);
  if (!next) return;
  selectedRating = next;
  syncRatingButtons();
  if (focus) document.querySelector(`[data-review-rating="${selectedRating}"]`)?.focus();
}

function renderForm() {
  const root = document.getElementById('product-review-form');
  if (!root) return;
  const logged = Boolean(currentUser);
  const name = currentUser?.displayName || currentUser?.email || 'Tintin';
  root.innerHTML = `<form class="tt-review-form tt-community-composer" id="tt-review-editor">
    ${avatarMarkup(currentUser?.photoURL, name)}
    <div class="tt-community-composer-body">
      <h3>${logged ? '¿Qué te pareció este producto?' : 'Compartí tu opinión'}</h3>
      <p>${logged ? 'Cada publicación es independiente. La puntuación es obligatoria.' : 'Podés escribir ahora; al publicar te pediremos iniciar sesión y volverás acá.'}</p>
      ${ratingButtons()}
      <textarea class="tt-review-textarea" name="comment" maxlength="1600" required placeholder="Escribí tu opinión…"></textarea>
      <div class="tt-review-form-actions"><small>${logged ? 'Hasta 10 publicaciones seguidas; luego se activa una pausa de 30 minutos. Tu identidad pública se protege.' : 'Tu texto y puntuación se conservarán al iniciar sesión.'}</small><button type="submit" class="tt-btn" data-review-submit ${isValidReviewRating(selectedRating) ? '' : 'disabled aria-disabled="true"'}>${logged ? 'Publicar opinión' : 'Iniciar sesión y publicar'}</button></div>
      <div role="alert" data-review-error></div>
    </div>
  </form>`;
  syncRatingButtons();
}

async function loadSocialState() {
  if (!currentUser) {
    likedReviewIds = new Set();
    likedReplyIds = new Set();
    productLiked = false;
    selectedRating = 0;
    renderForm();
    renderReviews();
    renderProductLike();
    showCommunityNotice('');
    return;
  }
  const [interactions, favorite] = await Promise.all([
    api(null, 'GET', 'reviewInteractions'),
    api(null, 'GET', 'ownFavorite'),
  ]);
  likedReviewIds = new Set(interactions.interactions?.reviewIds || []);
  likedReplyIds = new Set(interactions.interactions?.replyIds || []);
  productLiked = favorite.favorite === true;
  renderForm();
  renderReviews();
  renderProductLike();
  showCommunityNotice('');
}

function subscribePublic() {
  unsubscribeReviews?.();
  unsubscribeStats?.();
  unsubscribeLikes?.();
  publicReviewCursor = null;
  publicReviewsHaveMore = false;
  unsubscribeReviews = onSnapshot(query(
    collection(db, 'products', productId, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(PUBLIC_REVIEWS_LIMIT)
  ), snapshot => {
    reviews = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    publicReviewCursor = snapshot.docs.at(-1) || null;
    publicReviewsHaveMore = snapshot.size === PUBLIC_REVIEWS_LIMIT;
    renderReviews();
  }, () => renderReviews());
  unsubscribeStats = onSnapshot(doc(db, 'productReviewStats', productId), snapshot => {
    stats = snapshot.exists() ? snapshot.data() : { count: 0, average: 0, distribution: {} };
    renderSummary();
  }, () => loadPublicReviewStats());
  unsubscribeLikes = onSnapshot(doc(db, 'productEngagementStats', productId), snapshot => {
    productLikeCount = snapshot.exists() ? Number(snapshot.data()?.likeCount) || 0 : 0;
    renderProductLike();
  }, renderProductLike);
  loadPublicLikeStats();
  loadPublicReviewStats();
}

function updateLocalReview(reviewId, updater) {
  const review = reviews.find(item => reviewIdOf(item) === reviewId);
  if (review) updater(review);
}

document.addEventListener('click', async event => {
  const openCommunity = event.target.closest('[data-open-community]');
  if (openCommunity) {
    event.preventDefault();
    ensureSection().scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => document.querySelector('#tt-review-editor textarea')?.focus(), 350);
    return;
  }

  const ratingButton = event.target.closest('[data-review-rating]');
  if (ratingButton) {
    event.preventDefault();
    setSelectedRating(ratingButton.dataset.reviewRating);
    return;
  }

  const reviewLoadMore = event.target.closest('[data-review-load-more]');
  if (reviewLoadMore) {
    event.preventDefault();
    await loadMorePublicReviews(reviewLoadMore);
    return;
  }

  const productButton = event.target.closest('#btn-product-like');
  if (productButton) {
    event.preventDefault();
    if (productLiked) return;
    if (!currentUser) return requestCommunityLogin('productLike');
    productButton.disabled = true;
    try {
      const result = await api({ action: 'toggleFavorite', productId });
      productLiked = result.selected === true;
      productLikeCount = Number(result.likeCount) || productLikeCount;
      renderProductLike();
      showCommunityNotice(result.alreadyLiked ? 'Este Me gusta ya estaba guardado.' : 'Tu Me gusta quedó guardado de forma permanente.');
    } catch (failure) {
      if (failure.requiresLogin) return requestCommunityLogin('productLike');
      showCommunityNotice(failure.message || 'No pudimos guardar tu Me gusta.');
      productButton.disabled = false;
    }
    return;
  }

  const reviewLike = event.target.closest('[data-review-like]');
  if (reviewLike) {
    event.preventDefault();
    const reviewId = reviewLike.dataset.reviewLike;
    if (likedReviewIds.has(reviewId)) return;
    if (!currentUser) return requestCommunityLogin('reviewLike', { reviewId });
    reviewLike.disabled = true;
    try {
      const result = await api({ action: 'toggleReviewLike', productId, reviewId });
      likedReviewIds.add(reviewId);
      updateLocalReview(reviewId, review => { review.likeCount = result.likeCount; });
      renderReviews();
    } catch (failure) {
      if (failure.requiresLogin) return requestCommunityLogin('reviewLike', { reviewId });
      showCommunityNotice(failure.message || 'No pudimos guardar este Me gusta.');
      reviewLike.disabled = false;
    }
    return;
  }

  const replyLike = event.target.closest('[data-reply-like]');
  if (replyLike) {
    event.preventDefault();
    const replyId = replyLike.dataset.replyLike;
    const reviewId = replyLike.dataset.reviewId;
    if (likedReplyIds.has(replyId)) return;
    if (!currentUser) return requestCommunityLogin('replyLike', { reviewId, replyId });
    replyLike.disabled = true;
    try {
      const result = await api({ action: 'likeReply', productId, reviewId, replyId });
      likedReplyIds.add(replyId);
      updateLocalReview(reviewId, review => {
        const reply = (review.conversation || []).find(item => replyIdOf(item) === replyId);
        if (reply) reply.likeCount = result.likeCount;
      });
      renderReviews();
    } catch (failure) {
      if (failure.requiresLogin) return requestCommunityLogin('replyLike', { reviewId, replyId });
      showCommunityNotice(failure.message || 'No pudimos guardar este Me gusta.');
      replyLike.disabled = false;
    }
    return;
  }

  const toggle = event.target.closest('[data-reply-toggle]');
  if (toggle) {
    event.preventDefault();
    const form = document.querySelector(`[data-reply-form="${CSS.escape(toggle.dataset.replyToggle)}"]`);
    if (form) { form.hidden = false; form.querySelector('textarea')?.focus(); }
    return;
  }

  const cancel = event.target.closest('[data-reply-cancel]');
  if (cancel) {
    event.preventDefault();
    const form = document.querySelector(`[data-reply-form="${CSS.escape(cancel.dataset.replyCancel)}"]`);
    if (form) { form.reset(); form.hidden = true; }
    return;
  }

  const loginReply = event.target.closest('[data-reply-login]');
  if (loginReply) {
    event.preventDefault();
    requestCommunityLogin('openReply', { reviewId: loginReply.dataset.replyLogin });
  }
});

document.addEventListener('keydown', event => {
  const button = event.target.closest('[data-review-rating]');
  if (!button) return;
  const current = selectedRating || normalizeRating(button.dataset.reviewRating) || 1;
  let next = null;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 1);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, current - 1);
  if (event.key === 'Home') next = 1;
  if (event.key === 'End') next = 5;
  if (next === null) return;
  event.preventDefault();
  setSelectedRating(next, { focus: true });
});

document.addEventListener('pointerover', event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const button = event.target.closest('[data-review-rating]');
  if (button) syncRatingButtons(button.dataset.reviewRating);
});

document.addEventListener('pointerout', event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const group = event.target.closest('.tt-rating-input');
  if (group && !group.contains(event.relatedTarget)) syncRatingButtons();
});

document.addEventListener('submit', async event => {
  if (event.target.id === 'tt-review-editor') {
    event.preventDefault();
    const submit = event.target.querySelector('[type="submit"]');
    const errorNode = event.target.querySelector('[data-review-error]');
    errorNode.textContent = '';
    const comment = String(new FormData(event.target).get('comment') || '').trim();
    if (!isValidReviewRating(selectedRating)) {
      reportMissingReviewRating(event.target);
      syncReviewPublishState(event.target, selectedRating);
      return;
    }
    if (comment.length < 3) {
      errorNode.textContent = 'Escribí un comentario de al menos 3 caracteres.';
      return;
    }
    submit.disabled = true;
    try {
      if (!currentUser) return requestCommunityLogin('review', { rating: selectedRating, comment });
      const result = await api({ action: 'createReview', productId, rating: selectedRating, comment });
      if (result.publicReview) {
        upsertLocalReview(result.publicReview);
        renderReviews();
      }
      event.target.reset();
      selectedRating = 0;
      renderForm();
      const blocked = result.rateLimit?.blockedUntil ? dateValue(result.rateLimit.blockedUntil) : null;
      showCommunityNotice(blocked && blocked.getTime() > Date.now()
        ? `Tu comentario se publicó. Alcanzaste 10 publicaciones; podés volver a comentar después de ${blocked.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}.`
        : 'Tu opinión se publicó correctamente.');
    } catch (failure) {
      if (failure.requiresLogin) return requestCommunityLogin('review', { rating: selectedRating, comment });
      errorNode.textContent = failure.message || 'No pudimos publicar tu opinión.';
      submit.disabled = false;
    }
    return;
  }

  const replyForm = event.target.closest('[data-reply-form]');
  if (replyForm) {
    event.preventDefault();
    const reviewId = replyForm.dataset.replyForm;
    const text = String(new FormData(replyForm).get('reply') || '').trim();
    const errorNode = replyForm.querySelector('[data-reply-error]');
    const submit = replyForm.querySelector('[type="submit"]');
    errorNode.textContent = '';
    if (!text) { errorNode.textContent = 'Escribí una respuesta.'; return; }
    if (!currentUser) return requestCommunityLogin('reply', { reviewId, text });
    submit.disabled = true;
    try {
      const result = await api({ action: 'replyReview', productId, reviewId, text });
      updateLocalReview(reviewId, review => { review.conversation = result.review?.conversation || review.conversation || []; });
      renderReviews();
      showCommunityNotice('Tu respuesta se publicó correctamente.');
    } catch (failure) {
      if (failure.requiresLogin) return requestCommunityLogin('reply', { reviewId, text });
      errorNode.textContent = failure.message || 'No pudimos publicar tu respuesta.';
      submit.disabled = false;
    }
  }
});

async function resumePendingIntent() {
  const intent = takePendingIntent();
  if (!intent || !currentUser) return;
  try {
    if (intent.action === 'productLike') {
      const result = await api({ action: 'toggleFavorite', productId });
      productLiked = true;
      productLikeCount = Number(result.likeCount) || productLikeCount;
      renderProductLike();
    } else if (intent.action === 'reviewLike' && intent.payload?.reviewId) {
      const result = await api({ action: 'toggleReviewLike', productId, reviewId: intent.payload.reviewId });
      likedReviewIds.add(intent.payload.reviewId);
      updateLocalReview(intent.payload.reviewId, review => { review.likeCount = result.likeCount; });
      renderReviews();
    } else if (intent.action === 'replyLike' && intent.payload?.reviewId && intent.payload?.replyId) {
      const result = await api({ action: 'likeReply', productId, reviewId: intent.payload.reviewId, replyId: intent.payload.replyId });
      likedReplyIds.add(intent.payload.replyId);
      updateLocalReview(intent.payload.reviewId, review => {
        const reply = (review.conversation || []).find(item => replyIdOf(item) === intent.payload.replyId);
        if (reply) reply.likeCount = result.likeCount;
      });
      renderReviews();
    } else if (intent.action === 'review') {
      const result = await api({ action: 'createReview', productId, rating: normalizeRating(intent.payload?.rating), comment: String(intent.payload?.comment || '') });
      if (result.publicReview) {
        upsertLocalReview(result.publicReview);
        renderReviews();
      }
      selectedRating = 0;
      renderForm();
    } else if (intent.action === 'reply' && intent.payload?.reviewId) {
      await api({ action: 'replyReview', productId, reviewId: intent.payload.reviewId, text: String(intent.payload?.text || '') });
    } else if (intent.action === 'openReply' && intent.payload?.reviewId) {
      requestAnimationFrame(() => {
        const form = document.querySelector(`[data-reply-form="${CSS.escape(intent.payload.reviewId)}"]`);
        if (form) { form.hidden = false; form.querySelector('textarea')?.focus(); }
      });
    }
    clearPendingIntent();
    showCommunityNotice('Tu acción quedó guardada correctamente.');
  } catch (error) {
    if (!error.requiresLogin) showCommunityNotice(error.message || 'No pudimos retomar tu acción todavía.');
  }
}

if (productId) {
  ensureSection();
  renderSummary();
  renderForm();
  appCheckReady.then(subscribePublic);
  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    loadSocialState().then(() => resumePendingIntent()).catch(error => {
      console.warn('[reviews] No se pudo cargar el estado social.', error);
      renderForm();
      renderReviews();
    });
  });
}
