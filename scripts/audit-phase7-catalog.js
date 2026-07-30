'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const policy = read('js/phase7-catalog-policy.js');
const products = read('js/products-store.js');
const storefront = read('script.js');
const catalog = read('catalogo.html');
const admin = read('js/admin-app.js');
const sheets = read('functions/api/sheets-product-sync.js');
const loader = read('js/page-maintenance-loader.js');
const pkg = JSON.parse(read('package.json'));

check(
  'Existe una política única de producto comprable',
  /export function isPurchasable/.test(policy) &&
    /p\.active !== false/.test(policy) &&
    /p\.price > 0/.test(policy) &&
    /p\.stock == null \|\|/.test(policy) &&
    /categoryIsVisible/.test(policy),
  'La tienda debe validar estado, nombre, categoría, precio, stock y colección visible desde un único módulo.'
);

check(
  'Productos agotados u ocultos no reaparecen por URL directa',
  /installDetailGuard/.test(policy) &&
    /_showProductNotFound/.test(policy) &&
    /TintinCatalogPolicy\?\.isPurchasable/.test(products) &&
    /function _renderProductDetail\(product\)[\s\S]{0,220}TintinCatalogPolicy/.test(storefront),
  'La ficha directa debe usar la misma política que las listas públicas.'
);

check(
  'Las colecciones ocultas también ocultan sus productos',
  /loadCollections\(\)/.test(policy) &&
    /visibleCollectionSlugs = new Set/.test(policy) &&
    /phase7-collections/.test(policy),
  'La visibilidad de la colección debe formar parte de la política pública.'
);

check(
  'La caché conserva descripción, tags, variantes e imágenes',
  /tags: Array\.isArray\(d\.tags\)/.test(products) &&
    /description: product\.description/.test(products) &&
    /tags: product\.tags/.test(products) &&
    /variants: product\.variants/.test(products) &&
    /imagesExtra: product\.imagesExtra/.test(products),
  'Una recarga desde caché no debe degradar búsqueda, variantes ni galería.'
);

check(
  'La búsqueda global y la del catálogo incluyen tags y variantes',
  /searchable\(\(p\.tags \|\| \[\]\)\.join\(' '\)\)/.test(storefront) &&
    /searchable\(JSON\.stringify\(p\.variants \|\| \{\}\)\)/.test(storefront) &&
    /normalizeSearch\(\(p\.tags \|\| \[\]\)\.join\(' '\)\)/.test(catalog) &&
    /normalizeSearch\(JSON\.stringify\(p\.variants \|\| \{\}\)\)/.test(catalog),
  'La búsqueda debe encontrar productos por términos del Admin, no solo por nombre.'
);

check(
  'La búsqueda pública excluye productos no comprables',
  /productPool\.filter\(isFeaturable\)/.test(storefront) &&
    /window\.TintinCatalogPolicy\?\.isPurchasable/.test(storefront),
  'Resultados globales no deben enlazar productos agotados, ocultos o inválidos.'
);

check(
  'Las variantes se eligen en la ficha antes de agregar',
  /const hasVariants = window\.TintinCatalogPolicy/.test(catalog) &&
    /Elegir opciones/.test(catalog) &&
    /_pdValidateVariants/.test(storefront),
  'Una tarjeta con variantes no debe agregar una combinación incompleta.'
);

check(
  'El carrito se reconcilia con precio, stock, variante y visibilidad reales',
  /export function reconcileCatalogCart/.test(policy) &&
    /variantIsValid/.test(policy) &&
    /Math\.min\(max/.test(policy) &&
    /TintinCatalogPolicy\?\.reconcileCart/.test(storefront),
  'El carrito debe eliminar líneas inválidas y limitar cantidad al stock actual.'
);

check(
  'El Admin valida límites numéricos y categorías existentes',
  /price > 1000000000/.test(admin) &&
    /stockValue > 1000000/.test(admin) &&
    /priceBeforeValue <= price/.test(admin) &&
    /categoryExists = _allCollections\.some/.test(admin),
  'No deben guardarse precios, stock o categorías fuera del contrato público.'
);

check(
  'El Admin acepta valores de variante separados por coma y elimina variantes antiguas',
  /split\(','\)\.map\(value => value\.trim\(\)\)/.test(admin) &&
    /variants: deleteField\(\)/.test(admin) &&
    /vObj\[key\]\.length < 50/.test(admin),
  'Editar o limpiar variantes debe producir exactamente el estado esperado en Firestore.'
);

check(
  'Los tags se normalizan y tienen límites',
  /new Set\(tagsRaw/.test(admin) && /slice\(0, 30\)/.test(admin),
  'El Admin debe deduplicar y limitar tags antes de sincronizar.'
);

check(
  'La sincronización con Sheets sigue autenticada y acotada',
  /productIds\.map/.test(sheets) &&
    /slice\(0, 100\)/.test(sheets) &&
    /payload\.idToken/.test(sheets) &&
    /action: 'syncProducts'/.test(sheets) &&
    /await pushProductsToSheets\(\[docId\]\)/.test(admin),
  'Cada cambio debe notificar al motor de Sheets con token y lotes limitados.'
);

check(
  'La política se carga antes de products-store',
  /^import '\.\/phase7-catalog-policy\.js/.test(loader),
  'El filtro debe estar instalado antes del primer evento de productos.'
);

check(
  'La Fase 7 forma parte de audit:final',
  pkg.scripts['audit:phase7-catalog'] === 'node scripts/audit-phase7-catalog.js' &&
    pkg.scripts['audit:final'].includes('audit:phase7-catalog'),
  'La auditoría de catálogo debe ejecutarse en cada cierre integral.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría Fase 7 fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría Fase 7: todo correcto (${checks.length} comprobaciones).`);
