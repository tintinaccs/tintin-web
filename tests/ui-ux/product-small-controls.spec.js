const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const html = fs.readFileSync('product.html', 'utf8');
const selection = fs.readFileSync('js/pages/product/seleccion-producto.js', 'utf8');
const harness = `
window.syncCartWithCatalog=()=>[{id:'isolated',name:'Aro de prueba',qty:1,price:1000}];
window.TintinFavorites={has:()=>window.__selected===true};
${selection}
document.getElementById('product-loading').style.display='none';
document.getElementById('product-grid').style.display='';
document.documentElement.classList.remove('tt-store-gate-pending');
`;
for (const width of [320, 390, 768, 1440]) test(`producto oculta la barra social y conserva favoritos accesibles en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/product-controls-fixture.js') ? harness : '' }));
  await page.route('**/product-controls-fixture', route => route.fulfill({ contentType: 'text/html', body: html.replace('</body>', '<script src="/product-controls-fixture.js"></script></body>') }));
  await page.goto('/product-controls-fixture');
  await expect(page.locator('[data-share-product], #btn-product-like, [data-open-community], #product-reviews')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar Aro de prueba en favoritos' })).toHaveAttribute('aria-pressed','false');
  await page.evaluate(() => { window.__selected=true;window.dispatchEvent(new CustomEvent('tintin:favorites-updated')); });
  await expect(page.getByRole('button', { name: 'Quitar Aro de prueba de favoritos' })).toHaveAttribute('aria-pressed','true');
});
