import '../../cargador-mantenimiento-pagina.js?v=tintin-20260730-stock-visibility-1';
import { db, appCheckReady } from '../firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
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
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from '../firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
import { listPublicCollectionRest } from '../firebase/respaldo-rest-firestore.js?v=tintin-20260726-browser-fallback-1';
import { sortCatalogProducts, timestampToMillis } from '../../pages/catalog/politica-exhibicion-catalogo.js?v=tintin-20260731-unified-store-1';

const ALL_CACHE_KEY = 'products:cards';
const HOME_CACHE_KEY = 'products:home-featured';
const HOME_CACHE_TTL = 60 * 1000;
const HOME_PRODUCT_LIMIT = 24;
// El catálogo operativo se reconcilia con Sheets/Firestore cada minuto.
// Un TTL de un minuto mantiene la navegación rápida sin ocultar cambios
// de precio, stock o estado durante diez minutos en otros dispositivos.
const ALL_CACHE_TTL = 60 * 1000;
const PRODUCT_CACHE_TTL = 15 * 60 * 1000;
let publicProductsUnsubscribe = null;
let publicProductsReady = null;
let publicProductUnsubscribe = null;
let publicProductReady = null;
let publicProductId = '';
let publicProductRelated = [];
let publicProductCategory = '';
let publicProductCurrent = null;

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

async function fetchAllProductsFromRest() {
  const documents = await listPublicCollectionRest('products', 1000);
  recordFirestoreRead('products:all-rest-fallback', documents.length);
  return documents.map(item => mapProduct(item.id, item.data));
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

async function fetchHomeProductsFromRest() {
  const documents = await listPublicCollectionRest('products', HOME_PRODUCT_LIMIT);
  recordFirestoreRead('products:home-rest-fallback', documents.length);
  return documents.map(item => mapProduct(item.id, item.data));
}

async function fetchHomeProducts() {
  let products;
  if (!await appCheckReady) {
    products = await fetchHomeProductsFromRest();
  } else {
    try {
      products = await Promise.race([
        fetchHomeProductsFromSdk(),
        new Promise((_, reject) => window.setTimeout(
          () => reject(new Error('La portada tardó demasiado en obtener productos')),
          2800
        ))
      ]);
    } catch (error) {
      console.warn('[products-store] La portada usa el respaldo acotado:', error);
      products = await fetchHomeProductsFromRest();
    }
  }

  products = normalizeList(products);
  const cards = products.map(compactProduct);
  if (cards.length) writeCached(HOME_CACHE_KEY, cards);
  return publish(products, 'home-limited');
}

async function fetchAllProducts() {
  let products;
  if (!await appCheckReady) {
    products = normalizeList(await fetchAllProductsFromRest());
    writeCached(ALL_CACHE_KEY, products.map(compactProduct));
    return publish(products, 'rest-fallback');
  }
  try {
    products = await Promise.race([
      fetchAllProductsFromSdk(),
      new Promise((_, reject) => window.setTimeout(
        () => reject(new Error('Firestore SDK tardó demasiado')),
        3500
      ))
    ]);
  } catch (sdkError) {
    console.warn('[products-store] Se usa el respaldo compatible del catálogo:', sdkError);
    products = await fetchAllProductsFromRest();
  }
  products = normalizeList(products);
  const cards = products.map(compactProduct);
  // Un catálogo vacío no es una caché útil. Una lectura transitoria bloqueada
  // por App Check, red o un despliegue nunca debe dejar al navegador mostrando
  // "0 productos" durante todo el TTL después de que Firestore se recupere.
  // El resultado vacío sí se publica para esta carga, pero la próxima visita
  // vuelve a consultar el servidor en lugar de confiar en ese vacío.
  if (cards.length) writeCached(ALL_CACHE_KEY, cards);
  return publish(products, 'server-or-rest-fallback');
}

async function startPublicProductsRealtime() {
  if (publicProductsReady) return publicProductsReady;
  if (!await appCheckReady) return loadAllProducts({ force: true });

  const cached = readCached(ALL_CACHE_KEY, ALL_CACHE_TTL);
  if (Array.isArray(cached) && cached.length) publish(cached, 'cache');

  publicProductsReady = new Promise((resolve, reject) => {
    publicProductsUnsubscribe = onSnapshot(
      query(collection(db, 'products'), limit(1000)),
      snapshot => {
        const products = normalizeList(snapshot.docs.map(item => mapProduct(item.id, item.data())));
        const cards = products.map(compactProduct);
        recordFirestoreRead('products:realtime', snapshot.size);
        if (cards.length) writeCached(ALL_CACHE_KEY, cards);
        resolve(publish(products, 'realtime'));
      },
      async error => {
        publicProductsUnsubscribe = null;
        publicProductsReady = null;
        window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
        try {
          resolve(await loadAllProducts({ force: true }));
        } catch (fallbackError) {
          reject(fallbackError);
        }
      }
    );
  });

  window.addEventListener('pagehide', () => {
    publicProductsUnsubscribe?.();
    publicProductsUnsubscribe = null;
    publicProductsReady = null;
  }, { once: true });

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
  publicProductUnsubscribe?.();
  publicProductUnsubscribe = null;
  publicProductReady = null;
  publicProductId = '';
  publicProductRelated = [];
  publicProductCategory = '';
  publicProductCurrent = null;
}

async function startProductRealtime(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return Promise.resolve(publish([], 'missing-id'));
  if (publicProductReady && publicProductId === normalizedId) return publicProductReady;

  if (!await appCheckReady) {
    const products = await loadAllProducts();
    const product = products.find(item => String(item.id) === normalizedId);
    return publish(product ? [product] : [], product ? 'rest-fallback' : 'rest-fallback-missing');
  }

  stopProductRealtime();
  publicProductId = normalizedId;

  const cachedProduct = readCached(`product:${normalizedId}`, PRODUCT_CACHE_TTL);
  if (cachedProduct) publish([cachedProduct], 'cache');

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
          if (publicProductId !== normalizedId) return;
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
        publicProductUnsubscribe = null;
        publicProductReady = null;
        window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
        try {
          const product = await runSingleFlight(
            `product:${normalizedId}`,
            () => fetchSingleProduct(normalizedId)
          );
          if (product && product.active !== false && product.name) {
            settle(publish([product], 'server-fallback'));
          } else if (cachedProduct) {
            settle(publish([cachedProduct], 'stale-cache'));
          } else {
            settle(publish([], 'server-fallback-missing'));
          }
        } catch (fallbackError) {
          if (cachedProduct) settle(publish([cachedProduct], 'stale-cache'));
          else reject(fallbackError);
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
    return startPublicProductsRealtime();
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
