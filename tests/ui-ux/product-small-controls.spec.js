const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const html = fs.readFileSync('product.html', 'utf8');
const harness = `
document.getElementById('product-loading').style.display='none';
document.getElementById('product-grid').style.display='';
document.documentElement.classList.remove('tt-store-gate-pending');
`;
for (const width of [320, 390, 768, 1440]) test(`producto oculta comunidad y selección duplicada y conserva compra en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/product-controls-fixture.js') ? harness : '' }));
  await page.route('**/product-controls-fixture', route => route.fulfill({ contentType: 'text/html', body: html.replace('</body>', '<script src="/product-controls-fixture.js"></script></body>') }));
  await page.goto('/product-controls-fixture');
  await expect(page.locator('[data-share-product], #btn-product-like, [data-open-community], #product-reviews, #tinsel-root')).toHaveCount(0);
  await expect(page.locator('#btn-product-add-cart')).toBeVisible();
  await expect(page.locator('#btn-product-buy-now')).toBeVisible();
});
