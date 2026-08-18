import { UI_ICONS, svgIcon } from './iconos.js';

export function renderCartDrawer() {
  return `
    <div class="tt-cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrito de compras" aria-hidden="true">
      <div class="tt-cart-header">
        <h2 class="tt-cart-title">MI CARRITO</h2>
        <button type="button" class="tt-cart-close" id="btn-cart-close" aria-label="Cerrar carrito">${svgIcon(UI_ICONS.close, { size: 16 })}</button>
      </div>
      <div class="tt-cart-body" id="cart-body"></div>
      <div class="tt-cart-footer" id="cart-footer" style="display:none">
        <div class="tt-cart-total-row">
          <span class="tt-cart-total-label">TOTAL</span>
          <span class="tt-cart-total-value" id="cart-total">Gs. 0</span>
        </div>
      </div>
    </div>`;
}
