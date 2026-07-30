import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'scripts/audit-admin-products-media.js');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`No se encontró ${label}.`);
  source = source.replace(before, after);
}

replaceOnce(
  "const productsStore = read('js/products-store.js');\nconst sheetsSyncFunction",
  "const productsStore = read('js/products-store.js');\nconst phase7Policy = read('js/phase7-catalog-policy.js');\nconst sheetsSyncFunction",
  'la carga de política Fase 7'
);

replaceOnce(
  "check(\n  'Guardar producto valida nombre, categoría y precio obligatorios',\n  /if \\(!name \\|\\| !category \\|\\| !price\\)/.test(adminApp),\n  'Nombre, categoría y precio deben ser obligatorios antes de escribir en Firestore.'\n);",
  "check(\n  'Guardar producto valida nombre, categoría y precio obligatorios',\n  /categoryExists = _allCollections\\.some/.test(adminApp) &&\n    /!Number\\.isInteger\\(price\\) \\|\\| price <= 0/.test(adminApp) &&\n    /price > 1000000000/.test(adminApp),\n  'Nombre, una colección existente y un precio entero positivo deben ser obligatorios antes de escribir en Firestore.'\n);",
  'la validación histórica de nombre, categoría y precio'
);

replaceOnce(
  "check(\n  'El stock vacío se guarda como null (no controlado), distinto de 0 (agotado)',\n  /if \\(raw === ''\\) return null;/.test(adminApp),\n  'Un stock vacío no debe confundirse con 0; debe quedar como null (ilimitado).'\n);",
  "check(\n  'El stock vacío se guarda como null (no controlado), distinto de 0 (agotado)',\n  /stockRaw === '' \\? null : Number\\(stockRaw\\)/.test(adminApp) &&\n    /stock: stockValue/.test(adminApp) &&\n    /stockValue < 0 \\|\\| stockValue > 1000000/.test(adminApp),\n  'Un stock vacío debe quedar como null y un stock informado debe ser un entero acotado, incluido 0 como agotado.'\n);",
  'el contrato histórico de stock vacío'
);

replaceOnce(
  "check(\n  'El carrito descarta productos borrados o desactivados y refresca precio/nombre',\n  /function syncCartWithCatalog/.test(storefront) &&\n    /if \\(!live \\|\\| live\\.active === false\\) return null;/.test(storefront),\n  'syncCartWithCatalog debe quitar del carrito lo que ya no existe o quedó inactivo.'\n);",
  "check(\n  'El carrito descarta productos borrados, desactivados, agotados o inválidos y refresca sus datos',\n  /function syncCartWithCatalog/.test(storefront) &&\n    /TintinCatalogPolicy\\?\\.reconcileCart/.test(storefront) &&\n    /export function reconcileCatalogCart/.test(phase7Policy) &&\n    /variantIsValid/.test(phase7Policy),\n  'syncCartWithCatalog debe delegar en la política que valida existencia, visibilidad, stock, precio y variante.'\n);",
  'el contrato histórico del carrito'
);

fs.writeFileSync(file, source);
fs.rmSync(import.meta.filename);
console.log('Contratos de productos y carrito actualizados para la Fase 7.');
