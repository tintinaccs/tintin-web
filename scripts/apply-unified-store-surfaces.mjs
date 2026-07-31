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
  "    if (document.getElementById('colls-products-grid')) window.renderProductsGrid('colls-products-grid', featuredProducts);\n",
  "    if (document.getElementById('colls-products-grid')) window.renderProductsGrid('colls-products-grid', normalized);\n"
);

replaceOnce(
  'script.js',
  `  const isNew = Boolean(window.TintinCatalogMerchandising?.isNewProduct?.(p));
  const displayBadge = isNew ? 'Nuevo' : p.badge;
  const badgeClass = displayBadge === 'Nuevo' ? 'nuevo' : '';
  const badgeHTML = displayBadge ? \`<span class="tt-product-badge \${badgeClass}">\${escapeHtml(displayBadge)}</span>\` : '';
`,
  `  const inStock = isInStock(p);
  const isNew = Boolean(inStock && window.TintinCatalogMerchandising?.isNewProduct?.(p));
  const displayBadge = !inStock ? 'Agotado' : (isNew ? 'Nuevo' : p.badge);
  const badgeClass = displayBadge === 'Nuevo' ? 'nuevo' : '';
  const badgeHTML = displayBadge ? \`<span class="tt-product-badge \${badgeClass}">\${escapeHtml(displayBadge)}</span>\` : '';
`
);

replaceOnce(
  'script.js',
  `  const secondaryAction = hasVariants
    ? \`<a href="\${productHref}" class="tt-btn tt-btn-sm tt-btn-outline">\${options.related ? 'Opciones' : 'Elegir opciones'}</a>\`
    : \`<button type="button" class="tt-btn tt-btn-sm tt-btn-outline tt-add-to-cart" data-id="\${safeId}" aria-label="Agregar \${escapeAttribute(p.name)} al carrito">\${options.related ? 'Agregar' : '+ Carrito'}</button>\`;
`,
  `  const secondaryAction = !inStock
    ? \`<button type="button" class="tt-btn tt-btn-sm tt-btn-outline" disabled aria-disabled="true">Agotado</button>\`
    : hasVariants
      ? \`<a href="\${productHref}" class="tt-btn tt-btn-sm tt-btn-outline">\${options.related ? 'Opciones' : 'Elegir opciones'}</a>\`
      : \`<button type="button" class="tt-btn tt-btn-sm tt-btn-outline tt-add-to-cart" data-id="\${safeId}" aria-label="Agregar \${escapeAttribute(p.name)} al carrito">\${options.related ? 'Agregar' : '+ Carrito'}</button>\`;
`
);

replaceOnce(
  'script.js',
  `      const matches = productPool.filter(isFeaturable).filter(p =>
        searchable(p.name).includes(q) ||
        searchable(p.cat || p.category).includes(q) ||
        searchable(p.desc || p.description).includes(q) ||
        searchable((p.tags || []).join(' ')).includes(q) ||
        searchable(JSON.stringify(p.variants || {})).includes(q)
      ).slice(0, SEARCH_RESULTS_LIMIT);
`,
  `      const visiblePool = productPool.filter(p =>
        window.TintinCatalogPolicy?.isCatalogVisible
          ? window.TintinCatalogPolicy.isCatalogVisible(p)
          : p.active !== false && hasValidName(p) && Number(p.price) > 0
      );
      const orderedPool = window.TintinCatalogMerchandising?.sortCatalogProducts
        ? window.TintinCatalogMerchandising.sortCatalogProducts(visiblePool)
        : visiblePool;
      const matches = orderedPool.filter(p =>
        searchable(p.name).includes(q) ||
        searchable(p.cat || p.category).includes(q) ||
        searchable(p.desc || p.description).includes(q) ||
        searchable((p.tags || []).join(' ')).includes(q) ||
        searchable(JSON.stringify(p.variants || {})).includes(q)
      ).slice(0, SEARCH_RESULTS_LIMIT);
`
);

replaceOnce(
  'script.js',
  `              <div class="tt-search-result-price">\${formatPrice(p.price)}</div>
`,
  `              <div class="tt-search-result-price">\${formatPrice(p.price)}\${isInStock(p) ? '' : ' · Agotado'}</div>
`
);

console.log('Superficies públicas de productos alineadas correctamente.');
