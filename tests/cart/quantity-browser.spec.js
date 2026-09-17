'use strict';

const { test, expect } = require('@playwright/test');

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
