const { test, expect } = require('@playwright/test');
const product = { id: 'qa-stock-colors', name: 'Aros por color', category: 'aros', active: true, price: 25000, stock: 2,
  imageUrl: 'https://media.example.test/gold.svg', variants: { Color: ['Dorado', 'Plateado'] },
  variantInventory: [{ variant: 'Dorado', stock: 0 }, { variant: 'Plateado', stock: 2 }],
  variantMedia: [{ Color: 'Dorado', imageUrl: 'https://media.example.test/gold.svg' }, { Color: 'Plateado', imageUrl: 'https://media.example.test/silver.svg' }] };
async function catalog(page, items) {
  await page.route('**/api/public-catalog?**', route => {
    const url = new URL(route.request().url()), resource = url.searchParams.get('resource');
    if (!['products', 'collections'].includes(resource)) return route.continue();
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
    await expect(page.locator('#gallery-main .tt-stock-label')).toHaveCSS('writing-mode', 'horizontal-tb');
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
  for (const catalogPath of ['/catalogo', '/catalogo?cat=aros']) test(`${catalogPath} envía abajo los agotados incluso con stock agregado desactualizado en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const exhausted = { ...product, id: 'qa-exhausted', name: 'Agotado barato', price: 1, variantInventory: product.variantInventory.map(row => ({ ...row, stock: 0 })) };
    await catalog(page, [exhausted, product]); await page.goto(catalogPath);
    await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(2);
    await page.locator('#cat-sort').selectOption('precio-asc');
    await expect(page.locator('#cat-grid [data-product-id]').first()).toHaveAttribute('data-product-id', product.id);
    await expect(page.locator('#cat-grid [data-product-id]').last().locator('.tt-stock-label')).toBeVisible();
    await expect(page.locator('#cat-grid [data-product-id]').first().locator('img')).toHaveAttribute('src', /silver.svg/);
  });
}

for (const width of [390, 1440]) test(`tarjeta conserva una foto disponible al tocar un agotado y actualizar stock en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await catalog(page, [product]);
  await page.goto('/catalogo?cat=aros');
  await page.waitForFunction(() => typeof window.renderProductCardMarkup === 'function');
  await page.evaluate(product => {
    const root = document.createElement('div'); root.id = 'stock-card-fixture'; document.body.prepend(root);
    window.paintStockCard = item => { root.innerHTML = window.renderProductCardMarkup(item); };
    window.paintStockCard(product);
  }, product);
  const card = page.locator('#stock-card-fixture');
  const image = card.locator('img');
  const gold = card.locator('[data-card-color="Dorado"]');
  const silver = card.locator('[data-card-color="Plateado"]');
  await expect(image).toHaveAttribute('src', /silver.svg/);
  await expect(gold).toBeDisabled(); await expect(silver).toBeEnabled();
  await gold.dispatchEvent('click');
  await expect(image).toHaveAttribute('src', /silver.svg/);
  await expect(card.locator('.tt-stock-label')).toBeHidden();
  await silver.click();
  await page.evaluate(product => window.paintStockCard({ ...product, variantInventory: [{ variant: 'Dorado', stock: 2 }, { variant: 'Plateado', stock: 0 }] }), product);
  await expect(image).toHaveAttribute('src', /gold.svg/);
  await expect(silver).toBeDisabled(); await expect(gold).toBeEnabled();
  await expect(card.locator('.tt-stock-label')).toBeHidden();
  await page.evaluate(product => window.paintStockCard({ ...product, variantInventory: product.variantInventory.map(row => ({ ...row, stock: 0 })) }), product);
  await expect(card.locator('.tt-stock-label')).toBeVisible();
  await expect(gold).toBeDisabled(); await expect(silver).toBeDisabled();
});

for (const width of [390, 1440]) test(`catálogo actualiza stock y foto sin pedir recarga ni esperar el TTL en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const items = [{ ...product }]; await catalog(page, items);
  await page.goto('/catalogo?cat=aros');
  const card = page.locator(`#cat-grid [data-product-id="${product.id}"]`);
  await expect(card.locator('img')).toHaveAttribute('src', /silver.svg/);
  items[0] = { ...product, variantInventory: [{ variant: 'Dorado', stock: 2 }, { variant: 'Plateado', stock: 0 }] };
  await page.evaluate(async () => {
    const module = await import('../../js/quality/vigilancia-version.js?v=tintin-20261018-page-updates-1');
    module.notifySiteContentChange();
  });
  await expect(card.locator('img')).toHaveAttribute('src', /gold.svg/);
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  items[0] = { ...items[0], variantInventory: items[0].variantInventory.map(row => ({ ...row, stock: 0 })) };
  await page.evaluate(async () => (await import('../../js/quality/vigilancia-version.js?v=tintin-20261018-page-updates-1')).notifySiteContentChange());
  await expect(card.locator('.tt-stock-label')).toBeVisible();
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
});
