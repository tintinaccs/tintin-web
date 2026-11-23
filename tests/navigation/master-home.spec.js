const { test, expect } = require('@playwright/test');

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`hero móvil mantiene marca y acciones dentro de la composición ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const result = await page.locator('#hero').evaluate(hero => {
      const boundary = hero.getBoundingClientRect();
      const photo = hero.querySelector('.tt-hero-media').getBoundingClientRect();
      const actions = Array.from(hero.querySelectorAll('.tt-hero-actions a'), action => {
        const { top, right, bottom, left, width, height } = action.getBoundingClientRect();
        return {
          width,
          height,
          clearance: Math.min(top - boundary.top, boundary.right - right, boundary.bottom - bottom, left - boundary.left),
        };
      });
      return {
        padding: getComputedStyle(hero).paddingBottom,
        actions,
        overflow: document.documentElement.scrollWidth - innerWidth,
        photoFits: photo.left >= boundary.left && photo.right <= boundary.right,
      };
    });

    expect(result.padding).toBe('0px');
    expect(result.actions).toHaveLength(2);
    for (const action of result.actions) {
      expect(action.width).toBeGreaterThanOrEqual(44);
      expect(action.height).toBeGreaterThanOrEqual(44);
      // La línea de foco mide 3 px y su separación es de 5 px.
      expect(action.clearance).toBeGreaterThanOrEqual(8);
    }
    expect(result.overflow).toBeLessThanOrEqual(1);
    expect(result.photoFits).toBe(true);
  });
}

for(const reducedMotion of ['no-preference','reduce'])test('el contenido permanece visible al volver: '+reducedMotion,async({page})=>{await page.emulateMedia({reducedMotion});await page.goto('/',{waitUntil:'load'});await page.waitForFunction(()=>window.TintinGlobalScrollRevealBooted);if(reducedMotion==='no-preference')await page.waitForSelector('.tt-auto-reveal');await page.evaluate(async()=>{window.scrollTo(0,document.body.scrollHeight);await new Promise(requestAnimationFrame);window.scrollTo(0,0);await new Promise(requestAnimationFrame);});await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.target?.classList?.contains('tt-auto-reveal')).map(a=>a.finished.catch(()=>{})));});const state=await page.locator(reducedMotion==='reduce'?'.tt-hero,.tt-footer':'section.tt-auto-reveal,.tt-footer.tt-auto-reveal').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({opacity:getComputedStyle(n).opacity,identity:new DOMMatrixReadOnly(getComputedStyle(n).transform).isIdentity})));expect(state.length).toBeGreaterThan(0);expect(state.every(n=>n.opacity==='1'&&n.identity)).toBe(true);});
