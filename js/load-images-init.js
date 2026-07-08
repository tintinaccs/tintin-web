// header-dropdown-fix.js, store-gate.js y scroll-reveal-global.js NO se
// importan acá a propósito: js/page-loader.js ya los carga (con versión) en
// TODAS las páginas, incluida esta — importarlos de nuevo acá, sin versión,
// resolvía a una URL distinta y el navegador los ejecutaba dos veces (dos
// listeners de Firestore duplicados en store-gate, dos observers de scroll
// duplicados, etc.). splash-scroll-lock.js tampoco: era solo para el viejo
// splash bespoke de index.html (#tt-intro), que ahora usa el mismo
// js/page-loader.js que el resto del sitio (con su propio scroll-lock ya
// incluido).
import { loadImages } from './images.js';

loadImages().then(() => {
  if (typeof window.renderProductsGrid === 'function' && Array.isArray(window.PRODUCTS)) {
    ['colls-products-grid', 'related-grid'].forEach(id => {
      if (document.getElementById(id)) window.renderProductsGrid(id, window.PRODUCTS);
    });
    if (document.getElementById('products-grid')) {
      window.renderProductsGrid('products-grid', window.PRODUCTS.slice(0, 6));
    }
  }
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }
  if (typeof window.renderCart === 'function') window.renderCart();
  if (typeof window.initProductPage === 'function' && document.getElementById('product-detail')) {
    window.initProductPage();
  }
}).catch(e => console.warn('[load-images-init] failed:', e));
