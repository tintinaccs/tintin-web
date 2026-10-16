/* Productos que la dueña marca como "Más vendido" en Superadmin.
   No inventamos ventas: la elección es explícita y siempre se prioriza stock. */
const grid = document.getElementById('tt-best-sellers-grid');
const status = document.getElementById('tt-best-sellers-status');
const LIMIT = 4;

function available(product) {
  return product?.active !== false && !(product.stock != null && Number(product.stock) <= 0);
}

function selected(products) {
  const visible = products.filter(available);
  const picked = visible.filter(product => product.destacado === true);
  // Mientras todavía no se elija ninguno, la portada conserva una selección
  // útil; apenas haya productos marcados, solo se muestran esos.
  return (picked.length ? picked : visible).slice(0, LIMIT);
}

function render(products) {
  if (!grid || !Array.isArray(products)) return;
  const productsToShow = selected(products);
  if (typeof window.renderProductsGrid === 'function') window.renderProductsGrid(grid.id, productsToShow);
  grid.setAttribute('aria-busy', 'false');
  if (status) status.textContent = productsToShow.length
    ? `${productsToShow.length} producto${productsToShow.length === 1 ? '' : 's'} seleccionado${productsToShow.length === 1 ? '' : 's'} para vos.`
    : 'Pronto vas a encontrar nuestros productos más vendidos.';
}

window.addEventListener('tintin:products-loaded', event => render(event.detail?.products));
if (Array.isArray(window.PRODUCTS)) render(window.PRODUCTS);
