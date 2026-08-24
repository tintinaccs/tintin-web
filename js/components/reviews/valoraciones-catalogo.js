import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const STYLE_ID = 'tt-product-card-engagement-style';
const STYLE_VERSION = 'tintin-20260824-product-card-engagement-1';

let ratings = new Map();
let engagement = new Map();
let refreshPromise = null;
let refreshTimer = null;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = `/css/components/products/tarjeta-participacion.css?v=${STYLE_VERSION}`;
  document.head.appendChild(link);
}

function formatAverage(value) {
  return Math.max(0, Math.min(5, Number(value) || 0)).toFixed(1).replace('.', ',');
}

function plural(value, singular, pluralText) {
  return Number(value) === 1 ? singular : pluralText;
}

function safeProductHref(card, id) {
  const existing = card.querySelector('a.tt-product-card-img-link[href], .tt-product-name a[href], .tt-product-actions a[href]');
  const href = String(existing?.getAttribute('href') || `/product?id=${encodeURIComponent(id)}`).split('#')[0];
  return `${href}#product-reviews`;
}

function ensureRatingHost(card) {
  let host = card.querySelector('[data-review-rating]');
  if (host) return host;
  const info = card.querySelector('.tt-product-info');
  if (!info) return null;
  host = document.createElement('div');
  host.dataset.reviewRating = '';
  const price = info.querySelector('.tt-product-price');
  if (price) price.insertAdjacentElement('afterend', host);
  else info.prepend(host);
  return host;
}

function ensureEngagementHost(card, id) {
  let row = card.querySelector('[data-product-engagement]');
  if (row) return row;
  const ratingHost = ensureRatingHost(card);
  const info = card.querySelector('.tt-product-info');
  if (!info) return null;

  row = document.createElement('div');
  row.className = 'tt-product-engagement';
  row.dataset.productEngagement = id;
  row.innerHTML = `
    <button type="button" class="tt-product-engagement-action tt-product-engagement-like" data-card-product-like="${id}" aria-label="Dar Me gusta a este producto">
      <span class="tt-product-engagement-heart" data-card-like-icon aria-hidden="true">♡</span>
      <span data-card-like-count>0 Me gusta</span>
    </button>
    <a class="tt-product-engagement-action tt-product-engagement-comments" data-card-product-comments href="${safeProductHref(card, id)}" aria-label="Ver comentarios y reseñas de este producto">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.75h14a2.25 2.25 0 0 1 2.25 2.25v7A2.25 2.25 0 0 1 19 17.25h-7.35L7 20.5v-3.25H5A2.25 2.25 0 0 1 2.75 15V8A2.25 2.25 0 0 1 5 5.75Z"/></svg>
      <span data-card-review-count>0 comentarios</span>
    </a>`;

  if (ratingHost) ratingHost.insertAdjacentElement('afterend', row);
  else info.appendChild(row);
  return row;
}

function combinedStats(id) {
  const realtime = ratings.get(id) || {};
  const aggregate = engagement.get(id) || {};
  return {
    likeCount: Math.max(0, Number(aggregate.likeCount) || 0),
    reviewCount: Math.max(0, Number(realtime.count ?? aggregate.reviewCount) || 0),
    average: Math.max(0, Math.min(5, Number(realtime.average ?? aggregate.average) || 0)),
  };
}

function renderCard(card) {
  const id = String(card.dataset.productId || card.dataset.id || '').trim();
  if (!id) return;

  const value = combinedStats(id);
  const ratingHost = ensureRatingHost(card);
  if (ratingHost) {
    ratingHost.hidden = false;
    ratingHost.classList.add('tt-product-rating-summary');
    const ratingText = `★ ${formatAverage(value.average)} · ${value.reviewCount} ${plural(value.reviewCount, 'reseña', 'reseñas')}`;
    if (ratingHost.textContent !== ratingText) ratingHost.textContent = ratingText;
    ratingHost.setAttribute('aria-label', `${formatAverage(value.average)} de 5 estrellas; ${value.reviewCount} ${plural(value.reviewCount, 'reseña', 'reseñas')}`);
  }

  const row = ensureEngagementHost(card, id);
  if (!row) return;

  const favoriteButton = card.querySelector(`[data-favorite-id="${CSS.escape(id)}"]`);
  const selected = favoriteButton?.getAttribute('aria-pressed') === 'true';
  const likeButton = row.querySelector('[data-card-product-like]');
  const likeIcon = row.querySelector('[data-card-like-icon]');
  const likeCount = row.querySelector('[data-card-like-count]');
  const reviewCount = row.querySelector('[data-card-review-count]');
  const comments = row.querySelector('[data-card-product-comments]');

  if (likeButton) {
    likeButton.classList.toggle('is-liked', selected);
    likeButton.setAttribute('aria-pressed', String(selected));
    likeButton.setAttribute('aria-label', `${selected ? 'Quitar Me gusta de' : 'Dar Me gusta a'} este producto. ${value.likeCount} ${plural(value.likeCount, 'Me gusta', 'Me gusta')}`);
  }
  if (likeIcon) likeIcon.textContent = selected ? '♥' : '♡';
  if (likeCount) likeCount.textContent = `${value.likeCount} Me gusta`;
  if (reviewCount) reviewCount.textContent = `${value.reviewCount} ${plural(value.reviewCount, 'comentario', 'comentarios')}`;
  if (comments) {
    comments.href = safeProductHref(card, id);
    comments.setAttribute('aria-label', `Ver ${value.reviewCount} ${plural(value.reviewCount, 'comentario o reseña', 'comentarios o reseñas')} de este producto`);
  }
}

function render() {
  ensureStyles();
  document.querySelectorAll('.tt-product-card[data-product-id], .tt-product-card[data-id]').forEach(renderCard);
}

async function refreshEngagement() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch('/api/product-engagement-stats', { cache: 'no-store' })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true || !Array.isArray(payload.stats)) {
        throw new Error(payload.error || 'No se pudieron cargar los contadores');
      }
      engagement = new Map(payload.stats.map(item => [String(item.productId || ''), item]));
      render();
    })
    .catch(error => {
      console.warn('[product-engagement] No se pudieron actualizar los contadores.', error);
      render();
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function scheduleEngagementRefresh(delay = 120) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshEngagement(), delay);
}

appCheckReady.then(() => onSnapshot(collection(db, 'productReviewStats'), snapshot => {
  ratings = new Map(snapshot.docs.map(document => [document.id, document.data()]));
  render();
}, () => render()));

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-card-product-like]');
  if (!trigger) return;
  const card = trigger.closest('.tt-product-card');
  if (!card) return;
  event.preventDefault();
  event.stopPropagation();
  const id = String(trigger.dataset.cardProductLike || '');
  const favoriteButton = [...card.querySelectorAll('[data-favorite-id]')]
    .find(button => String(button.dataset.favoriteId || '') === id);
  if (favoriteButton) favoriteButton.click();
}, false);

window.addEventListener('tintin:products-loaded', render);
window.addEventListener('tintin:product-rendered', render);
window.addEventListener('tintin:favorites-updated', () => {
  render();
  scheduleEngagementRefresh();
});

let renderQueued = false;
new MutationObserver(() => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}).observe(document.body, { childList: true, subtree: true });

ensureStyles();
render();
refreshEngagement();
