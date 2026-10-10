import { UI_ICONS, svgIcon } from './iconos.js?v=tintin-20260916-final-production-stability-iconos-1-master-20261007-1';

export function renderAccountDrawer() {
  return `
    <div class="tt-account-drawer" id="account-drawer" role="dialog" aria-modal="true" aria-label="Mi cuenta" aria-hidden="true">
      <div class="tt-account-drawer-header">
        <div class="tt-account-drawer-heading">
          <img class="tt-account-drawer-logo" src="assets-tintin/images/general/logo.png?v=tintin-20261009-whatsapp-responsive-1" alt="Tintin" width="160" height="80" loading="lazy" decoding="async">
          <h2>MI CUENTA</h2>
        </div>
        <button type="button" id="btn-account-close" aria-label="Cerrar cuenta">${svgIcon(UI_ICONS.close, { size: 16 })}</button>
      </div>
      <div class="tt-account-panel" id="account-panel" aria-live="polite">
        <div class="tt-account-loading" role="status">
          <span class="tt-account-loading-dot" aria-hidden="true"></span>
          <span>Comprobando tu sesión…</span>
        </div>
      </div>
    </div>`;
}
