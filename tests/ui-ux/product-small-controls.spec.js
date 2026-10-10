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

for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900]]) {
  test(`ficha con márgenes, dorado metálico y recomendaciones legibles en ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('galeria-producto.js') ? fs.readFileSync('js/components/images/galeria-producto.js','utf8') : route.request().url().endsWith('/product-controls-fixture.js') ? harness : ''}));
    await page.route('**/product-controls-fixture',route=>route.fulfill({contentType:'text/html',body:html.replace('</body>','<script src="/product-controls-fixture.js"></script></body>')}));
    await page.goto('/product-controls-fixture');
    await page.evaluate(()=>{
      const card='<div class="tt-related-slot"><article class="tt-product-card tt-related-card"><div class="tt-product-info"><h3>CADENA TIPO AVENA PLATEADO</h3><p>Gs. 70.000</p><div class="tt-product-actions"><button class="tt-btn">AGREGAR</button></div></div></article></div>';
      document.querySelector('.tt-related-grid').innerHTML=card.repeat(3);
      const circle=document.createElement('span');circle.className='tt-color-option';
      circle.innerHTML='<span class="tt-color-swatch" style="display:block;width:24px;height:24px"></span>';
      circle.firstChild.style.background=window.TintinProductColors.swatch('dorado');
      document.getElementById('product-variants').append(circle);
    });
    const geometry=await page.evaluate(()=>{
      const box=document.getElementById('product-grid').getBoundingClientRect();
      const cards=[...document.querySelectorAll('.tt-related-slot')].map(el=>el.getBoundingClientRect().width);
      return{left:box.left,right:innerWidth-box.right,cards,overflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.querySelector('.tt-color-swatch')).backgroundImage};
    });
    expect(geometry.left).toBeGreaterThanOrEqual(16);expect(geometry.right).toBeGreaterThanOrEqual(16);
    expect(geometry.overflow).toBe(false);expect(Math.min(...geometry.cards)).toBeGreaterThanOrEqual(120);
    expect(geometry.background).toContain('142, 107, 35');
  });
}
