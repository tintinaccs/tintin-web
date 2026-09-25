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
