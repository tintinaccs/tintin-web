import './catalog-maintenance.js?v=tintin-20260718-catalog-maintenance-1';
import './collections-maintenance.js?v=tintin-20260718-collections-maintenance-1';
import './product-maintenance.js?v=tintin-20260718-product-maintenance-1';
import './checkout-maintenance.js?v=tintin-20260718-checkout-maintenance-1';
import './login-maintenance.js?v=tintin-20260718-login-maintenance-1';
import './profile-maintenance.js?v=tintin-20260718-profile-maintenance-1';

/**
 * TINTIN — Collections Store
 * Real-time read of the `collections` Firestore collection (managed from
 * Super Admin → Colecciones). Feeds catalogo.html's sidebar, collections.html,
 * the home "Nuestras Colecciones" grid, and every nav surface that lists
 * collections — one source of truth for which collections exist, their
 * name/image/order/visibility.
 *
 * Firestore is the ONLY source of truth here. There is no hardcoded fallback
 * list: zero collections in Firestore means zero collections on the site,
 * and a listener failure surfaces as a real error (via the onError
 * callback), never silently replaced by fake data.
 */
import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  limit,
  onSnapshot,
  query
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { cleanText, cleanMultilineText } from './security-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { sanitizeImageUrl } from './image-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { resolveCollectionImage } from './image-resolver.js?v=tintin-20260716-cloudinary-fix-1';

export function normalizeCollectionDoc(id, data) {
  const d = data || {};
  const orderNum = Number(d.order);
  return {
    slug: id,
    name: cleanText(d.name || d.title || id, 120),
    description: cleanMultilineText(d.description || '', 1000),
    image: sanitizeImageUrl(d.image || d.imageUrl || ''),
    order: Number.isFinite(orderNum) ? orderNum : 9999,
    visible: d.visible !== false,
  };
}

function sortCols(list) {
  return list.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}

function currentProducts() {
  return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
}

function withResolvedImages(cols) {
  const products = currentProducts();
  return cols.map(col => ({ ...col, image: resolveCollectionImage(col, products) }));
}

let latestVisibleCollections = null;
const publicSubscribers = new Set();
let productsReactivityAttached = false;

function republishToPublicSubscribers() {
  if (!latestVisibleCollections) return;
  const resolved = sortCols(withResolvedImages(latestVisibleCollections));
  publicSubscribers.forEach(cb => {
    try { cb(resolved); } catch (error) { console.warn('[collections-store] subscriber error:', error); }
  });
}

function attachProductsReactivity() {
  if (productsReactivityAttached) return;
  productsReactivityAttached = true;
  window.addEventListener('tintin:products-loaded', republishToPublicSubscribers);
}

export function onCollectionsUpdate(cb, onError) {
  attachProductsReactivity();
  publicSubscribers.add(cb);

  const unsubscribeSnapshot = onSnapshot(query(collection(db, 'collections'), limit(5000)), snap => {
    latestVisibleCollections = snap.docs
      .map(d => normalizeCollectionDoc(d.id, d.data()))
      .filter(c => c.visible);
    republishToPublicSubscribers();
  }, e => {
    console.error('[collections-store] listener failed:', e.code, e.message);
    if (typeof onError === 'function') onError(e);
  });

  return () => {
    unsubscribeSnapshot();
    publicSubscribers.delete(cb);
  };
}

export function onAllCollectionsUpdate(cb) {
  return onSnapshot(query(collection(db, 'collections'), limit(5000)), snap => {
    cb(sortCols(snap.docs.map(d => normalizeCollectionDoc(d.id, d.data()))), null);
  }, e => {
    console.error('[collections-store] admin listener failed:', e.code, e.message);
    cb([], e);
  });
}
