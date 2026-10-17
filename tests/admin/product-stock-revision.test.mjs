import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureProductInventoryRevision, productInventoryRevisionMatches } from '../../js/admin/products/revision-inventario-producto.mjs';
import { variantInventoryEntries } from '../../js/core/store/inventario-variantes.mjs';
import { sanitizeVariantData } from '../../js/core/auth/utilidades-seguridad.js';

const product = () => ({ stock: 3, variants: [{ Color: ' Dorado ', price: 200, sku: null }], variantInventory: [{ variant: 'Dorado', stock: 3 }] });
const source = readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const save = source.slice(source.indexOf('      const oldProd = _allProducts.find'), source.indexOf("      if (currentRole === 'superadmin')", source.indexOf('      const oldProd = _allProducts.find')));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function saveVariantProduct(current, baseline, stocks = ['0']) {
  const updates = [];
  const data = { active: false, stock: 0 };
  await new AsyncFunction('docId', '_allProducts', 'productVariantStockBaseline', 'document', 'data', 'variantInventoryEntries', 'productInventoryRevisionMatches', 'withAdminSiteChange', 'runTransaction', 'db', 'doc', save)(
    'p', [], baseline, { querySelectorAll: () => stocks.map(value => ({ value })) }, data,
    variantInventoryEntries, productInventoryRevisionMatches, fn => fn(),
    async (_db, action) => action({ get: async () => ({ exists: () => !!current, data: () => current }), update: (_ref, patch) => updates.push(patch) }), {}, () => 'p');
  return updates;
}

test('opciones importadas saneadas no provocan un conflicto inexistente al guardar stock 0 u ocultar', async () => {
  const raw = product();
  assert.notDeepEqual(sanitizeVariantData(raw.variants), raw.variants, 'reproduce el desacuerdo de la comparación anterior');
  const baseline = captureProductInventoryRevision(raw);
  const updates = await saveVariantProduct(raw, baseline);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].stock, 0);
  assert.equal(updates[0].active, false);
  assert.deepEqual(updates[0].variantInventory, [{ variant: 'Dorado', stock: 0 }]);
  assert.deepEqual(updates[0].variants, raw.variants, 'conserva opciones originales al editar cantidades');
});
test('orden distinto de claves de Firestore conserva la misma revisión', () => {
  const raw = product(), baseline = captureProductInventoryRevision(raw);
  assert.equal(productInventoryRevisionMatches({ ...raw, variants: [{ sku: null, price: 200, Color: ' Dorado ' }] }, baseline), true);
});
test('rechaza cambios concurrentes de stock, opciones y producto eliminado', async () => {
  for (const changed of [ { ...product(), stock: 2 }, { ...product(), variantInventory: [{ variant: 'Dorado', stock: 2 }] }, { ...product(), variants: [{ Color: 'Plata', price: 200, sku: null }] }, null ]) {
    await assert.rejects(saveVariantProduct(changed, captureProductInventoryRevision(product())), /stock o las opciones cambiaron/);
  }
});
test('el baseline no cambia si se modifica una opción después de abrir el editor', () => {
  const raw = product(), baseline = captureProductInventoryRevision(raw);
  raw.variants[0].Color = 'Plata';
  assert.equal(baseline.variants[0].Color, ' Dorado ');
  assert.equal(productInventoryRevisionMatches(raw, baseline), false);
});

test('un inventario legado sin campo variants se guarda sin enviar undefined a Firestore', async () => {
  const raw = product(); delete raw.variants;
  const updates = await saveVariantProduct(raw, captureProductInventoryRevision(raw));
  assert.equal(updates[0].stock, 0);
  assert.equal(Object.hasOwn(updates[0], 'variants'), false);
});
