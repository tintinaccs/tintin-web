const { test, expect } = require('@playwright/test');
const product = { id: 'qa-stock-colors', name: 'Aros por color', category: 'aros', active: true, price: 25000, stock: 2,
  imageUrl: 'https://media.example.test/gold.svg', variants: { Color: ['Dorado', 'Plateado'] },
  variantInventory: [{ variant: 'Dorado', stock: 0 }, { variant: 'Plateado', stock: 2 }],
  variantMedia: [{ Color: 'Dorado', imageUrl: 'https://media.example.test/gold.svg' }, { Color: 'Plateado', imageUrl: 'https://media.example.test/silver.svg' }] };
async function catalog(page, items) {
  await page.route('**/api/public-catalog?**', route => {
    const url = new URL(route.request().url()), resource = url.searchParams.get('resource');
    if (resource === 'collections') return route.fulfill({ json: { ok: true, resource, items: [{ id: 'aros', data: { name: 'Aros', slug: 'aros', active: true } }] } });
    return route.fulfill({ json: url.searchParams.has('id') ? { ok: true, resource, item: { id: product.id, data: product } } : { ok: true, resource, items: items.map(item => ({ id: item.id, data: item })) } });
  });
  await page.route('https://media.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="65" fill="${route.request().url().includes('gold') ? '#D4AF37' : '#CFD4DA'}"/></svg>` }));
}
for (const width of [390, 1440]) {
  test(`abre la variante disponible, sincroniza la foto y conserva el dorado agotado en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await catalog(page, [product]);
    await page.goto(`/product?id=${product.id}`);
    await page.waitForFunction(() => window._renderProductDetail && window.TintinCatalogPolicy?.variantStockLimit);
    await page.evaluate(product => { Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [product], set() {} }); window._renderProductDetail(product); }, product);
    await expect(page.locator('[data-variant-value="Plateado"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('#gallery-main img').evaluate(img => img.currentSrc)).toMatch(/silver.svg/);
    await expect(page.locator('#gallery-thumbs .tt-gallery-thumb').first()).toHaveAttribute('data-src', /silver.svg/);
    await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
    await page.locator('[data-variant-value="Dorado"]').click();
    await expect.poll(() => page.locator('#gallery-main img').evaluate(img => img.currentSrc)).toMatch(/gold.svg/);
    await expect(page.locator('#gallery-main img')).toHaveCSS('filter', 'none');
    await expect(page.locator('#gallery-main .tt-stock-label')).toBeVisible();
    await expect(page.locator('#gallery-main .tt-stock-label')).toHaveCSS('writing-mode', 'vertical-rl');
    await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
    await expect(page.locator('#btn-product-buy-now')).toBeDisabled();
    await page.locator('[data-variant-value="Plateado"]').click();
    await expect(page.locator('#gallery-main .tt-stock-label')).toBeHidden();
    await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
    await page.evaluate(product => {
      const legacy = {...product, id: 'qa-blank-total', stock: ''};
      Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [legacy], set() {} });
      window._renderProductDetail(legacy);
    }, product);
    await expect(page.locator('[data-variant-value="Plateado"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('#gallery-main img').evaluate(img => img.currentSrc)).toMatch(/silver.svg/);
  });
  test(`catálogo envía abajo los agotados incluso con stock agregado desactualizado en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const exhausted = { ...product, id: 'qa-exhausted', name: 'Agotado barato', price: 1, variantInventory: product.variantInventory.map(row => ({ ...row, stock: 0 })) };
    await catalog(page, [exhausted, product]); await page.goto('/catalogo');
    await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(2);
    await page.locator('#cat-sort').selectOption('precio-asc');
    await expect(page.locator('#cat-grid [data-product-id]').first()).toHaveAttribute('data-product-id', product.id);
    await expect(page.locator('#cat-grid [data-product-id]').last().locator('.tt-stock-label')).toBeVisible();
    await expect(page.locator('#cat-grid [data-product-id]').first().locator('img')).toHaveAttribute('src', /silver.svg/);
  });
}
