import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const store = fs.readFileSync(path.join(root, 'js/core/store/estado-productos.js'), 'utf8');
const publicApiClient = fs.readFileSync(path.join(root, 'js/core/firebase/catalogo-publico-api.js'), 'utf8');
const publicApi = fs.readFileSync(path.join(root, 'functions/api/public-catalog.js'), 'utf8');

function functionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `No se encontró ${startMarker}`);
  assert.notEqual(end, -1, `No se encontró ${endMarker}`);
  return source.slice(start, end);
}

test('Producto tiene fallback público individual y acotado', () => {
  assert.match(publicApiClient, /export async function fetchPublicProduct\(id\)/);
  assert.match(publicApiClient, /AbortController/);
  assert.match(publicApiClient, /TIMEOUT_MS\s*=\s*8000/);
  assert.match(publicApi, /firestoreAdminGet\(env, `products\/\$\{productId\}`\)/);
  assert.match(publicApi, /item:\s*null/);
  assert.match(publicApi, /\?resource=' \+ resource \+ \(productId \? '&id='/);
});

test('La ficha no descarga el catálogo completo ni emite error antes de agotar fallback', () => {
  const productFlow = functionBlock(
    store,
    'async function startProductRealtime(id)',
    'export async function loadProductPage'
  );

  assert.match(productFlow, /fetchSingleProductFromEdge\(normalizedId\)/);
  assert.match(productFlow, /edgeResultPromise/);
  assert.match(productFlow, /const appCheckAvailable = await appCheckReady/);
  assert.doesNotMatch(productFlow, /loadAllProducts\(/);
  assert.doesNotMatch(productFlow, /tintin:products-error/);

  assert.match(store, /ensureProductsForCurrentPage\(\)\.catch\(error => \{\s*window\.dispatchEvent\(new CustomEvent\('tintin:products-error'/s);
});
