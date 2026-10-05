const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const html = fs.readFileSync('checkout.html', 'utf8');
const handler = html.slice(html.indexOf('(() => {', html.indexOf('// Cupón de envío gratis')), html.indexOf("document.getElementById('btn-step3-back')"));
const deadline = 'function withDeadline' + fs.readFileSync('js/core/auth/estado-perfil-sesion.mjs', 'utf8').split('export function withDeadline')[1];
const harness = `
${deadline}
const auth={currentUser:{uid:'isolated',getIdToken:async()=>'isolated-token'}},apiUrl=path=>path;
window.__mode='old';window.__signals=[];
async function fetch(_,options){window.__signals.push(options.signal);const code=JSON.parse(options.body).code;if(window.__mode==='old')return {ok:true,json:()=>new Promise(resolve=>{window.__resolveOld=()=>resolve({valid:true,code});})};if(window.__mode==='pending')return new Promise(()=>{});return {ok:true,json:async()=>({valid:true,code})};}
${handler}
document.querySelectorAll('.ck-panel').forEach((panel,index)=>panel.classList.toggle('active',index===2));
document.documentElement.classList.remove('tt-store-gate-pending');
`;
for (const width of [320, 390, 768, 1440]) test(`cupón editable, plazo y reintento en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.clock.install();
  // HTML/CSS y handler reales. SDK y endpoints aislados: no pedido ni cuenta.
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/coupon-fixture.js') ? harness : '' }));
  await page.route('**/coupon-fixture', route => route.fulfill({ contentType: 'text/html', body: html.replace('</body>', '<script src="/coupon-fixture.js"></script></body>') }));
  await page.goto('/coupon-fixture');
  const input = page.locator('#ck-coupon'), button = page.locator('#ck-coupon-apply'), status = page.locator('#ck-coupon-status');
  await input.fill('ENVIO'); await button.click(); await expect(button).toBeDisabled();
  await expect.poll(() => page.evaluate(() => typeof window.__resolveOld)).toBe('function');
  await input.fill('NUEVO'); await expect(button).toBeEnabled();
  await page.evaluate(() => { window.__mode='pending'; }); await button.click();
  await page.evaluate(() => window.__resolveOld());
  await expect(input).toHaveValue('NUEVO'); await expect(input).not.toHaveAttribute('data-applied'); await expect(button).toBeDisabled();
  await page.clock.fastForward(15000); await expect(button).toBeEnabled(); await expect(status).toContainText('Intentá de nuevo');
  expect(await page.evaluate(() => window.__signals.every(signal=>signal.aborted))).toBe(true);
  await page.evaluate(() => { window.__mode='confirmed'; }); await button.click();
  await expect(input).toHaveAttribute('data-applied', 'NUEVO'); await expect(status).toContainText('Cupón válido');
});
