const STYLE_ID = 'tt-product-card-social-style';
const CARD_SELECTOR = '.tt-product-card[data-id], .tt-product-card[data-product-id], .tt-card[data-product-id]';

let statsByProduct = new Map();
let refreshPromise = null;
let refreshTimer = 0;
let renderQueued = false;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tt-product-card[data-id] [data-review-rating],.tt-product-card[data-product-id] [data-review-rating],.tt-card[data-product-id] [data-review-rating]{display:none!important}
    .tt-product-rating-social{margin-top:5px;color:#ad3f67;font-size:12px;font-weight:700;line-height:1.35}
    .tt-product-engagement{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px;min-height:22px;margin-bottom:7px}
    .tt-product-engagement-action{display:inline-flex;align-items:center;gap:5px;min-width:0;padding:2px 0;border:0;background:transparent;color:#7d5866;font:inherit;font-size:11.5px;font-weight:600;line-height:1.25;text-decoration:none;cursor:pointer;transition:color 160ms ease,transform 160ms ease}
    .tt-product-engagement-action:hover,.tt-product-engagement-action:focus-visible{color:#ad3f67}
    .tt-product-engagement-action:focus-visible{outline:2px solid rgba(173,63,103,.38);outline-offset:3px;border-radius:5px}
    .tt-product-engagement-action:active{transform:scale(.97)}
    .tt-product-engagement-heart{display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;font-size:17px;line-height:1;color:#ad3f67}
    .tt-product-engagement-comments svg{width:15px;height:15px;flex:0 0 15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:480px){.tt-product-rating-social{font-size:11px}.tt-product-engagement{gap:9px}.tt-product-engagement-action{font-size:10.5px}}
    @media(prefers-reduced-motion:reduce){.tt-product-engagement-action{transition:none}}
  `;
  document.head.appendChild(style);
}

function productIdOf(card) {
  return String(card?.dataset?.productId || card?.dataset?.id || '').trim();
}

function plural(value, one, many) {
  return Number(value) === 1 ? one : many;
}

function formatAverage(value) {
  return Math.max(0, Math.min(5, Number(value) || 0)).toFixed(1).replace('.', ',');
}

function productHref(card, id) {
  const link = card.querySelector(
    'a.tt-product-card-img-link[href], .tt-product-name a[href], .tt-product-actions a[href], a.tt-card-img-wrap[href], .tt-card-name a[href], a.tt-card-btn-view[href]'
  );
  const raw = String(link?.getAttribute('href') || `/product?id=${encodeURIComponent(id)}`).split('#')[0];
  return `${raw}#product-reviews`;
}

function infoRoot(card) {
  return card.querySelector('.tt-product-info, .tt-card-info');
}

function priceNode(card) {
  return card.querySelector('.tt-product-price, .tt-card-price');
}

function ensureRatingSummary(card) {
  let host = card.querySelector('[data-card-rating-social]');
  if (host) return host;
  const info = infoRoot(card);
  if (!info) return null;
  host = document.createElement('div');
  host.className = 'tt-product-rating-social';
  host.dataset.cardRatingSocial = '';
  const price = priceNode(card);
  if (price) price.insertAdjacentElement('afterend', host);
  else info.prepend(host);
  return host;
}

function ensureEngagementRow(card, id) {
  let row = card.querySelector('[data-product-engagement]');
  if (row) return row;
  const info = infoRoot(card);
  if (!info) return null;
  const rating = ensureRatingSummary(card);
  row = document.createElement('div');
  row.className = 'tt-product-engagement';
  row.dataset.productEngagement = id;
  row.innerHTML = `
    <button type="button" class="tt-product-engagement-action tt-product-engagement-like" data-card-product-like="${id}" aria-pressed="false">
      <span class="tt-product-engagement-heart" data-card-like-icon aria-hidden="true">♡</span>
      <span data-card-like-count>0 Me gusta</span>
    </button>
    <a class="tt-product-engagement-action tt-product-engagement-comments" data-card-product-comments href="${productHref(card, id)}">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.75h14a2.25 2.25 0 0 1 2.25 2.25v7A2.25 2.25 0 0 1 19 17.25h-7.35L7 20.5v-3.25H5A2.25 2.25 0 0 1 2.75 15V8A2.25 2.25 0 0 1 5 5.75Z"/></svg>
      <span data-card-review-count>0 comentarios</span>
    </a>`;
  if (rating) rating.insertAdjacentElement('afterend', row);
  else info.appendChild(row);
  return row;
}

function favoriteButtonFor(card, id) {
  return [...card.querySelectorAll('[data-favorite-id]')]
    .find(button => String(button.dataset.favoriteId || '') === id) || null;
}

function renderCard(card) {
  const id = productIdOf(card);
  if (!id) return;
  const stats = statsByProduct.get(id) || {};
  const likeCount = Math.max(0, Number(stats.likeCount) || 0);
  const reviewCount = Math.max(0, Number(stats.reviewCount) || 0);
  const average = Math.max(0, Math.min(5, Number(stats.average) || 0));

  const rating = ensureRatingSummary(card);
  if (rating) {
    const text = `★ ${formatAverage(average)} · ${reviewCount} ${plural(reviewCount, 'reseña', 'reseñas')}`;
    if (rating.textContent !== text) rating.textContent = text;
    rating.setAttribute('aria-label', `${formatAverage(average)} de 5 estrellas; ${reviewCount} ${plural(reviewCount, 'reseña', 'reseñas')}`);
  }

  const row = ensureEngagementRow(card, id);
  if (!row) return;
  const favorite = favoriteButtonFor(card, id);
  const selected = favorite?.getAttribute('aria-pressed') === 'true';
  const likeButton = row.querySelector('[data-card-product-like]');
  const likeIcon = row.querySelector('[data-card-like-icon]');
  const likeText = row.querySelector('[data-card-like-count]');
  const commentText = row.querySelector('[data-card-review-count]');
  const comments = row.querySelector('[data-card-product-comments]');

  if (likeButton) {
    likeButton.classList.toggle('is-liked', selected);
    likeButton.setAttribute('aria-pressed', String(selected));
    likeButton.setAttribute('aria-label', `${selected ? 'Quitar Me gusta de' : 'Dar Me gusta a'} este producto. ${likeCount} Me gusta`);
  }
  if (likeIcon && likeIcon.textContent !== (selected ? '♥' : '♡')) likeIcon.textContent = selected ? '♥' : '♡';
  if (likeText && likeText.textContent !== `${likeCount} Me gusta`) likeText.textContent = `${likeCount} Me gusta`;
  const commentLabel = `${reviewCount} ${plural(reviewCount, 'comentario', 'comentarios')}`;
  if (commentText && commentText.textContent !== commentLabel) commentText.textContent = commentLabel;
  if (comments) {
    comments.href = productHref(card, id);
    comments.setAttribute('aria-label', `Ver ${reviewCount} ${plural(reviewCount, 'comentario o reseña', 'comentarios o reseñas')} de este producto`);
  }
}

function render() {
  ensureStyles();
  document.querySelectorAll(CARD_SELECTOR).forEach(renderCard);
}

async function refreshStats({ fresh = false } = {}) {
  if (refreshPromise) return refreshPromise;
  const endpoint = `/api/product-engagement-stats${fresh ? '?fresh=1' : ''}`;
  refreshPromise = fetch(endpoint, { cache: 'no-store' })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true || !Array.isArray(payload.stats)) {
        throw new Error(payload.error || 'No se pudieron cargar las interacciones');
      }
      statsByProduct = new Map(payload.stats.map(item => [String(item.productId || ''), item]));
      render();
    })
    .catch(error => {
      console.warn('[card-social] No se pudieron actualizar los contadores.', error);
      render();
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function scheduleRefresh(delay = 120) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshStats({ fresh: true }), delay);
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-card-product-like]');
  if (!trigger) return;
  const card = trigger.closest(CARD_SELECTOR);
  if (!card) return;
  event.preventDefault();
  event.stopPropagation();
  const favorite = favoriteButtonFor(card, String(trigger.dataset.cardProductLike || ''));
  if (favorite) favorite.click();
}, false);

window.addEventListener('tintin:products-loaded', render);
window.addEventListener('tintin:product-rendered', render);
window.addEventListener('tintin:favorites-updated', () => {
  render();
  scheduleRefresh();
});

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
refreshStats();
