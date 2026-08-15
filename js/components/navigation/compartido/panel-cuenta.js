export function renderAccountDrawer() {
  return `
    <div class="tt-account-drawer" id="account-drawer" role="dialog" aria-modal="true" aria-label="Mi cuenta" aria-hidden="true">
      <div class="tt-account-drawer-header">
        <h2>MI CUENTA</h2>
        <button type="button" id="btn-account-close" aria-label="Cerrar cuenta">✕</button>
      </div>
      <div class="tt-account-panel" id="account-panel">
        <p class="tt-account-guest-copy">Ingresá para guardar favoritos, ver pedidos y comprar más rápido.</p>
        <a class="tt-account-item" href="/login">Iniciar sesión</a>
        <a class="tt-account-item" href="/login">Crear una cuenta</a>
      </div>
    </div>`;
}
