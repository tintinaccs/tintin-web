/**
 * TINTIN — Products Store
 * Loads products from Firestore and feeds the homepage/product grids.
 * This is a module script; import it after script.js.
 */
import { db } from './firebase.js';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CACHE_KEY = 'tt_products_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

/** Map Firestore doc to the shape script.js expects */
function mapProduct(id, d) {
  return {
    id,
    name:     d.name     || '',
    cat:      d.category || '',
    category: d.category || '',
    price:    d.price    || 0,
    badge:    d.badge    || (d.oferta ? 'Oferta' : null),
    desc:     d.description || d.desc || '',
    imageUrl: d.imageUrl || d.image || '',
    stock:    d.stock ?? null,
    active:   d.active !== false,
    variants: d.variants || null,
  };
}

export async function loadProducts() {
  const cached = fromCache();
  if (cached) return cached;
  try {
    const snap = await getDocs(
      query(collection(db, 'products'), where('active', '==', true), orderBy('name'))
    );
    const products = snap.docs.map(d => mapProduct(d.id, d.data()));
    toCache(products);
    return products;
  } catch (e) {
    console.warn('[products-store] Firestore load failed:', e);
    return [];
  }
}

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
