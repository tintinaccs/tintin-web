import { UI_ICONS, svgIcon } from '../compartido/iconos.js';
import { logoUrl } from '../compartido/configuracion.js';

const notificationBell = () => '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

export function renderMobileHeader() {
  const logo = logoUrl();
  return `
    <header class="tt-header-mobile" id="tt-header-mobile" data-header-device="mobile">
      <a href="/" class="tt-mobile-logo-link" aria-label="Tintin, ir al inicio">
        <img loading="eager" decoding="async" fetchpriority="high" src="${logo}" data-tt-shared-logo="${logo}" alt="TINTIN Accesorios &amp; Relojes" class="tt-logo-img tt-mobile-logo-img">
      </a>
    </header>`;
}

export function renderMobileTabbar() {
  return `
    <nav class="tt-tabbar" id="tt-tabbar" aria-label="Navegación principal móvil">
      <span class="tt-mobile-nav-halo" aria-hidden="true"></span>
      <span class="tt-mobile-nav-indicator" aria-hidden="true"></span>
      <a href="/" class="tt-tabbar-btn" aria-label="Inicio" data-shell-tab="home">
        ${svgIcon(UI_ICONS.home)}<span>Inicio</span>
      </a>
      <button type="button" class="tt-tabbar-btn" id="tabbar-search" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel" data-shell-tab="search">
        ${svgIcon(UI_ICONS.search)}<span>Buscar</span>
      </button>
      <button type="button" class="tt-tabbar-btn" id="tabbar-tienda" aria-label="Tienda" aria-expanded="false" aria-controls="collections-sheet" data-shell-tab="shop">
        ${svgIcon(UI_ICONS.storefront)}<span>Tienda</span>
      </button>
      <button type="button" class="tt-tabbar-btn tt-notification-trigger" id="tabbar-notifications" data-nav-action="notifications" aria-label="Notificaciones" aria-expanded="false" aria-controls="notifications-drawer" data-shell-tab="notifications" hidden>
        ${notificationBell()}<span class="tt-notification-badge" data-notification-badge hidden>0</span><span>Alertas</span>
      </button>
      <button type="button" class="tt-tabbar-btn" id="tabbar-cart" style="position:relative" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" data-shell-tab="cart">
        ${svgIcon(UI_ICONS.bag)}<span class="tt-cart-badge hidden" id="cart-badge-mobile">0</span><span>Carrito</span>
      </button>
      <button type="button" id="tabbar-cuenta" class="tt-tabbar-btn" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer" data-nav-action="account" data-shell-tab="account">
        <span class="tt-tabbar-account-icon" aria-hidden="true">${svgIcon(UI_ICONS.account)}</span><span>Cuenta</span>
      </button>
    </nav>`;
}
