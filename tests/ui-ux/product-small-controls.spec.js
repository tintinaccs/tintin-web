const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const html = fs.readFileSync('product.html', 'utf8');
const source = fs.readFileSync('tienda.js', 'utf8');
const copy = source.slice(source.indexOf('async function _copyProductLink'), source.indexOf('function _renderProductDetail'));
const share = source.slice(source.indexOf('  const compactShare ='), source.indexOf('  // Add to cart.', source.indexOf('  const compactShare =')));
const harness = `
${copy}
const _pdProduct={name:'Aro de prueba'};
Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
document.execCommand=()=>window.__copySucceeds===true;
${share}
document.getElementById('product-loading').style.display='none';
document.getElementById('product-grid').style.display='';
document.documentElement.classList.remove('tt-store-gate-pending');
`;
for (const width of [320, 390, 768, 1440]) test(`producto comunica copiado real sin selección duplicada en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/product-controls-fixture.js') ? harness : '' }));
  await page.route('**/product-controls-fixture', route => route.fulfill({ contentType: 'text/html', body: html.replace('</body>', '<script src="/product-controls-fixture.js"></script></body>') }));
  await page.goto('/product-controls-fixture');
  await page.locator('[data-share-product]').click();
  await expect(page.locator('[data-share-product-label]')).toHaveText('No se pudo copiar');
  await expect(page.locator('textarea[readonly]')).toHaveCount(0);
  await page.evaluate(() => { window.__copySucceeds=true; });
  await page.locator('[data-share-product]').click();
  await expect(page.locator('[data-share-product-label]')).toHaveText('Enlace copiado');
  await expect(page.locator('#tinsel-root,#product-reviews')).toHaveCount(0);
});
