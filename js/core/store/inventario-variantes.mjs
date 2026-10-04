// Optional stock matrix. Missing metadata preserves the aggregate stock model;
// malformed metadata fails closed instead of making unavailable options sellable.
export function normalizeVariantSelection(value) {
  return String(value ?? '').split('/').map(part => part.trim()).join(' / ');
}

export function variantInventoryEntries(product) {
  if (product?.variantInventory == null) return null;
  const entries = product.variantInventory;
  if (!Array.isArray(entries) || !entries.length || entries.length > 1000) throw new Error('Inventario de variantes inválido.');
  const seen = new Set();
  return entries.map(entry => {
    const variant = normalizeVariantSelection(entry?.variant);
    const stock = entry?.stock;
    if (!variant || variant.length > 120 || seen.has(variant) || !Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      throw new Error('Inventario de variantes inválido.');
    }
    seen.add(variant);
    return { variant, stock };
  });
}

export function variantStockLimit(product, selection) {
  try {
    const entries = variantInventoryEntries(product);
    if (entries === null) return null;
    return entries.find(entry => entry.variant === normalizeVariantSelection(selection))?.stock ?? 0;
  } catch { return 0; }
}

export function normalizeVariantInventoryItems(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const id = String(item.id || '').trim();
    const variant = normalizeVariantSelection(item.variant);
    const qty = Number(item.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error('Cantidad de variante inválida.');
    const key = JSON.stringify([id, variant]);
    const previous = grouped.get(key);
    grouped.set(key, { id, variant, qty: (previous?.qty || 0) + qty });
  }
  return [...grouped.values()];
}

export function applyVariantInventoryDeltas(product, deltas) {
  const entries = variantInventoryEntries(product);
  if (entries === null) {
    if (deltas.length) throw new Error('El inventario de variantes del pedido requiere revisión.');
    return null;
  }
  for (const delta of deltas) {
    const entry = entries.find(row => row.variant === normalizeVariantSelection(delta.variant));
    if (!entry) throw new Error('La variante del pedido ya no existe.');
    const stock = entry.stock - delta.qty;
    if (stock < 0) throw Object.assign(new Error(`Stock insuficiente para la variante ${entry.variant}. Disponible: ${entry.stock}.`), {
      code: 'insufficient_stock', status: 422, variant: entry.variant, available: entry.stock, requested: delta.qty,
    });
    if (stock > 1000000) throw new Error('Stock de variante fuera de rango.');
    entry.stock = stock;
  }
  return entries;
}

export function variantInventoryDeltas(beforeItems, afterItems) {
  const deltas = new Map();
  for (const [items, sign] of [[beforeItems, -1], [afterItems, 1]]) {
    for (const item of normalizeVariantInventoryItems(items)) {
      const key = JSON.stringify([item.id, item.variant]);
      const previous = deltas.get(key);
      deltas.set(key, { ...item, qty: (previous?.qty || 0) + sign * item.qty });
    }
  }
  return [...deltas.values()].filter(item => item.qty !== 0);
}
