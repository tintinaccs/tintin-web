import '../../cargador-mantenimiento-pagina.js?v=tintin-20260830-instant-loading-1';
import { db, appCheckReady } from '../firebase/firebase.js?v=tintin-20260903-app-check-singleton-2';
import { sanitizeImageUrl, uniqueSafeImageUrls } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { cleanText, cleanMultilineText, sanitizeVariantData } from '../auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from '../firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
import { fetchPublicCatalogResource } from '../firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1';
import { sortCatalogProducts, timestampToMillis } from '../../pages/catalog/politica-exhibicion-catalogo.js?v=tintin-20260731-unified-store-1';

const ALL_CACHE_KEY = 'products:cards';
const HOME_CACHE_KEY = 'products:home-featured';
const HOME_CACHE_TTL = 60 * 1000;
const HOME_PRODUCT_LIMIT = 18;
// El catálogo operativo se reconcilia con Sheets/Firestore cada minuto.
// Un TTL de un minuto mantiene la navegación rápida sin ocultar cambios
// de precio, stock o estado durante diez minutos en otros dispositivos.
const ALL_CACHE_TTL = 60 * 1000;
const PRODUCT_CACHE_TTL = 15 * 60 * 1000;
const PUBLIC_CATALOG_ENDPOINT = '/api/public-catalog';
const PUBLIC_PRODUCT_TIMEOUT_MS = 8000;
const PRODUCT_APP_CHECK_TIMEOUT_MS = 1200;
let publicProductsUnsubscribe = null;
let publicProductsReady = null;
let publicProductUnsubscribe = null;
let publicProductReady = null;
let publicProductId = '';
let publicProductRelated = [];
let publicProductCategory = '';
let publicProductCurrent = null;
let publicProductRequestVersion = 0;

function sanitizeProductImage(img) {
  return sanitizeImageUrl(img);
}

function normalizeImageUrl(d) {
  const img = d.imageUrl || d.image || d.img || d.photo || d.imageSrc || d.image_src ||
    d['Image Src'] || d['Variant Image'] || d.Image || d.Imagen || d.Foto || '';
  return sanitizeProductImage(img);
}

export function mapProduct(id, d) {
  const rawCategory = d.category || d.collectionSlug || d.collection || d.cat || d.Type || d.type || d['Product Category'] || d.Category || '';
  const category = cleanText(rawCategory, 120);
  const description = cleanMultilineText(d.description || d.desc || d['Body (HTML)'] || '', 4000);
  const rawExtraImages = Array.isArray(d.imagesExtra) ? d.imagesExtra : Array.isArray(d.images) ? d.images : [];
  return {
    id: String(id),
    name: cleanText(d.name || d.title || d.Title || d.handle || d.Handle || '', 180),
    cat: category,
    category,
    price: Number(String(d.price || d.Price || d['Variant Price'] || 0).replace(/\./g, '').replace(',', '.')),
    priceBefore: d.priceBefore != null ? Number(d.priceBefore) : null,
    badge: cleanText(d.badge || (d.oferta ? 'Oferta' : ''), 60) || null,
    desc: description,
    description,
    material: cleanText(d.material || '', 240),
    measurements: cleanText(d.measurements || '', 240),
    colorFinish: cleanText(d.colorFinish || '', 240),
    care: cleanMultilineText(d.care || '', 500),
    waterResistance: cleanText(d.waterResistance || '', 240),
    warranty: cleanText(d.warranty || '', 240),
    sizeFit: cleanText(d.sizeFit || '', 240),
    packageContents: cleanMultilineText(d.packageContents || '', 500),
    imageUrl: normalizeImageUrl(d),
    imagesExtra: uniqueSafeImageUrls(rawExtraImages).slice(0, 12),
    stock: d.stock ?? d['Variant Inventory Qty'] ?? null,
    active: d.active !== false,
    oferta: !!d.oferta,
    destacado: !!d.destacado,
    tags: Array.isArray(d.tags)
      ? d.tags.map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30)
      : String(d.tags || '').split(',').map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30),
    variants: sanitizeVariantData(d.variants || null),
    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999,
    createdAt: timestampToMillis(d.createdAt ?? d.created_at ?? d.importedAt),
    updatedAt: timestampToMillis(d.updatedAt ?? d.updated_at ?? d.modifiedAt),
    restockedAt: timestampToMillis(d.restockedAt),
    catalogActivityAt: timestampToMillis(d.catalogActivityAt)
  };
}

function compactProduct(product) {
  return {
    id: product.id,
    name: product.name,
    cat: product.cat,
    category: product.category,
    price: product.price,
    priceBefore: product.priceBefore,
    badge: product.badge,
    desc: product.desc,
    description: product.description,
    material: product.material,
    measurements: product.measurements,
    colorFinish: product.colorFinish,
    care: product.care,
    waterResistance: product.waterResistance,
    warranty: product.warranty,
    sizeFit: product.sizeFit,
    packageContents: product.packageContents,
    imageUrl: product.imageUrl,
    imagesExtra: product.imagesExtra,
    tags: product.tags,
    variants: product.variants,
    stock: product.stock,
    active: product.active,
    oferta: product.oferta,
    destacado: product.destacado,
    collectionOrder: product.collectionOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    restockedAt: product.restockedAt,
    catalogActivityAt: product.catalogActivityAt
  };
}

function normalizeList(list) {
  const normalized = list
    .filter(Boolean)
    .map(product => window.TintinCatalogPolicy?.normalizeProduct
      ? window.TintinCatalogPolicy.normalizeProduct(product)
      : product)
    .filter(product => window.TintinCatalogPolicy?.isCatalogVisible
      ? window.TintinCatalogPolicy.isCatalogVisible(product)
      : product.active !== false && Boolean(product.name) && Number.isFinite(Number(product.price)) && Number(product.price) > 0);
  return sortCatalogProducts(normalized);
}

function publish(products, source) {
  const normalized = normalizeList(products);
  const featuredProducts = normalized.filter(product =>
    typeof window.isFeaturable === 'function'
      ? window.isFeaturable(product)
      : !(product.stock != null && Number(product.stock) <= 0)
  );
  window.PRODUCTS = normalized;
  window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
    detail: { products: normalized, source }
  }));
  if (typeof window.renderProductsGrid === 'function') {
    if (document.getElementById('colls-products-grid')) window.renderProductsGrid('colls-products-grid', normalized);
    if (document.getElementById('products-grid')) window.renderProductsGrid('products-grid', featuredProducts.slice(0, 5));
  }
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }
  if (typeof window.renderCart === 'function') window.renderCart();
  if (document.getElementById('product-detail')) {
    const id = new URLSearchParams(location.search).get('id');
    const product = normalized.find(item => String(item.id) === String(id));
    if (product && typeof window._renderProductDetail === 'function') {
      window._renderProductDetail(product);
    } else if (source !== 'loading' && typeof window._showProductNotFound === 'function') {
      window._showProductNotFound();
    } else if (typeof window.initProductPage === 'function') {
      window.initProductPage();
    }
  }
  return normalized;
}

async function fetchAllProductsFromSdk() {
  const snapshot = await getDocs(query(collection(db, 'products'), limit(1000)));
  recordFirestoreRead('products:all', snapshot.size);
  return snapshot.docs.map(item => mapProduct(item.id, item.data()));
}

async function fetchHomeProductsFromSdk() {
  const featuredSnapshot = await getDocs(query(
    collection(db, 'products'),
    where('destacado', '==', true),
    limit(HOME_PRODUCT_LIMIT)
  ));
  recordFirestoreRead('products:home-featured', featuredSnapshot.size);
  const featured = featuredSnapshot.docs.map(item => mapProduct(item.id, item.data()));
  if (featured.length) return featured;

  // Respaldo acotado para tiendas que todavía no marcaron productos destacados.
  const fallbackSnapshot = await getDocs(query(collection(db, 'products'), limit(HOME_PRODUCT_LIMIT)));
  recordFirestoreRead('products:home-fallback', fallbackSnapshot.size);
  return fallbackSnapshot.docs.map(item => mapProduct(item.id, item.data()));
}

async function fetchHomeProducts() {
  // El catálogo público debe pasar siempre por la API edge cacheada. No se
  // permite un fallback automático desde cada navegador a Firestore: un bot
  // podría provocar miles de lecturas cambiando de red o forzando errores de
  // caché. El caché local/stale de loadHomeProducts mantiene la UX cuando la
  // API está temporalmente fuera de servicio.
  const items = await fetchPublicCatalogResource('products');
  let products = items.map(item => mapProduct(item.id, item.data));

  products = normalizeList(products);
  const cards = products.map(compactProduct);
  if (cards.length) writeCached(HOME_CACHE_KEY, cards);
  return publish(products, 'home-limited');
}

async function fetchAllProducts() {
  const items = await fetchPublicCatalogResource('products');
  let products = items.map(item => mapProduct(item.id, item.data));
  products = normalizeList(products);
  const cards = products.map(compactProduct);
  // Un catálogo vacío no es una caché útil. Una lectura transitoria bloqueada
  // por red o un despliegue nunca debe dejar al navegador mostrando "0 productos".
  if (cards.length) writeCached(ALL_CACHE_KEY, cards);
  return publish(products, 'edge-cache');
}

async function startPublicProductsRealtime() {
  if (publicProductsReady) return publicProductsReady;
  // La superficie pública se actualiza por TTL/caché edge. Un listener de
  // colección completa aquí multiplicaba lecturas por cada visitante y podía
  // volver a disparar el costo aunque el catálogo no hubiera cambiado.
  publicProductsReady = loadAllProducts();
  publicProductsReady.finally(() => {
    publicProductsReady = null;
  });
  return publicProductsReady;
}

export async function loadHomeProducts(options = {}) {
  const force = options.force === true;
  if (!force) {
    const cached = readCached(HOME_CACHE_KEY, HOME_CACHE_TTL);
    if (Array.isArray(cached) && cached.length) return publish(cached, 'home-cache');
  }

  const stale = readStaleCached(HOME_CACHE_KEY);
  if (!force && Array.isArray(stale) && stale.length) publish(stale, 'home-stale-cache');
  try {
    return await runSingleFlight('products:home', fetchHomeProducts);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
    if (Array.isArray(stale) && stale.length) return stale;
    throw error;
  }
}

export async function loadAllProducts(options = {}) {
  const force = options.force === true;
  if (!force) {
    const cached = readCached(ALL_CACHE_KEY, ALL_CACHE_TTL);
    if (Array.isArray(cached) && cached.length) return publish(cached, 'cache');
  }
  const stale = readStaleCached(ALL_CACHE_KEY);
  if (!force && Array.isArray(stale) && stale.length) publish(stale, 'stale-cache');
  try {
    return await runSingleFlight('products:all', fetchAllProducts);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
    if (Array.isArray(stale) && stale.length) return stale;
    throw error;
  }
}

async function fetchSingleProduct(id) {
  if (!await appCheckReady) return null;
  const snapshot = await getDoc(doc(db, 'products', id));
  recordFirestoreRead('products:single', 1);
  if (!snapshot.exists()) return null;
  const product = mapProduct(snapshot.id, snapshot.data());
  if (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product)) return null;
  writeCached(`product:${id}`, product);
  return product;
}

async function fetchSingleProductFromEdge(id) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PUBLIC_PRODUCT_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ resource: 'products', id: String(id) });
    const response = await fetch(`${PUBLIC_CATALOG_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      credentials: 'omit',
      cache: 'default',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('API pública de producto respondió ' + response.status);
    const payload = await response.json();
    if (!payload?.ok || payload.resource !== 'products' || !Object.prototype.hasOwnProperty.call(payload, 'item')) {
      throw new Error('Respuesta pública de producto inválida');
    }
    if (payload.item == null) return null;
    if (!payload.item.id || !payload.item.data || typeof payload.item.data !== 'object') {
      throw new Error('Producto público inválido');
    }
    const product = mapProduct(payload.item.id, payload.item.data);
    if (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product)) return null;
    writeCached(`product:${id}`, product);
    return product;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchRelatedProducts(product) {
  if (!product?.category) return [];
  if (!await appCheckReady) return [];
  try {
    const snapshot = await getDocs(query(
      collection(db, 'products'),
      where('category', '==', product.category),
      limit(12)
    ));
    recordFirestoreRead('products:related', snapshot.size);
    return normalizeList(snapshot.docs.map(item => mapProduct(item.id, item.data())))
      .map(compactProduct);
  } catch {
    return [];
  }
}

function stopProductRealtime() {
  // onSnapshot puede entregar un callback que ya estaba en cola después de
  // unsubscribe(). La versión invalida esa entrega para que nunca pinte otro
  // producto al navegar rápido entre fichas.
  publicProductRequestVersion += 1;
  publicProductUnsubscribe?.();
  publicProductUnsubscribe = null;
  publicProductReady = null;
  publicProductId = '';
  publicProductRelated = [];
  publicProductCategory = '';
  publicProductCurrent = null;
}

function isCurrentProductRequest(id, requestVersion) {
  return publicProductId === id && publicProductRequestVersion === requestVersion;
}

function waitForProductAppCheck() {
  let timer = 0;
  const timeout = new Promise(resolve => {
    timer = window.setTimeout(() => resolve(false), PRODUCT_APP_CHECK_TIMEOUT_MS);
  });
  return Promise.race([
    Promise.resolve(appCheckReady).catch(() => false),
    timeout,
  ]).finally(() => window.clearTimeout(timer));
}

async function startProductRealtime(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return Promise.resolve(publish([], 'missing-id'));
  if (publicProductReady && publicProductId === normalizedId) return publicProductReady;

  stopProductRealtime();
  publicProductId = normalizedId;
  const requestVersion = publicProductRequestVersion;

  const cachedProduct = readCached(`product:${normalizedId}`, PRODUCT_CACHE_TTL);
  if (cachedProduct) publish([cachedProduct], 'cache');

  // La ficha no debe esperar a App Check ni descargar los ~1000 productos del
  // catálogo para resolver uno solo. La API pública canónica consulta el mismo
  // documento por ID y queda en paralelo mientras App Check prepara realtime.
  // Si responde primero, el producto se pinta de inmediato; si App Check está
  // disponible, el listener SDK toma luego el control y mantiene precio/stock vivo.
  const edgeResultPromise = runSingleFlight(
    `product:edge:${normalizedId}`,
    () => fetchSingleProductFromEdge(normalizedId)
  ).then(product => {
    if (!isCurrentProductRequest(normalizedId, requestVersion)) return { ok: true, product, published: null };
    if (product) {
      publicProductCurrent = product;
      return { ok: true, product, published: publish([product], 'edge-product') };
    }
    return { ok: true, product: null, published: publish([], 'edge-product-missing') };
  }).catch(error => ({ ok: false, error, product: null, published: null }));

  // App Check mejora la protección del listener realtime, pero no puede
  // retener la ficha: la API pública ya está resolviendo en paralelo.
  const appCheckAvailable = await waitForProductAppCheck();
  if (!isCurrentProductRequest(normalizedId, requestVersion)) return [];
  if (!appCheckAvailable) {
    const edgeResult = await edgeResultPromise;
    if (!isCurrentProductRequest(normalizedId, requestVersion)) return [];
    if (edgeResult.ok) return edgeResult.published || publish(edgeResult.product ? [edgeResult.product] : [], edgeResult.product ? 'edge-product' : 'edge-product-missing');
    if (cachedProduct) return publish([cachedProduct], 'stale-cache');
    throw edgeResult.error;
  }

  publicProductReady = new Promise((resolve, reject) => {
    let settled = false;
    const settle = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    publicProductUnsubscribe = onSnapshot(
      doc(db, 'products', normalizedId),
      snapshot => {
        if (!isCurrentProductRequest(normalizedId, requestVersion)) return;
        recordFirestoreRead('products:single-realtime', 1);
        if (!snapshot.exists()) {
          settle(publish([], 'realtime-product-missing'));
          return;
        }

        const product = mapProduct(snapshot.id, snapshot.data());
        if (product.active === false || !product.name ||
            (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product))) {
          publicProductCurrent = null;
          settle(publish([], 'realtime-product-unavailable'));
          return;
        }

        publicProductCurrent = product;
        writeCached(`product:${normalizedId}`, product);
        const current = publish(
          [product, ...publicProductRelated.filter(item => item.id !== product.id)],
          'realtime-product'
        );
        settle(current);

        if (publicProductCategory === product.category && publicProductRelated.length) return;
        publicProductCategory = product.category;
        runSingleFlight(
          `products:related:${product.category}`,
          () => fetchRelatedProducts(product)
        ).then(related => {
          if (!isCurrentProductRequest(normalizedId, requestVersion)) return;
          publicProductRelated = related;
          const latestProduct = publicProductCurrent;
          if (!latestProduct) return;
          publish(
            [latestProduct, ...related.filter(item => item.id !== latestProduct.id)],
            'realtime-product-related'
          );
        }).catch(() => {
          // La ficha principal ya está actualizada. Los relacionados son opcionales.
        });
      },
      async error => {
        if (!isCurrentProductRequest(normalizedId, requestVersion)) {
          settle([]);
          return;
        }
        publicProductUnsubscribe = null;
        publicProductReady = null;
        // No se emite products-error todavía: ese evento es terminal para la
        // ficha y antes reiniciaba su watchdog aun cuando el fallback seguía vivo.
        // Primero agotamos las autoridades ya existentes; recién el rechazo final
        // de loadProductPage se transforma en un único error visible.
        const edgeResult = await edgeResultPromise;
        if (!isCurrentProductRequest(normalizedId, requestVersion)) {
          settle([]);
          return;
        }
        if (edgeResult.ok) {
          if (edgeResult.product) {
            settle(edgeResult.published || publish([edgeResult.product], 'edge-product-fallback'));
          } else {
            settle(edgeResult.published || publish([], 'edge-product-missing'));
          }
          return;
        }

        try {
          const product = await runSingleFlight(
            `product:${normalizedId}`,
            () => fetchSingleProduct(normalizedId)
          );
          if (!isCurrentProductRequest(normalizedId, requestVersion)) {
            settle([]);
            return;
          }
          if (product && product.active !== false && product.name) {
            settle(publish([product], 'server-fallback'));
          } else if (cachedProduct) {
            settle(publish([cachedProduct], 'stale-cache'));
          } else {
            settle(publish([], 'server-fallback-missing'));
          }
        } catch (fallbackError) {
          if (cachedProduct) settle(publish([cachedProduct], 'stale-cache'));
          else reject(fallbackError || error);
        }
      }
    );
  });

  window.addEventListener('pagehide', stopProductRealtime, { once: true });
  return publicProductReady;
}

export async function loadProductPage(options = {}) {
  const id = String(options.id || new URLSearchParams(location.search).get('id') || '').trim();
  if (!id) {
    publish([], 'missing-id');
    return [];
  }
  if (options.force === true) stopProductRealtime();
  return startProductRealtime(id);
}

export async function ensureProductsForSearch() {
  return loadAllProducts();
}

export async function ensureProductsForCurrentPage() {
  const path = location.pathname.toLowerCase();
  if (/(^|\/)product(?:\.html)?$/.test(path)) return loadProductPage();
  if (path.endsWith('/') || /(^|\/)index(?:\.html)?$/.test(path)) return loadHomeProducts();
  if (/(^|\/)(?:catalogo|collections)(?:\.html)?$/.test(path)) {
    return loadAllProducts();
  }
  // Inventario histórico de rutas para auditorías: index|catalogo|collections.
  return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
}

function attachSearchDemand() {
  ['btn-search', 'tabbar-search'].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    const load = () => ensureProductsForSearch().then(() => {
      const input = document.getElementById('search-input');
      if (input?.value) input.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(error => {
      window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
    });
    control.addEventListener('pointerenter', load, { once: true, passive: true });
    control.addEventListener('focus', load, { once: true });
    control.addEventListener('click', load, { once: true });
  });
}

window.TintinProductsStore = {
  loadAll: loadAllProducts,
  loadHome: loadHomeProducts,
  loadProductPage,
  startRealtime: startPublicProductsRealtime,
  ensureSearch: ensureProductsForSearch,
  ensureCurrentPage: ensureProductsForCurrentPage,
  getReadBudget: () => window.TintinReadBudget || null
};

attachSearchDemand();
ensureProductsForCurrentPage().catch(error => {
  window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
});
