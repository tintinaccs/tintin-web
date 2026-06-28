/**
 * TINTIN — Products Store
 * Loads products from Firestore and feeds the homepage/product grids.
 * This is a module script; import it after script.js.
 */
import { db } from './firebase.js';
import {
  collection, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CACHE_KEY = 'tt_products_cache';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes — short so image changes reflect quickly

function fromCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function toCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function bustOldCache() {
  // Force fresh Firestore load on next visit if we detect stale data
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

function normalizeImageUrl(d) {
  return (
    d.imageUrl      ||
    d.image         ||
    d.img           ||
    d.photo         ||
    d.imageSrc      ||
    d.image_src     ||
    d['Image Src']  ||
    d['Variant Image'] ||
    ''
  );
}

/** Map Firestore doc to the shape script.js expects */
function mapProduct(id, d) {
  return {
    id,
    name:     d.name  || d.title || d.Title || '',
    cat:      d.category || d.cat || d.Type || d['Product Category'] || '',
    category: d.category || d.cat || d.Type || d['Product Category'] || '',
    price:    Number(d.price || d.Price || d['Variant Price'] || 0),
    badge:    d.badge || (d.oferta ? 'Oferta' : null),
    desc:     d.description || d.desc || d['Body (HTML)'] || '',
    imageUrl: normalizeImageUrl(d),
    stock:    d.stock ?? d['Variant Inventory Qty'] ?? null,
    active:   d.active !== false,
    variants: d.variants || null,
  };
}

export async function loadProducts() {
  const cached = fromCache();
  if (cached) return cached;
  try {
    // No composite index needed — fetch all, filter & sort in JS
    const snap = await getDocs(collection(db, 'products'));
    const all = snap.docs.map(d => mapProduct(d.id, d.data()));
    const products = all
      .filter(p => p.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    toCache(products);
    return products;
  } catch (e) {
    console.error('[products-store] Firestore load failed:', e);
    return [];
  }
}

// Clear any stale cache from failed previous loads
try { sessionStorage.removeItem('tt_products_cache'); } catch {}

/** Render homepage and look combinator with Firestore products */
loadProducts().then(products => {
  if (!products.length) return;

  // Expose on window so script.js helpers can find them by id
  window.PRODUCTS = products;

  // Re-render homepage product grids
  if (typeof window.renderProductsGrid === 'function') {
    ['products-grid', 'colls-products-grid', 'related-grid'].forEach(id => {
      if (document.getElementById(id)) window.renderProductsGrid(id, products);
    });
  }

  // Re-render look combinator
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }

  // Re-render cart (images may have changed)
  if (typeof window.renderCart === 'function') window.renderCart();

  // Product page: re-init with Firestore product if on product page
  if (document.getElementById('product-detail') && typeof window.initProductPage === 'function') {
    window.initProductPage();
  }
});
