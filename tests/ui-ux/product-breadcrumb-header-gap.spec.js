const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
// HTML/CSS reales de la ficha: la reserva del header fijo debe aplicarse una sola vez.
const html = fs.readFileSync('product.html', 'utf8');
test.use({ javaScriptEnabled: false });

for (const width of [768, 820, 1024]) {
  test(`Producto en tableta ${width}px no duplica el espacio del header sobre el breadcrumb`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1180 });
    await page.route('**/product-breadcrumb-gap', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/product-breadcrumb-gap');
    // El body ya reserva los 84px del header fijo de tableta; el breadcrumb no suma otro margen.
    await expect(page.locator('body')).toHaveCSS('padding-top', '84px');
    await expect(page.locator('.tt-breadcrumb')).toHaveCSS('margin-top', '0px');
    expect(Math.round(await page.locator('.tt-breadcrumb').evaluate(el => el.getBoundingClientRect().top))).toBe(84);
  });
}

test('Producto en escritorio conserva la separación del header fijo sobre el breadcrumb', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/product-breadcrumb-gap', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/product-breadcrumb-gap');
  await expect(page.locator('body')).toHaveCSS('padding-top', '0px');
  await expect(page.locator('.tt-breadcrumb')).toHaveCSS('margin-top', '112px');
});
