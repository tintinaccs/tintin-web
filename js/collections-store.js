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
import { db } from './firebase.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { cleanText, cleanMultilineText } from './security-utils.js';
import { sanitizeImageUrl } from './image-utils.js';

/**
 * Normalize a raw Firestore `collections/{slug}` doc into the canonical
 * shape the whole app relies on. The document ID is ALWAYS the canonical
 * slug — a stray `slug` field inside the doc data (legacy/manual edits)
 * must never override it, so this reads `id` last-and-explicit, never via
 * object-spread order.
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

/**
 * cb(cols) receives the live array of PUBLIC (visible !== false) collections,
 * sorted by order, every time Firestore changes — including an empty array
 * when zero collections exist. onError(e), if provided, fires on a real
 * listener failure (e.g. permission-denied); cb is NOT called with fake data
 * in that case, so callers can tell "empty" and "broken" apart.
 * Returns the onSnapshot unsubscribe function.
 */
export function onCollectionsUpdate(cb, onError) {
  return onSnapshot(collection(db, 'collections'), snap => {
    const cols = sortCols(
      snap.docs.map(d => normalizeCollectionDoc(d.id, d.data())).filter(c => c.visible)
    );
    cb(cols);
  }, e => {
    console.error('[collections-store] listener failed:', e.code, e.message);
    if (typeof onError === 'function') onError(e);
  });
}

/**
 * Same live data, but UNFILTERED by visibility and including an `error`
 * signal — for admin/management UIs that must still see+edit hidden
 * collections. cb(cols, error): error is null on a normal update, or the
 * Firestore error object on listener failure (cols is [] in that case —
 * callers should render an explicit error state, not treat it as "no
 * collections yet").
 */
export function onAllCollectionsUpdate(cb) {
  return onSnapshot(collection(db, 'collections'), snap => {
    cb(sortCols(snap.docs.map(d => normalizeCollectionDoc(d.id, d.data()))), null);
  }, e => {
    console.error('[collections-store] admin listener failed:', e.code, e.message);
    cb([], e);
  });
}
