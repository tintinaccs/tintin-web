import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const MAX_FAVORITES = 200;
let currentUser = null;
let items = [];
let unsubscribe = null;

function clean(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.id || raw.productId, 180);
  if (!id || id.includes('/')) return null;
  return {
    id,
    productId: id,
    name: clean(raw.name || raw.title || 'Producto', 180),
    cat: clean(raw.cat || raw.category, 120),
    price: Math.max(0, Number(raw.price) || 0),
    imageUrl: clean(raw.imageUrl || raw.image, 1200),
    createdAt: raw.createdAt || null,
  };
}

function publish() {
  const ids = new Set(items.map(item => item.id));
  document.querySelectorAll('[data-favorite-id]').forEach(button => {
    const selected = ids.has(String(button.dataset.favoriteId || ''));
    button.classList.toggle('is-favorite', selected);
    button.setAttribute('aria-pressed', String(selected));
    const label = clean(button.dataset.favoriteName || 'producto', 100);
    button.setAttribute('aria-label', selected ? `Quitar ${label} de favoritos` : `Guardar ${label} en favoritos`);
    const icon = button.querySelector('[data-favorite-icon]');
    if (icon) icon.textContent = selected ? '♥' : '♡';
  });
  window.dispatchEvent(new CustomEvent('tintin:favorites-updated', {
    detail: { items: [...items], userId: currentUser?.uid || null },
  }));
}

function fromButton(button) {
  const id = clean(button?.dataset.favoriteId, 180);
  const product = Array.isArray(window.PRODUCTS)
    ? window.PRODUCTS.find(item => String(item.id) === id)
    : null;
  return normalize({
    ...product,
    id,
    name: button?.dataset.favoriteName || product?.name,
    cat: button?.dataset.favoriteCat || product?.cat || product?.category,
    price: button?.dataset.favoritePrice || product?.price,
    imageUrl: button?.dataset.favoriteImage || product?.imageUrl,
  });
}

function loginForCurrentPage() {
  const file = location.pathname.split('/').pop() || 'index.html';
  const target = `${file}${location.search}`;
  location.href = `login.html?from=${encodeURIComponent(target)}`;
}

async function toggle(raw) {
  const item = normalize(raw);
  if (!item) return { selected: false, changed: false };
  if (!currentUser) {
    loginForCurrentPage();
    return { selected: false, changed: false, loginRequired: true };
  }
  const token = await currentUser.getIdToken();
  const response = await fetch('/api/engagement', {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggleFavorite', productId: item.id, ...item }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'No se pudo actualizar favoritos');
  return { selected: Boolean(result.selected), changed: true, item };
}

function subscribe(user) {
  unsubscribe?.();
  unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'favorites'), snapshot => {
    items = snapshot.docs.map(document => normalize({ id: document.id, ...document.data() })).filter(Boolean).slice(0, MAX_FAVORITES);
    publish();
  }, error => {
    items = [];
    publish();
    console.warn('[favorites] No se pudieron cargar los favoritos.', error);
  });
}

document.addEventListener('click', async event => {
  const favoriteButton = event.target.closest('[data-favorite-id]');
  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();
    if (favoriteButton.dataset.favoriteBusy === '1') return;
    favoriteButton.dataset.favoriteBusy = '1';
    try { await toggle(fromButton(favoriteButton)); }
    catch (error) { window.alert(error.message || 'No se pudo actualizar favoritos'); }
    finally { delete favoriteButton.dataset.favoriteBusy; }
    return;
  }
  const addButton = event.target.closest('[data-favorite-add-cart]');
  if (!addButton) return;
  const item = items.find(entry => entry.id === String(addButton.dataset.favoriteAddCart || ''));
  if (!item) return;
  const cart = await import('../cart/sincronizacion-carrito.js?v=tintin-20260811-phonefix-sincronizacion-carrito-1');
  await cart.addToCart({ ...item, qty: 1 });
}, true);

window.addEventListener('tintin:products-loaded', publish);
window.TintinFavorites = {
  getAll: () => [...items],
  has: id => items.some(item => item.id === String(id)),
  toggle,
  refresh: publish,
};

onAuthStateChanged(auth, user => {
  unsubscribe?.();
  unsubscribe = null;
  currentUser = user || null;
  items = [];
  publish();
  if (user) appCheckReady.then(() => currentUser?.uid === user.uid && subscribe(user));
});
publish();
