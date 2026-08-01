/* =============================================================
   TINTIN — Navegacion publica compartida
   =============================================================
   Este componente es la unica fuente del header desktop/tablet y de la
   barra mobile. Todas las pantallas publicas montan exactamente este mismo
   HTML antes de DOMContentLoaded, por lo que script.js y los modulos de
   cuenta, carrito y colecciones siempre encuentran los mismos controles.
   ============================================================= */
(function () {
  'use strict';

  if (window.TintinPublicShellBooted) return;
  window.TintinPublicShellBooted = true;

  const VERSION = 'tintin-20260801-unified-surfaces-12';
  const SCRIPT_URL = document.currentScript?.src || new URL('js/public-shell.js', location.href).href;
  const ICONS = {
    bolsos: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
    collares: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="9"/>',
    earcuff: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/>',
    gafas: '<circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2m-8.5-4l-1-4h18l-1 4"/>',
    brazaletes: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    aros: '<circle cx="12" cy="8" r="5"/><path d="M9.5 12.5l-3 7a2 2 0 004 0v-1"/><path d="M14.5 12.5l3 7a2 2 0 01-4 0v-1"/>',
    armcuff: '<path d="M5 12h14M5 8h14M5 16h14"/><rect x="2" y="6" width="20" height="12" rx="3"/>',
    anillos: '<circle cx="12" cy="14" r="6"/><path d="M12 8V2m-4 2l4 4 4-4"/>',
    joyeros: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 10h18M8 8V5a4 4 0 018 0v3"/>',
    pulseras: '<path d="M4 8h16M4 16h16"/><path d="M8 4v16M16 4v16" opacity=".4"/><rect x="2" y="6" width="20" height="12" rx="3"/>',
    relojes: '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 01-1.99 1.82H9.83a2 2 0 01-1.99-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 011.99 1.82l.35 3.83"/>',
    tobilleras: '<path d="M12 22a10 10 0 01-7.07-3A9.94 9.94 0 012 12"/><path d="M22 12a9.94 9.94 0 01-2.93 7M12 2a10 10 0 0110 10"/><circle cx="12" cy="12" r="4"/>',
  };

  const CATEGORIES = [
    ['bolsos', 'Bags', 'linear-gradient(135deg,#e8c5d0,#c48a9e)'],
    ['collares', 'Collares', 'linear-gradient(135deg,#d4b0c0,#a87090)'],
    ['earcuff', 'Earcuff', 'linear-gradient(135deg,#f0d0e0,#d090a8)'],
    ['gafas', 'Gafas', 'linear-gradient(135deg,#e8c0d0,#c88098)'],
    ['brazaletes', 'Brazaletes', 'linear-gradient(135deg,#c8a0b8,#a06080)'],
    ['aros', 'Aros', 'linear-gradient(135deg,#f0c8d8,#d48098)'],
    ['armcuff', 'Armcuff', 'linear-gradient(135deg,#c8b0cc,#9870a0)'],
    ['anillos', 'Anillos', 'linear-gradient(135deg,#dca8c0,#b06880)'],
    ['joyeros', 'Joyeros', 'linear-gradient(135deg,#c0a0b8,#906080)'],
    ['pulseras', 'Pulseras', 'linear-gradient(135deg,#e0b8c8,#c07888)'],
    ['relojes', 'Relojes', 'linear-gradient(135deg,#b8849a,#8b5070)'],
    ['tobilleras', 'Tobilleras', 'linear-gradient(135deg,#d8a8c0,#b06888)'],
  ];

  const svg = (name, size = 20, stroke = 'currentColor') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const desktopCategories = CATEGORIES.map(([slug, label]) => `
    <a href="catalogo.html?cat=${slug}" class="tt-dropdown-card">
      <div class="tt-dropdown-icon">${svg(slug)}</div>
      <div class="tt-dropdown-label">${label.toUpperCase()}</div>
    </a>`).join('');

  const tabletCategories = CATEGORIES.map(([slug, label, background]) => `
    <a href="catalogo.html?cat=${slug}" class="tt-tablet-cat-card">
      <div class="tt-tablet-cat-img" style="background:${background}">${svg(slug, 28, '#FFFFFF')}</div>
      <span>${label}</span>
    </a>`).join('');

  const sheetCategories = CATEGORIES.map(([slug, label]) =>
    `<a href="catalogo.html?cat=${slug}" class="tt-sheet-item"><span></span><span>${label.toUpperCase()}</span></a>`
  ).join('');

  function topShell() {
    return `
      <header class="tt-header tt-header-desktop" id="tt-header-desktop-tablet" data-header-device="desktop">
        <div class="tt-header-inner">
          <a href="index.html" class="tt-logo-link" aria-label="Tintin, ir al inicio">
            <img loading="eager" decoding="async" fetchpriority="high" src="assets-tintin/images/general/logo.png?v=${VERSION}" alt="TINTIN Accesorios &amp; Relojes" class="tt-logo-img">
          </a>

          <nav class="tt-nav tt-nav-desktop" id="tt-nav-desktop-tablet" aria-label="Navegación principal">
            <span class="tt-desktop-active-pill" aria-hidden="true"></span>
            <a href="index.html" data-shell-route="home" data-desktop-nav-item>INICIO</a>
            <div class="tt-nav-dropdown" id="tienda-dropdown">
              <button type="button" id="btn-tienda" data-shell-route="shop" data-desktop-nav-item aria-expanded="false" aria-haspopup="true" aria-controls="tt-tienda-dropdown-panel">TIENDA <span aria-hidden="true">▾</span></button>
              <div class="tt-dropdown" id="tt-tienda-dropdown-panel" role="dialog" aria-label="Categorías de la tienda" aria-hidden="true">
                <div class="tt-dropdown-grid" data-collections-nav="desktop">${desktopCategories}</div>
              </div>
            </div>
            <a href="about.html" data-shell-route="about" data-desktop-nav-item>NOSOTROS</a>
            <a href="contact.html" data-shell-route="contact" data-desktop-nav-item>CONTACTO</a>
          </nav>

          <div class="tt-header-actions">
            <button type="button" id="btn-search" data-nav-action="search" title="Buscar" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button type="button" id="btn-cuenta" data-nav-action="account" data-auth-account-button title="Mi cuenta" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            <button type="button" id="btn-cart" data-nav-action="cart" title="Carrito" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" style="position:relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              <span class="tt-cart-badge hidden" id="cart-badge">0</span>
            </button>
          </div>
        </div>
      </header>

      <header class="tt-header-tablet" id="tt-header-tablet" data-header-device="tablet">
        <div class="tt-tablet-header-inner">
          <button type="button" class="tt-tablet-menu-toggle" id="btn-menu-tablet" aria-label="Abrir menú" aria-expanded="false" aria-controls="tt-tablet-menu">
            <span class="tt-tablet-menu-lines" aria-hidden="true"><span></span><span></span><span></span></span>
          </button>
          <a href="index.html" class="tt-tablet-logo-link" aria-label="Tintin, ir al inicio">
            <img loading="eager" decoding="async" fetchpriority="high" src="assets-tintin/images/general/logo.png?v=${VERSION}" alt="TINTIN Accesorios &amp; Relojes" class="tt-tablet-logo-img">
          </a>
          <div class="tt-tablet-actions">
            <button type="button" id="btn-search-tablet" data-nav-action="search" title="Buscar" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
            <button type="button" id="btn-cuenta-tablet" data-nav-action="account" data-auth-account-button data-shell-route="account" title="Mi cuenta" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></button>
            <button type="button" id="btn-cart-tablet" data-nav-action="cart" title="Carrito" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg><span class="tt-cart-badge hidden" id="cart-badge-tablet">0</span></button>
          </div>
        </div>
      </header>

      <div class="tt-search-panel" id="search-panel" role="dialog" aria-modal="true" aria-label="Buscar productos" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" class="tt-search-input" id="search-input" aria-label="Buscar productos" autocomplete="off" placeholder="¿Qué estás buscando? Ej: reloj, collar, bag…">
        <button type="button" class="tt-search-close" id="btn-search-close" aria-label="Cerrar búsqueda">✕</button>
        <div class="tt-search-results" id="search-results" style="display:none"></div>
      </div>

      <div class="tt-tablet-menu" id="tt-tablet-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación tablet" aria-hidden="true">
        <div class="tt-tablet-menu-header">
          <a href="index.html" class="tt-tablet-menu-logo" aria-label="Tintin, ir al inicio">
            <img loading="eager" decoding="async" src="assets-tintin/images/general/logo.png?v=${VERSION}" alt="TINTIN" class="tt-tablet-menu-logo-img">
          </a>
          <button type="button" class="tt-tablet-menu-close" id="btn-tablet-close" aria-label="Cerrar menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav class="tt-tablet-nav" aria-label="Navegación tablet">
          <a href="index.html" data-shell-route="home">INICIO</a>
          <button type="button" id="btn-tablet-tienda" class="tt-tablet-tienda-btn" aria-expanded="false" aria-controls="tablet-cats">
            <span>TIENDA</span>
            <svg class="tt-tablet-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="tt-tablet-cats" id="tablet-cats">
            <button type="button" class="tt-tablet-cats-back" id="btn-tablet-cats-back">← Volver</button>
            <h2 class="tt-tablet-cats-title">Colecciones</h2>
            <div class="tt-tablet-cats-grid" data-collections-nav="tablet">${tabletCategories}</div>
            <a href="catalogo.html" class="tt-tablet-ver-todo">Ver todo el catálogo →</a>
          </div>
          <a href="about.html" data-shell-route="about">NOSOTROS</a>
          <a href="contact.html" data-shell-route="contact">CONTACTO</a>
        </nav>
        <button type="button" class="tt-tablet-account-entry" data-nav-action="account" aria-expanded="false" aria-controls="account-drawer">Mi cuenta</button>
      </div>`;
  }

  function bottomShell() {
    return `
      <nav class="tt-tabbar" id="tt-tabbar" aria-label="Navegación mobile">
        <span class="tt-mobile-nav-halo" aria-hidden="true"></span>
        <span class="tt-mobile-nav-indicator" aria-hidden="true"></span>
        <a href="index.html" class="tt-tabbar-btn" aria-label="Inicio" data-shell-tab="home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Inicio</span>
        </a>
        <button type="button" class="tt-tabbar-btn" id="tabbar-tienda" aria-label="Tienda" aria-expanded="false" aria-controls="collections-sheet" data-shell-tab="shop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7h12M10 20a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2z"/></svg><span>Tienda</span>
        </button>
        <button type="button" class="tt-tabbar-btn" id="tabbar-search" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel" data-shell-tab="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Buscar</span>
        </button>
        <button type="button" class="tt-tabbar-btn" id="tabbar-cart" style="position:relative" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" data-shell-tab="cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg><span class="tt-cart-badge hidden" id="cart-badge-mobile">0</span><span>Carrito</span>
        </button>
        <button type="button" id="tabbar-cuenta" class="tt-tabbar-btn" aria-label="Cuenta" aria-expanded="false" aria-controls="account-drawer" data-nav-action="account" data-shell-tab="account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Cuenta</span>
        </button>
      </nav>

      <div class="tt-cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrito de compras" aria-hidden="true">
        <div class="tt-cart-header"><h2 class="tt-cart-title">MI CARRITO</h2><button type="button" class="tt-cart-close" id="btn-cart-close" aria-label="Cerrar carrito">✕</button></div>
        <div class="tt-cart-body" id="cart-body"></div>
        <div class="tt-cart-footer" id="cart-footer" style="display:none"><div class="tt-cart-total-row"><span class="tt-cart-total-label">TOTAL</span><span class="tt-cart-total-value" id="cart-total">Gs. 0</span></div></div>
      </div>

      <div class="tt-account-drawer" id="account-drawer" role="dialog" aria-modal="true" aria-label="Mi cuenta" aria-hidden="true">
        <div class="tt-account-drawer-header"><h2>MI CUENTA</h2><button type="button" id="btn-account-close" aria-label="Cerrar cuenta">✕</button></div>
        <div class="tt-account-panel" id="account-panel"></div>
      </div>

      <div class="tt-collections-sheet" id="collections-sheet" role="dialog" aria-modal="true" aria-label="Colecciones" aria-hidden="true">
        <div class="tt-sheet-handle"></div>
        <div class="tt-sheet-header"><span>Colecciones</span><button type="button" id="btn-close-sheet" aria-label="Cerrar colecciones">✕</button></div>
        <div class="tt-sheet-grid" data-collections-nav="sheet">${sheetCategories}</div>
        <div class="tt-sheet-footer"><a href="catalogo.html" class="tt-btn" style="display:block;text-align:center;text-decoration:none">Ver todas las colecciones</a></div>
      </div>
      <div class="tt-shared-backdrop" id="tt-shared-backdrop" hidden></div>
      <div class="tt-shared-morph" id="tt-shared-morph" aria-hidden="true"></div>`;
  }

  function removeLegacyShell() {
    [
      'tt-header-desktop-tablet', 'tt-header-tablet', 'search-panel', 'mobile-menu', 'tt-tablet-menu', 'tt-tabbar',
      'cart-overlay', 'cart-drawer', 'account-drawer', 'collections-sheet', 'sheet-backdrop',
      'tt-shared-backdrop', 'tt-shared-morph',
    ].forEach(id => document.getElementById(id)?.remove());
  }

  function currentPage() {
    const parts = (location.pathname || '').split('/').filter(Boolean);
    const file = (parts.pop() || 'index').toLowerCase().replace(/\.html$/, '');
    if (!file || file === 'index' || file === 'tintin-web') return 'home';
    if (file === 'about' || file === 'nosotros') return 'about';
    if (file === 'contact') return 'contact';
    if (['catalogo', 'collections', 'product'].includes(file)) return 'shop';
    if (file === 'checkout') return 'cart';
    if (['login', 'perfil'].includes(file)) return 'account';
    return 'other';
  }

  function applyActiveState() {
    const page = currentPage();
    document.querySelectorAll('[data-shell-route]').forEach(link => {
      const active = link.dataset.shellRoute === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const tienda = document.getElementById('btn-tienda');
    tienda?.classList.toggle('active', page === 'shop');
    if (page === 'shop') tienda?.setAttribute('aria-current', 'page');
    else tienda?.removeAttribute('aria-current');

    const mobileTienda = document.getElementById('btn-tablet-tienda');
    mobileTienda?.classList.toggle('active', page === 'shop');
    if (page === 'shop') mobileTienda?.setAttribute('aria-current', 'page');
    else mobileTienda?.removeAttribute('aria-current');

    [['btn-cart', 'cart'], ['btn-cart-tablet', 'cart'], ['btn-cuenta', 'account'], ['btn-cuenta-tablet', 'account']].forEach(([id, route]) => {
      const control = document.getElementById(id);
      const active = page === route;
      control?.classList.toggle('active', active);
      if (active) control?.setAttribute('aria-current', 'page');
      else control?.removeAttribute('aria-current');
    });

    document.querySelectorAll('[data-shell-tab]').forEach(control => {
      const active = control.dataset.shellTab === page;
      control.classList.toggle('active', active);
      if (active) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    });
  }

  function versioned(file) {
    const url = new URL(file, SCRIPT_URL);
    url.searchParams.set('v', VERSION);
    return url.href;
  }

  function ensureNavigationAssets() {
    [
      ['tt-navigation-desktop-css', '../css/navigation-desktop.css'],
      ['tt-navigation-tablet-css', '../css/navigation-tablet.css'],
      ['tt-navigation-mobile-css', '../css/navigation-mobile.css'],
      ['tt-navigation-shared-css', '../css/navigation-shared.css'],
      ['tt-surface-controller-css', '../css/surface-controller.css'],
    ].forEach(([id, file]) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = versioned(file);
      document.head.appendChild(link);
    });
  }

  function loadHomeMaintenance() {
    if (currentPage() !== 'home') return Promise.resolve();
    if (!document.getElementById('tt-home-maintenance-css')) {
      const link = document.createElement('link');
      link.id = 'tt-home-maintenance-css';
      link.rel = 'stylesheet';
      link.href = versioned('../css/home-maintenance.css');
      document.head.appendChild(link);
    }
    return import(versioned('./home-maintenance.js'));
  }

  let productsRuntimePromise = null;

  function loadProductsRuntime({ forSearch = false } = {}) {
    if (!productsRuntimePromise) {
      productsRuntimePromise = import(versioned('./products-store.js')).catch(error => {
        productsRuntimePromise = null;
        throw error;
      });
    }
    return productsRuntimePromise.then(module => {
      if (!forSearch) return module;
      const ensureSearch = window.TintinProductsStore?.ensureSearch || module.ensureProductsForSearch;
      return typeof ensureSearch === 'function' ? ensureSearch() : module;
    });
  }

  function attachProductsDemand() {
    const load = () => loadProductsRuntime({ forSearch: true }).then(() => {
      const input = document.getElementById('search-input');
      if (input?.value) input.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(error => {
      console.warn('[PublicShell] No se pudo cargar el catálogo para la búsqueda.', error);
    });

    document.querySelectorAll('[data-nav-action="search"],#tabbar-search').forEach(control => {
      if (!control) return;
      control.addEventListener('pointerenter', load, { once: true, passive: true });
      control.addEventListener('focus', load, { once: true });
      control.addEventListener('click', load, { once: true });
    });
  }

  function scheduleNonCritical(task) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 1400 });
      return;
    }
    window.setTimeout(task, 450);
  }

  function reportRuntimeFailures(results) {
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) {
      console.warn('[PublicShell] Algunos datos en vivo no pudieron cargarse.', failed.map(item => item.reason));
    }
  }

  function loadSharedRuntime() {
    const page = currentPage();
    const critical = [
      import(versioned('./auth-nav.js')),
      import(versioned('./cart-sync.js')),
    ];

    // Inicio y tienda necesitan productos para su primera vista. En páginas
    // informativas el catálogo se importa únicamente cuando se abre Buscar.
    if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
    if (page === 'cart') critical.push(import(versioned('./checkout-reliability.js')));

    Promise.allSettled(critical).then(reportRuntimeFailures);
    attachProductsDemand();

    Promise.allSettled([
      import(versioned('./navigation-desktop.js')),
      import(versioned('./navigation-tablet.js')),
      import(versioned('./navigation-mobile.js')),
      import(versioned('./navigation-shared.js')),
    ]).then(reportRuntimeFailures);

    // Las colecciones del menú ya tienen contenido estático utilizable; su
    // sincronización y el mantenimiento visual del inicio pueden esperar al
    // primer periodo ocioso sin retrasar LCP/INP.
    scheduleNonCritical(() => {
      Promise.allSettled([
        import(versioned('./nav-collections.js')),
        loadHomeMaintenance(),
      ]).then(reportRuntimeFailures);
    });
  }

  function enhanceMobileFooter() {
    const mobile = window.matchMedia('(max-width: 480px)');
    document.querySelectorAll('.tt-footer-col').forEach((column, index) => {
      const title = column.querySelector('.tt-footer-col-title');
      const list = column.querySelector(':scope > ul');
      if (!title || !list || title.querySelector('.tt-footer-accordion-toggle')) return;

      const panelId = list.id || `tt-footer-panel-${index + 1}`;
      list.id = panelId;
      const label = title.textContent.trim();
      title.textContent = '';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tt-footer-accordion-toggle';
      toggle.setAttribute('aria-controls', panelId);
      toggle.innerHTML = `<span>${label}</span><span class="tt-footer-accordion-icon" aria-hidden="true">+</span>`;
      title.appendChild(toggle);

      const sync = () => {
        if (!mobile.matches) {
          list.hidden = false;
          toggle.setAttribute('aria-expanded', 'true');
          return;
        }
        const open = toggle.getAttribute('aria-expanded') === 'true';
        list.hidden = !open;
      };
      toggle.setAttribute('aria-expanded', mobile.matches ? 'false' : 'true');
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        sync();
      });
      mobile.addEventListener?.('change', sync);
      sync();
    });
  }

  function mount() {
    if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return;
    ensureNavigationAssets();
    removeLegacyShell();
    document.body.insertAdjacentHTML('afterbegin', topShell());
    document.body.insertAdjacentHTML('beforeend', bottomShell());
    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');
    applyActiveState();
    enhanceMobileFooter();
    loadSharedRuntime();
    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
