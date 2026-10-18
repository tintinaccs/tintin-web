import { variantInventoryEntries } from '../../core/store/inventario-variantes.mjs?v=tintin-20261003-variant-inventory-1-stock-flow-20261014-1';

// Compara el documento original, no las opciones saneadas para mostrar el
// formulario. Firestore no garantiza el orden de las claves de sus mapas.
function inventorySignature(product) {
  return JSON.stringify({ stock: product.stock, entries: variantInventoryEntries(product), variants: product.variants }, (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
}

export function captureProductInventoryRevision(product) {
  return {
    stock: product.stock,
    entries: variantInventoryEntries(product),
    variants: product.variants == null ? product.variants : structuredClone(product.variants),
    signature: inventorySignature(product),
  };
}

export function productInventoryRevisionMatches(product, baseline) {
  return inventorySignature(product) === baseline.signature;
}
