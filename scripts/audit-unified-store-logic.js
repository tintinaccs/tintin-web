'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(label, condition, problem) {
  checks.push({ label, ok: Boolean(condition), problem });
}

const policy = read('js/pages/catalog/catalog-merchandising-policy.js');
const productsStore = read('js/core/store/products-store.js');
const phase7 = read('js/pages/catalog/phase7-catalog-policy.js');
const catalog = read('catalogo.html');
const classic = read('script.js');
const compatibility = read('js/pages/catalog/catalog-stock-priority.js');

check(
  'Existe una sola política de merchandising reutilizable',
  /export function sortCatalogProducts/.test(policy) &&
    /export function isNewProduct/.test(policy) &&
    /NEW_PRODUCT_WINDOW_MS = 5 \* 24 \* 60 \* 60 \* 1000/.test(policy),
  'La prioridad y la vigencia de Nuevo no deben estar duplicadas en cada página.'
);

check(
  'Disponibles y agotados quedan separados de forma estable',
  /const available = \[\]/.test(policy) &&
    /const exhausted = \[\]/.test(policy) &&
    /return \[\.\.\.available, \.\.\.exhausted\]/.test(policy),
  'Ningún modo de orden puede volver a colocar un agotado entre productos disponibles.'
);

check(
  'La actividad considera creación, edición y reposición',
  /catalogActivityAt/.test(policy) &&
    /restockedAt/.test(policy) &&
    /updatedAt/.test(policy) &&
    /productCreatedAtMillis/.test(policy),
  'Una edición o reposición debe promover el producto incluso después de recargar.'
);

check(
  'products-store conserva timestamps y aplica el orden antes de publicar',
  /catalog-merchandising-policy/.test(productsStore) &&
    /createdAt: timestampToMillis/.test(productsStore) &&
    /updatedAt: timestampToMillis/.test(productsStore) &&
    /return sortCatalogProducts\(normalized\)/.test(productsStore),
  'El orden no puede depender solamente de un listener visual posterior.'
);

check(
  'La caché conserva la actividad del producto',
  /createdAt: product\.createdAt/.test(productsStore) &&
    /updatedAt: product\.updatedAt/.test(productsStore) &&
    /restockedAt: product\.restockedAt/.test(productsStore),
  'Recargar desde caché no debe perder la posición ni la etiqueta Nuevo.'
);

check(
  'La política pública de Fase 7 usa el mismo orden',
  /sortCatalogProducts/.test(phase7) &&
    /sortProducts: sortCatalogProducts/.test(phase7) &&
    !/\.sort\(\(a, b\) => a\.name\.localeCompare/.test(phase7),
  'Fase 7 no debe volver a ordenar alfabéticamente después de products-store.'
);

check(
  'El catálogo y todas sus categorías usan el contrato único',
  /TintinCatalogMerchandising\?\.sortCatalogProducts/.test(catalog) &&
    /\{ mode: sort \}/.test(catalog),
  'Todos, Anillos, Relojes y las demás ramas deben responder igual.'
);

check(
  'Los modos de precio y nombre mantienen agotados al final',
  /compareByMode/.test(policy) &&
    /available\.sort\(comparator\)/.test(policy) &&
    /exhausted\.sort\(comparator\)/.test(policy),
  'El selector Ordenar por no puede romper la regla de disponibilidad.'
);

check(
  'La etiqueta Nuevo se calcula por fecha y no queda permanente',
  /TintinCatalogMerchandising\?\.isNewProduct/.test(catalog) &&
    /TintinCatalogMerchandising\?\.isNewProduct/.test(classic),
  'Nuevo debe expirar automáticamente después de cinco días.'
);

check(
  'La compatibilidad antigua ya no guarda prioridad solo en memoria',
  /Compatibilidad: la prioridad ya no vive en memoria/.test(compatibility) &&
    !/previousStockById|restockedPriorityIds|setInterval/.test(compatibility),
  'Una reposición debe mantener el mismo orden después de cerrar o recargar la página.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.label}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de lógica unificada fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de lógica unificada correcta (${checks.length} comprobaciones).`);
