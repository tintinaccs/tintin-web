/* =============================================================
   TINTIN — Header hide on scroll (desktop/tablet)
   =============================================================
   En desktop y tablet el header se esconde suavemente al bajar y vuelve al
   subir. Mobile queda intacto porque tiene header/menú separado.
   ============================================================= */

(function () {
  'use strict';
  if (window.TintinHeaderScrollHideBooted) return;
  window.TintinHeaderScrollHideBooted = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function injectStyles() {
    if (document.getElementById('tt-header-scroll-hide-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-header-scroll-hide-style';
    st.textContent = `
      @media (min-width: 768px) {
        #tt-header {
          transition: transform .34s cubic-bezier(.22,.61,.36,1), box-shadow .28s ease, background .28s ease, border-color .28s ease !important;
          will-change: transform;
        }
        #tt-header.tt-header-hidden-desktop {
          transform: translateY(calc(-100% - 12px)) !important;
          pointer-events: none;
        }
      }
      @media (max-width: 767px) {
        #tt-header.tt-header-hidden-desktop {
          transform: none !important;
          pointer-events: auto !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #tt-header {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(st);
  }

  ready(function () {
    const header = document.getElementById('tt-header');
    if (!header) return;
    injectStyles();

    let lastY = window.scrollY || document.documentElement.scrollTop || 0;
    let ticking = false;
    const MIN_HIDE_Y = 96;
    const DELTA = 6;

    function isDesktopTablet() {
      return window.matchMedia ? window.matchMedia('(min-width: 768px)').matches : window.innerWidth >= 768;
    }

    function shouldKeepVisible() {
      return !!(
        document.getElementById('tienda-dropdown')?.classList.contains('open') ||
        document.getElementById('account-dropdown')?.classList.contains('open') ||
        document.getElementById('search-panel')?.classList.contains('open') ||
        document.body?.classList.contains('tt-cart-open') ||
        document.documentElement.classList.contains('tt-scroll-locked') ||
        document.documentElement.classList.contains('tt-welcome-scroll-locked')
      );
    }

    function showHeader() {
      header.classList.remove('tt-header-hidden-desktop');
    }

    function hideHeader() {
      header.classList.add('tt-header-hidden-desktop');
    }

    function onScroll() {
      ticking = false;
      const y = window.scrollY || document.documentElement.scrollTop || 0;

      if (!isDesktopTablet()) {
        showHeader();
        lastY = y;
        return;
      }

      if (shouldKeepVisible() || y <= MIN_HIDE_Y) {
        showHeader();
        lastY = y;
        return;
      }

      const diff = y - lastY;
      if (Math.abs(diff) < DELTA) return;

      if (diff > 0) hideHeader();
      else showHeader();

      lastY = y;
    }

    function requestTick() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    }

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', () => {
      if (!isDesktopTablet()) showHeader();
      lastY = window.scrollY || document.documentElement.scrollTop || 0;
    }, { passive: true });

    ['focusin', 'mousemove', 'keydown'].forEach(evt => {
      document.addEventListener(evt, () => {
        if (!isDesktopTablet()) return;
        if ((window.scrollY || 0) <= MIN_HIDE_Y || shouldKeepVisible()) showHeader();
      }, { passive: true });
    });
  });
})();
