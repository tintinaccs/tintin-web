/**
 * Loads product/site images from Firestore into localStorage (tt_images),
 * then re-renders any product grids on the page so real photos appear.
 *
 * Import this as a <script type="module"> AFTER script.js on any page
 * that shows product cards or the look combinator.
 */
import { loadImages } from './images.js';

loadImages().then(() => {
  // Re-render product grids now that tt_images is populated
  if (typeof window.renderProductsGrid === 'function' && Array.isArray(window.PRODUCTS)) {
    ['products-grid', 'colls-products-grid', 'related-grid'].forEach(id => {
      if (document.getElementById(id)) {
        window.renderProductsGrid(id, window.PRODUCTS);
      }
    });
  }
  // Re-render look combinator
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }
  // Re-render cart (cart items may have product images)
  if (typeof window.renderCart === 'function') {
    window.renderCart();
  }
  // Re-init product page gallery if on product page
  if (typeof window.initProductPage === 'function' && document.getElementById('product-detail')) {
    window.initProductPage();
  }
}).catch(e => console.warn('[load-images-init] failed:', e));
