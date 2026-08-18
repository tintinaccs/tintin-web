import { CATEGORIES, UI_ICONS, categoryIcon, svgIcon } from '../compartido/iconos.js';
import { logoUrl } from '../compartido/configuracion.js';

const notificationBell = () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

function renderTabletCategories() {
  return CATEGORIES.map(({ slug, label, background }) => `
    <a href="/catalogo?cat=${slug}" class="tt-tablet-cat-card">
      <div class="tt-tablet-cat-img" style="background:${background}">${categoryIcon(slug, { size: 28, stroke: '#FFFFFF' })}</div>
      <span>${label}</span>
    </a>`).join('');
}

function logoImage(className, alt, highPriority = false) {
  const fallbackLogo = logoUrl();
  return `<img loading="eager" decoding="async"${highPriority ? ' fetchpriority="high"' : ''} src="${fallbackLogo}" data-tt-shell-logo-pending data-tt-fallback-logo="${fallbackLogo}" alt="${alt}" class="${className}" style="visibility:hidden">`;
}

export function renderTabletHeader() {
  return `
    <header class="tt-header-tablet" id="tt-header-tablet" data-header-device="tablet">
      <div class="tt-tablet-header-inner">
        <button type="button" class="tt-tablet-menu-toggle" id="btn-menu-tablet" aria-label="Abrir menú" aria-expanded="false" aria-controls="tt-tablet-menu">
          <span class="tt-tablet-menu-lines" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>
        <a href="/" class="tt-tablet-logo-link" aria-label="Tintin, ir al inicio">
          ${logoImage('tt-tablet-logo-img', 'TINTIN Accesorios & Relojes', true)}
        </a>
        <div class="tt-tablet-actions">
          <button type="button" id="btn-search-tablet" data-nav-action="search" title="Buscar" aria-label="Buscar" aria-expanded="false" aria-controls="search-panel">${svgIcon(UI_ICONS.search, { size: 22 })}</button>
          <button type="button" id="btn-notifications-tablet" class="tt-notification-trigger" data-nav-action="notifications" title="Notificaciones" aria-label="Notificaciones" aria-expanded="false" aria-controls="notifications-drawer" hidden>${notificationBell()}<span class="tt-notification-badge" data-notification-badge hidden>0</span></button>
          <button type="button" id="btn-cuenta-tablet" data-nav-action="account" data-auth-account-button data-shell-route="account" title="Mi cuenta" aria-label="Mi cuenta" aria-expanded="false" aria-controls="account-drawer">${svgIcon(UI_ICONS.account, { size: 22 })}</button>
          <button type="button" id="btn-cart-tablet" data-nav-action="cart" title="Carrito" aria-label="Carrito" aria-expanded="false" aria-controls="cart-drawer">${svgIcon(UI_ICONS.bag, { size: 22 })}<span class="tt-cart-badge hidden" id="cart-badge-tablet">0</span></button>
        </div>
      </div>
    </header>`;
}

export function renderTabletMenu() {
  return `
    <div class="tt-tablet-menu" id="tt-tablet-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación tablet" aria-hidden="true">
      <div class="tt-tablet-menu-header">
        <a href="/" class="tt-tablet-menu-logo" aria-label="Tintin, ir al inicio">
          ${logoImage('tt-tablet-menu-logo-img', 'TINTIN')}
        </a>
        <button type="button" class="tt-tablet-menu-close" id="btn-tablet-close" aria-label="Cerrar menú">
          ${svgIcon(UI_ICONS.close)}
        </button>
      </div>
      <nav class="tt-tablet-nav" aria-label="Navegación tablet">
        <a href="/" data-shell-route="home">INICIO</a>
        <button type="button" id="btn-tablet-tienda" class="tt-tablet-tienda-btn" aria-expanded="false" aria-controls="tablet-cats">
          <span>TIENDA</span>
          ${svgIcon(UI_ICONS.chevronDown, { size: 16, className: 'tt-tablet-chevron' })}
        </button>
        <a href="/about" data-shell-route="about">NOSOTROS</a>
        <a href="/contact" data-shell-route="contact">CONTACTO</a>
      </nav>
      <div class="tt-tablet-cats" id="tablet-cats">
        <button type="button" class="tt-tablet-cats-back" id="btn-tablet-cats-back">← Volver</button>
        <h2 class="tt-tablet-cats-title">Colecciones</h2>
        <div class="tt-tablet-cats-grid" data-collections-nav="tablet">${renderTabletCategories()}</div>
        <a href="/catalogo" class="tt-tablet-ver-todo">Ver todo el catálogo →</a>
      </div>
      <button type="button" class="tt-tablet-account-entry" data-nav-action="account" aria-expanded="false" aria-controls="account-drawer">Mi cuenta</button>
    </div>`;
}
