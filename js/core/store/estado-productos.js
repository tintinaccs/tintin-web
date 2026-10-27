import { getProductPagePrefetch } from '../../pages/product/precarga-datos-producto.js?v=tintin-20261015-product-fast-1';
import { wristCategory } from './categorias-pulseras.mjs?v=tintin-20261014-pulseras-2';
import '../../cargador-mantenimiento-pagina.js?v=tintin-20261027-welcome-receipt-1';
import { catalogVisibilityReady } from '../../pages/catalog/politica-visibilidad-catalogo.js?v=tintin-20261026-editor-closure-1';
import '../../pages/catalog/prioridad-stock-catalogo.js?v=tintin-20261023-variant-engine-v2-2';
import { loadProductRealtimeDependencies } from './tiempo-real-producto.js?v=tintin-20261017-domain-cutover-1';
import { sanitizeImageUrl, uniqueSafeImageUrls } from '../../components/images/utilidades-imagenes.js?v=tintin-20261015-images-1';
import { cleanText, cleanMultilineText, sanitizeVariantData } from '../auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1';

import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from '../firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
import { fetchPublicCatalogResource } from '../firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1-first-render-merge-20261010-1-bags-20261014-1';
import { sortCatalogProducts, timestampToMillis } from '../../pages/catalog/politica-exhibicion-catalogo.js?v=tintin-20261023-variant-engine-v2-2';

const ALL_CACHE_KEY = 'products:cards';
const HOME_CACHE_KEY = 'products:home-featured';
const HOME_CACHE_TTL = 10 * 1000;
// La caché local acompaña la frescura del edge (10 segundos) para mostrar
// cambios de precio, stock y estado al volver a la categoría.
const ALL_CACHE_TTL = 10 * 1000;
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

let realtimeDependencies;
let db, doc, getDoc, onSnapshot;
function getRealtimeDependencies() {
  if (!realtimeDependencies) realtimeDependencies = loadProductRealtimeDependencies().then(deps => {
    ({ db, doc, getDoc, onSnapshot } = deps);
    return deps;
  }).catch(() => null);
  return realtimeDependencies;
}

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
  const category = wristCategory(cleanText(rawCategory, 120));
  const description = cleanMultilineText(d.description || d.desc || d['Body (HTML)'] || '', 4000);
  const rawExtraImages = Array.isArray(d.imagesExtra) ? d.imagesExtra : Array.isArray(d.images) ? d.images : [];
  return {
    id: String(id),
    sku: cleanText(d.sku ?? '', 120),
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
    publicationStatus:d.publicationStatus,productTemplate:d.productTemplate,seoTitle:d.seoTitle,seoDescription:d.seoDescription,
    oferta: !!d.oferta,
    destacado: !!d.destacado,
    tags: Array.isArray(d.tags)
      ? d.tags.map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30)
      : String(d.tags || '').split(',').map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30),
    variants: sanitizeVariantData(d.variants || null),
    variantMedia: (Array.isArray(d.variantMedia) ? d.variantMedia : Array.isArray(d.variants) ? d.variants : []).slice(0, 100)
      .filter(row => row && typeof row === 'object' && !Array.isArray(row))
      .map(row => ({ ...row, imageUrl: sanitizeProductImage(row.imageUrl || ''),
        imageUrls: uniqueSafeImageUrls(Array.isArray(row.imageUrls) ? row.imageUrls : []).slice(0, 24) })),
    variantCommerceVersion: d.variantCommerceVersion,
    variantInventory: d.variantInventory ?? null,
    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999,
    createdAt: timestampToMillis(d.createdAt ?? d.created_at ?? d.importedAt),
    updatedAt: timestampToMillis(d.updatedAt ?? d.updated_at ?? d.modifiedAt),
    restockedAt: timestampToMillis(d.restockedAt),
    catalogActivityAt: timestampToMillis(d.catalogActivityAt),
    merchandisingUpdatedAt: timestampToMillis(d.merchandisingUpdatedAt)
  };
}

function compactProduct(product) {
  return {
    id: product.id,
    sku: product.sku,
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
    variantMedia: product.variantMedia,
    variantCommerceVersion: product.variantCommerceVersion,
    variantInventory: product.variantInventory,
    stock: product.stock,
    active: product.active,
    publicationStatus:product.publicationStatus,productTemplate:product.productTemplate,seoTitle:product.seoTitle,seoDescription:product.seoDescription,
    oferta: product.oferta,
    destacado: product.destacado,
    collectionOrder: product.collectionOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    restockedAt: product.restockedAt,
    catalogActivityAt: product.catalogActivityAt,
    merchandisingUpdatedAt: product.merchandisingUpdatedAt
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
  window.PRODUCTS = normalized;
  // Única vía de pintado de las grillas (Inicio, Colecciones, "Completá tu
  // look"): tienda.js escucha este evento. Pintar también desde acá producía
  // dos renders por publicación con selecciones aleatorias distintas.
  window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
    detail: { products: normalized, source }
  }));
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
    const cached = readCached(HOME_CACHE_KEY, HOME_CACHE_TTL) || readCached(ALL_CACHE_KEY, ALL_CACHE_TTL);
    if (Array.isArray(cached) && cached.length) return publish(cached, 'home-cache');
  }

  const stale = readStaleCached(HOME_CACHE_KEY) || readStaleCached(ALL_CACHE_KEY);
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
    const cached = readCached(ALL_CACHE_KEY, ALL_CACHE_TTL) || readCached(HOME_CACHE_KEY, HOME_CACHE_TTL);
    if (Array.isArray(cached) && cached.length) return publish(cached, 'cache');
  }
  const stale = readStaleCached(ALL_CACHE_KEY) || readStaleCached(HOME_CACHE_KEY);
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
  const deps = await getRealtimeDependencies();
  if (!deps || !await deps.appCheckReady) return null;
  const snapshot = await getDoc(doc(db, 'products', id));
  recordFirestoreRead('products:single', 1);
  if (!snapshot.exists()) return null;
  const product = mapProduct(snapshot.id, snapshot.data());
  if (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product)) return null;
  writeCached(`product:${id}`, product);
  return product;
}

async function fetchSingleProductFromEdge(id, pagePrefetch = getProductPagePrefetch(id)) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PUBLIC_PRODUCT_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ resource: 'products', id: String(id) });
    const prefetched = await pagePrefetch?.response;
    const response = prefetched ? prefetched.clone() : await fetch(`${PUBLIC_CATALOG_ENDPOINT}?${params.toString()}`, {
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
    await catalogVisibilityReady;
    const product = mapProduct(payload.item.id, payload.item.data);
    if (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product)) return null;
    writeCached(`product:${id}`, product);
    return product;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchRelatedProducts(product, pagePrefetch = getProductPagePrefetch(product?.id)) {
  if (!product?.category) return [];
  return runSingleFlight('products:catalog:related-fetch', async () => {
    try {
      const cached = readCached(ALL_CACHE_KEY, ALL_CACHE_TTL);
      if (Array.isArray(cached) && cached.length) return cached;
      const prefetched = await pagePrefetch?.catalog;
      const items = prefetched || await fetchPublicCatalogResource('products');
      const products = normalizeList(items.map(item => mapProduct(item.id, item.data)));
      if (products.length) writeCached(ALL_CACHE_KEY, products.map(compactProduct));
      return products.map(compactProduct);
    } catch {
      return [];
    }
  });
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

async function waitForProductAppCheck() {
  const deps = await getRealtimeDependencies();
  if (!deps) return false;
  const appCheckReady = deps.appCheckReady;
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
  // Conservar el transporte tomado al iniciar: una CPU lenta no inicia otra
  // descarga si el plazo para nuevas tomas vence mientras procesa el producto.
  const pagePrefetch = getProductPagePrefetch(normalizedId);
  let realtimeConfirmed = false;
  let relatedRequestVersion = 0;
  let relatedPendingCategory = '';

  function scheduleRelated(product) {
    if (!product || (publicProductCategory === product.category && (publicProductRelated.length || relatedPendingCategory === product.category))) return;
    publicProductCategory = product.category;
    const relatedVersion = ++relatedRequestVersion;
    relatedPendingCategory = product.category;
    void fetchRelatedProducts(product, pagePrefetch).then(related => {
      if (!isCurrentProductRequest(normalizedId, requestVersion) || relatedVersion !== relatedRequestVersion) return;
      if (publicProductCategory !== product.category || !publicProductCurrent) return;
      publicProductRelated = related;
      publish([publicProductCurrent, ...related.filter(item => item.id !== normalizedId)], 'product-related-catalog');
    }).catch(() => {}).finally(() => {
      if (relatedVersion === relatedRequestVersion) relatedPendingCategory = '';
    });
  }

  const cachedProduct = readCached(`product:${normalizedId}`, PRODUCT_CACHE_TTL);
  if (cachedProduct) void Promise.resolve(catalogVisibilityReady).then(() => {
    if (!isCurrentProductRequest(normalizedId, requestVersion) || realtimeConfirmed) return;
    publicProductCurrent = cachedProduct;
    publish([cachedProduct], 'cache');
    scheduleRelated(cachedProduct);
  });

  // La ficha no debe esperar a App Check ni descargar los ~1000 productos del
  // catálogo para resolver uno solo. La API pública canónica consulta el mismo
  // documento por ID y queda en paralelo mientras App Check prepara realtime.
  // Si responde primero, el producto se pinta de inmediato; si App Check está
  // disponible, el listener SDK toma luego el control y mantiene precio/stock vivo.
  const edgeResultPromise = runSingleFlight(
    `product:edge:${normalizedId}`,
    () => fetchSingleProductFromEdge(normalizedId, pagePrefetch)
  ).then(product => {
    if (!isCurrentProductRequest(normalizedId, requestVersion) || realtimeConfirmed) return { ok: true, product, published: null };
    if (product) {
      publicProductCurrent = product;
      const published = publish([product, ...publicProductRelated.filter(item => item.id !== product.id)], 'edge-product');
      scheduleRelated(product);
      return { ok: true, product, published };
    }
    publicProductCurrent = null;
    publicProductRelated = [];
    relatedRequestVersion += 1;
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
        realtimeConfirmed = true;
        recordFirestoreRead('products:single-realtime', 1);
        if (!snapshot.exists()) {
          publicProductCurrent = null;
          publicProductRelated = [];
          publicProductCategory = '';
          relatedRequestVersion += 1;
          settle(publish([], 'realtime-product-missing'));
          return;
        }

        const product = mapProduct(snapshot.id, snapshot.data());
        if (product.active === false || !product.name ||
            (window.TintinCatalogPolicy?.isCatalogVisible && !window.TintinCatalogPolicy.isCatalogVisible(product))) {
          publicProductCurrent = null;
          publicProductRelated = [];
          publicProductCategory = '';
          relatedRequestVersion += 1;
          settle(publish([], 'realtime-product-unavailable'));
          return;
        }

        if (publicProductCategory !== product.category) {
          publicProductRelated = [];
          relatedRequestVersion += 1;
        }
        publicProductCurrent = product;
        writeCached(`product:${normalizedId}`, product);
        const current = publish(
          [product, ...publicProductRelated.filter(item => item.id !== product.id)],
          'realtime-product'
        );
        settle(current);

        scheduleRelated(product);
      },
      async error => {
        if (!isCurrentProductRequest(normalizedId, requestVersion)) {
          settle([]);
          return;
        }
        publicProductUnsubscribe = null;
        publicProductReady = null;
        if (realtimeConfirmed) {
          settle(publish(publicProductCurrent ? [publicProductCurrent, ...publicProductRelated] : [], 'realtime-product-retained'));
          return;
        }
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
  // El shell y la ficha pueden pedir esta misma carga durante el arranque.
  // Compartirla evita que una CPU lenta repita las dos lecturas públicas.
  return runSingleFlight(`product:page:${id}`, () => startProductRealtime(id));
}

export async function ensureProductsForSearch() {
  return loadAllProducts();
}

export async function ensureProductsForCurrentPage(options = {}) {
  const path = location.pathname.toLowerCase();
  if (options.collectionsChanged === true && document.getElementById('search-input')?.value?.trim()) {
    return loadAllProducts(options);
  }
  if (/(^|\/)product(?:\.html)?$/.test(path)) {
    const id = options.id || new URLSearchParams(location.search).get('id');
    // Preserve the live stock subscription and selections of a still-visible
    // detail when another collection changes membership.
    if (options.collectionsChanged === true && publicProductCurrent &&
        String(publicProductCurrent.id) === String(id) &&
        window.TintinCatalogPolicy?.isCatalogVisible(publicProductCurrent)) {
      return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    }
    return loadProductPage(options);
  }
  if (path.endsWith('/') || /(^|\/)index(?:\.html)?$/.test(path)) return loadHomeProducts(options);
  if (/(^|\/)(?:catalogo|collections)(?:\.html)?$/.test(path)) {
    return loadAllProducts(options);
  }
  if (options.collectionsChanged === true && window.PRODUCTS?.length) return loadAllProducts(options);
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
  readProduct: id => runSingleFlight(`product:cart:${String(id)}`, () => fetchSingleProductFromEdge(String(id))),
  loadAll: loadAllProducts,
  loadHome: loadHomeProducts,
  loadProductPage,
  startRealtime: startPublicProductsRealtime,
  ensureSearch: ensureProductsForSearch,
  ensureCurrentPage: ensureProductsForCurrentPage,
  getReadBudget: () => window.TintinReadBudget || null
};

// La revisión confirmada invalida el TTL de la vista actual sin recargar.
// La ficha conserva su suscripción de stock y sus selecciones en curso.
window.addEventListener('tintin:site-content-updated', () => {
  if (/(^|\/)product(?:\.html)?$/.test(location.pathname.toLowerCase())) return;
  ensureProductsForCurrentPage({ force: true }).catch(() => {});
});

attachSearchDemand();
ensureProductsForCurrentPage().catch(error => {
  window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
});
