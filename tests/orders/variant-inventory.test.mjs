import test from 'node:test';
import assert from 'node:assert/strict';
import { variantStockLimit, applyVariantInventoryDeltas, variantInventoryDeltas } from '../../js/core/store/inventario-variantes.mjs';
import { buildCatalogProductFromImport } from '../../js/core/store/shopify-import-core.mjs';

test('optional matrix fails closed, excludes missing combinations and preserves aggregate products', () => {
  assert.equal(variantStockLimit({}, '6'), null);
  assert.equal(variantStockLimit({ variantInventory: [] }, '6'), 0);
  assert.equal(variantStockLimit({ variantInventory: [{ variant: '6', stock: -1 }] }, '6'), 0);
  assert.equal(variantStockLimit({ variantInventory: [{ variant: '6 / Negro', stock: 2 }] }, '6/Negro'), 2);
  assert.equal(variantStockLimit({ variantInventory: [{ variant: '6 / Negro', stock: 2 }] }, '7 / Negro'), 0);
});

test('inventory deltas preserve stock per option when total quantity is unchanged', () => {
  const product = { variantInventory: [{ variant: '6', stock: 0 }, { variant: '7', stock: 3 }] };
  const deltas = variantInventoryDeltas([{ id: 'ring', variant: '6', qty: 2 }], [{ id: 'ring', variant: '7', qty: 2 }]);
  assert.deepEqual(applyVariantInventoryDeltas(product, deltas), [{ variant: '6', stock: 2 }, { variant: '7', stock: 1 }]);
  assert.equal(product.variantInventory[0].stock, 0, 'planning must not mutate source data');
  assert.throws(() => applyVariantInventoryDeltas(product, [{ variant: '6', qty: 1 }]), /Stock insuficiente/);
});

test('import retains each real combination and inventory rather than Cartesian combinations', () => {
  const product = buildCatalogProductFromImport({ name: 'Anillo', price: 100, stock: 5, variants: [
    { Talla: '6', Color: 'Negro', stock: 2 }, { Talla: '7', Color: 'Dorado', stock: 3 },
  ] });
  assert.deepEqual(product.variantInventory, [{ variant: '6 / Negro', stock: 2 }, { variant: '7 / Dorado', stock: 3 }]);
  assert.equal(variantStockLimit(product, '6 / Dorado'), 0);
});
