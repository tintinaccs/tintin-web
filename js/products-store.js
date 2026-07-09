/**
 * TINTIN — Products Store
 * Loads products from Firestore and feeds the homepage/product grids.
 * This is a module script; import it after script.js.
 */
import { db } from './firebase.js';
import {
  collection, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Real-time store: no session cache needed anymore — onSnapshot pushes
// creates/edits/deletes from Super Admin to every open tab automatically.
try { sessionStorage.removeItem('tt_products_cache'); } catch {}

function normalizeImageUrl(d) {
  const img =
    d.imageUrl ||
    d.image ||
    d.img ||
    d.photo ||
    d.imageSrc ||
    d.image_src ||
    d['Image Src'] ||
    d['Variant Image'] ||
    d['Image'] ||
    d['Imagen'] ||
    d['Foto'] ||
    '';

  return String(img || '').trim();
}

/** Map Firestore doc to the shape script.js expects */
function mapProduct(id, d) {
  return {
    id,
    name:     d.name || d.title || d.Title || d['Title'] || d.handle || d.Handle || '',
    cat:      d.category || d.cat || d.Type || d.type || d['Product Category'] || d['Category'] || d['Tags'] || '',
    category: d.category || d.cat || d.Type || d.type || d['Product Category'] || d['Category'] || d['Tags'] || '',
    price:    Number(String(d.price || d.Price || d['Variant Price'] || 0).replace(/\./g, '').replace(',', '.')),
    badge:    d.badge || (d.oferta ? 'Oferta' : null),
    desc:     d.description || d.desc || d['Body (HTML)'] || '',
    imageUrl: normalizeImageUrl(d),
    stock:    d.stock ?? d['Variant Inventory Qty'] ?? null,
    active:   d.active !== false,
    variants: d.variants || null,
  };
}

function handleSnapshot(snap) {
  const all = snap.docs.map(d => mapProduct(d.id, d.data()));

  const products = all
    .filter(p => p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Expose on window so script.js helpers can find them by id
  window.PRODUCTS = products;

  window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
    detail: { products }
  }));

  // Re-render homepage product grids
  if (typeof window.renderProductsGrid === 'function') {
    ['colls-products-grid', 'related-grid'].forEach(id => {
      if (document.getElementById(id)) window.renderProductsGrid(id, products);
    });
    if (document.getElementById('products-grid')) {
      window.renderProductsGrid('products-grid', products.slice(0, 6));
    }
  }

  // Re-render look combinator
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }

  // Re-render cart (product may have been deleted/deactivated or price/image changed)
  if (typeof window.renderCart === 'function') window.renderCart();

  // Product page: refresh with live data (price/stock/etc. may have changed
  // on ANY product, since this fires on every snapshot of the whole
  // collection). _renderProductDetail is idempotent — it never re-attaches
  // event listeners on repeat calls — so it's safe to call on every update.
  // Do NOT reset/re-run initProductPage() here: that re-triggers the one-time
  // id lookup and used to re-register everything, which is what caused a
  // single real click to add multiple units to the cart.
  if (document.getElementById('product-detail')) {
    const id = new URLSearchParams(window.location.search).get('id');
    const p = products.find(pr => String(pr.id) === String(id));
    if (p && typeof window._renderProductDetail === 'function') {
      window._renderProductDetail(p);
    } else if (typeof window.initProductPage === 'function') {
      window.initProductPage(); // first load: page not inited yet, or product not found yet
    }
  }
}

// Live subscription — any create/edit/delete/activate/deactivate from Super Admin
// pushes to every open tab immediately, no reload needed.
onSnapshot(collection(db, 'products'), handleSnapshot, e => {
  console.error('[products-store] Firestore realtime listener failed:', e);
  // Let pages waiting on window.PRODUCTS (catalogo/collections skeletons) know
  // the listener failed, instead of spinning forever with no feedback.
  window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error: e } }));
});
