// Optional stock matrix. Missing metadata preserves the aggregate stock model;
// malformed metadata fails closed instead of making unavailable options sellable.
export function normalizeVariantSelection(value) {
  return String(value ?? '').split('/').map(part => part.trim()).join(' / ');
}

// One interpretation for public checkout, saved carts, photos and stock. Object
// field order can change between Firestore reads; it is not an option identity.
const VARIANT_METADATA = new Set(['price', 'sku', 'imageUrl', 'imageUrls', 'stock', 'active', 'colorHex', 'swatch']);
const variantText = value => String(value ?? '').replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

export function productVariantGroups(product) {
  const groups = new Map();
  const rows = Array.isArray(product?.variants) ? product.variants.slice(0, 100) : [product?.variants];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    for (const [key, raw] of Object.entries(row).slice(0, 20)) {
      if (VARIANT_METADATA.has(key)) continue;
      const values = (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map(variantText).filter(Boolean);
      if (values.length) groups.set(key, [...new Set([...(groups.get(key) || []), ...values])]);
    }
  }
  return [...groups.values()];
}

// null is invalid/ambiguous; an empty string is a valid product without options.
export function resolveProductVariant(product, selection) {
  const groups = productVariantGroups(product);
  const selected = variantText(selection);
  if (!groups.length) return selected ? null : '';
  if (!selected) return groups.every(group => group.length === 1) ? groups.map(group => group[0]).join(' / ') : null;
  const parts = selected.split('/').map(variantText);
  if (parts.length !== groups.length || groups.length > 20 || parts.some(part => !part)) return null;
  if (parts.every((part, index) => groups[index].includes(part))) return parts.join(' / ');

  // Bipartite matching avoids factorial permutations and preserves multiplicity.
  const match = forbidden => {
    const owners = Array(parts.length).fill(-1);
    const place = (group, seen) => {
      for (let part = 0; part < parts.length; part += 1) {
        if (seen.has(part) || !groups[group].includes(parts[part]) || (forbidden?.[0] === group && forbidden[1] === parts[part])) continue;
        seen.add(part);
        if (owners[part] < 0 || place(owners[part], seen)) { owners[part] = group; return true; }
      }
      return false;
    };
    for (let group = 0; group < groups.length; group += 1) if (!place(group, new Set())) return null;
    const values = Array(groups.length);
    owners.forEach((group, part) => { values[group] = parts[part]; });
    return values;
  };
  const values = match();
  if (!values) return null;
  // A reordered legacy string must have a unique attribute assignment.
  for (let group = 0; group < groups.length; group += 1) if (match([group, values[group]])) return null;
  return values.join(' / ');
}

export function inventorySelection(product, entries, selection) {
  if (product?.variantCommerceVersion === 2) {
    const attrs = variantAttributes(product, selection);
    if (!attrs) return null;
    return entries.find(entry => attributesKey(entry.attributes) === attributesKey(attrs)) || null;
  }
  const selected = normalizeVariantSelection(selection);
  const exact = entries.find(entry => entry.variant === selected);
  if (exact) return exact;
  const canonical = resolveProductVariant(product, selected);
  if (canonical === null) return null;
  const matches = entries.filter(entry => resolveProductVariant(product, entry.variant) === canonical);
  return matches.length === 1 ? matches[0] : null;
}

export function variantInventoryEntries(product) {
  if (product?.variantInventory == null) {
    if (product?.variantCommerceVersion === 2) throw new Error('Falta la matriz comercial de variantes.');
    return null;
  }
  const entries = product.variantInventory;
  if (!Array.isArray(entries) || !entries.length || entries.length > 1000) throw new Error('Inventario de variantes inválido.');
  const seen = new Set();
  return entries.map(entry => {
    const variant = normalizeVariantSelection(entry?.variant);
    const stock = entry?.stock;
    if (!variant || variant.length > 120 || seen.has(variant) || (!(product?.variantCommerceVersion === 2 && stock === null) && (!Number.isInteger(stock) || stock < 0 || stock > 1000000))) {
      throw new Error('Inventario de variantes inválido.');
    }
    seen.add(variant);
    if (product?.variantCommerceVersion !== 2) return { variant, stock };
    const attributes = entry.attributes;
    const groups = namedVariantGroups(product);
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)
      || Object.keys(attributes).length !== groups.length
      || groups.some(([key, values]) => typeof attributes[key] !== 'string' || !values.includes(attributes[key]))) throw new Error('Atributos comerciales inválidos.');
    const identity = attributesKey(attributes);
    if (seen.has(identity)) throw new Error('Combinación comercial duplicada.');
    seen.add(identity);
    for (const field of ['price', 'priceBefore']) {
      if (entry[field] != null && (!Number.isInteger(entry[field]) || entry[field] < 1 || entry[field] > 1e9)) throw new Error('Precio de variante inválido.');
    }
    if (entry.active != null && typeof entry.active !== 'boolean') throw new Error('Disponibilidad de variante inválida.');
    const price = entry.price ?? product.price;
    const before = entry.priceBefore ?? (entry.price == null ? product.priceBefore : null);
    if (before != null && (!Number.isInteger(before) || before <= price)) throw new Error('Precio anterior de variante inválido.');
    return { ...entry, variant, stock, attributes: { ...attributes } };
  });
}

export function variantStockLimit(product, selection) {
  try {
    const entries = variantInventoryEntries(product);
    if (entries === null) return null;
    const entry = inventorySelection(product, entries, selection);
    return !entry || entry.active === false ? 0 : entry.stock;
  } catch { return 0; }
}

export function hasProductStock(product) {
  if (product?.variantCommerceVersion !== 2 && product?.stock != null && product.stock !== '' && Number(product.stock) <= 0) return false;
  try {
    const entries = variantInventoryEntries(product);
    return entries === null || entries.some(entry => entry.active !== false && (entry.stock === null || entry.stock > 0));
  } catch { return false; }
}

export function firstAvailableVariant(product) {
  if (!hasProductStock(product)) return '';
  try { return variantInventoryEntries(product)?.find(entry => entry.active !== false && (entry.stock === null || entry.stock > 0))?.variant || ''; }
  catch { return ''; }
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
    const entry = inventorySelection(product, entries, delta.variant);
    if (!entry) throw new Error('La variante del pedido ya no existe.');
    if (delta.qty > 0 && entry.active === false) throw new Error('La variante no está disponible.');
    if (entry.stock === null) continue;
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

// Version 2 is opt-in on a product; no writer enables it automatically.
function namedVariantGroups(product) {
  const groups = new Map();
  for (const row of Array.isArray(product?.variants) ? product.variants : [product?.variants]) {
    if (!row || typeof row !== 'object') continue;
    for (const [key, raw] of Object.entries(row)) {
      if (VARIANT_METADATA.has(key)) continue;
      const values = (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map(variantText).filter(Boolean);
      if (values.length) groups.set(key, [...new Set([...(groups.get(key) || []), ...values])]);
    }
  }
  return [...groups];
}
export function attributesKey(attributes) {
  return JSON.stringify(Object.keys(attributes).sort().map(key => [key, attributes[key]]));
}
export function variantAttributes(product, selection) {
  const canonical = resolveProductVariant(product, selection);
  if (canonical === null) return null;
  const parts = canonical.split(' / ');
  return Object.fromEntries(namedVariantGroups(product).map(([key], index) => [key, parts[index]]));
}
export function productVariantPrice(product, selection = '') {
  let entry = null;
  if (product?.variantCommerceVersion === 2) {
    entry = inventorySelection(product, variantInventoryEntries(product), selection);
    if (!entry) throw new Error('La combinación seleccionada no existe.');
  }
  const price = entry?.price ?? product?.price;
  const priceBefore = entry?.priceBefore ?? (entry?.price == null ? product?.priceBefore : null) ?? null;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 1 || price > 1e9) throw new Error('Precio comercial inválido.');
  return { price, priceBefore: priceBefore != null && priceBefore > price ? priceBefore : null };
}
export function variantInventoryTotal(entries) {
  if (entries == null || entries.some(entry => entry.stock === null)) return null;
  const stock = entries.reduce((sum, entry) => sum + entry.stock, 0);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw new Error('Stock total inválido.');
  return stock;
}
export function productStockTotal(product) {
  return product?.variantCommerceVersion === 2 ? variantInventoryTotal(variantInventoryEntries(product)) : product?.stock;
}
export function stableVariantSelection(product, selection) {
  const canonical = resolveProductVariant(product, selection);
  if (canonical === null) return null;
  const entries = variantInventoryEntries(product);
  return entries ? inventorySelection(product, entries, selection)?.variant ?? null : canonical;
}
// Called before any definition edit, including import. Commercial references must
// be supplied by the authorized caller; absence never grants deletion of v2 rows.
export function assertVariantCompatibility(before, after) {
  if (before?.variantCommerceVersion !== 2) return;
  if (after?.variantCommerceVersion !== 2) throw new Error('No se puede degradar un producto comercial v2.');
  const next = variantInventoryEntries(after);
  for (const entry of variantInventoryEntries(before)) {
    if (!next.some(row => row.variant === entry.variant && attributesKey(row.attributes) === attributesKey(entry.attributes))) {
      throw new Error('Conservá la combinación comercial; podés desactivarla, no eliminarla.');
    }
  }
}
