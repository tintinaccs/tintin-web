import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const productStore = read('js/core/store/estado-productos.js');
const catalogHtml = read('catalogo.html');
const catalogRuntime = read('js/pages/catalog/mantenimiento-catalogo.js');
const publicCatalogApi = read('functions/api/public-catalog.js');
const collectionsState = read('js/pages/collections/estado-colecciones.js');
const collectionsPresentation = read('js/pages/collections/presentacion-colecciones.js');
const checkoutHealth = read('cloudflare/checkout-operational-health.js');
const systemHealth = read('cloudflare/system-health.js');
const systemHealthUi = read('js/admin/diagnostics/estado-ecosistema-admin.js');
const checkoutRunbook = read('docs/runbook-conciliacion-checkout.md');
const collectionsPolicy = read('docs/politica-colecciones-publicas.md');
const catalogScalePolicy = read('docs/politica-escalado-catalogo.md');

test('catálogo público permanece acotado y usa la ruta edge/cache actual', () => {
  assert.match(productStore, /\(\?:catalogo\|collections\)[\s\S]{0,180}loadAllProducts\(options\)/);
  assert.match(productStore, /startPublicProductsRealtime[\s\S]{0,420}publicProductsReady = loadAllProducts\(\)/);
  assert.match(publicCatalogApi, /resource === 'products' \? 1000 : 300/);
  assert.match(productStore, /limit\(1000\)/);
});

test('fallo de catálogo termina en error recuperable sin convertirlo en vacío', () => {
  assert.match(catalogHtml, /Catálogo no disponible/);
  assert.match(catalogHtml, /data-state="error"/);
  assert.match(catalogHtml, /TintinProductsStore\?\.loadAll\?\.\(\{ force: true \}\)/);
  assert.match(catalogHtml, /tintin:products-error/);
  assert.match(catalogRuntime, /window\.addEventListener\('online'/);
  assert.match(catalogRuntime, /window\.addEventListener\('offline'/);
  assert.match(catalogRuntime, /visibilitychange/);
  assert.match(catalogRuntime, /pageshow/);
  assert.match(catalogRuntime, /history\.replaceState/);
});

test('colecciones públicas conservan vacío, visibilidad y productos comprables', () => {
  assert.match(productStore, /product\.active !== false[\s\S]{0,180}Number\(product\.price\) > 0/);
  assert.match(collectionsState, /collections\.filter\(item => item\.visible !== false\)/);
  assert.match(collectionsPresentation, /No hay colecciones disponibles todavía/);
  assert.match(collectionsPresentation, /encodeURIComponent\(clean\(slug\)\)/);
});

test('checkout expone conciliación operativa sin PII y con runbook', () => {
  assert.match(checkoutHealth, /paidWithoutEmail/);
  assert.match(checkoutHealth, /paidAtRiskSheets/);
  assert.match(checkoutHealth, /alerts: alerts\.slice\(0, 20\)/);
  assert.doesNotMatch(checkoutHealth, /userEmail|userPhone|address/);
  assert.match(systemHealth, /inspectCheckoutOperationalHealth/);
  assert.match(systemHealth, /checkoutHealthy/);
  assert.match(systemHealthUi, /Checkout \/ conciliación/);
  assert.match(systemHealthUi, /sin correo confirmado/);
  assert.match(checkoutRunbook, /requestId/);
  assert.match(checkoutRunbook, /pago huérfano/i);
});

test('políticas de crecimiento y slugs quedan explícitas sin fingir paginación', () => {
  assert.match(collectionsPolicy, /Colecciones vacías/);
  assert.match(collectionsPolicy, /Slugs duplicados/);
  assert.match(catalogScalePolicy, /800 productos/);
  assert.match(catalogScalePolicy, /no debe aumentarse/i);
  assert.match(catalogScalePolicy, /cursor\/paginación server-side/i);
});
