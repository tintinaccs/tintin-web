import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cleanText, cleanMultilineText } from '../../core/auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { resolveCollectionImage } from '../../components/images/resolucion-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from '../../core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
import { listPublicCollectionRest } from '../../core/firebase/respaldo-rest-firestore.js?v=tintin-20260726-browser-fallback-1';
import { fetchPublicCatalogResource } from '../../core/firebase/catalogo-publico-api.js?v=tintin-20260831-product-loading-1';

if (/(^|\/)admin(?:\.html)?$/i.test(location.pathname)) {
  Promise.allSettled([
    import('../../admin/settings/compatibilidad-pagos-anteriores-admin.js?v=tintin-20260720-payment-crud-1'),
    import('../../admin/settings/metodos-pago-admin.js?v=tintin-20260821-accounts-phase-a-1')
  ]);
}

const CACHE_KEY = 'collections:public';
const CACHE_TTL = 30 * 60 * 1000;

export function normalizeCollectionDoc(id, data) {
  const d = data || {};
  const orderNum = Number(d.order);
  return {
    slug: id,
    name: cleanText(d.name || d.title || id, 120),
    description: cleanMultilineText(d.description || '', 1000),
    image: sanitizeImageUrl(d.image || d.imageUrl || ''),
    order: Number.isFinite(orderNum) ? orderNum : 9999,
    visible: d.visible !== false
  };
}

function sortCols(list) {
  return list.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
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
  latestVisibleCollections = collections.filter(item => item.visible !== false);
  republishToPublicSubscribers(source);
}

async function fetchPublicCollectionsSdk() {
  const snapshot = await getDocs(query(collection(db, 'collections'), limit(300)));
  recordFirestoreRead('collections:public', snapshot.size);
  return snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data()));
}

async function fetchPublicCollectionsRest() {
  const documents = await listPublicCollectionRest('collections', 300);
  recordFirestoreRead('collections:public-rest-fallback', documents.length);
  return documents.map(item => normalizeCollectionDoc(item.id, item.data));
}

async function fetchPublicCollections() {
  let collections;
  try {
    const items = await fetchPublicCatalogResource('collections');
    collections = items.map(item => normalizeCollectionDoc(item.id, item.data));
  } catch (edgeError) {
    try {
      collections = await fetchPublicCollectionsRest();
    } catch (restError) {
      if (!await appCheckReady) throw restError;
      collections = await fetchPublicCollectionsSdk();
    }
  }
  const normalized = sortCols(collections.filter(item => item.visible));
  if (normalized.length) writeCached(CACHE_KEY, normalized);
  publishPublic(normalized, 'edge-or-firestore-fallback');
  return normalized;
}

export async function loadPublicCollections(options = {}) {
  attachProductsReactivity();
  const force = options.force === true;
  if (!force) {
    const cached = readCached(CACHE_KEY, CACHE_TTL);
    if (Array.isArray(cached) && cached.length) {
      const normalized = sortCols(cached.filter(item => item.visible !== false));
      publishPublic(normalized, 'cache');
      return normalized;
    }
  }

  const stale = readStaleCached(CACHE_KEY);
  if (!force && Array.isArray(stale) && stale.length) publishPublic(stale, 'stale-cache');
  try {
    return await runSingleFlight('collections:public', fetchPublicCollections);
  } catch (error) {
    if (Array.isArray(stale) && stale.length) return stale;
    throw error;
  }
}

export async function startPublicCollectionsRealtime(callback) {
  attachProductsReactivity();
  const subscriber = typeof callback === 'function' ? callback : () => {};
  publicSubscribers.add(subscriber);
  const initial = await loadPublicCollections();
  if (latestVisibleCollections) subscriber(sortCols(withResolvedImages(latestVisibleCollections)), { source: 'initial' });

  if (!await appCheckReady) {
    return () => publicSubscribers.delete(subscriber);
  }

  let unsubscribe = null;
  try {
    unsubscribe = onSnapshot(
      query(collection(db, 'collections'), limit(300)),
      snapshot => {
        recordFirestoreRead('collections:realtime', snapshot.size);
        const collections = sortCols(snapshot.docs
          .map(item => normalizeCollectionDoc(item.id, item.data()))
          .filter(item => item.visible));
        if (collections.length) writeCached(CACHE_KEY, collections);
        publishPublic(collections, 'realtime');
      },
      () => {
        // El cache/fallback ya mantiene la vista útil; no rompemos la experiencia pública.
      }
    );
  } catch {
    unsubscribe = null;
  }

  return () => {
    publicSubscribers.delete(subscriber);
    unsubscribe?.();
  };
}

export async function startAdminCollectionsRealtime(callback) {
  const subscriber = typeof callback === 'function' ? callback : () => {};
  adminSubscribers.add(subscriber);
  if (!await appCheckReady) return () => adminSubscribers.delete(subscriber);

  if (!adminUnsubscribe) {
    adminUnsubscribe = onSnapshot(
      query(collection(db, 'collections'), limit(300)),
      snapshot => {
        recordFirestoreRead('collections:admin-realtime', snapshot.size);
        const collections = sortCols(snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data())));
        adminSubscribers.forEach(cb => {
          try {
            cb(collections, { source: 'realtime' });
          } catch (error) {
            console.warn('[collections-store] admin subscriber error:', error);
          }
        });
      },
      error => {
        console.warn('[collections-store] admin realtime error:', error);
      }
    );
  }

  return () => {
    adminSubscribers.delete(subscriber);
    if (!adminSubscribers.size && adminUnsubscribe) {
      adminUnsubscribe();
      adminUnsubscribe = null;
    }
  };
}
