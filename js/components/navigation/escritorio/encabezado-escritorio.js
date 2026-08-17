import { CATEGORIES, UI_ICONS, categoryIcon, svgIcon } from '../compartido/iconos.js';
import { logoUrl } from '../compartido/configuracion.js';

const notificationBell = () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function renderDesktopCategories() {
  return CATEGORIES.map(({ slug, label }) => `
    <a href="/catalogo?cat=${encodeURIComponent(slug)}" class="tt-dropdown-card">
      <div class="tt-dropdown-icon">${categoryIcon(slug)}</div>
      <div class="tt-dropdown-label">${label.toUpperCase()}</div>
    </a>`).join('');
}

export function renderDesktopHeader() {
  return `
    <header class="tt-header tt-header-desktop" id="tt-header-desktop-tablet" data-header-device="desktop">
      <div class="tt-header-inner">
        <a href="/" class="tt-logo-link" aria-label="Tintin, ir al inicio">
          <img loading="eager" decoding="async" fetchpriority="high" src="${EMPTY_IMAGE}" data-tt-shared-logo="${logoUrl()}" alt="TINTIN Accesorios &amp; Relojes" class="tt-logo-img">
        </a>

        <nav class="tt-nav tt-nav-desktop" id="tt-nav-desktop-tablet" aria-label="Navegación principal">
          <span class="tt-desktop-active-pill" aria-hidden="true"></span>
          <a href="/" data-shell-route="home" data-desktop-nav-item>INICIO</a>
          <div class="tt-nav-dropdown" id="tienda-dropdown">
            <button type="button" id="btn-tienda" data-shell-route="shop" data-desktop-nav-item aria-expanded="false" aria-haspopup="true" aria-controls="tt-tienda-dropdown-panel">TIENDA <span aria-hidden="true">▾</span></button>
            <div class="tt-dropdown" id="tt-tienda-dropdown-panel" role="dialog" aria-label="Categorías de la tienda" aria-hidden="true">
              <div class="tt-dropdown-grid" data-collections-nav="desktop">${renderDesktopCategories()}</div>
            </div>
          </div>
          <a href="/about" data-shell-route="about" data-desktop-nav-item>NOSOTROS</a>
          <a href="/contact" data-shell-route="contact" data-desktop-nav-item>CONTACTO</a>
        </nav>

        <div class="tt-header-actions">
          <button type="button" id="btn-search" data-nav-action="search" title="Buscar" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel">
            ${svgIcon(UI_ICONS.search)}
          </button>
          <button type="button" id="btn-notifications" class="tt-notification-trigger" data-nav-action="notifications" title="Notificaciones" aria-label="Notificaciones" aria-expanded="false" aria-controls="notifications-drawer" hidden>
            ${notificationBell()}<span class="tt-notification-badge" data-notification-badge hidden>0</span>
          </button>
          <button type="button" id="btn-cuenta" data-nav-action="account" data-auth-account-button title="Mi cuenta" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer">
            ${svgIcon(UI_ICONS.account)}
          </button>
          <button type="button" id="btn-cart" data-nav-action="cart" title="Carrito" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" style="position:relative">
            ${svgIcon(UI_ICONS.bag)}
            <span class="tt-cart-badge hidden" id="cart-badge">0</span>
          </button>
        </div>
      </div>
    </header>`;
}
