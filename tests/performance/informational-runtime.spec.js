'use strict';
const { test, expect } = require('@playwright/test');
const { url, waitLoaderGone, collectVitals, BUDGETS } = require('./_helpers');

for (const [route, width] of [['envios', 390], ['preguntas-frecuentes', 820], ['contact', 1440]]) {
  test(`grafo diferido liviano y animación al abrir cuenta: ${route} ${width}px`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url(route), { waitUntil: 'domcontentloaded' });
    await waitLoaderGone(page);
    await page.waitForFunction(() => window.TintinAccountMobileFixBooted);
    // El conteo inmediato ocultaba las descargas diferidas que CI sí alcanzaba.
    await page.waitForTimeout(5000);
    const vitals = await collectVitals(page);
    // El presupuesto existente se mide con Desktop Chrome. Los recursos
    // de cabecera y precarga varían por dispositivo/motor; la deduplicación
    // y el límite de transferencia se exigen en todos ellos.
    if (browserName === 'chromium' && width >= 768) expect(vitals.firstPartyRequests).toBeLessThanOrEqual(BUDGETS.lightweightRequests);
    expect(vitals.firstPartyTransferKB).toBeLessThanOrEqual(BUDGETS.lightweightTransferKB);
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name));
    expect(new Set(resources.filter(name => new URL(name).pathname.endsWith('/images/general/logo.png'))).size).toBe(1);
    expect(resources.some(name => name.includes('/extension-revelado-marca.js'))).toBe(false);
    await page.locator('[data-nav-action="cart"]:visible,#tabbar-cart:visible').first().click();
    await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('open');
    expect(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('/extension-revelado-marca.js')))).toBe(false);
    await page.locator('#btn-cart-close').click();
    await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('idle');
    await page.locator('#btn-cuenta, #btn-cuenta-tablet, #tabbar-cuenta').filter({ visible: true }).first().click();
    await expect.poll(() => page.evaluate(() => window.TintinBrandRevealExtensionBooted === true)).toBe(true);
    await expect(page.locator('#tt-brand-reveal-extension-style')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('panel ya abierto conserva reveal cuando llega el runtime informativo diferido',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const decorativeRequests=[];
 page.on('request',request=>{if(request.url().includes('extension-revelado-marca.js'))decorativeRequests.push(request.url());});
 let release;const delayed=new Promise(resolve=>{release=resolve;});
 await page.route('**/compatibilidad-cuenta-movil.js?**',async route=>{await delayed;await route.continue();});
 await page.goto(url('envios'),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.TintinSurfaceController);
 await page.locator('#btn-cuenta, #btn-cuenta-tablet, #tabbar-cuenta').filter({visible:true}).first().click();
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 release();
 await expect.poll(()=>page.evaluate(()=>window.TintinBrandRevealExtensionBooted===true)).toBe(true);
 await expect(page.locator('#tt-brand-reveal-extension-style')).toHaveCount(1);
 expect(decorativeRequests).toHaveLength(1);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('idle');
 await page.locator('#tabbar-cuenta').click();
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 expect(decorativeRequests).toHaveLength(1);
});
