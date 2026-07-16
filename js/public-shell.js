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

  const VERSION = 'tintin-20260716-product-page-1';
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

  const mobileCategories = CATEGORIES.map(([slug, label, background]) => `
    <a href="catalogo.html?cat=${slug}" class="tt-mobile-cat-card">
      <div class="tt-mobile-cat-img" style="background:${background}">${svg(slug, 28, '#FFFFFF')}</div>
      <span>${label}</span>
    </a>`).join('');

  const sheetCategories = CATEGORIES.map(([slug, label]) =>
    `<a href="catalogo.html?cat=${slug}" class="tt-sheet-item"><span></span><span>${label.toUpperCase()}</span></a>`
  ).join('');

  function topShell() {
    return `
      <header class="tt-header tt-header-desktop-tablet" id="tt-header-desktop-tablet" data-header-device="desktop-tablet">
        <div class="tt-header-inner">
          <button type="button" class="tt-menu-toggle" id="btn-menu" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <a href="index.html" class="tt-logo-link" aria-label="Tintin, ir al inicio">
            <img loading="eager" decoding="async" fetchpriority="high" src="assets-tintin/images/general/logo.png?v=${VERSION}" alt="TINTIN Accesorios &amp; Relojes" class="tt-logo-img">
          </a>

          <nav class="tt-nav tt-nav-desktop-tablet" id="tt-nav-desktop-tablet" aria-label="Navegación principal">
            <a href="index.html" data-shell-route="home">INICIO</a>
            <div class="tt-nav-dropdown" id="tienda-dropdown">
              <button type="button" id="btn-tienda" aria-expanded="false" aria-haspopup="true" aria-controls="tt-tienda-dropdown-panel">TIENDA ▾</button>
              <div class="tt-dropdown" id="tt-tienda-dropdown-panel">
                <div class="tt-dropdown-grid" data-collections-nav="desktop">${desktopCategories}</div>
              </div>
            </div>
            <a href="about.html" data-shell-route="about">NOSOTROS</a>
            <a href="contact.html" data-shell-route="contact">CONTACTO</a>
          </nav>

          <div class="tt-header-actions">
            <button type="button" id="btn-search" title="Buscar" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <div class="tt-nav-dropdown" id="account-dropdown">
              <button type="button" id="btn-cuenta" title="Mi cuenta" aria-label="Mi cuenta" aria-expanded="false" aria-haspopup="true" aria-controls="account-panel">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </button>
              <div class="tt-account-panel" id="account-panel"></div>
            </div>
            <button type="button" id="btn-cart" title="Carrito" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" style="position:relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              <span class="tt-cart-badge hidden" id="cart-badge">0</span>
            </button>
          </div>
        </div>
      </header>

      <div class="tt-search-panel" id="search-panel" role="search" aria-label="Buscar productos" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" class="tt-search-input" id="search-input" aria-label="Buscar productos" autocomplete="off" placeholder="¿Qué estás buscando? Ej: reloj, collar, bag…">
        <button type="button" class="tt-search-close" id="btn-search-close" aria-label="Cerrar búsqueda">✕</button>
        <div class="tt-search-results" id="search-results" style="display:none"></div>
      </div>

      <div class="tt-mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación" aria-hidden="true">
        <div class="tt-mobile-menu-header">
          <a href="index.html" class="tt-logo-link" aria-label="Tintin, ir al inicio">
            <img loading="eager" decoding="async" src="assets-tintin/images/general/logo.png?v=${VERSION}" alt="TINTIN" class="tt-logo-img tt-logo-img--menu">
          </a>
          <button type="button" class="tt-mobile-close" id="btn-mobile-close" aria-label="Cerrar menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav class="tt-mobile-nav" aria-label="Navegación tablet">
          <a href="index.html" data-shell-route="home">INICIO</a>
          <button type="button" id="btn-mobile-tienda" class="tt-mobile-tienda-btn" aria-expanded="false" aria-controls="mobile-cats">
            <span>TIENDA</span>
            <svg class="tt-mobile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="tt-mobile-cats" id="mobile-cats">
            <div class="tt-mobile-cats-grid" data-collections-nav="mobile">${mobileCategories}</div>
            <a href="catalogo.html" class="tt-mobile-ver-todo">Ver todo el catálogo →</a>
          </div>
          <a href="about.html" data-shell-route="about">NOSOTROS</a>
          <a href="contact.html" data-shell-route="contact">CONTACTO</a>
        </nav>
        <div class="tt-mobile-user" id="tt-mobile-user">
          <a href="login.html" class="tt-mobile-user-login">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div><div class="tt-mobile-user-name">Iniciar sesión</div><div class="tt-mobile-user-sub">Ingresá con Google, ¡es gratis!</div></div>
          </a>
        </div>
      </div>`;
  }

  function bottomShell() {
    return `
      <nav class="tt-tabbar" id="tt-tabbar" aria-label="Navegación mobile">
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
        <a href="login.html" id="tabbar-cuenta" class="tt-tabbar-btn" aria-label="Cuenta" data-shell-tab="account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Cuenta</span>
        </a>
      </nav>

      <div class="tt-cart-overlay" id="cart-overlay"></div>
      <div class="tt-cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrito de compras" aria-hidden="true">
        <div class="tt-cart-header"><h2 class="tt-cart-title">MI CARRITO</h2><button type="button" class="tt-cart-close" id="btn-cart-close" aria-label="Cerrar carrito">✕</button></div>
        <div class="tt-cart-body" id="cart-body"></div>
        <div class="tt-cart-footer" id="cart-footer" style="display:none"><div class="tt-cart-total-row"><span class="tt-cart-total-label">TOTAL</span><span class="tt-cart-total-value" id="cart-total">Gs. 0</span></div></div>
      </div>

      <div class="tt-collections-sheet" id="collections-sheet" role="dialog" aria-modal="true" aria-label="Colecciones" aria-hidden="true">
        <div class="tt-sheet-handle"></div>
        <div class="tt-sheet-header"><span>Colecciones</span><button type="button" id="btn-close-sheet" aria-label="Cerrar colecciones">✕</button></div>
        <div class="tt-sheet-grid" data-collections-nav="sheet">${sheetCategories}</div>
        <div class="tt-sheet-footer"><a href="catalogo.html" class="tt-btn" style="display:block;text-align:center;text-decoration:none">Ver todas las colecciones</a></div>
      </div>
      <div class="tt-sheet-backdrop" id="sheet-backdrop"></div>`;
  }

  function removeLegacyShell() {
    [
      'tt-header-desktop-tablet', 'search-panel', 'mobile-menu', 'tt-tabbar',
      'cart-overlay', 'cart-drawer', 'collections-sheet', 'sheet-backdrop',
    ].forEach(id => document.getElementById(id)?.remove());
  }

  function currentPage() {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!file || file === 'index.html') return 'home';
    if (file === 'about.html') return 'about';
    if (file === 'contact.html') return 'contact';
    if (['catalogo.html', 'collections.html', 'product.html'].includes(file)) return 'shop';
    if (file === 'checkout.html') return 'cart';
    if (['login.html', 'perfil.html'].includes(file)) return 'account';
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

    document.querySelectorAll('[data-shell-tab]').forEach(control => {
      const active = control.dataset.shellTab === page;
      control.classList.toggle('active', active);
      if (active && control.tagName === 'A') control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    });
  }

  function loadSharedRuntime() {
    const versioned = file => {
      const url = new URL(file, SCRIPT_URL);
      url.searchParams.set('v', VERSION);
      return url.href;
    };
    Promise.allSettled([
      import(versioned('./auth-nav.js')),
      import(versioned('./nav-collections.js')),
      import(versioned('./products-store.js')),
      import(versioned('./cart-sync.js')),
    ]).then(results => {
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) console.warn('[PublicShell] Algunos datos en vivo no pudieron cargarse.', failed.map(item => item.reason));
    });
  }

  function mount() {
    if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return;
    removeLegacyShell();
    document.body.insertAdjacentHTML('afterbegin', topShell());
    document.body.insertAdjacentHTML('beforeend', bottomShell());
    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');
    applyActiveState();
    loadSharedRuntime();
    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
