import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value, 'utf8');
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: se esperaba una coincidencia y se encontraron ${count}`);
  write(path, source.replace(before, after));
}

replaceOnce(
  'js/products-store.js',
  "import { listPublicCollectionRest } from './firestore-rest-fallback.js?v=tintin-20260726-browser-fallback-1';\n",
  "import { listPublicCollectionRest } from './firestore-rest-fallback.js?v=tintin-20260726-browser-fallback-1';\nimport { sortCatalogProducts, timestampToMillis } from './catalog-merchandising-policy.js?v=tintin-20260731-unified-store-1';\n"
);

replaceOnce(
  'js/products-store.js',
  "    variants: sanitizeVariantData(d.variants || null),\n    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999\n",
  "    variants: sanitizeVariantData(d.variants || null),\n    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999,\n    createdAt: timestampToMillis(d.createdAt ?? d.created_at ?? d.importedAt),\n    updatedAt: timestampToMillis(d.updatedAt ?? d.updated_at ?? d.modifiedAt),\n    restockedAt: timestampToMillis(d.restockedAt),\n    catalogActivityAt: timestampToMillis(d.catalogActivityAt)\n"
);

replaceOnce(
  'js/products-store.js',
  "    destacado: product.destacado,\n    collectionOrder: product.collectionOrder\n",
  "    destacado: product.destacado,\n    collectionOrder: product.collectionOrder,\n    createdAt: product.createdAt,\n    updatedAt: product.updatedAt,\n    restockedAt: product.restockedAt,\n    catalogActivityAt: product.catalogActivityAt\n"
);

replaceOnce(
  'js/products-store.js',
  `function normalizeList(list) {
  return list
    .filter(Boolean)
    .map(product => window.TintinCatalogPolicy?.normalizeProduct
      ? window.TintinCatalogPolicy.normalizeProduct(product)
      : product)
    .filter(product => window.TintinCatalogPolicy?.isCatalogVisible
      ? window.TintinCatalogPolicy.isCatalogVisible(product)
      : product.active !== false && Boolean(product.name) && Number.isFinite(Number(product.price)) && Number(product.price) > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
`,
  `function normalizeList(list) {
  const normalized = list
    .filter(Boolean)
    .map(product => window.TintinCatalogPolicy?.normalizeProduct
      ? window.TintinCatalogPolicy.normalizeProduct(product)
      : product)
    .filter(product => window.TintinCatalogPolicy?.isCatalogVisible
      ? window.TintinCatalogPolicy.isCatalogVisible(product)
      : product.active !== false && Boolean(product.name) && Number.isFinite(Number(product.price)) && Number(product.price) > 0);
  return sortCatalogProducts(normalized);
}
`
);

replaceOnce(
  'js/phase7-catalog-policy.js',
  "import { loadCollections } from './collections-store.js?v=tintin-20260726-browser-fallback-1';\n",
  "import { loadCollections } from './collections-store.js?v=tintin-20260726-browser-fallback-1';\nimport { isNewProduct, productActivityAtMillis, sortCatalogProducts, timestampToMillis } from './catalog-merchandising-policy.js?v=tintin-20260731-unified-store-1';\n"
);

replaceOnce(
  'js/phase7-catalog-policy.js',
  "    price: Number.isFinite(price) ? Math.round(price) : NaN,\n    stock: stock == null ? null : (Number.isFinite(stock) ? Math.floor(stock) : NaN),\n    tags: unique(Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(','), 30, 60),\n",
  "    price: Number.isFinite(price) ? Math.round(price) : NaN,\n    stock: stock == null ? null : (Number.isFinite(stock) ? Math.floor(stock) : NaN),\n    createdAt: timestampToMillis(p.createdAt ?? p.created_at ?? p.importedAt),\n    updatedAt: timestampToMillis(p.updatedAt ?? p.updated_at ?? p.modifiedAt),\n    restockedAt: timestampToMillis(p.restockedAt),\n    catalogActivityAt: timestampToMillis(p.catalogActivityAt),\n    tags: unique(Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(','), 30, 60),\n"
);

replaceOnce(
  'js/phase7-catalog-policy.js',
  `function filterProducts(products) {
  return (Array.isArray(products) ? products : [])
    .map(normalizeProduct)
    .filter(isCatalogVisible)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
`,
  `function filterProducts(products) {
  return sortCatalogProducts(
    (Array.isArray(products) ? products : [])
      .map(normalizeProduct)
      .filter(isCatalogVisible)
  );
}
`
);

replaceOnce(
  'js/phase7-catalog-policy.js',
  "  hasVariants,\n  reconcileCart: reconcileCatalogCart,\n",
  "  hasVariants,\n  isNewProduct,\n  productActivityAtMillis,\n  sortProducts: sortCatalogProducts,\n  reconcileCart: reconcileCatalogCart,\n"
);

replaceOnce(
  'catalogo.html',
  `  const sort = document.getElementById('cat-sort').value;
  if (sort === 'precio-asc')  lista.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'precio-desc') lista.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === 'nombre')      lista.sort((a, b) => nameSorter.compare(a.name || '', b.name || ''));
  if (sort === 'stock')       lista.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0));
  if (sort === 'default' && catActual !== 'todos') {
    // Manual order set from Super Admin → Colecciones → Gestionar productos
    lista.sort((a, b) => (a.collectionOrder ?? 9999) - (b.collectionOrder ?? 9999));
  }

  // El stock no modifica el orden. Un producto agotado conserva exactamente
  // su posición y vuelve a estar disponible en ese mismo lugar al reponerse.
`,
  `  const sort = document.getElementById('cat-sort').value;
  lista = window.TintinCatalogMerchandising?.sortCatalogProducts
    ? window.TintinCatalogMerchandising.sortCatalogProducts(lista, { mode: sort })
    : lista.sort((a, b) => {
        const aAvailable = isInStockCat(a) ? 0 : 1;
        const bAvailable = isInStockCat(b) ? 0 : 1;
        return aAvailable - bAvailable || nameSorter.compare(a.name || '', b.name || '');
      });
`
);

replaceOnce(
  'catalogo.html',
  "    const inStock = isInStockCat(p);\n    const hasVariants = window.TintinCatalogPolicy?.hasVariants\n",
  "    const inStock = isInStockCat(p);\n    const isNew = Boolean(inStock && window.TintinCatalogMerchandising?.isNewProduct?.(p));\n    const hasVariants = window.TintinCatalogPolicy?.hasVariants\n"
);

replaceOnce(
  'catalogo.html',
  "    const badgeHtml = !inStock\n      ? `<span class=\"tt-card-badge tt-card-badge--out\">AGOTADO</span>`\n      : p.badge ? `<span class=\"tt-card-badge\">${escapeCatalogHtml(p.badge)}</span>` : '';\n",
  "    const badgeHtml = !inStock\n      ? `<span class=\"tt-card-badge tt-card-badge--out\">AGOTADO</span>`\n      : isNew\n        ? `<span class=\"tt-card-badge\">NUEVO</span>`\n        : p.badge ? `<span class=\"tt-card-badge\">${escapeCatalogHtml(p.badge)}</span>` : '';\n"
);

replaceOnce(
  'script.js',
  "  const badgeClass = p.badge === 'Nuevo' ? 'nuevo' : '';\n  const badgeHTML = p.badge ? `<span class=\"tt-product-badge ${badgeClass}\">${escapeHtml(p.badge)}</span>` : '';\n",
  "  const isNew = Boolean(window.TintinCatalogMerchandising?.isNewProduct?.(p));\n  const displayBadge = isNew ? 'Nuevo' : p.badge;\n  const badgeClass = displayBadge === 'Nuevo' ? 'nuevo' : '';\n  const badgeHTML = displayBadge ? `<span class=\"tt-product-badge ${badgeClass}\">${escapeHtml(displayBadge)}</span>` : '';\n"
);

write('js/catalog-stock-priority.js', `/* Compatibilidad: la prioridad ya no vive en memoria ni depende de la sesión. */
import { sortCatalogProducts } from './catalog-merchandising-policy.js?v=tintin-20260731-unified-store-1';

window.TintinCatalogStockPriority = Object.freeze({
  order: products => sortCatalogProducts(products),
  getRestockedPriorityIds: () => [],
});
`);

console.log('Lógica unificada de tienda aplicada correctamente.');
