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

test('catálogo y colecciones consumen productos en realtime sin consultas ilimitadas', () => {
  assert.match(productStore, /catalogo\|collections[\s\S]{0,180}startPublicProductsRealtime\(\)/);
  assert.match(productStore, /limit\(1000\)/);
  assert.match(publicCatalogApi, /resource === 'products' \? 1000 : 300/);
  assert.doesNotMatch(productStore, /collection\(db, 'products'\)\s*\)/);
});

test('fallo de catálogo es error recuperable y no un vacío falso', () => {
  assert.match(catalogHtml, /data-state="error"/);
  assert.match(catalogHtml, /Catálogo no disponible/);
  assert.match(catalogHtml, /TintinProductsStore\?\.loadAll\?\.\(\{ force: true \}\)/);
  assert.match(catalogRuntime, /tintin:products-error/);
  assert.match(catalogRuntime, /showCatalogError/);
  assert.match(catalogRuntime, /Última sincronización/);
  assert.match(catalogRuntime, /window\.addEventListener\('online',[\s\S]{0,200}refreshCatalog\(\)/);
});

test('colecciones publicadas preservan vacío y excluyen productos eliminados', () => {
  assert.match(collectionsPresentation, /product\?\.active !== false/);
  assert.match(collectionsPresentation, /No hay colecciones disponibles todavía\.'[\s\S]{0,40}false/);
  assert.match(collectionsState, /function uniquePublishedCollections/);
  assert.match(collectionsState, /Slug publicado duplicado ignorado/);
  assert.match(collectionsState, /latestVisibleCollections = uniquePublishedCollections\(collections\)/);
});

test('checkout expone conciliación operativa sin PII y con runbook', () => {
  assert.match(checkoutHealth, /paidWithoutEmail/);
  assert.match(checkoutHealth, /paidAtRiskSheets/);
  assert.match(checkoutHealth, /alerts: alerts\.slice\(0, 20\)/);
  assert.doesNotMatch(checkoutHealth, /userEmail|userPhone|address/);
  assert.match(systemHealth, /inspectCheckoutOperationalHealth/);
  assert.match(systemHealthUi, /Checkout \/ conciliación/);
  assert.match(systemHealthUi, /pago\(s\) aprobado\(s\) sin correo confirmado/);
  assert.match(checkoutRunbook, /requestId/);
  assert.match(checkoutRunbook, /pago huérfano/i);
});

test('las políticas pendientes quedan explícitas y no convierten límites en falsa paginación', () => {
  assert.match(collectionsPolicy, /Colecciones vacías/);
  assert.match(collectionsPolicy, /Slugs duplicados/);
  assert.match(catalogScalePolicy, /800 productos/);
  assert.match(catalogScalePolicy, /no debe aumentarse/i);
  assert.match(catalogScalePolicy, /cursor\/paginación server-side/i);
});
