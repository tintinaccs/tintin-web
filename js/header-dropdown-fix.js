(function () {
  'use strict';
  if (window.TintinHeaderDropdownFixBooted) return;
  window.TintinHeaderDropdownFixBooted = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function injectStyles() {
    if (document.getElementById('tt-header-dropdown-fix-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-header-dropdown-fix-style';
    st.textContent = `
      html.tt-click-dropdown-ready .tt-dropdown,
      html.tt-click-dropdown-ready .tt-mobile-cats {
        background: #FFFFFF !important;
        background-color: #FFFFFF !important;
        background-image: none !important;
      }
      html.tt-click-dropdown-ready .tt-nav-dropdown:not(.open) > .tt-dropdown {
        opacity: 0 !important;
        visibility: hidden !important;
        transform: translateX(-50%) translateY(-8px) !important;
        pointer-events: none !important;
      }
      html.tt-click-dropdown-ready .tt-nav-dropdown.open > .tt-dropdown {
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateX(-50%) translateY(0) !important;
        pointer-events: auto !important;
      }
      html.tt-click-dropdown-ready .tt-nav-dropdown.open > button {
        color: var(--pink-dark);
        background: var(--pink-pale);
        border-color: rgba(212,120,154,0.28);
      }
      html.tt-click-dropdown-ready .tt-mobile-cats {
        display: block !important;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transform: translateY(12px);
        transform-origin: bottom center;
        transition: max-height .32s cubic-bezier(.25,.46,.45,.94), opacity .22s ease, transform .32s cubic-bezier(.25,.46,.45,.94), padding .22s ease;
        padding-top: 0;
        padding-bottom: 0;
      }
      html.tt-click-dropdown-ready .tt-mobile-cats.open {
        max-height: min(72vh, 720px);
        opacity: 1;
        transform: translateY(0);
        padding-top: 12px;
        padding-bottom: 8px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      @media (min-width: 769px) and (max-width: 1120px) {
        html.tt-click-dropdown-ready .tt-dropdown {
          width: min(92vw, 680px);
          max-height: min(70vh, 620px);
          overflow-y: auto;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        html.tt-click-dropdown-ready .tt-dropdown,
        html.tt-click-dropdown-ready .tt-mobile-cats {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(st);
    document.documentElement.classList.add('tt-click-dropdown-ready');
  }

  ready(function () {
    injectStyles();

    const desktopWrap = document.getElementById('tienda-dropdown');
    const desktopBtn = document.getElementById('btn-tienda');
    const desktopPanel = desktopWrap?.querySelector('.tt-dropdown');
    const accountWrap = document.getElementById('account-dropdown');
    const searchPanel = document.getElementById('search-panel');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOpenBtn = document.getElementById('btn-menu');
    const mobileBtn = document.getElementById('btn-mobile-tienda');
    const mobileCats = document.getElementById('mobile-cats');
    let desktopOpenScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    let desktopOpenedAt = 0;

    if (desktopPanel && !desktopPanel.id) desktopPanel.id = 'tt-tienda-dropdown-panel';
    if (desktopBtn && desktopPanel) {
      desktopBtn.setAttribute('aria-haspopup', 'true');
      desktopBtn.setAttribute('aria-controls', desktopPanel.id);
      desktopBtn.setAttribute('aria-expanded', 'false');
    }
    if (mobileBtn && mobileCats) {
      mobileBtn.setAttribute('aria-controls', mobileCats.id || 'mobile-cats');
      mobileBtn.setAttribute('aria-expanded', mobileCats.classList.contains('open') ? 'true' : 'false');
    }

    function isDesktopTablet() {
      return window.matchMedia ? window.matchMedia('(min-width: 769px)').matches : window.innerWidth >= 769;
    }

    function currentScrollY() {
      return window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0;
    }

    function isDesktopOpen() {
      return !!desktopWrap?.classList.contains('open');
    }

    function setDesktop(open, opts = {}) {
      if (!desktopWrap || !desktopBtn) return;
      desktopWrap.classList.toggle('open', !!open);
      desktopBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        desktopOpenScrollY = currentScrollY();
        desktopOpenedAt = Date.now();
      }
      if (!open && opts.blur !== false) desktopBtn.blur();
      if (open) {
        accountWrap?.classList.remove('open');
        accountWrap?.querySelector('button')?.setAttribute('aria-expanded', 'false');
        searchPanel?.classList.remove('open');
      }
    }

    function setMobile(open) {
      if (!mobileBtn || !mobileCats) return;
      mobileCats.classList.toggle('open', !!open);
      mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeAll(opts = {}) {
      setDesktop(false, opts);
      setMobile(false);
    }

    if (desktopBtn && desktopWrap) {
      desktopBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        setDesktop(!isDesktopOpen(), { blur: false });
      }, true);

      desktopWrap.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => setDesktop(false));
      });
    }

    if (mobileBtn && mobileCats) {
      mobileBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        setMobile(!mobileCats.classList.contains('open'));
      }, true);

      mobileCats.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => setMobile(false));
      });
    }

    document.addEventListener('click', function (e) {
      const target = e.target;
      const clickedDesktop = desktopWrap?.contains(target);
      const clickedMobile = mobileCats?.contains(target) || mobileBtn?.contains(target);
      if (!clickedDesktop) setDesktop(false);
      if (!clickedMobile) setMobile(false);
    }, true);

    window.addEventListener('scroll', function () {
      if (!isDesktopTablet() || !isDesktopOpen()) return;
      if (Date.now() - desktopOpenedAt < 120) return;
      if (Math.abs(currentScrollY() - desktopOpenScrollY) > 3) setDesktop(false, { blur: false });
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const wasOpen = isDesktopOpen();
      closeAll();
      if (desktopBtn && wasOpen) desktopBtn.focus();
    });

    ['pagehide', 'beforeunload', 'hashchange', 'popstate'].forEach(evt => {
      window.addEventListener(evt, () => closeAll({ blur: false }));
    });

    ['btn-search', 'btn-cart', 'btn-cuenta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => setDesktop(false), true);
    });

    if (menuOpenBtn) {
      menuOpenBtn.addEventListener('click', () => {
        setDesktop(false);
        setMobile(false);
      }, true);
    }

    if (mobileMenu) {
      const obs = new MutationObserver(() => {
        if (!mobileMenu.classList.contains('open')) setMobile(false);
      });
      obs.observe(mobileMenu, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
