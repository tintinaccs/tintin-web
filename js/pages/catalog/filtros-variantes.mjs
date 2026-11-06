import { hasProductStock, productVariantGroups, variantAttributes, variantInventoryEntries } from '../../core/store/inventario-variantes.mjs?v=tintin-20261031-seo-espacios-2';

const identity = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
const sorter = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

// Read option names, values and combinations through the same interpretation
// used by product/checkout. Never derive choices from the color preset palette.
export function catalogFilterRecord(product) {
  const groups = new Map();
  const add = (name, values) => {
    const key = identity(name);
    if (!key || !values.length) return;
    const group = groups.get(key) || { key, label: name, values: new Map() };
    for (const value of values) if (identity(value)) group.values.set(identity(value), value);
    groups.set(key, group);
  };
  const values = productVariantGroups(product);
  const names = Object.keys(variantAttributes(product, values.map(group => group[0]).join(' / ')) || {});
  names.forEach((name, index) => add(name, values[index]));
  if (typeof product.material === 'string' && product.material.trim() && !groups.has('material')) add('Material', [product.material.trim()]);

  const available = hasProductStock(product);
  let rows;
  try {
    const inventory = variantInventoryEntries(product);
    rows = inventory === null ? null : inventory.map(entry => {
      const attributes = product.variantCommerceVersion === 2 ? entry.attributes : variantAttributes(product, entry.variant);
      const attrs = new Map(Object.entries(attributes || {}).map(([key, value]) => [identity(key), identity(value)]));
      if (groups.has('material') && !attrs.has('material') && product.material) attrs.set('material', identity(product.material));
      return { attrs, available: available && entry.active !== false && (entry.stock === null || entry.stock > 0) };
    });
  } catch { rows = []; }
  return { product, groups, rows, available };
}

// OR inside a group, AND between groups; all selected attributes must match
// one actual inventory row, rather than different incompatible combinations.
export function matchesCatalogFilters(record, selected, { onlyStock = false, except = '' } = {}) {
  const entries = [...selected].filter(([key, values]) => key !== except && values.size);
  if (!entries.length) return !onlyStock || record.available;
  const matches = attrs => entries.every(([key, values]) => attrs.has(key) && values.has(attrs.get(key)));
  if (record.rows !== null) return record.rows.some(row => (!onlyStock || row.available) && matches(row.attrs));
  return (!onlyStock || record.available) && entries.every(([key, values]) => {
    const group = record.groups.get(key);
    return group && [...values].some(value => group.values.has(value));
  });
}

export function catalogFilterOptions(records, selected = new Map(), definitions = records) {
  const groups = new Map();
  for (const record of definitions) {
    for (const [key, group] of record.groups) {
      const target = groups.get(key) || { key, label: group.label, options: new Map() };
      for (const [value, label] of group.values) {
        const option = target.options.get(value) || { value, label, count: 0, availableCount: 0 };
        target.options.set(value, option);
      }
      groups.set(key, target);
    }
  }
  for (const record of records) for (const [key, group] of record.groups) {
    for (const value of group.values.keys()) {
      const option = groups.get(key)?.options.get(value);
      if (!option) continue;
      const candidate = new Map(selected);
      candidate.set(key, new Set([value]));
      if (matchesCatalogFilters(record, candidate)) option.count++;
      if (matchesCatalogFilters(record, candidate, { onlyStock: true })) option.availableCount++;
    }
  }
  return [...groups.values()].sort((a, b) => sorter.compare(a.label, b.label)).map(group => ({
    ...group,
    options: [...group.options.values()].sort((a, b) => Number(!a.availableCount) - Number(!b.availableCount) || sorter.compare(a.label, b.label))
  }));
}

export function pruneCatalogFilters(selected, records) {
  const groups = new Map();
  for (const record of records) for (const [key, group] of record.groups) {
    const values = groups.get(key) || new Set();
    for (const value of group.values.keys()) values.add(value);
    groups.set(key, values);
  }
  for (const [key, values] of selected) {
    for (const value of values) if (!groups.get(key)?.has(value)) values.delete(value);
    if (!values.size) selected.delete(key);
  }
}
