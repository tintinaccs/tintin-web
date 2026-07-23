import './page-maintenance-loader.js?v=tintin-20260720-read-budget-1';
import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { sanitizeImageUrl, uniqueSafeImageUrls } from './image-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { cleanText, cleanMultilineText, sanitizeVariantData } from './security-utils.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  readCached,
  readStaleCached,
  recordFirestoreRead,
  runSingleFlight,
  writeCached
} from './firestore-read-cache.js?v=tintin-20260720-read-budget-1';

const ALL_CACHE_KEY = 'products:cards';
const ALL_CACHE_TTL = 10 * 60 * 1000;
const PRODUCT_CACHE_TTL = 15 * 60 * 1000;

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
    variants: sanitizeVariantData(d.variants || null),
    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999
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
    imageUrl: product.imageUrl,
    stock: product.stock,
    active: product.active,
    oferta: product.oferta,
    destacado: product.destacado,
    collectionOrder: product.collectionOrder
  };
}

function normalizeList(list) {
  return list
    .filter(Boolean)
    .filter(p => p.active !== false && Boolean(p.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
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
    if (document.getElementById('colls-products-grid')) window.renderProductsGrid('colls-products-grid', featuredProducts);
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

async function fetchAllProducts() {
  const snapshot = await getDocs(query(collection(db, 'products'), limit(1000)));
  recordFirestoreRead('products:all', snapshot.size);
  const products = normalizeList(snapshot.docs.map(item => mapProduct(item.id, item.data())));
  const cards = products.map(compactProduct);
  writeCached(ALL_CACHE_KEY, cards);
  return publish(products, 'server');
}

export async function loadAllProducts(options = {}) {
  const force = options.force === true;
  if (!force) {
    const cached = readCached(ALL_CACHE_KEY, ALL_CACHE_TTL);
    if (Array.isArray(cached)) return publish(cached, 'cache');
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
  const snapshot = await getDoc(doc(db, 'products', id));
  recordFirestoreRead('products:single', 1);
  if (!snapshot.exists()) return null;
  const product = mapProduct(snapshot.id, snapshot.data());
  writeCached(`product:${id}`, product);
  return product;
}

async function fetchRelatedProducts(product) {
  if (!product?.category) return [];
  try {
    const snapshot = await getDocs(query(
      collection(db, 'products'),
      where('category', '==', product.category),
      limit(12)
    ));
    recordFirestoreRead('products:related', snapshot.size);
    return snapshot.docs.map(item => compactProduct(mapProduct(item.id, item.data())));
  } catch {
    return [];
  }
}

export async function loadProductPage(options = {}) {
  const id = String(options.id || new URLSearchParams(location.search).get('id') || '').trim();
  if (!id) {
    publish([], 'missing-id');
    return [];
  }
  const cachedProduct = readCached(`product:${id}`, PRODUCT_CACHE_TTL);
  let product = cachedProduct || null;
  if (product) publish([product], 'cache');
  if (!product || options.force === true) {
    product = await runSingleFlight(`product:${id}`, () => fetchSingleProduct(id));
  }
  if (!product || product.active === false || !product.name) {
    publish([], 'server');
    return [];
  }
  publish([product], cachedProduct ? 'refresh' : 'server');
  const related = await runSingleFlight(`products:related:${product.category}`, () => fetchRelatedProducts(product));
  return publish([product, ...related.filter(item => item.id !== product.id)], 'server-related');
}

export async function ensureProductsForSearch() {
  return loadAllProducts();
}

export async function ensureProductsForCurrentPage() {
  const path = location.pathname.toLowerCase();
  if (/(^|\/)product(?:\.html)?$/.test(path)) return loadProductPage();
  if (/(^|\/)(?:index|catalogo|collections)(?:\.html)?$/.test(path) || path.endsWith('/')) return loadAllProducts();
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
  loadProductPage,
  ensureSearch: ensureProductsForSearch,
  ensureCurrentPage: ensureProductsForCurrentPage,
  getReadBudget: () => window.TintinReadBudget || null
};

attachSearchDemand();
ensureProductsForCurrentPage().catch(error => {
  window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
});
