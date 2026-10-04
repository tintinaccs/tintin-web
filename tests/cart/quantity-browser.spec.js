'use strict';

const { test, expect } = require('@playwright/test');

test('admin stock editor labels each option, sums quantities and resets for a new product', async ({ page }) => {
  const fs = require('node:fs');
  const source = fs.readFileSync('js/admin/admin-app.js', 'utf8');
  const editor = source.slice(source.indexOf('let productVariantStockBaseline = null;'), source.indexOf('function serializeProductForm()'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async editor => {
    document.body.innerHTML = '<input id="prod-stock" value="3"><div><textarea id="prod-variants-text"></textarea></div>';
    const inventoryUrl = new URL('/js/core/store/inventario-variantes.mjs', location.origin);
    inventoryUrl.searchParams.set('v', 'tintin-20261003-variant-inventory-1');
    const { variantInventoryEntries } = await import(inventoryUrl.href);
    window.qaRenderStock = new Function('variantInventoryEntries', editor + '\nreturn renderProductVariantStock;')(variantInventoryEntries);
    window.qaRenderStock({ stock: 3, variants: { Talla: ['6', '7'] }, variantInventory: [{ variant: '6', stock: 1 }, { variant: '7', stock: 2 }] });
  }, editor);
  await expect(page.getByLabel('6', { exact: true })).toHaveValue('1');
  await page.getByLabel('7', { exact: true }).fill('4');
  await expect(page.locator('#prod-stock')).toHaveValue('5');
  await expect(page.locator('#prod-stock')).toHaveAttribute('readonly', '');
  await page.evaluate(() => window.qaRenderStock(null));
  await expect(page.locator('#prod-variant-stock input')).toHaveCount(0);
  await expect(page.locator('#prod-stock')).not.toHaveAttribute('readonly');
});

test('product options recalculate quantity and block the exhausted choice', async ({ page }) => {
  const fixture = { id: 'qa-variant-stock', name: 'QA opciones', category: 'relojes', price: 1000, stock: 2,
    variants: { Talla: ['6', '7'] }, variantInventory: [{ variant: '6', stock: 2 }, { variant: '7', stock: 0 }] };
  await page.route('**/api/public-catalog?**', async route => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get('resource');
    if (resource === 'collections') return route.fulfill({ json: { ok: true, resource, items: [{ id: 'relojes', data: { name: 'Relojes', slug: 'relojes', active: true } }] } });
    if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id')
      ? { ok: true, resource, item: { id: fixture.id, data: fixture } }
      : { ok: true, resource, items: [{ id: fixture.id, data: fixture }] } });
    return route.continue();
  });
  await page.goto('/product?id=qa-variant-stock', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._renderProductDetail === 'function' && window.TintinCatalogPolicy?.variantStockLimit);
  await page.evaluate(fixture => {
    Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [fixture], set: () => {} });
    window._renderProductDetail(fixture);
  }, fixture);
  await page.locator('.tt-variant-option').filter({ hasText: /^6$/ }).click();
  await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
  await page.locator('#btn-qty-plus').click();
  await expect(page.locator('#qty-val')).toHaveText('2');
  await expect(page.locator('#btn-qty-plus')).toBeDisabled();
  await page.locator('.tt-variant-option').filter({ hasText: /^7$/ }).click();
  await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
  await expect(page.locator('#btn-product-buy-now')).toBeDisabled();
  await expect(page.locator('#qty-stock')).toHaveText('Esta opción está sin stock');
});

test('cart caps each variant independently and keeps the aggregate stock cap', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.TintinCartRuntime?.addToCart);
  const result = await page.evaluate(async () => {
    const fixture = { id: 'qa-variant-stock', name: 'QA opciones', category: 'relojes', price: 1000, stock: 4,
      variants: { Talla: ['6', '7', '8'] }, variantInventory: [{ variant: '6', stock: 1 }, { variant: '7', stock: 4 }, { variant: '8', stock: 0 }] };
    const runtime = window.TintinCartRuntime;
    await runtime.clearCart();
    Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [fixture], set: () => {} });
    try {
      const small = await runtime.addToCart({ ...fixture, variant: '6', qty: 3 });
      const increase = await runtime.updateQty(small.item.lineId, 1);
      const large = await runtime.addToCart({ ...fixture, variant: '7', qty: 4 });
      const empty = await runtime.addToCart({ ...fixture, variant: '8', qty: 1 });
      return { small: small.item.qty, smallCapped: small.capped, increase: increase.changed, large: large.item.qty,
        empty: empty.changed, quantities: runtime.getCartLocal().map(item => item.qty) };
    } finally { await runtime.clearCart(); }
  });
  expect(result).toEqual({ small: 1, smallCapped: true, increase: false, large: 3, empty: false, quantities: [1, 3] });
});

test('QA fixture stock 3 allows qty 1 to 2 and rejects over-stock safely', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return window.TintinCartRuntime &&
      typeof window.TintinCartRuntime.addToCart === 'function' &&
      typeof window.TintinCartRuntime.updateQty === 'function';
  });

  const result = await page.evaluate(async () => {
    const fixture = {
      id: 'qa-stock-3',
      name: 'QA stock fixture',
      category: 'relojes',
      price: 1000,
      stock: 3,
      imageUrl: '',
      qty: 1,
    };
    const runtime = window.TintinCartRuntime;
    await runtime.clearCart();
    Object.defineProperty(window, 'PRODUCTS', {
      configurable: true,
      get: () => [fixture],
      set: () => {},
    });

    try {
      const added = await runtime.addToCart(fixture);
      const afterOne = runtime.getCartLocal();
      const lineId = afterOne[0]?.lineId;
      const toTwo = await runtime.updateQty(lineId, 1);
      const afterTwo = runtime.getCartLocal();
      const toThree = await runtime.updateQty(lineId, 1);
      const afterThree = runtime.getCartLocal();
      const overStock = await runtime.updateQty(lineId, 1);
      const afterOverStock = runtime.getCartLocal();

      return {
        addedQty: added.item?.qty,
        qtyOne: afterOne[0]?.qty,
        qtyTwo: afterTwo[0]?.qty,
        qtyThree: afterThree[0]?.qty,
        overCapped: overStock.capped,
        overChanged: overStock.changed,
        qtyAfterOverStock: afterOverStock[0]?.qty,
        lineCount: afterOverStock.length,
      };
    } finally {
      await runtime.clearCart();
    }
  });

  expect(result).toEqual({
    addedQty: 1,
    qtyOne: 1,
    qtyTwo: 2,
    qtyThree: 3,
    overCapped: true,
    overChanged: false,
    qtyAfterOverStock: 3,
    lineCount: 1,
  });
});
