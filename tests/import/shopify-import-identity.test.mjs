import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizeImportRecords, stableProductDocumentId } from '../../js/core/store/shopify-import-core.mjs';
import { reconcileShopifyImportIdentities } from '../../js/core/store/shopify-import-identity.mjs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const record = (overrides = {}) => ({
  product: {
    name: 'Reloj Aurora',
    importFingerprint: 'shopify:reloj-aurora',
    sourceMetadata: { platform: 'shopify', handle: 'reloj-aurora' },
    variants: [{ sku: 'AUR-001' }],
    ...overrides,
  },
  errors: [],
  warnings: [],
});

test('un Handle Shopify ya importado bajo otro ID se omite y conserva el documento existente', () => {
  const [result] = reconcileShopifyImportIdentities(
    [record()],
    [{ id: 'legacy-doc-42', name: 'Reloj Aurora', shopifyHandle: 'reloj-aurora' }],
  );
  assert.equal(result.identityStatus, 'MATCHED_EXISTING');
  assert.equal(result.existingProductId, 'legacy-doc-42');
  assert.equal(result.duplicate, true);
  assert.deepEqual(result.errors, []);
  assert.equal(summarizeImportRecords([result]).duplicate, 1);
});

test('una coincidencia por nombre o SKU sin Handle requiere revisión y bloquea aplicar', () => {
  const [result] = reconcileShopifyImportIdentities(
    [record({ sourceMetadata: { platform: 'shopify', handle: 'reloj-aurora-nuevo' } })],
    [{ id: 'legacy-doc-1', name: 'Reloj Aurora', variants: [{ sku: 'AUR-001' }] }],
  );
  assert.equal(result.identityStatus, 'REVIEW_REQUIRED');
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Confirmá si es el mismo/);
  assert.equal(summarizeImportRecords([result]).invalid, 1);
});

test('una identidad Shopify ambigua entre varios documentos no se salta automáticamente', () => {
  const [result] = reconcileShopifyImportIdentities(
    [record()],
    [
      { id: 'legacy-a', shopifyHandle: 'reloj-aurora' },
      { id: 'legacy-b', sourceMetadata: { platform: 'shopify', handle: 'reloj-aurora' } },
    ],
  );
  assert.equal(result.identityStatus, 'REVIEW_REQUIRED');
  assert.equal(result.duplicate, false);
  assert.match(result.errors[0], /coincide con varios productos/);
});

test('reconciliar un preview restaurado reemplaza su diagnóstico anterior sin duplicar errores', () => {
  const catalog = [{ id: 'legacy-1', name: 'Reloj Aurora', variants: [{ sku: 'AUR-001' }] }];
  const first = reconcileShopifyImportIdentities([record({ sourceMetadata: { platform: 'shopify', handle: 'reloj-aurora-nuevo' } })], catalog);
  const restored = reconcileShopifyImportIdentities(first, catalog);
  assert.equal(restored[0].errors.length, 1);
  assert.equal(restored[0].identityStatus, 'REVIEW_REQUIRED');
});

test('producto sin Handle, fingerprint, SKU o nombre coincidentes queda como nuevo', () => {
  const fresh = record({ name: 'Collar Boreal', importFingerprint: 'shopify:collar-boreal', sourceMetadata: { platform: 'shopify', handle: 'collar-boreal' }, variants: [{ sku: 'BOR-999' }] });
  const [result] = reconcileShopifyImportIdentities([fresh], [{ id: 'old', name: 'Aro Sol', shopifyHandle: 'aro-sol', variants: [{ sku: 'SOL-100' }] }]);
  assert.equal(result.identityStatus, 'NEW');
  assert.equal(result.errors.length, 0);
  assert.equal(result.duplicate, false);
  assert.equal(stableProductDocumentId(fresh.product.importFingerprint).startsWith('imp_'), true);
});

test('el preview Admin concilia el catálogo de Firestore y las filas reconocidas no se aplican', () => {
  const importer = read('js/admin/importacion-admin.js');
  const apply = read('js/admin/aplicar-importacion-admin.js');
  assert.match(importer, /extension === 'csv' \? await readCollection\('products'\)/);
  assert.match(importer, /reconcileShopifyImportIdentities\(grouped\.products, state\.existingProducts\)/);
  assert.match(importer, /existingProducts: state\.existingProducts/);
  assert.match(importer, /records = reconcileShopifyImportIdentities\(saved\.records, existingProducts\)/);
  assert.match(apply, /state\.records\.filter\(record => !record\.errors\?\.length && !record\.duplicate\)/);
});
