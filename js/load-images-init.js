function injectTintinPalette() {
  if (document.getElementById('tt-tintin-palette-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-tintin-palette-css';
  link.rel = 'stylesheet';
  link.href = new URL('../css/tintin-palette.css', import.meta.url).href;
  document.head.appendChild(link);
}

injectTintinPalette();

import './splash-scroll-lock.js';
import './header-dropdown-fix.js';
import './store-gate.js';
import './scroll-reveal-global.js';
import './welcome-tutorial-runtime.js';
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
