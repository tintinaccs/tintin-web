import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const store = fs.readFileSync(path.join(root, 'js/core/store/estado-productos.js'), 'utf8');
const productPage = fs.readFileSync(path.join(root, 'tienda.js'), 'utf8');
const publicApi = fs.readFileSync(path.join(root, 'functions/api/public-catalog.js'), 'utf8');

function functionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `No se encontró ${startMarker}`);
  assert.notEqual(end, -1, `No se encontró ${endMarker}`);
  return source.slice(start, end);
}

test('Producto tiene fallback público individual y acotado', () => {
  const edgeFetch = functionBlock(
    store,
    'async function fetchSingleProductFromEdge(id)',
    'async function fetchRelatedProducts'
  );

  assert.match(store, /PUBLIC_CATALOG_ENDPOINT\s*=\s*'\/api\/public-catalog'/);
  assert.match(store, /PUBLIC_PRODUCT_TIMEOUT_MS\s*=\s*8000/);
  assert.match(edgeFetch, /AbortController/);
  assert.match(edgeFetch, /new URLSearchParams\(\{ resource: 'products', id: String\(id\) \}\)/);
  assert.match(edgeFetch, /signal:\s*controller\.signal/);
  assert.match(publicApi, /firestoreAdminGet\(env, `products\/\$\{productId\}`\)/);
  assert.match(publicApi, /item:\s*null/);
  assert.match(publicApi, /\?resource=' \+ resource \+ \(productId \? '&id='/);
});

test('La ficha no descarga el catálogo completo ni permite que App Check la bloquee', () => {
  const productFlow = functionBlock(
    store,
    'async function startProductRealtime(id)',
    'export async function loadProductPage'
  );

  assert.match(productFlow, /fetchSingleProductFromEdge\(normalizedId\)/);
  assert.match(productFlow, /edgeResultPromise/);
  assert.match(store, /PRODUCT_APP_CHECK_TIMEOUT_MS\s*=\s*1200/);
  assert.match(store, /function waitForProductAppCheck\(\)/);
  assert.match(store, /Promise\.race\(\[\s*Promise\.resolve\(appCheckReady\)\.catch\(\(\) => false\),\s*timeout,/s);
  assert.match(productFlow, /const appCheckAvailable = await waitForProductAppCheck\(\)/);
  assert.doesNotMatch(productFlow, /loadAllProducts\(/);
  assert.doesNotMatch(productFlow, /tintin:products-error/);

  assert.match(store, /ensureProductsForCurrentPage\(\)\.catch\(error => \{\s*window\.dispatchEvent\(new CustomEvent\('tintin:products-error'/s);
});

test('Los callbacks tardíos de otro producto no pueden modificar la ficha actual', () => {
  const productFlow = functionBlock(
    store,
    'async function startProductRealtime(id)',
    'export async function loadProductPage'
  );

  assert.match(store, /let publicProductRequestVersion = 0/);
  assert.match(store, /function isCurrentProductRequest\(id, requestVersion\)/);
  assert.match(productFlow, /const requestVersion = publicProductRequestVersion/);
  assert.match(productFlow, /if \(!isCurrentProductRequest\(normalizedId, requestVersion\)\) return;/);
  assert.match(productFlow, /if \(!isCurrentProductRequest\(normalizedId, requestVersion\)\) \{\s*settle\(\[\]\);/s);
});

test('La interfaz de Producto tiene un único plazo absoluto de salida del loading', () => {
  const productInit = functionBlock(
    productPage,
    'function initProductPage()',
    '// Product detail page: state shared across re-renders.'
  );

  assert.match(productPage, /const PRODUCT_PAGE_LOAD_DEADLINE_MS = 12000/);
  assert.match(productInit, /const deadlineAt = Date\.now\(\) \+ PRODUCT_PAGE_LOAD_DEADLINE_MS/);
  assert.match(productInit, /window\.setTimeout\(finishAtDeadline, Math\.max\(0, deadlineAt - Date\.now\(\)\)\)/);
  assert.doesNotMatch(productInit, /setTimeout\(\(\) => \{\s*cleanup\(\);\s*if \(!_pdProduct\) _showProductLoadError\(\);\s*\}, 10000\)/s);
});
