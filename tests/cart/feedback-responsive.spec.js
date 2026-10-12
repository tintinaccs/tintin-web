const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('js/components/cart/sincronizacion-carrito.js','utf8');
const feedback=source.slice(source.indexOf('  function showFeedback('),source.indexOf('  function withCartMutation('));
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
 test(`aviso de carrito visible y completo ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.setContent('<html><body style="margin:0"><main>Catálogo</main></body></html>');
  await page.addScriptTag({content:'let feedbackTimer;'+feedback+'window.fixtureFeedback=showFeedback;'});
  await page.evaluate(()=>fixtureFeedback('✓ ARMCUFF ZEPHIRA agregado al carrito','success'));
  const notice=page.locator('#tt-cart-feedback');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role','status');
  const bounds=await notice.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);
  await page.evaluate(()=>fixtureFeedback('✓ Un nombre de producto muy largo '.repeat(4),'success'));
  expect(await notice.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(notice).toBeHidden({timeout:6000});
 });
}
