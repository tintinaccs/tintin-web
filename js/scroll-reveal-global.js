(function () {
  'use strict';

  if (window.TintinGlobalScrollRevealBooted) return;
  window.TintinGlobalScrollRevealBooted = true;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const fixedExclusions = '#tt-loader,#tt-intro,#tt-welcome-tutorial,#tt-privacy-consent,.tt-header,.tt-tabbar,.tt-mobile-tabs,.tt-mobile-menu,.tt-cart-drawer,.tt-search-panel,.tt-collections-sheet,.tt-account-panel,.adm-overlay,.modal,.adm-modal';
  const revealSelectors = [
    'main>section', '.section', '.section-sm', '.tt-section', '.tt-page-hero', '.tt-hero', '.tt-trust-bar', '.tt-editorial', '.tt-products-section', '.tt-reviews-section', '.tt-footer',
    '.tt-card', '.tt-product-card', '.tt-coll-card', '.tt-category-card', '.tt-review-card', '.tt-trust-item', '.tt-info-block', '.tt-dropdown-card', '.tt-sheet-item',
    '.perfil-card', '.perfil-section', '.ck-panel', '.ck-step', '.ck-summary-card', '.login-box', '.login-brand', '.tt-404-wrap',
    '.adm-section.active>.adm-card', '.adm-section.active .adm-card', '.adm-section.active .adm-table-wrap', '.adm-section.active .tt-welcome-admin-card', '.adm-section.active .adm-analytics-card',
    'h1', 'h2', 'h3', '.tt-section-title', '.tt-section-sub', '.tt-section-desc', '.tt-hero-title', '.tt-hero-subtitle', '.tt-page-hero-title',
    'footer .tt-footer-col', '.tt-faq-item', '.tt-about-img', '.tt-about-content', '.tt-about-text', '.tt-contact-grid', '.tt-page-hero-sub',
    '.tt-editorial-item', '.tt-editorial-card', '.ck-panel-head', '.tt-checkout-suggested-grid', '.tt-about-section', '.tt-look-card', '.tt-coll-page-card', '.tt-look-item', '.tt-featured-item'
  ].join(',');
  const hoverSelectors = '.tt-card,.tt-product-card,.tt-coll-card,.tt-review-card,.perfil-card,.ck-panel,.adm-card,.tt-trust-item,.tt-btn,.ck-btn,.adm-btn,.login-google';
  const pendingRoots = new Set();
  let observer = null;
  let scheduled = false;

  function injectStyles() {
    if (document.getElementById('tt-global-reveal-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-global-reveal-style';
    style.textContent = `
      html.tt-reveal-ready .tt-auto-reveal{opacity:0;transform:translate3d(0,18px,0) scale(.992);transition:opacity .52s ease,transform .56s cubic-bezier(.16,1,.3,1);transition-delay:var(--tt-r-delay,0ms);will-change:opacity,transform;backface-visibility:hidden}
      html.tt-reveal-ready .tt-auto-reveal.tt-visible{opacity:1!important;transform:translate3d(0,0,0) scale(1)!important}
      .tt-auto-reveal.tt-reveal-settled{will-change:auto}
      .tt-reveal-left{transform:translate3d(-18px,10px,0) scale(.992)!important}
      .tt-reveal-right{transform:translate3d(18px,10px,0) scale(.992)!important}
      .tt-reveal-scale{transform:translate3d(0,10px,0) scale(.97)!important}
      .tt-reveal-soft{transform:translate3d(0,12px,0)!important}
      .tt-reveal-text{letter-spacing:.018em;transform:translate3d(0,12px,0)!important}
      .tt-reveal-text.tt-visible{letter-spacing:inherit}
      .tt-reveal-img{transform:translate3d(0,16px,0) scale(1.012)!important}
      .tt-reveal-img.tt-visible{transform:translate3d(0,0,0) scale(1)!important}
      .tt-premium-hover{transition:transform .24s cubic-bezier(.16,1,.3,1),box-shadow .24s ease,border-color .24s ease,background .24s ease}
      .tt-premium-pressed{transform:scale(.988)!important}
      @media(hover:hover){.tt-premium-hover:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(173,63,103,.13)}}
      @media(max-width:767px){html.tt-reveal-ready .tt-auto-reveal{transform:translate3d(0,12px,0) scale(.996);transition-duration:.42s}.tt-reveal-left,.tt-reveal-right{transform:translate3d(0,12px,0) scale(.996)!important}}
      @media(prefers-reduced-motion:reduce){html.tt-reveal-ready .tt-auto-reveal,.tt-auto-reveal{opacity:1!important;transform:none!important;transition:none!important;letter-spacing:inherit!important}.tt-premium-hover,.tt-premium-hover:hover{transition:none!important;transform:none!important}}
    `;
    document.head.appendChild(style);
  }

  function canReveal(element) {
    if (!element?.isConnected || element.classList.contains('tt-visible') || element.classList.contains('tt-auto-reveal')) return false;
    if (element.closest(fixedExclusions)) return false;
    if (element.closest('[hidden],.tt-no-reveal,.no-reveal,[data-no-reveal="true"]')) return false;
    if (element.getClientRects().length === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= 6 && rect.height >= 6;
  }

  function variantFor(element, index) {
    if (element.matches('h1,h2,h3,.tt-section-title,.tt-hero-title,.tt-page-hero-title')) return 'tt-reveal-text';
    if (element.matches('img,picture,.tt-editorial-img,.tt-watch-feature-img,.tt-card-img,.tt-coll-card-img,.login-brand')) return 'tt-reveal-img';
    if (element.matches('.tt-card,.tt-product-card,.tt-coll-card,.tt-review-card,.perfil-card,.ck-panel,.adm-card,.adm-analytics-card')) return index % 2 ? 'tt-reveal-left' : 'tt-reveal-right';
    if (element.matches('.ck-step')) return 'tt-reveal-scale';
    return 'tt-reveal-soft';
  }

  function revealNow(element) {
    if (element.classList.contains('tt-visible')) return;
    element.classList.add('tt-visible');
    observer?.unobserve(element);
    const settle = () => element.classList.add('tt-reveal-settled');
    element.addEventListener('transitionend', settle, { once: true });
    window.setTimeout(settle, 900);
  }

  function observe(elements) {
    if (!elements.length) return;
    if (!('IntersectionObserver' in window)) {
      elements.forEach(revealNow);
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) revealNow(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    }
    elements.forEach(element => observer.observe(element));
  }

  function elementsInside(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const elements = [];
    if (root.matches?.(revealSelectors)) elements.push(root);
    elements.push(...root.querySelectorAll(revealSelectors));
    return [...new Set(elements)];
  }

  function scanRoots() {
    scheduled = false;
    const roots = pendingRoots.size ? [...pendingRoots] : [document];
    pendingRoots.clear();
    const candidates = roots.flatMap(elementsInside).filter(canReveal);
    candidates.forEach((element, index) => {
      if (element.matches(hoverSelectors)) element.classList.add('tt-premium-hover');
      element.classList.add('tt-auto-reveal', variantFor(element, index));
      element.style.setProperty('--tt-r-delay', `${Math.min(index % 5, 4) * 28}ms`);
    });
    observe(candidates);
  }

  function scheduleScan(root = document) {
    pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;
    if ('requestIdleCallback' in window) window.requestIdleCallback(scanRoots, { timeout: 140 });
    else window.setTimeout(scanRoots, 36);
  }

  function bindPressFeedback() {
    document.addEventListener('pointerdown', event => {
      const target = event.target.closest('.tt-btn,.ck-btn,.adm-btn,.login-google,button,a');
      if (target && !target.closest(fixedExclusions)) target.classList.add('tt-premium-pressed');
    }, { passive: true });
    const clear = () => document.querySelectorAll('.tt-premium-pressed').forEach(element => element.classList.remove('tt-premium-pressed'));
    document.addEventListener('pointerup', clear, { passive: true });
    document.addEventListener('pointercancel', clear, { passive: true });
  }

  function boot() {
    injectStyles();
    bindPressFeedback();
    if (reducedMotion) {
      document.documentElement.classList.add('tt-reveal-reduced-motion');
      return;
    }
    document.documentElement.classList.add('tt-reveal-ready');
    scheduleScan(document);
    document.addEventListener('tintin:products-loaded', event => scheduleScan(event.target || document), { passive: true });
    document.addEventListener('tintin:page-ready', () => scheduleScan(document), { passive: true });
    document.addEventListener('click', event => {
      if (event.target.closest('.adm-nav-item,.adm-mobile-tab,.tt-tabbar-btn,.tt-nav a,.tt-mobile-menu a')) {
        window.setTimeout(() => scheduleScan(document.querySelector('.adm-section.active') || document), 80);
      }
    }, true);
    if ('MutationObserver' in window) {
      const mutationObserver = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scheduleScan(node);
        }));
      });
      mutationObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
    window.setTimeout(() => scheduleScan(document), 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
