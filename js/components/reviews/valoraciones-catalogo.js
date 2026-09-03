import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-2';
import { collection, documentId, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let ratings = new Map();
let statsUnsubscribe = null;
let statsRequestKey = '';
let statsRefreshQueued = false;

const MAX_STATS_IDS_PER_QUERY = 30;

function visibleProductIds() {
  return [...new Set([...document.querySelectorAll('[data-product-id],[data-id]')]
    .map(card => String(card.dataset.productId || card.dataset.id || '').trim())
    .filter(Boolean))].slice(0, MAX_STATS_IDS_PER_QUERY);
}

function subscribeToVisibleStats() {
  const ids = visibleProductIds();
  const requestKey = ids.join('|');
  if (requestKey === statsRequestKey) return;
  statsRequestKey = requestKey;
  statsUnsubscribe?.();
  statsUnsubscribe = null;
  ratings = new Map();
  render();
  if (!ids.length) return;

  const statsQuery = query(
    // La consulta se limita a los productos realmente renderizados; nunca se
    // abre un listener sobre toda la colección pública de estadísticas.
    collection(db, 'productReviewStats'),
    where(documentId(), 'in', ids)
  );
  statsUnsubscribe = onSnapshot(statsQuery, snapshot => {
    ratings = new Map(snapshot.docs.map(document => [document.id, document.data()]));
    render();
  }, () => {});
}

function render() {
  document.querySelectorAll('[data-product-id],[data-id]').forEach(card => {
    const id = String(card.dataset.productId || card.dataset.id || '');
    const host = card.querySelector('[data-review-rating]');
    if (!host) return;
    const value = ratings.get(id);
    const nextHidden = !value?.count;
    const nextText = value?.count
      ? `\u2605 ${Number(value.average).toFixed(1).replace('.', ',')} (${value.count})`
      : '';
    if (host.hidden !== nextHidden) host.hidden = nextHidden;
    if (host.textContent !== nextText) host.textContent = nextText;
  });
}

appCheckReady.then(() => subscribeToVisibleStats());

function queueStatsRefresh() {
  if (statsRefreshQueued) return;
  statsRefreshQueued = true;
  requestAnimationFrame(() => {
    statsRefreshQueued = false;
    subscribeToVisibleStats();
    render();
  });
}

window.addEventListener('tintin:products-loaded', queueStatsRefresh);
window.addEventListener('tintin:product-rendered', queueStatsRefresh);
let renderQueued = false;
new MutationObserver(() => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    queueStatsRefresh();
    render();
  });
}).observe(document.body, { childList: true, subtree: true });
