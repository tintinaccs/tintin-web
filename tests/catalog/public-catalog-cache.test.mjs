import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('functions/api/public-catalog.js', 'utf8');
const products = fs.readFileSync('js/core/store/estado-productos.js', 'utf8');
const collections = fs.readFileSync('js/pages/collections/estado-colecciones.js', 'utf8');
const routes = fs.readFileSync('_routes.json', 'utf8');

test('catálogo público pasa por caché edge y usa lista blanca', () => {
  assert.match(api, /caches\.default/);
  assert.match(api, /s-maxage=60/);
  assert.match(api, /PRODUCT_FIELDS/);
  assert.match(api, /COLLECTION_FIELDS/);
  assert.match(api, /pickKnownFields/);
  assert.match(routes, /\/api\/public-catalog/);
});

test('clientes prefieren edge y conservan fallback Firestore', () => {
  assert.match(products, /fetchPublicCatalogResource\('products'\)/);
  assert.match(products, /fetchAllProductsFromRest\(\)/);
  assert.match(products, /fetchAllProductsFromSdk\(\)/);
  assert.match(collections, /fetchPublicCatalogResource\('collections'\)/);
  assert.match(collections, /listPublicCollectionRest\('collections'/);
});

test('catálogo comercial no abre automáticamente el listener completo', () => {
  assert.doesNotMatch(products, /catalogo\|collections[\s\S]{0,160}return startPublicProductsRealtime\(\)/);
});
