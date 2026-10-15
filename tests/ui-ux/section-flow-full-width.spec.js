const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const styles = fs.readFileSync('css/theme/sistema-superficies-tintin.css', 'utf8');
const runtime = fs.readFileSync('js/theme/alternancia-secciones.js', 'utf8');
for (const width of [390, 1440]) test(`bloques entre wrappers llenan el ancho y alternan al ocultar secciones en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<style>${styles}body{margin:0}.cat-wrap{max-width:800px;margin:auto;padding:24px}.cat-hero{height:160px;border-radius:24px;margin-bottom:32px}.cat-layout{height:200px}.tt-footer{height:140px}.white-card{background:white;height:60px;width:120px}</style><body><div class="cat-wrap"><section class="cat-hero"><h1>Catálogo</h1></section><section id="hidden-block" hidden>Oculto</section><div class="cat-layout"><article class="white-card">Tarjeta blanca</article></div></div><footer class="tt-footer">Pie</footer><section role="dialog">Panel</section></body>`);
  await page.addScriptTag({ content: runtime });
  const sequence = () => page.evaluate(() => [...document.querySelectorAll('[data-tt-flow-block]')].map(node => ({ flow: node.dataset.ttFlowBlock, left: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().left, width: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().width, start: getComputedStyle(node).getPropertyValue('--tt-section-start'), end: getComputedStyle(node).getPropertyValue('--tt-section-end') })));
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink', 'light']);
  for (const row of await sequence()) { expect(Math.abs(row.left)).toBeLessThan(1); expect(row.width).toBe(width); }
  const rows = await sequence(); expect(rows[0].end).toBe(rows[1].start); expect(rows[1].end).toBe(rows[2].start);
  await expect(page.locator('.white-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.locator('.cat-layout').evaluate(node => { node.hidden = true; });
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const html = removeFixtureScripts(fs.readFileSync('perfil.html', 'utf8'));
const flow = runtime;
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`perfil conserva tarjetas blancas y controles descubiertos · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/__profile-surfaces', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/__profile-surfaces');
    await page.locator('#perfil-nombre-display').evaluate(el => { el.textContent = 'TINTIN ACCESORIOS Y RELOJES'; });
    await page.locator('.perfil-card').first().evaluate(el => el.classList.add('tt-visual-block'));
    await page.addScriptTag({ content: flow });
    await expect(page.locator('.tt-profile-hero')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.perfil-card').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (const button of await page.locator('[data-profile-tab]').all()) {
      await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(el => {
        const b = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const title = await page.locator('#perfil-nombre-display').boundingBox();
    expect(title.x).toBeGreaterThanOrEqual(0);
    expect(title.x + title.width).toBeLessThanOrEqual(width);
  });
}

const profileHtml=removeFixtureScripts(fs.readFileSync('perfil.html','utf8'));
for(const width of [320,390,768,1024,1440,1920]) test(`perfil muestra pestañas completas sobre las transiciones en ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/__profile-flow',r=>r.fulfill({contentType:'text/html',body:profileHtml}));
 await page.goto('/__profile-flow');await page.addScriptTag({content:runtime});
 await expect(page.locator('.tt-profile-tabs')).toHaveCSS('position','relative');
 const tabs=page.locator('[data-profile-tab]');
 for(let i=0;i<await tabs.count();i++){
  await tabs.nth(i).scrollIntoViewIfNeeded();
  expect(await tabs.nth(i).evaluate(n=>{const r=n.getBoundingClientRect();return [0.2,0.8].every(y=>n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height*y)));})).toBe(true);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('insertar tarjetas sin cambiar el tamaño no vuelve a medir todas las secciones', async ({ page }) => {
  await page.setContent('<main><section id="products" style="height:200px;overflow:hidden"></section><section style="height:200px">Otra sección</section></main>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await page.waitForTimeout(150);
  const reads = await page.evaluate(async () => {
    window.__flowGeometryReads = 0;
    document.querySelectorAll('section').forEach(node => {
      const measure = node.getBoundingClientRect.bind(node);
      node.getBoundingClientRect = () => { window.__flowGeometryReads++; return measure(); };
    });
    for (let i = 0; i < 25; i++) {
      document.getElementById('products').append(document.createElement('article'));
      await new Promise(requestAnimationFrame);
    }
    return window.__flowGeometryReads;
  });
  expect(reads).toBe(0);
  await page.locator('#products').evaluate(node => { node.style.height = '300px'; });
  await expect.poll(() => page.evaluate(() => window.__flowGeometryReads)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.textContent = 'Nueva sección'; section.style.height = '100px';
    document.querySelector('main').append(section);
  });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(3);
});

for (const width of [390, 1440]) test(`logo del footer sigue el fondo personalizado y restaura la alternancia en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/footer-contrast-fixture', route => route.fulfill({ contentType: 'text/html', body: `<style id="tt-global-layout-css">${styles}body{margin:0}section{height:160px}.tt-footer{height:140px}</style><section></section><footer class="tt-footer"><img class="tt-logo-img" src="/assets-tintin/images/general/logo.png"></footer>` }));
  await page.goto('/footer-contrast-fixture');
  await page.addScriptTag({ content: fs.readFileSync('js/components/color/logotipo-marca.js', 'utf8') });
  await page.addScriptTag({ content: runtime });
  const footer = page.locator('.tt-footer');
  await expect(footer).toHaveAttribute('data-tt-flow-block', 'pink');
  for (const [background, rgb, filter] of [['#fdecf2', 'rgb(253, 236, 242)', 'tt-brand-logo-tint'], ['#f8aaca', 'rgb(248, 170, 202)', 'tt-brand-logo-tint-light']]) {
    await page.evaluate(async background => (await import(new URL('js/components/navigation/compartido/apariencia-global.js', `${location.origin}/`).href)).applyGlobalLayout({ footer: { background } }), background);
    await expect(footer).toHaveCSS('background-color', rgb);
    await expect(footer.locator('img')).toHaveCSS('filter', new RegExp('#' + filter + '"?\\)$'));
    await page.locator('section').evaluate(node => { node.hidden = !node.hidden; });
    await expect(footer).toHaveCSS('background-color', rgb);
    await expect(footer.locator('img')).toHaveCSS('filter', new RegExp('#' + filter + '"?\\)$'));
  }
  await page.evaluate(async () => (await import(new URL('js/components/navigation/compartido/apariencia-global.js', `${location.origin}/`).href)).applyGlobalLayout({ footer: {} }));
  await expect.poll(() => footer.evaluate(node => node.style.getPropertyValue('--tt-footer-logo-filter'))).toBe('');
  await expect(footer).toHaveAttribute('data-tt-flow-block', 'pink');
  await expect(footer.locator('img')).toHaveCSS('filter', /#tt-brand-logo-tint-light"?\)$/);
});
