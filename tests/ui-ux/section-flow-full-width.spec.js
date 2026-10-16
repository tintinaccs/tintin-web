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

test('scripts, diálogos fijos y clases repetidas no vuelven a medir el flujo; una clase real sí lo actualiza', async ({ page }) => {
  await page.setContent('<style>section{height:100px}#later{visibility:hidden}body.reveal #later{visibility:visible}</style><body class="ready"><main><section>Visible</section><section id="later">Oculta</section></main></body>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(1);
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__flowStartupReads = 0;
    document.querySelectorAll('section').forEach(node => {
      const rect = node.getBoundingClientRect.bind(node);
      node.getBoundingClientRect = () => { window.__flowStartupReads++; return rect(); };
    });
  });
  await page.evaluate(async () => {
    for (let i=0; i<20; i++) {
      const script = document.createElement('script'); script.type='application/json'; script.textContent='{}'; document.body.append(script);
      const dialog = document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.style.position='fixed'; document.body.append(dialog);
      document.body.classList.add('ready');
      await new Promise(requestAnimationFrame);
    }
  });
  expect(await page.evaluate(() => window.__flowStartupReads)).toBe(0);
  await page.evaluate(() => document.body.classList.add('reveal'));
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await expect(page.locator('#later')).toHaveAttribute('data-tt-flow-block', 'pink');
});

test('medir sin cambios no reescribe los tonos de las superficies', async ({ page }) => {
  await page.setContent('<main><section id="first" style="height:100px">Primera</section><section id="second" style="height:100px">Segunda</section></main>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await page.waitForTimeout(150);
  const writes = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['data-tt-flow-block'] });
    for (let i=0;i<10;i++) {
      window.TintinSectionFlow.refresh();
      await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    observer.disconnect(); return count;
  });
  expect(writes).toBe(0);
  await page.locator('#first').evaluate(node => { node.hidden=true; });
  await expect(page.locator('#second')).toHaveAttribute('data-tt-flow-block', 'light');
});
