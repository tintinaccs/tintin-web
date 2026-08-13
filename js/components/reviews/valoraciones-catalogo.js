import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let ratings = new Map();

function render() {
  document.querySelectorAll('[data-product-id],[data-id]').forEach(card => {
    const id = String(card.dataset.productId || card.dataset.id || '');
    const host = card.querySelector('[data-review-rating]');
    if (!host) return;
    const value = ratings.get(id);
    host.hidden = !value?.count;
    host.textContent = value?.count
      ? `★ ${Number(value.average).toFixed(1).replace('.', ',')} (${value.count})`
      : '';
  });
}

appCheckReady.then(() => onSnapshot(collection(db, 'productReviewStats'), snapshot => {
  ratings = new Map(snapshot.docs.map(document => [document.id, document.data()]));
  render();
}, () => {}));

window.addEventListener('tintin:products-loaded', render);
window.addEventListener('tintin:product-rendered', render);
new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
