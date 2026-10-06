import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('cloudflare/borrado-global-catalogo.js', 'utf8');

test('fallas de referencias sociales no bloquean el borrado canónico de productos', () => {
  assert.match(source, /optionalReferences\('reviews',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('reviewRecords',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('likeRecords',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('reviewLikeProducts',\s*runProductIdQuery/);
});

test('una sincronización de Sheets encolada no se informa como sincronizada', () => {
  const fn = source.match(/async function syncProductsToSheets\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, 'syncProductsToSheets no encontrado');
  assert.doesNotMatch(fn, /return \{[^}]*queued: true/, 'encolar debe lanzar error para que la etapa quede pendiente');
  assert.match(fn, /queueCatalogSheetSync\(env, ids, error, actor\)[\s\S]*throw new Error/);
});

test('los productos que se conservan al borrar colecciones no reciben tombstones en Sheets', () => {
  const fn = source.slice(source.indexOf('export async function deleteCollectionsGlobally('));
  assert.ok(fn.length > 0, 'deleteCollectionsGlobally no encontrado');
  assert.match(fn, /productMode !== 'delete'[\s\S]*syncProductsToSheets\(env, idToken, affectedIds, actor, \{ deleted: false \}\)/);
  assert.match(source, /deleted\s*\?\s*await syncDeletedProductsPayloadWithRetry[\s\S]*:\s*await syncProductsPayloadWithRetry/);
});

test('el borrado de productos elimina Firestore antes de esperar a Google Sheets', () => {
  const fn = source.slice(source.indexOf('export async function deleteProductsGlobally('), source.indexOf('export async function deleteCollectionsGlobally('));
  const commit = fn.indexOf('await commitWrites(env, [...deletePaths]');
  assert.ok(commit > 0, 'commit de borrado no encontrado');
  assert.ok(commit < fn.indexOf('syncSocialPurgeToSheets(env, social)'), 'el espejo social no debe demorar el borrado canónico');
  assert.ok(commit < fn.indexOf('syncProductsToSheets(env, idToken, ids, actor)'), 'la hoja Productos no debe demorar el borrado canónico');
});

test('con deferProductsSheet la hoja Productos se encola y solo se sincroniza en línea si no se pudo encolar', () => {
  const fn = source.slice(source.indexOf('export async function deleteProductsGlobally('), source.indexOf('export async function deleteCollectionsGlobally('));
  assert.match(fn, /if \(deferProductsSheet\) productsQueued = await queueDeletedProductsSheet\(env, ids, actor\)/);
  assert.match(fn, /if \(!productsQueued\) \{[\s\S]*syncProductsToSheets\(env, idToken, ids, actor\)/);
  assert.match(fn, /result\.sheets = \{ products: productsSheets, productsQueued, social: socialSheet\.ok \}/);
});

test('la API de borrado de productos responde sin sonda previa y drena la cola después de responder', () => {
  const api = fs.readFileSync('functions/api/admin-catalog-delete.js', 'utf8');
  assert.match(api, /const deferProductsSheet = action === 'deleteProducts' && typeof context\.waitUntil === 'function'/);
  assert.match(api, /if \(!deferProductsSheet\) \{\s*try \{\s*await preflightProductsSheet/);
  assert.match(api, /if \(result\?\.sheets\?\.productsQueued\) \{\s*context\.waitUntil\(retryPendingCatalogSheets\(env, idToken/);
});

test('el panel informa la hoja Productos encolada sin dejar la operación en advertencia', () => {
  const ui = fs.readFileSync('js/admin/products/borrado-global-catalogo-admin.js', 'utf8');
  assert.match(ui, /if \(result\?\.sheets\?\.productsQueued === true\) \{[\s\S]*?ctx\.ok\('sheets-products'/);
});
