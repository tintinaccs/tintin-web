import { firstEligibleCollectionProduct } from '../../core/store/colecciones-publicas.mjs?v=tintin-20261030-home-history-4';
// La lectura pública no descarga las herramientas de guardado administrativo.
const withAdminSiteChange = async action => (await import('../../core/store/publicar-cambio-administrativo.js?v=tintin-20261017-domain-cutover-1')).withAdminSiteChange(action);
/* =============================================================
   TINTIN — Resolución centralizada de imágenes

   Única fuente de lógica para: qué imagen mostrar por dispositivo (con
   reutilización automática de desktop en tablet/mobile), qué imagen mostrar
   para una colección sin foto propia (respaldo automático desde el primer
   producto elegible), y cuál es el respaldo global configurado por Super
   Admin cuando no hay ninguna imagen real disponible. Ninguna página debe
   reimplementar esta cascada — todas deben importar de acá.
   ============================================================= */

import { db } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { sanitizeImageUrl } from './utilidades-imagenes.js?v=tintin-20261030-home-history-5';

const DEFAULTS_DOC_PATH = ['settings', 'imageDefaults'];
export const DEFAULT_IMAGE_TYPES = Object.freeze(['collection', 'category', 'product', 'banner', 'general']);

function normalizeDefaults(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};
  DEFAULT_IMAGE_TYPES.forEach(type => {
    normalized[type] = sanitizeImageUrl(source[type]) || '';
  });
  return normalized;
}

let defaultsCache = null;
let defaultsListenerStarted = false;
const defaultsSubscribers = new Set();

function publishDefaults(raw) {
  defaultsCache = normalizeDefaults(raw);
  defaultsSubscribers.forEach(fn => {
    try { fn({ ...defaultsCache }); } catch (error) { console.warn('[image-resolver] subscriber error:', error); }
  });
  return defaultsCache;
}

/** Suscripción en vivo a los respaldos globales configurados en Apariencia/Imágenes. */
export function onImageDefaultsUpdate(cb) {
  if (typeof cb === 'function') {
    defaultsSubscribers.add(cb);
    if (defaultsCache) cb({ ...defaultsCache });
  }
  if (!defaultsListenerStarted) {
    defaultsListenerStarted = true;
    onSnapshot(
      doc(db, ...DEFAULTS_DOC_PATH),
      snap => publishDefaults(snap.exists() ? snap.data() : {}),
      error => console.warn('[image-resolver] defaults listener failed:', error)
    );
  }
  return () => defaultsSubscribers.delete(cb);
}

/** Lectura puntual (no reactiva) de los respaldos globales — usa/llena la misma caché. */
export async function loadImageDefaults() {
  if (defaultsCache) return { ...defaultsCache };
  try {
    const snap = await getDoc(doc(db, ...DEFAULTS_DOC_PATH));
    return publishDefaults(snap.exists() ? snap.data() : {});
  } catch (error) {
    console.warn('[image-resolver] could not load defaults:', error);
    return normalizeDefaults({});
  }
}

/** Guarda los respaldos globales (Super Admin únicamente, reglas del lado servidor lo exigen). */
export async function saveImageDefaults(patch) {
  const next = normalizeDefaults({ ...(defaultsCache || {}), ...patch });
  await withAdminSiteChange(async () => setDoc(doc(db, ...DEFAULTS_DOC_PATH), { ...next, updatedAt: serverTimestamp() }, { merge: true }));
  return publishDefaults(next);
}

/** Devuelve el respaldo global ya cacheado para un tipo de contenido (o el general si no hay uno específico). */
export function getDefaultImage(type) {
  if (!defaultsCache) return '';
  return defaultsCache[type] || defaultsCache.general || '';
}

/**
 * Cascada de dispositivo, pura y sin I/O. Implementa exactamente la
 * prioridad pedida: cada dispositivo prioriza su propia imagen, después
 * reutiliza desktop (si autoReuseDesktop no está desactivado explícitamente),
 * y por último cruza con el otro dispositivo no-desktop antes de rendirse.
 */
export function resolveDeviceImage(images = {}, device = 'desktop') {
  const desktop = sanitizeImageUrl(images.desktop) || '';
  const tablet = sanitizeImageUrl(images.tablet) || '';
  const mobile = sanitizeImageUrl(images.mobile) || '';
  const autoReuseDesktop = images.autoReuseDesktop !== false;

  if (device === 'tablet') {
    if (tablet) return tablet;
    if (autoReuseDesktop && desktop) return desktop;
    return mobile || '';
  }
  if (device === 'mobile') {
    if (mobile) return mobile;
    if (autoReuseDesktop && desktop) return desktop;
    return tablet || '';
  }
  // desktop
  if (desktop) return desktop;
  if (!autoReuseDesktop) return '';
  return tablet || mobile || '';
}

/**
 * Primer producto "elegible" de una colección: activo, con nombre y con
 * imagen válida, en el orden real configurado (collectionOrder), con el
 * nombre como desempate. Excluye automáticamente productos eliminados,
 * desactivados o sin imagen — nunca hace falta filtrarlos antes de llamar.
 */
export function firstEligibleProductImage(slug, products) {
  const product = firstEligibleCollectionProduct(slug, products, sanitizeImageUrl);
  return product ? sanitizeImageUrl(product.imageUrl) : '';
}

/**
 * Resuelve la imagen efectiva de una colección para CUALQUIER lugar que la
 * muestre: su propia imagen configurada -> la imagen del primer producto
 * elegible -> el respaldo global de colecciones. `products` es la lista ya
 * normalizada (la misma forma que expone estado-productos.js / window.PRODUCTS).
 * Siempre devuelve una URL válida o '' si genuinamente no hay nada que mostrar
 * (ni imagen propia, ni producto con imagen, ni respaldo global configurado).
 */
export function resolveCollectionImage(collectionDoc, products, { productFallback = '' } = {}) {
  const own = sanitizeImageUrl(collectionDoc?.image);
  if (own) return own;

  const fromProduct = sanitizeImageUrl(productFallback) || firstEligibleProductImage(collectionDoc?.slug, products);
  if (fromProduct) return fromProduct;

  return getDefaultImage('collection');
}

/** Resuelve la imagen de un producto: la propia, o el respaldo global de productos. */
export function resolveProductImage(productDoc) {
  return sanitizeImageUrl(productDoc?.imageUrl) || getDefaultImage('product');
}
