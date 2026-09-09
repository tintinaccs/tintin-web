// compatibilidad-menus-desplegables.js, control-tienda.js y revelado-desplazamiento-global.js NO se
// importan acá a propósito: js/cargador-pagina.js ya los carga (con versión) en
// TODAS las páginas, incluida esta — importarlos de nuevo acá, sin versión,
// resolvía a una URL distinta y el navegador los ejecutaba dos veces (dos
// listeners de Firestore duplicados en store-gate, dos observers de scroll
// duplicados, etc.). splash-scroll-lock.js tampoco: era solo para el viejo
// splash bespoke de index.html (#tt-intro), que ahora usa el mismo
// js/cargador-pagina.js que el resto del sitio (con su propio scroll-lock ya
// incluido).
import { loadImages } from './imagenes.js?v=tintin-20260716-cloudinary-fix-3';

/**
 * Hero final Tintin — 2026-09-09
 *
 * Mantiene la fotografía conectada al sistema Imágenes/Super Panel, pero la
 * composición visual y el copy ya no dependen del hero editorial anterior.
 * El contenido se transforma en DOM real (SEO/accesibilidad/click) y el reveal
 * es one-shot: una vez visible no vuelve a ocultarse al salir del viewport.
 */
function mountFinalHero() {
  const hero = document.getElementById('hero');
  if (!hero || hero.dataset.ttFinalHeroMounted === 'true') return;
  hero.dataset.ttFinalHeroMounted = 'true';
  hero.classList.add('tt-hero-final');

  const title = hero.querySelector('.tt-hero-title');
  const subtitle = hero.querySelector('.tt-hero-subtitle');
  const cta = hero.querySelector('.tt-hero-cta');
  const about = hero.querySelector('.tt-hero-link');

  if (title) {
    title.setAttribute('aria-label', 'Bienvenida tintina');
    title.innerHTML = [
      '<span class="tt-hero-welcome">Bienvenida</span>',
      '<span class="tt-hero-tintina">tintina</span>',
    ].join('');
  }

  if (subtitle) subtitle.textContent = 'Joyitas únicas, como vos.';

  if (cta) {
    cta.setAttribute('href', '/catalogo');
    cta.setAttribute('aria-label', 'Comprar ahora');
    cta.innerHTML = 'COMPRAR AHORA <span class="tt-hero-cta-arrow" aria-hidden="true">→</span>';
  }

  if (about) {
    about.setAttribute('href', '/about');
    about.textContent = '¿Quiénes somos?';
    about.setAttribute('aria-label', 'Conocé quiénes somos');
  }

  // Elementos gráficos no interactivos del arte de referencia. Se crean como
  // DOM para que la fotografía siga siendo intercambiable desde Super Panel.
  const doodles = [
    ['obsessed', 'obsesionada ↘'],
    ['happy', 'un relojito y soy feliz'],
    ['heart-one', '♡'],
    ['heart-two', '♡'],
    ['heart-three', '♡'],
  ];

  doodles.forEach(([name, text]) => {
    if (hero.querySelector(`.tt-hero-doodle--${name}`)) return;
    const el = document.createElement('span');
    el.className = `tt-hero-doodle tt-hero-doodle--${name}`;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = text;
    hero.appendChild(el);
  });

  // Reveal irreversible. No se activa el estado oculto hasta comprobar que el
  // navegador dispone de IntersectionObserver, así un fallo de JS jamás deja
  // el hero invisible. Al revelarse se desconecta definitivamente el observer.
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    hero.classList.add('tt-hero-revealed');
    return;
  }

  hero.classList.add('tt-hero-reveal-ready');
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry?.isIntersecting) return;
    hero.classList.add('tt-hero-revealed');
    observer.disconnect();
  }, {
    root: null,
    threshold: 0.08,
    rootMargin: '0px 0px -2% 0px',
  });
  observer.observe(hero);

  // Red de seguridad: el hero está arriba del fold y nunca debe quedar oculto
  // por una implementación defectuosa del observer o una transición de página.
  window.setTimeout(() => {
    if (!hero.classList.contains('tt-hero-revealed')) {
      hero.classList.add('tt-hero-revealed');
      observer.disconnect();
    }
  }, 1800);
}

function bootHomeImages() {
  mountFinalHero();

  loadImages().then(() => {
    if (typeof window.renderProductsGrid === 'function' && Array.isArray(window.PRODUCTS)) {
      const featuredProducts = window.PRODUCTS.filter(product =>
        typeof window.isFeaturable === 'function'
          ? window.isFeaturable(product)
          : Boolean(product?.name) && !(product.stock != null && Number(product.stock) <= 0)
      );
      ['colls-products-grid'].forEach(id => {
        if (document.getElementById(id)) window.renderProductsGrid(id, featuredProducts);
      });
      if (document.getElementById('products-grid')) {
        window.renderProductsGrid('products-grid', featuredProducts.slice(0, 5));
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootHomeImages, { once: true });
} else {
  bootHomeImages();
}
