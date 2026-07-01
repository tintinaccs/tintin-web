/**
 * TINTIN — Collections Store
 * Real-time read of the `collections` Firestore collection (managed from
 * Super Admin → Colecciones). Feeds catalogo.html's sidebar, collections.html,
 * and the home "Nuestras Colecciones" grid — one source of truth for which
 * collections exist, their name/image/order/visibility.
 *
 * If no collections have been configured yet in Firestore, falls back to the
 * original 12 canonical categories so nothing breaks on a fresh install.
 */
import { db } from './firebase.js';
import { collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const FALLBACK_COLLECTIONS = [
  { slug: 'relojes',    name: 'Relojes' },
  { slug: 'bolsos',     name: 'Bags' },
  { slug: 'aros',       name: 'Aros' },
  { slug: 'collares',   name: 'Collares' },
  { slug: 'pulseras',   name: 'Pulseras' },
  { slug: 'anillos',    name: 'Anillos' },
  { slug: 'tobilleras', name: 'Tobilleras' },
  { slug: 'brazaletes', name: 'Brazaletes' },
  { slug: 'earcuff',    name: 'Earcuff' },
  { slug: 'armcuff',    name: 'Armcuff' },
  { slug: 'gafas',      name: 'Gafas' },
  { slug: 'joyeros',    name: 'Joyeros' },
].map((c, i) => ({ ...c, order: i, visible: true, image: '', description: '' }));

/** cb receives an array of visible collections, sorted by order, live. */
export function onCollectionsUpdate(cb) {
  onSnapshot(query(collection(db, 'collections'), orderBy('order')), snap => {
    let cols = snap.docs.map(d => ({ slug: d.id, ...d.data() })).filter(c => c.visible !== false);
    if (!cols.length) cols = FALLBACK_COLLECTIONS;
    cb(cols);
  }, e => {
    console.warn('[collections-store] listener failed, using fallback:', e);
    cb(FALLBACK_COLLECTIONS);
  });
}
