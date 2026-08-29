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
  section.className = 'tt-reviews-product';
  section.dataset.collapsed = 'false';
  section.innerHTML = `
    <div class="container tt-reviews-layout">
      <aside class="tt-reviews-summary" aria-labelledby="product-reviews-title">
        <p class="tt-section-sub">Opiniones de la comunidad</p>
        <h2 class="tt-section-title" id="product-reviews-title">Comentarios</h2>
        <div id="product-review-summary" aria-live="polite"></div>
      </aside>
      <div id="product-reviews-content">
        <div id="product-review-form"></div>
        <div class="tt-review-list" id="product-review-list" aria-live="polite"></div>
      </div>
    </div>`;

  const related = document.querySelector('.tt-related-section, .tt-related-products, #related-products');
  const tinsel = document.querySelector('.tinsel, #tinsel-root');
  const productDetail = document.getElementById('product-detail');
  if (related?.parentNode) {
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
  if (!user) throw new Error('Iniciá sesión para participar');
  let token;
  try {
    token = await user.getIdToken(forceRefresh);
  } catch {
    const error = new Error('No se pudo renovar tu sesión. Volvé a intentar.');
    error.status = 401;
    throw error;
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
        const preservedSessionError = new Error('No pudimos renovar tu sesión automáticamente. No cerramos tu sesión; probá otra vez en unos segundos.');
        preservedSessionError.status = 401;
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
  const distribution = stats.distribution || {};
  root.innerHTML = `
    <div class="tt-reviews-score"><strong>${count ? average.toFixed(1).replace('.', ',') : '—'}</strong><span>de 5</span></div>
    <div class="tt-review-stars" aria-label="${average.toFixed(1)} de 5 estrellas">${starText(Math.round(average))}</div>
    <div class="tt-review-date">${count} comentario${count === 1 ? '' : 's'}</div>
    <div class="tt-review-distribution">${[5,4,3,2,1].map(rating => {
      const value = Number(distribution[rating] || 0);
      const percent = count ? Math.round(value * 100 / count) : 0;
      return `<div class="tt-review-bar"><span>${rating}★</span><span class="tt-review-bar-track"><span class="tt-review-bar-fill" style="width:${percent}%"></span></span><span>${value}</span></div>`;
    }).join('')}</div>`;
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
  button.querySelector('[data-product-like-icon]')?.replaceChildren(document.createTextNode(productLiked ? '♥' : '♡'));
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
    <div class="tt-rating-input" role="radiogroup" aria-label="Puntuación de la reseña" data-rating-value="${selectedRating}">${[1,2,3,4,5].map(value => `
      <button type="button" role="radio" aria-checked="${selectedRating === value}" tabindex="${selectedRating ? (selectedRating === value ? 0 : -1) : (value === 1 ? 0 : -1)}" class="${selectedRating >= value ? 'is-active' : ''}${selectedRating === value ? ' is-current' : ''}" data-review-rating="${value}" aria-label="${value} estrella${value === 1 ? '' : 's'}">★</button>`).join('')}</div>
    <span class="tt-rating-status" data-rating-status aria-live="polite">${selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Sin puntuación seleccionada'}</span>
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
  if (status) status.textContent = selectedRating ? `${selectedRating} de 5 estrellas seleccionadas` : 'Sin puntuación seleccionada';
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
    root.innerHTML = `<div class="tt-review-form"><h3>Compartí tu opinión</h3><p>Iniciá sesión para dejar una reseña distinta para este producto.</p><a class="tt-btn" href="/login?from=${encodeURIComponent(`/product?id=${productId}`)}">Iniciar sesión</a></div>`;
    return;
  }
  if (ownReview && Number(ownReview.editCount) >= 1) {
    root.innerHTML = '<div class="tt-review-form"><h3>Tu reseña está publicada</h3><p>Ya utilizaste la única edición disponible. Podés seguir participando en la conversación desde cualquier reseña.</p></div>';
    return;
  }
  selectedRating = selectedRating || normalizeRating(ownReview?.rating);
  root.innerHTML = `<form class="tt-review-form" id="tt-review-editor">
    <h3>${ownReview ? 'Editar mi reseña' : 'Compartí tu opinión'}</h3>
    ${ratingButtons()}
    <textarea class="tt-review-textarea" name="comment" maxlength="1600" required placeholder="¿Qué te pareció este producto?">${escapeHtml(ownReview?.comment || '')}</textarea>
    <div class="tt-review-form-actions"><small>${ownReview ? 'Esta es tu única edición disponible.' : 'Tu nombre se mostrará de forma protegida.'}</small><button type="submit" class="tt-btn">${ownReview ? 'Guardar edición' : 'Publicar reseña'}</button></div>
    <div role="alert" data-review-error></div>
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
  const button = event.target.closest('#btn-product-like');
  if (!button || button.disabled) return;
  if (!currentUser) {
    window.location.href = `/login?from=${encodeURIComponent(`/product?id=${productId}`)}`;
    return;
  }
  button.disabled = true;
  try {
    const result = await api({ action: 'toggleFavorite', productId }, 'POST');
    productLiked = result.selected === true;
    if (Number.isFinite(Number(result.likeCount))) productLikeCount = Number(result.likeCount);
    renderProductLike();
  } catch (failure) {
    window.alert(failure.message);
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
      window.alert(failure.message);
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
      const comment = new FormData(event.target).get('comment');
      const action = ownReview ? 'editReview' : 'createReview';
      const result = await api({ action, productId, rating: selectedRating, comment });
      ownReview = result.review;
      selectedRating = normalizeRating(result.review?.rating) || selectedRating;
      renderForm();
    } catch (failure) {
      error.textContent = failure.message;
      submit.disabled = false;
    }
    return;
  }

});

if (productId) {
  ensureSection();
  renderSummary();
  renderForm();
  appCheckReady.then(subscribePublic);
  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    loadSocialState().catch(error => {
      console.warn('[reviews] No se pudo cargar el estado social de la reseña.', error);
      renderForm();
      renderReviews();
    });
  });
}
