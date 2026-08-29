import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { heartIconMarkup } from '../../components/favorites/icono-corazon.js?v=tintin-20260817-heart-icon-1';

const productId = String(new URLSearchParams(location.search).get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 180);
let currentUser = null;
let ownReview = null;
let reviews = [];
let likedReviewIds = new Set();
let stats = { count: 0, average: 0, distribution: {} };
let productLikeCount = 0;
let productLiked = false;
let selectedRating = 0;
let unsubscribeReviews = null;
let unsubscribeStats = null;
let unsubscribeLikes = null;
let deepLinkHandled = false;
const PENDING_INTENT_KEY = 'tt_product_community_intent_v1';

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

function publicAlias(value) {
  const parts = String(value || 'Clienta Tintin').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => `${Array.from(part)[0] || 'C'}***`).join(' ');
}

function dateValue(value) {
  const date = value?.toDate?.() || new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function relativeDate(value) {
  const date = dateValue(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Recién publicado';
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Hace ${elapsedHours} h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 14) return `Hace ${elapsedDays} d`;
  return date.toLocaleDateString('es-PY');
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

function ensureSection() {
  let section = document.getElementById('product-reviews');
  if (section) return section;
  section = document.createElement('section');
  section.id = 'product-reviews';
  section.className = 'tt-reviews-product tt-product-community';
  section.dataset.collapsed = 'false';
  section.innerHTML = `
    <div class="container tt-reviews-layout">
      <aside class="tt-reviews-summary" aria-labelledby="product-reviews-title">
        <p class="tt-section-sub">Comunidad Tintin</p>
        <h2 class="tt-section-title" id="product-reviews-title">Opiniones y comentarios</h2>
        <div id="product-review-summary" aria-live="polite"></div>
      </aside>
      <div id="product-reviews-content">
        <div class="tt-community-notice" id="product-community-notice" role="status" aria-live="polite" hidden></div>
        <div id="product-review-form"></div>
        <div class="tt-review-list" id="product-review-list" aria-live="polite"></div>
      </div>
    </div>`;

  const socialBar = document.querySelector('.tt-product-social-bar');
  const related = document.querySelector('.tt-related-section, .tt-related-products, #related-products');
  const tinsel = document.querySelector('.tinsel, #tinsel-root');
  const productDetail = document.getElementById('product-detail');
  if (socialBar?.parentNode) {
    socialBar.insertAdjacentElement('afterend', section);
  } else if (related?.parentNode) {
    related.parentNode.insertBefore(section, related);
  } else if (tinsel?.parentNode) {
    tinsel.insertAdjacentElement('afterend', section);
  } else if (productDetail?.parentNode) {
    productDetail.insertAdjacentElement('afterend', section);
  } else {
    document.body.insertBefore(section, document.querySelector('.tt-footer'));
  }
  return section;
}

async function requestApi(input, method = 'POST', action = 'ownReview', forceRefresh = false) {
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
  } catch (cause) {
    // Reintento único sin recargar el perfil ni cerrar la sesión local.
    try {
      token = await (auth.currentUser || user).getIdToken(true);
    } catch {
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
    error.requiresLogin = response.status === 401;
    throw error;
  }
  return result;
}

async function api(input, method = 'POST', action = 'ownReview') {
  try {
    return await requestApi(input, method, action);
  } catch (error) {
    if (error?.status !== 401 || !auth.currentUser) throw error;

    // Firebase conserva la sesión local: sólo pedimos un token nuevo y nunca llamamos a signOut aquí.
    try {
      return await requestApi(input, method, action, true);
    } catch (retryError) {
      if (retryError?.status === 401) {
        const preservedSessionError = new Error('Para confirmar esta acción necesitás volver a iniciar sesión. Conservamos lo que escribiste y te devolvemos aquí.');
        preservedSessionError.status = 401;
        preservedSessionError.requiresLogin = true;
        throw preservedSessionError;
      }
      throw retryError;
    }
  }
}

function renderSummary() {
  const root = document.getElementById('product-review-summary');
  if (!root) return;
  const count = Number(stats.count) || 0;
  const average = Number(stats.average) || 0;
  root.innerHTML = `
    <div class="tt-community-metrics"><div class="tt-reviews-score"><strong>${count ? average.toFixed(1).replace('.', ',') : '—'}</strong><span>de 5</span></div><div><div class="tt-review-stars" aria-label="${average.toFixed(1)} de 5 estrellas">${starText(Math.round(average))}</div><div class="tt-review-date">${count} opinión${count === 1 ? '' : 'es'}</div></div></div>`;
}

function showCommunityNotice(message) {
  const notice = document.getElementById('product-community-notice');
  if (!notice) return;
  notice.textContent = message || '';
  notice.hidden = !message;
}

function highlightDeepLink() {
  if (deepLinkHandled) return;
  const match = String(location.hash || '').match(/^#review-([A-Za-z0-9_-]+)$/);
  if (!match) return;
  const target = document.getElementById(`review-${match[1]}`);
  if (!target) return;
  deepLinkHandled = true;
  requestAnimationFrame(() => {
    target.classList.add('tt-review-deeplink-highlight');
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.classList.remove('tt-review-deeplink-highlight'), 2200);
  });
}

function renderReviews() {
  const root = document.getElementById('product-review-list');
  if (!root) return;
  const sorted = [...reviews].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  root.innerHTML = sorted.length ? sorted.map(review => {
    const id = reviewIdOf(review);
    const liked = likedReviewIds.has(id);
    const likeCount = Math.max(0, Number(review.likeCount) || 0);
    return `
    <article class="tt-review-card" id="review-${escapeHtml(id)}" data-review-card="${escapeHtml(id)}">
      <div class="tt-review-head">
        <div><div class="tt-review-author">${escapeHtml(publicAlias(review.publicName))}</div><div class="tt-review-stars" aria-label="${Number(review.rating)} de 5 estrellas">${starText(review.rating)}</div></div>
        <time class="tt-review-date" datetime="${dateValue(review.createdAt).toISOString()}" title="${dateValue(review.createdAt).toLocaleDateString('es-PY')}">${relativeDate(review.createdAt)}</time>
      </div>
      <p class="tt-review-comment">${escapeHtml(review.comment)}</p>
      ${review.storeLiked ? `<div class="tt-review-store-like">${heartIconMarkup(true)} A Tintin Accesorios le gustó esta reseña</div>` : ''}
      <div class="tt-review-social-actions">
        ${currentUser ? `<button type="button" class="tt-review-like-button${liked ? ' is-liked' : ''}" data-review-like="${escapeHtml(id)}" aria-pressed="${liked}" aria-label="${liked ? 'Quitar Me gusta' : 'Dar Me gusta'} a esta reseña"><span aria-hidden="true">${heartIconMarkup(liked)}</span><span>${likeCount ? `${likeCount} Me gusta` : 'Me gusta'}</span></button>` : `<span class="tt-review-like-count">${likeCount ? `${heartIconMarkup(true)} ${likeCount} Me gusta` : 'Todavía sin Me gusta'}</span>`}
      </div>
    </article>`;
  }).join('') : '<div class="tt-review-empty">Todavía no hay comentarios. Podés ser la primera en compartir tu opinión.</div>';
  highlightDeepLink();
  document.querySelectorAll('[data-product-comment-count]').forEach(node => { node.textContent = String(reviews.length); });
}

function renderProductLike() {
  const button = document.getElementById('btn-product-like');
  if (!button) return;
  button.setAttribute('aria-pressed', String(productLiked));
  button.setAttribute('aria-label', productLiked ? 'Quitar Me gusta de este producto' : 'Me gusta este producto');
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

function ratingButtons() {
  return `<div class="tt-rating-field">
    <span class="tt-rating-label">Tu puntuación</span>
    <div class="tt-rating-scale"><div class="tt-rating-input" role="radiogroup" aria-label="Puntuación de la reseña" data-rating-value="${selectedRating}">${[1,2,3,4,5].map(value => `
      <button type="button" role="radio" aria-checked="${selectedRating === value}" tabindex="${selectedRating ? (selectedRating === value ? 0 : -1) : (value === 1 ? 0 : -1)}" class="${selectedRating >= value ? 'is-active' : ''}${selectedRating === value ? ' is-current' : ''}" data-review-rating="${value}" aria-label="${value} estrella${value === 1 ? '' : 's'}">★</button>`).join('')}</div><div class="tt-rating-numbers" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div></div>
    <span class="tt-rating-status" data-rating-status aria-live="polite">${selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Elegí de 1 a 5 estrellas'}</span>
  </div>`;
}

function syncRatingButtons(previewRating = null) {
  const group = document.querySelector('.tt-rating-input');
  if (!group) return;
  const preview = previewRating === null ? null : normalizeRating(previewRating);
  const effectiveRating = preview === null ? selectedRating : preview;
  group.dataset.ratingValue = String(selectedRating);
  group.querySelectorAll('[data-review-rating]').forEach(button => {
    const value = normalizeRating(button.dataset.reviewRating);
    button.classList.toggle('is-active', effectiveRating > 0 && value <= effectiveRating);
    button.classList.toggle('is-current', preview === null && selectedRating === value);
    button.setAttribute('aria-checked', String(selectedRating === value));
    button.tabIndex = selectedRating ? (selectedRating === value ? 0 : -1) : (value === 1 ? 0 : -1);
  });
  const status = group.parentElement?.querySelector('[data-rating-status]');
  if (status) status.textContent = selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Elegí de 1 a 5 estrellas';
}

function setSelectedRating(value, { focus = false } = {}) {
  const nextRating = normalizeRating(value);
  if (!nextRating) return;
  selectedRating = nextRating;
  syncRatingButtons();
  if (focus) document.querySelector(`[data-review-rating="${selectedRating}"]`)?.focus();
}

function renderForm() {
  const root = document.getElementById('product-review-form');
  if (!root) return;
  if (!currentUser) {
    root.innerHTML = `<form class="tt-review-form tt-community-composer" id="tt-review-editor"><div class="tt-community-avatar" aria-hidden="true">T</div><div class="tt-community-composer-body"><h3>Decí tu primera opinión</h3><p>Podés escribir y elegir tu puntuación ahora. Te pediremos iniciar sesión solo al publicar y volverás a este mismo lugar.</p>${ratingButtons()}<textarea class="tt-review-textarea" name="comment" maxlength="1600" required placeholder="Escribí tu opinión…"></textarea><div class="tt-review-form-actions"><small>Tu identidad se muestra protegida para otras personas.</small><button type="submit" class="tt-btn">Iniciar sesión y publicar</button></div><div role="alert" data-review-error></div></div></form>`;
    syncRatingButtons();
    return;
  }
  if (ownReview && Number(ownReview.editCount) >= 1) {
    root.innerHTML = '<div class="tt-review-form"><h3>Tu reseña está publicada</h3><p>Ya utilizaste la única edición disponible. Podés seguir participando en la conversación desde cualquier reseña.</p></div>';
    return;
  }
  selectedRating = selectedRating || normalizeRating(ownReview?.rating);
  const initial = String(currentUser.displayName || currentUser.email || 'T').trim().slice(0, 1).toUpperCase();
  root.innerHTML = `<form class="tt-review-form tt-community-composer" id="tt-review-editor">
    <div class="tt-community-avatar" aria-hidden="true">${escapeHtml(initial)}</div><div class="tt-community-composer-body"><h3>${ownReview ? 'Editar mi opinión' : '¿Qué te pareció este producto?'}</h3><p>Tu nombre se verá de forma protegida para otras personas.</p>
    ${ratingButtons()}
    <textarea class="tt-review-textarea" name="comment" maxlength="1600" required placeholder="Escribí tu opinión…">${escapeHtml(ownReview?.comment || '')}</textarea>
    <div class="tt-review-form-actions"><small>${ownReview ? 'Esta es tu única edición disponible.' : 'Sé amable: tu opinión ayuda a la comunidad.'}</small><button type="submit" class="tt-btn">${ownReview ? 'Guardar edición' : 'Publicar opinión'}</button></div>
    <div role="alert" data-review-error></div></div>
  </form>`;
  syncRatingButtons();
}

async function loadSocialState() {
  if (!currentUser) {
    ownReview = null;
    likedReviewIds = new Set();
    selectedRating = 0;
    productLiked = false;
    renderForm();
    renderReviews();
    renderProductLike();
    showCommunityNotice('');
    return;
  }
  const [own, interactions, favorite] = await Promise.all([
    api(null, 'GET', 'ownReview'),
    api(null, 'GET', 'reviewInteractions'),
    api(null, 'GET', 'ownFavorite'),
  ]);
  ownReview = own.review;
  likedReviewIds = new Set(interactions.interactions?.reviewIds || []);
  productLiked = favorite.favorite === true;
  selectedRating = normalizeRating(ownReview?.rating);
  renderForm();
  renderReviews();
  renderProductLike();
  showCommunityNotice('');
}

function subscribePublic() {
  unsubscribeReviews?.();
  unsubscribeStats?.();
  unsubscribeLikes?.();
  unsubscribeReviews = onSnapshot(collection(db, 'products', productId, 'reviews'), snapshot => {
    reviews = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    renderReviews();
  }, () => {
    reviews = [];
    renderReviews();
  });
  unsubscribeStats = onSnapshot(doc(db, 'productReviewStats', productId), snapshot => {
    stats = snapshot.exists() ? snapshot.data() : { count: 0, average: 0, distribution: {} };
    renderSummary();
  }, renderSummary);
  unsubscribeLikes = onSnapshot(doc(db, 'productEngagementStats', productId), snapshot => {
    productLikeCount = snapshot.exists() ? Number(snapshot.data()?.likeCount) || 0 : 0;
    renderProductLike();
  }, renderProductLike);
  loadPublicLikeStats();
}

document.addEventListener('click', async event => {
  const openCommunity = event.target.closest('[data-open-community]');
  if (openCommunity) {
    event.preventDefault();
    const section = ensureSection();
    section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => document.querySelector('#tt-review-editor textarea')?.focus(), 350);
    return;
  }
  const button = event.target.closest('#btn-product-like');
  if (!button || button.disabled) return;
  if (!currentUser) {
    requestCommunityLogin('productLike');
    return;
  }
  button.disabled = true;
  try {
    const result = await api({ action: 'toggleFavorite', productId }, 'POST');
    productLiked = result.selected === true;
    if (Number.isFinite(Number(result.likeCount))) productLikeCount = Number(result.likeCount);
    renderProductLike();
  } catch (failure) {
    if (failure.requiresLogin) {
      requestCommunityLogin('productLike');
      return;
    }
    showCommunityNotice(failure.message || 'No pudimos actualizar tu Me gusta. Tu sesión sigue abierta.');
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('click', async event => {
  const ratingButton = event.target.closest('[data-review-rating]');
  if (ratingButton) {
    event.preventDefault();
    setSelectedRating(ratingButton.dataset.reviewRating);
    return;
  }

  const likeButton = event.target.closest('[data-review-like]');
  if (likeButton) {
    event.preventDefault();
    const reviewId = likeButton.dataset.reviewLike;
    likeButton.disabled = true;
    try {
      const result = await api({ action: 'toggleReviewLike', productId, reviewId });
      if (result.selected) likedReviewIds.add(reviewId);
      else likedReviewIds.delete(reviewId);
      const review = reviews.find(item => reviewIdOf(item) === reviewId);
      if (review) review.likeCount = result.likeCount;
      renderReviews();
    } catch (failure) {
      if (failure.requiresLogin) {
        requestCommunityLogin('reviewLike', { reviewId });
        return;
      }
      showCommunityNotice(failure.message || 'No pudimos actualizar este Me gusta. Tu sesión sigue abierta.');
      loadSocialState().catch(() => {});
    } finally {
      document.querySelector(`[data-review-like="${reviewId}"]`)?.removeAttribute('disabled');
    }
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
  if (!button) return;
  syncRatingButtons(button.dataset.reviewRating);
});

document.addEventListener('pointerout', event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const group = event.target.closest('.tt-rating-input');
  if (!group || group.contains(event.relatedTarget)) return;
  syncRatingButtons();
});

document.addEventListener('submit', async event => {
  if (event.target.id === 'tt-review-editor') {
    event.preventDefault();
    const submit = event.target.querySelector('[type="submit"]');
    const error = event.target.querySelector('[data-review-error]');
    error.textContent = '';
    if (selectedRating < 1 || selectedRating > 5) {
      error.textContent = 'Elegí de 1 a 5 estrellas antes de publicar tu reseña.';
      event.target.querySelector('[data-review-rating]')?.focus();
      return;
    }
    submit.disabled = true;
    try {
      const comment = String(new FormData(event.target).get('comment') || '').trim();
      if (!currentUser) {
        requestCommunityLogin('review', { rating: selectedRating, comment });
        return;
      }
      const action = ownReview ? 'editReview' : 'createReview';
      const result = await api({ action, productId, rating: selectedRating, comment });
      ownReview = result.review;
      selectedRating = normalizeRating(result.review?.rating) || selectedRating;
      renderForm();
    } catch (failure) {
      if (failure.requiresLogin) {
        requestCommunityLogin('review', { rating: selectedRating, comment: String(new FormData(event.target).get('comment') || '').trim() });
        return;
      }
      error.textContent = failure.message;
      submit.disabled = false;
    }
    return;
  }

});

async function resumePendingIntent() {
  const intent = takePendingIntent();
  if (!intent || !currentUser) return;
  try {
    if (intent.action === 'productLike') {
      const result = await api({ action: 'toggleFavorite', productId });
      productLiked = result.selected === true;
      productLikeCount = Number(result.likeCount) || productLikeCount;
      renderProductLike();
      showCommunityNotice(productLiked ? 'Tu Me gusta quedó guardado.' : 'Actualizamos tu Me gusta.');
    } else if (intent.action === 'reviewLike' && intent.payload?.reviewId) {
      const result = await api({ action: 'toggleReviewLike', productId, reviewId: intent.payload.reviewId });
      if (result.selected) likedReviewIds.add(intent.payload.reviewId);
      else likedReviewIds.delete(intent.payload.reviewId);
      renderReviews();
      showCommunityNotice('Tu Me gusta quedó guardado.');
    } else if (intent.action === 'review') {
      const result = await api({ action: ownReview ? 'editReview' : 'createReview', productId, rating: normalizeRating(intent.payload?.rating), comment: String(intent.payload?.comment || '') });
      ownReview = result.review;
      selectedRating = normalizeRating(result.review?.rating);
      renderForm();
      showCommunityNotice('Tu opinión se publicó correctamente.');
    }
    clearPendingIntent();
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
      console.warn('[reviews] No se pudo cargar el estado social de la reseña.', error);
      renderForm();
      renderReviews();
    });
  });
}
