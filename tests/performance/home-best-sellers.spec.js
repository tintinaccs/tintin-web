const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const runtime = fs.readFileSync('js/pages/home/mas-vendidos.js', 'utf8');

test('más vendidos respeta selección explícita, disponibilidad canónica y cambios en vivo', async ({ page }) => {
  await page.setContent('<div id="tt-best-sellers-grid" aria-busy="true"></div><p id="tt-best-sellers-status"></p>');
  await page.evaluate(() => {
    window.TintinCatalogPolicy = { isPurchasable: product => product.canPurchase };
    window.renderProductsGrid = (id, products) => { document.getElementById(id).textContent = products.map(product => product.id).join(','); };
  });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:products-loaded', { detail: { products: [
    { id: 'unselected', canPurchase: true },
    { id: 'sold-out', destacado: true, canPurchase: false },
    { id: 'variants-available', destacado: true, stock: 0, canPurchase: true },
    { id: 'chosen', destacado: true, canPurchase: true },
  ] } })));
  await expect(page.locator('#tt-best-sellers-grid')).toHaveText('variants-available,chosen');
  await expect(page.locator('#tt-best-sellers-grid')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:products-loaded', { detail: { products: [{ id: 'unselected', canPurchase: true }] } })));
  await expect(page.locator('#tt-best-sellers-grid')).toHaveText('');
  await expect(page.locator('#tt-best-sellers-status')).toContainText('Pronto');
});
