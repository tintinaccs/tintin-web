import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { sanitizeImageUrl } from '../images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const GUEST_KEY = 'tt_favorites_guest_v1';
const USER_PREFIX = 'tt_favorites_user_';
const MAX_FAVORITES = 200;
let currentUser = null;
let activeKey = GUEST_KEY;
let unsubscribe = null;
let remoteReady = false;
let remoteMutation = false;

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
  const price = Number(raw.price);
  return {
    id,
    productId: id,
    name: clean(raw.name || raw.title || 'Producto', 180),
    cat: clean(raw.cat || raw.category || '', 120),
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    imageUrl: sanitizeImageUrl(raw.imageUrl || raw.imgUrl || raw.image || ''),
  };
}

function normalizeList(items) {
  const map = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    const item = normalize(raw);
    if (item) map.set(item.id, item);
  }
  return [...map.values()].slice(0, MAX_FAVORITES);
}

function read(key = activeKey) {
  try { return normalizeList(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return []; }
}

function write(items, notify = true) {
  const normalized = normalizeList(items);
  try { localStorage.setItem(activeKey, JSON.stringify(normalized)); } catch {}
  if (notify) publish(normalized);
  return normalized;
}

function publish(items = read()) {
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
    detail: { items, userId: currentUser?.uid || null }
  }));
}

function fromButton(button) {
  const id = clean(button?.dataset.favoriteId, 180);
  const catalogItem = Array.isArray(window.PRODUCTS)
    ? window.PRODUCTS.find(item => String(item.id) === id)
    : null;
  const saved = read().find(item => item.id === id);
  return normalize({
    ...saved,
    ...catalogItem,
    id,
    name: button?.dataset.favoriteName || catalogItem?.name || saved?.name,
    price: button?.dataset.favoritePrice || catalogItem?.price || saved?.price,
    imageUrl: button?.dataset.favoriteImage || catalogItem?.imageUrl || saved?.imageUrl,
    cat: button?.dataset.favoriteCat || catalogItem?.cat || catalogItem?.category || saved?.cat,
  });
}

function payload(item) {
  return {
    schemaVersion: 1,
    productId: item.id,
    name: item.name,
    cat: item.cat,
    price: item.price,
    imageUrl: item.imageUrl,
    updatedAt: serverTimestamp(),
  };
}

async function replaceRemote(items) {
  if (!currentUser || !remoteReady) return;
  remoteMutation = true;
  try {
    const batch = writeBatch(db);
    const desired = new Set(items.map(item => item.id));
    items.forEach(item => batch.set(doc(db, 'users', currentUser.uid, 'favorites', item.id), payload(item)));
    const knownRemote = read(`${USER_PREFIX}${currentUser.uid}`);
    knownRemote.forEach(item => {
      if (!desired.has(item.id)) batch.delete(doc(db, 'users', currentUser.uid, 'favorites', item.id));
    });
    await batch.commit();
  } finally {
    remoteMutation = false;
  }
}

async function toggle(raw) {
  const item = normalize(raw);
  if (!item) return { selected: false, changed: false };
  const items = read();
  const index = items.findIndex(entry => entry.id === item.id);
  const selected = index < 0;
  if (selected) items.unshift(item); else items.splice(index, 1);
  const saved = write(items);
  if (currentUser && remoteReady) {
    remoteMutation = true;
    try {
      const ref = doc(db, 'users', currentUser.uid, 'favorites', item.id);
      if (selected) await setDoc(ref, payload(item)); else await deleteDoc(ref);
    } catch (error) {
      console.warn('[favorites] No se pudo sincronizar el cambio.', error);
    } finally {
      remoteMutation = false;
    }
  }
  return { selected, changed: true, item: saved.find(entry => entry.id === item.id) || item };
}

function subscribe(user, guestItems) {
  let first = true;
  unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'favorites'), snapshot => {
    const remote = normalizeList(snapshot.docs.map(item => item.data()));
    if (first) {
      first = false;
      remoteReady = true;
      const merged = normalizeList([...remote, ...read(activeKey), ...guestItems]);
      write(merged);
      try { localStorage.removeItem(GUEST_KEY); } catch {}
      if (JSON.stringify(merged) !== JSON.stringify(remote)) replaceRemote(merged).catch(() => {});
      return;
    }
    if (!remoteMutation && !snapshot.metadata.hasPendingWrites) write(remote);
  }, error => {
    remoteReady = false;
    console.warn('[favorites] Sincronización no disponible; se conserva la copia local.', error);
    publish();
  });
}

function activateIdentity(user) {
  unsubscribe?.();
  unsubscribe = null;
  remoteReady = false;
  currentUser = user || null;
  if (!currentUser) {
    activeKey = GUEST_KEY;
    publish();
    return;
  }
  const guestItems = read(GUEST_KEY);
  activeKey = `${USER_PREFIX}${currentUser.uid}`;
  publish();
  appCheckReady.then(ready => {
    if (ready && currentUser?.uid === user.uid) subscribe(user, guestItems);
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
    finally { delete favoriteButton.dataset.favoriteBusy; }
    return;
  }
  const addButton = event.target.closest('[data-favorite-add-cart]');
  if (!addButton) return;
  const item = read().find(entry => entry.id === String(addButton.dataset.favoriteAddCart || ''));
  if (!item) return;
  const cart = await import('../cart/sincronizacion-carrito.js?v=tintin-20260808-product-cart-1');
  await cart.addToCart({ ...item, qty: 1 });
}, true);

window.addEventListener('tintin:products-loaded', () => publish());
window.addEventListener('storage', event => {
  if (event.storageArea === localStorage && event.key === activeKey) publish();
});
window.TintinFavorites = {
  getAll: () => read(),
  has: id => read().some(item => item.id === String(id)),
  toggle,
  refresh: publish,
};
onAuthStateChanged(auth, activateIdentity);
publish();
