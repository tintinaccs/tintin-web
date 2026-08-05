import { UI_ICONS, svgIcon } from '../shared/icons.js';

export function renderMobileTabbar() {
  return `
    <nav class="tt-tabbar" id="tt-tabbar" aria-label="Navegación mobile">
      <span class="tt-mobile-nav-halo" aria-hidden="true"></span>
      <span class="tt-mobile-nav-indicator" aria-hidden="true"></span>
      <a href="index.html" class="tt-tabbar-btn" aria-label="Inicio" data-shell-tab="home">
        ${svgIcon(UI_ICONS.home)}<span>Inicio</span>
      </a>
      <button type="button" class="tt-tabbar-btn" id="tabbar-tienda" aria-label="Tienda" aria-expanded="false" aria-controls="collections-sheet" data-shell-tab="shop">
        ${svgIcon(UI_ICONS.storefront)}<span>Tienda</span>
      </button>
      <button type="button" class="tt-tabbar-btn" id="tabbar-search" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel" data-shell-tab="search">
        ${svgIcon(UI_ICONS.search)}<span>Buscar</span>
      </button>
      <button type="button" class="tt-tabbar-btn" id="tabbar-cart" style="position:relative" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer" data-shell-tab="cart">
        ${svgIcon(UI_ICONS.bag)}<span class="tt-cart-badge hidden" id="cart-badge-mobile">0</span><span>Carrito</span>
      </button>
      <button type="button" id="tabbar-cuenta" class="tt-tabbar-btn" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer" data-nav-action="account" data-shell-tab="account">
        ${svgIcon(UI_ICONS.account)}<span>Cuenta</span>
      </button>
    </nav>`;
}
