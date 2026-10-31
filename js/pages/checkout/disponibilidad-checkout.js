import { normalizeVariantSelection, variantStockLimit } from '../../core/store/inventario-variantes.mjs?v=tintin-20261031-seo-espacios-2';

// Es una comprobación anticipada, nunca una reserva. La transacción del
// servidor sigue siendo la autoridad al confirmar y ante compras simultáneas.
export async function inspectCheckoutAvailability(items, readProduct) {
  const ids = [...new Set(items.map(item => String(item.id)))];
  const products = new Map(await Promise.all(ids.map(async id => [id, await readProduct(id)])));
  const used = new Map();
  const issues = [];
  const adjusted = [];
  for (const item of items) {
    const id = String(item.id);
    const product = products.get(id);
    if (!product || product.active === false) {
      issues.push({ id, variant: item.variant || '', name: item.name, available: 0, unavailable: true });
      continue;
    }
    const aggregate = product.stock == null || product.stock === '' ? Infinity : Number(product.stock);
    if (Number.isNaN(aggregate) || aggregate < 0) throw new Error('invalid_stock');
    const variant = normalizeVariantSelection(item.variant);
    const option = variantStockLimit(product, variant);
    const variantKey = JSON.stringify([id, variant]);
    const available = Math.max(0, Math.floor(Math.min(
      aggregate - (used.get(id) || 0),
      option == null ? Infinity : option - (used.get(variantKey) || 0),
    )));
    const qty = Math.min(Number(item.qty), available);
    if (qty < Number(item.qty)) issues.push({ id, variant, name: item.name, available: qty });
    if (qty > 0) {
      adjusted.push({ ...item, qty });
      used.set(id, (used.get(id) || 0) + qty);
      used.set(variantKey, (used.get(variantKey) || 0) + qty);
    }
  }
  return { issues, items: adjusted };
}

export function showCheckoutAvailabilityDialog({ name = '', available = 0, unavailable = false } = {}) {
  if (document.getElementById('ck-availability-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'ck-availability-dialog';
  dialog.className = 'ck-availability-dialog';
  dialog.setAttribute('aria-labelledby', 'ck-availability-title');
  dialog.setAttribute('aria-describedby', 'ck-availability-description');
  const title = document.createElement('h2');
  title.id = 'ck-availability-title';
  title.textContent = available > 0 ? 'Cambió la cantidad disponible' : unavailable ? 'Este producto ya no está disponible' : 'Este producto se acaba de agotar';
  const description = document.createElement('p');
  description.id = 'ck-availability-description';
  description.textContent = available > 0
    ? `Ahora quedan ${available} unidades${name ? ` de «${name}»` : ''}. Ajustamos la cantidad en tu carrito.`
    : `${name ? `«${name}» ya no está disponible.` : 'Uno de los productos ya no está disponible.'} Esta vez no pudimos completar tu compra.`;
  const hint = document.createElement('p');
  hint.className = 'ck-availability-hint';
  hint.textContent = 'Podés descubrir otras opciones en el catálogo. Conservamos los artículos que siguen disponibles en tu carrito.';
  const actions = document.createElement('div');
  actions.className = 'ck-availability-actions';
  for (const [label, href, primary] of [['Ver catálogo', '/catalogo', true], ['Cerrar y volver al inicio', '/', false]]) {
    const link = document.createElement('a');
    link.textContent = label;
    link.href = href;
    link.className = primary ? 'ck-btn' : 'ck-btn-secondary';
    actions.append(link);
  }
  dialog.append(title, description, hint, actions);
  // Escape y el cierre nativo también salen del checkout inválido.
  dialog.addEventListener('cancel', event => { event.preventDefault(); window.location.replace('/'); });
  dialog.addEventListener('close', () => window.location.replace('/'));
  document.body.append(dialog);
  window.TintinCheckoutState?.clear?.();
  dialog.showModal();
  actions.querySelector('a').focus();
}
