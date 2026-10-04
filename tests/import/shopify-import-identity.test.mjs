import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizeImportRecords, stableProductDocumentId } from '../../js/core/store/shopify-import-core.mjs';
import { reconcileShopifyImportIdentities, confirmDistinctShopifyImport } from '../../js/core/store/shopify-import-identity.mjs';

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
  assert.match(importer, /async function refreshCatalogIdentitySnapshot\(\)[\s\S]*?await readCollection\('products'\)/);
  assert.match(apply, /await refreshCatalogIdentitySnapshot\(\)/);
  assert.ok(apply.indexOf('await refreshCatalogIdentitySnapshot()') < apply.indexOf("action: 'transition', jobId: state.jobId, status: 'RUNNING'"), 'la verificación fresca debe ocurrir antes de marcar el job RUNNING');
  assert.ok(apply.indexOf('await refreshCatalogIdentitySnapshot()') < apply.indexOf('await copyShopifyMedia(records)'), 'la verificación fresca debe ocurrir antes de copiar imágenes o escribir el catálogo');
  assert.match(apply, /El catálogo cambió desde que cargaste el CSV/);
});

const reviewCatalog = () => [{ id: 'legacy-1', name: 'Reloj Aurora', shopifyHandle: 'reloj-aurora-anterior', price: 100,
  imageUrl: 'https://images.test/old.webp', variants: [{ sku: 'AUR-001' }] }];

test('la decisión expresa permite un producto distinto solo con la misma revisión fresca', () => {
  const catalog = reviewCatalog();
  const before = JSON.stringify(catalog);
  const [pending] = reconcileShopifyImportIdentities([record({ price: 150 })], catalog);
  const confirmed = confirmDistinctShopifyImport(pending);
  assert.equal(pending.identityDecision, undefined);
  const [fresh] = reconcileShopifyImportIdentities([confirmed], catalog);
  assert.equal(fresh.identityStatus, 'NEW_CONFIRMED_DISTINCT');
  assert.equal(fresh.duplicate, false);
  assert.deepEqual(fresh.errors, []);
  assert.equal(JSON.stringify(catalog), before);
  const [restored] = reconcileShopifyImportIdentities(JSON.parse(JSON.stringify([fresh])), catalog);
  assert.equal(restored.identityStatus, 'NEW_CONFIRMED_DISTINCT');
});

test('una decisión pendiente o inventada nunca elimina la revisión', () => {
  const [pending] = reconcileShopifyImportIdentities([record()], reviewCatalog());
  assert.equal(reconcileShopifyImportIdentities([pending], reviewCatalog())[0].identityStatus, 'REVIEW_REQUIRED');
  const forged = { ...pending, identityDecision: { type: 'CREATE_DISTINCT', reviewKey: 'inventado' } };
  assert.equal(reconcileShopifyImportIdentities([forged], reviewCatalog())[0].identityStatus, 'REVIEW_REQUIRED');
});

test('precio, imagen, SKU, fuente y nuevos candidatos cambian la revisión y vuelven a bloquear', () => {
  const catalog = reviewCatalog();
  const [pending] = reconcileShopifyImportIdentities([record({ price: 150 })], catalog);
  const confirmed = confirmDistinctShopifyImport(pending);
  const changedCatalogs = [
    [{ ...catalog[0], price: 101 }], [{ ...catalog[0], imageUrl: 'https://images.test/new.webp' }],
    [{ ...catalog[0], variants: [{ sku: 'AUR-002' }] }], [...catalog, { ...catalog[0], id: 'legacy-2' }]
  ];
  for (const changed of changedCatalogs) assert.equal(reconcileShopifyImportIdentities([confirmed], changed)[0].identityStatus, 'REVIEW_REQUIRED');
  assert.equal(reconcileShopifyImportIdentities([{ ...confirmed, product: { ...confirmed.product, price: 151 } }], catalog)[0].identityStatus, 'REVIEW_REQUIRED');
});

test('confirmar distinto nunca pisa una identidad exacta ni oculta otras validaciones', () => {
  const [pending] = reconcileShopifyImportIdentities([{ ...record(), errors: ['Precio inválido'] }], reviewCatalog());
  const confirmed = confirmDistinctShopifyImport(pending);
  const [stillInvalid] = reconcileShopifyImportIdentities([confirmed], reviewCatalog());
  assert.deepEqual(stillInvalid.errors, ['Precio inválido']);
  const [exact] = reconcileShopifyImportIdentities([confirmed], [{ ...reviewCatalog()[0], shopifyHandle: 'reloj-aurora' }]);
  assert.equal(exact.identityStatus, 'MATCHED_EXISTING');
  assert.equal(exact.existingProductId, 'legacy-1');
  assert.equal(exact.duplicate, true);
  const [ambiguous] = reconcileShopifyImportIdentities([confirmed], [{ id:'a', shopifyHandle:'reloj-aurora' }, { id:'b', shopifyHandle:'reloj-aurora' }]);
  assert.throws(() => confirmDistinctShopifyImport(ambiguous), /no permite/);
});

test('el orden de candidatos no invalida una decisión y los duplicados de la fuente siguen omitidos', () => {
  const catalog = [...reviewCatalog(), { ...reviewCatalog()[0], id: 'legacy-2' }];
  const [pending] = reconcileShopifyImportIdentities([{ ...record(), duplicate: true, sourceDuplicate: true }], catalog);
  const confirmed = confirmDistinctShopifyImport(pending);
  const [fresh] = reconcileShopifyImportIdentities([confirmed], [...catalog].reverse());
  assert.equal(fresh.identityStatus, 'NEW_CONFIRMED_DISTINCT');
  assert.equal(fresh.sourceDuplicate, true);
  assert.equal(fresh.duplicate, true);
});
