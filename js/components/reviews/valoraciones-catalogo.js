import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let ratings = new Map();

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

appCheckReady.then(() => onSnapshot(collection(db, 'productReviewStats'), snapshot => {
  ratings = new Map(snapshot.docs.map(document => [document.id, document.data()]));
  render();
}, () => {}));

window.addEventListener('tintin:products-loaded', render);
window.addEventListener('tintin:product-rendered', render);
let renderQueued = false;
new MutationObserver(() => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}).observe(document.body, { childList: true, subtree: true });
