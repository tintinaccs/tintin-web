// compatibilidad-menus-desplegables.js, control-tienda.js y revelado-desplazamiento-global.js NO se
// importan acá a propósito: js/cargador-pagina.js ya los carga (con versión) en
// TODAS las páginas, incluida esta — importarlos de nuevo acá, sin versión,
// resolvía a una URL distinta y el navegador los ejecutaba dos veces (dos
// listeners de Firestore duplicados en store-gate, dos observers de scroll
// duplicados, etc.). splash-scroll-lock.js tampoco: era solo para el viejo
// splash bespoke de index.html (#tt-intro), que ahora usa el mismo
// js/cargador-pagina.js que el resto del sitio (con su propio scroll-lock ya
// incluido).
import { loadImages } from './imagenes.js?v=tintin-20261004-admin-connections-3-first-render-merge-20261010-1';

loadImages().then(() => {
  // Con las imágenes ya resueltas sólo se refrescan las tarjetas: tienda.js
  // conserva la selección visible (no se re-sortea) y es el único que pinta
  // productos y "Completá tu look".
  if (typeof window.renderRandomHomeProducts === 'function' && document.getElementById('products-grid')) {
    window.renderRandomHomeProducts();
  }
  if (typeof window.initLookCombinator === 'function' && document.getElementById('look-grid')) {
    window.initLookCombinator();
  }
  if (typeof window.renderCart === 'function') window.renderCart();
  if (typeof window.initProductPage === 'function' && document.getElementById('product-detail')) {
    window.initProductPage();
  }
}).catch(e => console.warn('[load-images-init] failed:', e));
