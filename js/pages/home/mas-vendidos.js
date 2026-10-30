/* Productos que la dueña marca como "Más vendido" en Superadmin.
   No inventamos ventas: la elección es explícita y siempre se prioriza stock. */
const grid = document.getElementById('tt-best-sellers-grid');
const status = document.getElementById('tt-best-sellers-status');
const LIMIT = 4;

function available(product) {
  return Boolean(window.TintinCatalogPolicy?.isPurchasable?.(product));
}

function selected(products) {
  const ids = window.TintinProductsStore?.homeSelection?.featured;
  return products.filter(product => product.destacado === true && available(product) && (!ids || ids.includes(String(product.id)))).slice(0, LIMIT);
}

function render(products) {
  if (!grid || !Array.isArray(products) || typeof window.renderProductsGrid !== 'function') return;
  const productsToShow = selected(products);
  window.renderProductsGrid(grid.id, productsToShow);
  grid.setAttribute('aria-busy', 'false');
  if (status) status.textContent = productsToShow.length
    ? `${productsToShow.length} producto${productsToShow.length === 1 ? '' : 's'} seleccionado${productsToShow.length === 1 ? '' : 's'} para vos.`
    : 'Pronto vas a encontrar nuestros productos más vendidos.';
}

window.addEventListener('tintin:products-loaded', event => render(event.detail?.products));
window.addEventListener('tintin:products-error', () => {
  if (grid?.getAttribute('aria-busy') !== 'true') return;
  grid.setAttribute('aria-busy', 'false');
  if (status) status.textContent = 'No pudimos cargar la selección. Podés volver a intentar desde el catálogo.';
});
document.addEventListener('DOMContentLoaded', () => render(window.PRODUCTS), { once: true });
if (Array.isArray(window.PRODUCTS)) render(window.PRODUCTS);
