import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { cleanText, cleanMultilineText } from './security-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { sanitizeImageUrl } from './image-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { resolveCollectionImage } from './image-resolver.js?v=tintin-20260716-cloudinary-fix-1';
import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from './firestore-read-cache.js?v=tintin-20260720-read-budget-1';

if (/(^|\/)admin(?:\.html)?$/i.test(location.pathname)) {
  Promise.allSettled([
    import('./admin-payment-legacy-preserve.js?v=tintin-20260720-payment-crud-1'),
    import('./admin-payment-methods.js?v=tintin-20260720-payment-crud-1')
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
  return sortCols(withResolvedImages(latestVisibleCollections));
}

async function fetchPublicCollections() {
  const snapshot = await getDocs(query(collection(db, 'collections'), limit(200)));
  recordFirestoreRead('collections:public', snapshot.size);
  const list = snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data()));
  writeCached(CACHE_KEY, list);
  return publishPublic(list, 'server');
}

export async function loadCollections(options = {}) {
  const force = options.force === true;
  if (!force) {
    const cached = readCached(CACHE_KEY, CACHE_TTL);
    if (Array.isArray(cached)) return publishPublic(cached, 'cache');
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

function startAdminListener() {
  if (adminUnsubscribe) return;
  adminUnsubscribe = onSnapshot(query(collection(db, 'collections'), limit(200)), snapshot => {
    recordFirestoreRead('collections:admin-live', snapshot.size);
    const list = sortCols(snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data())));
    adminSubscribers.forEach(cb => cb(list, null));
    writeCached(CACHE_KEY, list);
  }, error => {
    adminSubscribers.forEach(cb => cb([], error));
  });
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
