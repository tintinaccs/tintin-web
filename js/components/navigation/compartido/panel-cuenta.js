import { UI_ICONS, svgIcon } from './iconos.js';

function loginHrefForCurrentLocation() {
  const path = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  const onHome = /^\/(?:index(?:\.html)?)?\/?$/i.test(window.location.pathname || '/');
  const onLogin = /(^|\/)login(?:\.html)?\/?$/i.test(window.location.pathname || '');
  if (onHome || onLogin) return '/login';
  return `/login?from=${encodeURIComponent(path)}`;
}

export function renderAccountDrawer() {
  const loginHref = loginHrefForCurrentLocation();
  return `
    <div class="tt-account-drawer" id="account-drawer" role="dialog" aria-modal="true" aria-label="Mi cuenta" aria-hidden="true">
      <div class="tt-account-drawer-header">
        <h2>MI CUENTA</h2>
        <button type="button" id="btn-account-close" aria-label="Cerrar cuenta">${svgIcon(UI_ICONS.close, { size: 16 })}</button>
      </div>
      <div class="tt-account-panel" id="account-panel">
        <p class="tt-account-guest-copy">Ingresá para guardar favoritos, ver pedidos y comprar más rápido.</p>
        <a class="tt-account-item" href="${loginHref}">Iniciar sesión</a>
        <a class="tt-account-item" href="${loginHref}">Crear una cuenta</a>
      </div>
    </div>`;
}
