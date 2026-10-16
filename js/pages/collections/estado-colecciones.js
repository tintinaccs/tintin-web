import { CACHE_KEY, loadCollections as loadCollectionMetadata, normalizeCollectionDoc, normalizeCollectionSlug, canonicalPublicCollections, sortCols } from './datos-publicos-colecciones.js?v=tintin-20261015-public-collection-data-1';
export { normalizeCollectionDoc, normalizeCollectionSlug, canonicalPublicCollections };
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js-domain-prepared-20261012-6-pedidos-styles-20261013-1-security-ready-20261013-2';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  orderBy,
  startAfter
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { resolveCollectionImage } from '../../components/images/resolucion-imagenes.js?v=tintin-20261015-images-1-admin-live-20261016-1';
import {
  recordFirestoreRead,
  writeCached
} from '../../core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';

if (/(^|\/)admin(?:\.html)?$/i.test(location.pathname)) {
  Promise.allSettled([
    import('../../admin/settings/compatibilidad-pagos-anteriores-admin.js?v=tintin-20260925-cache-converge-1'),
    import('../../admin/settings/metodos-pago-admin.js?v=tintin-20261012-checkout-ready-3-metodos-pago-admin-js-domain-prepared-20261012-6-pedidos-styles-20261013-2-security-ready-20261013-2-palette-20261014-1-ui-reconciled-20261014-1-admin-live-20261016-1')
  ]);
}


function withResolvedImages(cols) {
  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  return cols.map(col => ({ ...col, image: resolveCollectionImage(col, products) }));
}

let latestVisibleCollections = null;
const publicSubscribers = new Set();
let productsReactivityAttached = false;
let adminUnsubscribe = null;
const adminSubscribers = new Set();

function republishToPublicSubscribers(source = 'memory') {
  if (!latestVisibleCollections) return;
  const resolved = sortCols(withResolvedImages(latestVisibleCollections));
  publicSubscribers.forEach(cb => {
    try {
      cb(resolved, { source });
    } catch (error) {
      console.warn('[collections-store] subscriber error:', error);
    }
  });
}

function attachProductsReactivity() {
  if (productsReactivityAttached) return;
  productsReactivityAttached = true;
  window.addEventListener('tintin:products-loaded', () => republishToPublicSubscribers('products-refresh'));
}

function publishPublic(collections, source) {
  latestVisibleCollections = canonicalPublicCollections(collections);
  republishToPublicSubscribers(source);
  return sortCols(withResolvedImages(latestVisibleCollections));
}

export async function loadCollections(options = {}) {
  let resolved;
  await loadCollectionMetadata({ ...options, onData: (rows, source) => { resolved = publishPublic(rows, source); } });
  return resolved;
}

export function onCollectionsUpdate(cb, onError) {
  attachProductsReactivity();
  publicSubscribers.add(cb);
  if (latestVisibleCollections) republishToPublicSubscribers('memory');
  loadCollections().catch(error => {
    console.error('[collections-store] load failed:', error.code || '', error.message || error);
    if (typeof onError === 'function') onError(error);
  });
  return () => publicSubscribers.delete(cb);
}

async function startAdminListener() {
  if (adminUnsubscribe) return;
  const uid = auth.currentUser?.uid;
  const [{ subscribeAdminSnapshot }, { createAdminPagedSource }, { isSuperAdmin }] = await Promise.all([
    import('../../admin/auth/lecturas-admin.js?v=tintin-20261012-auth-privacy-1-lecturas-admin-js-domain-prepared-20261012-6-pedidos-styles-20261013-2-security-ready-20261013-2-connections-20261014-1-ui-reconciled-20261014-1-admin-live-20261016-1'),
    import('../../admin/datos/fuente-paginada-admin.mjs?v=tintin-20261016-admin-live-1'),
    import('../../core/auth/identidad-super-admin.js?v=tintin-20260916-superadmin-identity-2'),
  ]);
  if (adminUnsubscribe || !adminSubscribers.size || !uid || auth.currentUser?.uid !== uid) return;
  adminUnsubscribe = createAdminPagedSource({
    complete: isSuperAdmin(auth.currentUser),
    subscribePage(cursor, next, fail) {
      const source = query(collection(db, 'collections'), orderBy('__name__'), ...(cursor ? [startAfter(cursor)] : []), limit(200));
      return subscribeAdminSnapshot(source, snapshot => {
        recordFirestoreRead('collections:admin-live', snapshot.size);
        const last = snapshot.docs.at(-1);
        next({ records: snapshot.docs.map(item => ({ id: item.id, collection: normalizeCollectionDoc(item.id, item.data()) })),
          cursor: last, cursorKey: last?.id || '', hasMore: snapshot.docs.length === 200 });
      }, fail);
    },
    onData(records) {
      const list = sortCols(records.map(item => item.collection));
      adminSubscribers.forEach(cb => cb(list, null));
      writeCached(CACHE_KEY, list);
    },
    onError(error) { adminSubscribers.forEach(cb => cb([], error)); },
  }).stop;
}

export function onAllCollectionsUpdate(cb) {
  adminSubscribers.add(cb);
  startAdminListener();
  return () => {
    adminSubscribers.delete(cb);
    if (!adminSubscribers.size && adminUnsubscribe) {
      adminUnsubscribe();
      adminUnsubscribe = null;
    }
  };
}

window.TintinCollectionsStore = {
  load: loadCollections,
  refresh: () => loadCollections({ force: true })
};
