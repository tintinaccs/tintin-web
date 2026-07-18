import './catalog-maintenance.js?v=tintin-20260718-catalog-maintenance-1';

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

/**
 * Normalize a raw Firestore `collections/{slug}` doc into the canonical
 * shape the whole app relies on. The document ID is ALWAYS the canonical
 * slug — a stray `slug` field inside the doc data (legacy/manual edits)
 * must never override it, so this reads `id` last-and-explicit, never via
 * object-spread order.
 *
 * `image` here is always the collection's OWN configured cover — raw, not
 * resolved with any fallback. Admin editing screens need that truth (so an
 * empty value correctly shows "no image set yet"). Public consumers get the
 * resolved value instead, via onCollectionsUpdate below.
 */
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

/**
 * Devuelve la misma lista con `image` reemplazado por la imagen EFECTIVA de
 * cada colección (propia -> primer producto elegible -> respaldo global),
 * vía image-resolver.js. Nunca duplica esa lógica acá.
 */
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

/**
 * cb(cols) receives the live array of PUBLIC (visible !== false) collections,
 * sorted by order, every time Firestore changes — including an empty array
 * when zero collections exist. Each collection's `image` is already the
 * EFFECTIVE image to show (own cover -> first eligible product -> global
 * default), re-derived automatically whenever window.PRODUCTS updates too,
 * not just when the collection doc itself changes.
 * onError(e), if provided, fires on a real listener failure (e.g.
 * permission-denied); cb is NOT called with fake data in that case, so
 * callers can tell "empty" and "broken" apart.
 * Returns an unsubscribe function.
 */
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

/**
 * Same live data, but UNFILTERED by visibility and including an `error`
 * signal — for admin/management UIs that must still see+edit hidden
 * collections. `image` here stays RAW (never resolved with a product
 * fallback) so the panel always shows the truth about what's actually
 * configured. cb(cols, error): error is null on a normal update, or the
 * Firestore error object on listener failure (cols is [] in that case —
 * callers should render an explicit error state, not treat it as "no
 * collections yet").
 */
export function onAllCollectionsUpdate(cb) {
  return onSnapshot(query(collection(db, 'collections'), limit(5000)), snap => {
    cb(sortCols(snap.docs.map(d => normalizeCollectionDoc(d.id, d.data()))), null);
  }, e => {
    console.error('[collections-store] admin listener failed:', e.code, e.message);
    cb([], e);
  });
}
