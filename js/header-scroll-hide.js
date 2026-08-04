/* =============================================================
   TINTIN — Header hide on scroll (desktop/tablet)
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinHeaderScrollHideBooted) return;
  window.TintinHeaderScrollHideBooted = true;

  let initialized = false;

  function injectStyles() {
    if (document.getElementById('tt-header-scroll-hide-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-header-scroll-hide-style';
    st.textContent = `
      @media (min-width: 768px) {
        #tt-header-desktop-tablet,
        #tt-header-tablet {
          transition: transform .34s cubic-bezier(.22,.61,.36,1), box-shadow .28s ease, background .28s ease, border-color .28s ease !important;
          will-change: transform;
        }
        #tt-header-desktop-tablet.tt-header-hidden-desktop,
        #tt-header-tablet.tt-header-hidden-desktop {
          transform: translateY(calc(-100% - 12px)) !important;
          pointer-events: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #tt-header-desktop-tablet,
        #tt-header-tablet { transition: none !important; }
      }
    `;
    document.head.appendChild(st);
  }

  function initialize() {
    if (initialized) return true;
    const headers = [
      document.getElementById('tt-header-desktop-tablet'),
      document.getElementById('tt-header-tablet')
    ].filter(Boolean);
    if (!headers.length) return false;

    initialized = true;
    injectStyles();

    let lastY = window.scrollY || document.documentElement.scrollTop || 0;
    let ticking = false;
    let resizeFrame = 0;
    const MIN_HIDE_Y = 96;
    const DELTA = 6;

    function isDesktopTablet() {
      return window.matchMedia ? window.matchMedia('(min-width: 768px)').matches : window.innerWidth >= 768;
    }

    function focusIsInsideHeader() {
      const active = document.activeElement;
      return !!active && headers.some(header => header.contains(active));
    }

    function shouldKeepVisible() {
      return !!(
        (window.TintinSurfaceController?.surface || 'none') !== 'none' ||
        document.getElementById('tienda-dropdown')?.classList.contains('open') ||
        document.getElementById('search-panel')?.classList.contains('open') ||
        document.body?.classList.contains('tt-cart-open') ||
        document.documentElement.classList.contains('tt-surface-locked') ||
        document.documentElement.classList.contains('tt-scroll-locked') ||
        document.documentElement.classList.contains('tt-welcome-scroll-locked') ||
        focusIsInsideHeader()
      );
    }

    function showHeader() {
      headers.forEach(header => header.classList.remove('tt-header-hidden-desktop'));
    }

    function markCompact(y) {
      const compact = y > 24;
      headers.forEach(header => header.classList.toggle('tt-header-compact', compact));
    }

    function hideHeader() {
      headers.forEach(header => header.classList.add('tt-header-hidden-desktop'));
    }

    function updateFromScroll() {
      ticking = false;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      markCompact(y);

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
      requestAnimationFrame(updateFromScroll);
    }

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!isDesktopTablet()) showHeader();
        lastY = window.scrollY || document.documentElement.scrollTop || 0;
      });
    }, { passive: true });

    document.addEventListener('focusin', showHeader);
    window.addEventListener('tintin:surface-change', event => {
      if (event.detail?.surface !== 'none') showHeader();
    });
    requestAnimationFrame(updateFromScroll);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
  document.addEventListener('tintin:public-shell-ready', initialize);
})();
