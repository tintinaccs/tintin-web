export function renderAccountDrawer() {
  return `
    <div class="tt-account-drawer" id="account-drawer" role="dialog" aria-modal="true" aria-label="Mi cuenta" aria-hidden="true">
      <div class="tt-account-drawer-header">
        <h2>MI CUENTA</h2>
        <button type="button" id="btn-account-close" aria-label="Cerrar cuenta">✕</button>
      </div>
      <div class="tt-account-panel" id="account-panel">
        <p class="tt-account-loading" role="status">Cargando tu cuenta…</p>
      </div>
    </div>`;
}
