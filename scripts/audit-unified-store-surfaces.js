'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(label, condition, problem) {
  checks.push({ label, ok: Boolean(condition), problem });
}

const products = read('js/core/store/products-store.js');
const storefront = read('script.js');
const catalog = read('catalogo.html');
const policy = read('js/pages/catalog/catalog-merchandising-policy.js');

check(
  'Catálogo y colecciones reciben la misma lista visible y ordenada',
  /renderProductsGrid\('colls-products-grid', normalized\)/.test(products) &&
    /sortCatalogProducts\(normalized\)/.test(products) &&
    /TintinCatalogMerchandising\?\.sortCatalogProducts/.test(catalog),
  'Colecciones no puede ocultar agotados ni aplicar un orden distinto del catálogo principal.'
);

check(
  'La portada conserva solamente productos comprables',
  /const featuredProducts = normalized\.filter/.test(products) &&
    /renderProductsGrid\('products-grid', featuredProducts\.slice\(0, 5\)\)/.test(products),
  'Inicio puede promocionar disponibles, mientras Colecciones representa el catálogo completo.'
);

check(
  'Las tarjetas compartidas bloquean la compra sin stock',
  /const inStock = isInStock\(p\)/.test(storefront) &&
    /displayBadge = !inStock \? 'Agotado'/.test(storefront) &&
    /disabled aria-disabled="true">Agotado/.test(storefront),
  'Una tarjeta agotada de Colecciones o Relacionados no debe mostrar un botón de compra activo.'
);

check(
  'La búsqueda global incluye agotados al final',
  /const visiblePool = productPool\.filter/.test(storefront) &&
    /TintinCatalogPolicy\?\.isCatalogVisible/.test(storefront) &&
    /TintinCatalogMerchandising\?\.sortCatalogProducts/.test(storefront) &&
    /Agotado/.test(storefront),
  'La búsqueda debe representar productos visibles, ordenarlos igual y señalar cuáles no se pueden comprar.'
);

check(
  'Nuevo nunca reemplaza el estado Agotado',
  /const isNew = Boolean\(inStock &&/.test(storefront) &&
    /displayBadge = !inStock \? 'Agotado' : \(isNew \? 'Nuevo'/.test(storefront) &&
    /NEW_PRODUCT_WINDOW_MS/.test(policy),
  'La disponibilidad es el estado prioritario y Nuevo debe expirar por fecha.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.label}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de superficies fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de superficies correcta (${checks.length} comprobaciones).`);
