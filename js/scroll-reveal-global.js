/* =============================================================
   TINTIN — Scroll reveal global seguro
   =============================================================
   Refuerzo visual para páginas públicas/perfil: las secciones aparecen al
   entrar en pantalla y quedan visibles. No toca admin ni login para evitar
   romper paneles, permisos o formularios sensibles.
   ============================================================= */

(function () {
  'use strict';
  if (window.TintinGlobalScrollRevealBooted) return;
  window.TintinGlobalScrollRevealBooted = true;

  const path = (location.pathname || '').toLowerCase();
  const SKIP = path.includes('/admin') || path.endsWith('/login.html');
  if (SKIP) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('tt-reveal-reduced-motion');
    return;
  }

  function injectStyles() {
    if (document.getElementById('tt-global-reveal-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-global-reveal-style';
    st.textContent = `
      .tt-auto-reveal {
        opacity: 0;
        transform: translateY(22px);
        transition: opacity .58s ease, transform .58s cubic-bezier(.22,.61,.36,1);
        will-change: opacity, transform;
      }
      .tt-auto-reveal.tt-visible,
      .tt-reveal.tt-visible {
        opacity: 1 !important;
        transform: none !important;
      }
      @media (max-width: 640px) {
        .tt-auto-reveal { transform: translateY(16px); transition-duration: .46s; }
      }
      @media (prefers-reduced-motion: reduce) {
        .tt-auto-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      }
    `;
    document.head.appendChild(st);
  }

  function shouldReveal(el) {
    if (!el || el.closest('#tt-loader, #tt-intro, #tt-welcome-tutorial, .tt-cart-drawer, .tt-mobile-menu, .tt-tabbar, .tt-header')) return false;
    if (el.classList.contains('tt-visible') || el.classList.contains('tt-no-reveal')) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  }

  function collectRevealTargets() {
    const selectors = [
      'main > section',
      '.tt-section',
      '.tt-card',
      '.tt-product-card',
      '.tt-category-card',
      '.perfil-card',
      '.checkout-card',
      'footer'
    ];
    const nodes = [...document.querySelectorAll(selectors.join(','))]
      .filter(shouldReveal);
    nodes.forEach((el, i) => {
      if (!el.classList.contains('tt-reveal')) el.classList.add('tt-auto-reveal');
      el.style.transitionDelay = `${Math.min(i % 6, 5) * 35}ms`;
    });
    return nodes;
  }

  function boot() {
    injectStyles();
    const targets = collectRevealTargets();
    if (!targets.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('tt-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -48px 0px', threshold: 0.08 });

    targets.forEach(el => observer.observe(el));

    document.addEventListener('tintin:products-loaded', () => {
      collectRevealTargets().forEach(el => {
        if (!el.classList.contains('tt-visible')) observer.observe(el);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
