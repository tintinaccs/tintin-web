const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');

for(const width of [320,390,768,1440]) test(`footer de perfil conserva logo contrastado sin recuadro tras cargar el filtro de marca en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const html=removeFixtureScripts(fs.readFileSync(path.join(__dirname,'../../perfil.html'),'utf8'),{removeModulePreloads:true});
  await page.route('**/__profile-footer',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('/__profile-footer');
  await page.addScriptTag({url:'/js/components/color/logotipo-marca.js'});
  const logo=page.locator('.tt-footer .tt-logo-img');
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toHaveCSS('filter', /tt-brand-logo-tint/);
  for (const tone of ['light', 'pink']) {
    await page.locator('.tt-footer').evaluate((footer,tone)=>footer.dataset.ttFlowBlock=tone,tone);
    await expect(logo).toHaveCSS('filter', new RegExp(tone === 'pink' ? 'tt-brand-logo-tint-light' : 'tt-brand-logo-tint["\\)]'));
  }
  await expect(page.locator('.tt-footer .tt-logo-link')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect.poll(()=>logo.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  for(const action of await page.locator('a[href*="wa.me"][class]').all()) {
    await expect(action).toHaveCSS('background-color','rgb(13, 128, 67)');
    await expect(action).toHaveCSS('color','rgb(255, 255, 255)');
  }
});

const pages = [
  ['/index.html', '#hero'],
  ['/catalogo.html', '.cat-wrap'],
  ['/collections.html', '.tt-page-hero'],
  ['/product.html?id=seo-prueba', '#product-detail'],
  ['/checkout.html', '.ck-body'],
  ['/login.html', '.login-shell'],
  ['/about.html', '.tt-page-hero'],
  ['/contact.html', '.tt-page-hero'],
  ['/envios.html', '.tt-page-hero'],
  ['/cambios-devoluciones.html', '.tt-page-hero'],
  ['/preguntas-frecuentes.html', '.tt-page-hero'],
  ['/privacidad.html', '.tt-page-hero'],
  ['/terminos.html', '.tt-page-hero'],
  ['/404.html', '.tt-404-wrap'],
];

test('WhatsApp conserva texto legible en contacto y footer con el tema público', async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.goto('/contact.html');
  await expect(page.locator('body')).toHaveClass(/tt-public-shell-mounted/);
  await expect(page.locator('.tt-contact-wa-link')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.tt-contact-wa-link')).toHaveCSS('background-color', 'rgb(13, 128, 67)');
  await expect(page.locator('.tt-footer-wa-text')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

// Detener los módulos permite medir el documento con sus estilos definitivos
// antes de Auth/API. Luego se ejecuta el runtime real de cada página local.
for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`las páginas públicas no reconstruyen su ancho tras arrancar · ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    const height = { 320: 568, 390: 844, 768: 1024, 1024: 768, 1280: 720, 1440: 900, 1920: 1080 }[width];
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
    await page.route('**/api/paypal-config', route => route.fulfill({ json: { enabled: false } }));
    for (const [url, selector] of pages) {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const defer = async route => {
        if (!/\/(?:cargador-pagina|esquema-color-instantaneo)\.js/.test(route.request().url())) await gate;
        await route.continue().catch(() => {});
      };
      await page.route(/\.(?:m?js)(?:\?|$)/, defer);
      try {
        await page.goto(url, { waitUntil: 'commit' });
        await page.waitForSelector(selector, { state: 'attached' });
        await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link =>
          (link.disabled && link.dataset.ttStyleBundle ? document.getElementById(link.dataset.ttStyleBundle) : link)?.sheet));
        await page.evaluate(() => document.fonts.ready);
        const initial = await page.locator(selector).boundingBox();
        expect(initial, url).not.toBeNull();
        const structural = await page.locator('head #tt-responsive-brand-safety-css').evaluate(link => Boolean(
          (link.disabled && link.dataset.ttStyleBundle ? document.getElementById(link.dataset.ttStyleBundle) : link)?.sheet));
        expect(structural, url).toBe(true);
        release();
        await page.waitForLoadState('load');
        await expect(page.locator('body'), url).toHaveClass(/tt-public-shell-mounted/);
        await page.waitForFunction(() => !document.getElementById('tt-loader') || getComputedStyle(document.getElementById('tt-loader')).display === 'none', null, { timeout: 15000 });
        // Los estilos de mantenimiento deben estar aplicados también en esta
        // fase. Un solo frame final no detectaba la cascada tardía anterior.
        await page.waitForTimeout(250);
        const final = await page.locator(selector).boundingBox();
        expect(Math.abs(final.x - initial.x), url).toBeLessThanOrEqual(1);
        expect(Math.abs(final.width - initial.width), url).toBeLessThanOrEqual(1);
        if (url === '/about.html') {
          const gap = await page.locator('.tt-page-hero .tt-section-sub').evaluate(label => {
            const header = [...document.querySelectorAll('.tt-header-desktop, #tt-header-tablet')]
              .find(node => node.getBoundingClientRect().height > 0);
            return label.getBoundingClientRect().top - (header?.getBoundingClientRect().bottom || 0);
          });
          expect(gap, 'Conocenos debe quedar separado del header o borde superior').toBeGreaterThanOrEqual(32);
          expect(gap, 'no duplicar la reserva de espacio del header').toBeLessThanOrEqual(72);
          const portraits = await page.locator('.tt-about-portrait img').evaluateAll(images => images.map(image => ({
            imageBottom: image.getBoundingClientRect().bottom,
            frameBottom: image.closest('.tt-about-portrait').getBoundingClientRect().bottom,
            position: getComputedStyle(image).objectPosition,
          })));
          expect(portraits).toHaveLength(1);
          for (const portrait of portraits) {
            expect(portrait.imageBottom, 'el contenedor exterior no debe cortar la parte inferior de la foto').toBeLessThanOrEqual(portrait.frameBottom + 1);
            expect(['50% 47%', '50% 46%']).toContain(portrait.position);
          }
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        expect(overflow, url).toBe(false);
        const surfaces = await page.evaluate(() => [...document.querySelectorAll('[data-tt-flow-block]')].map(node => {
          const layer = node.querySelector(':scope > [data-tt-flow-background]');
          const rect = layer?.getBoundingClientRect();
          return { tone: node.dataset.ttFlowBlock, left: rect?.left, width: rect?.width, viewport: document.documentElement.clientWidth };
        }));
        expect(surfaces.length, url).toBeGreaterThan(0);
        surfaces.forEach((surface, index) => {
          expect(surface.tone, url).toBe(index % 2 ? 'pink' : 'light');
          expect(Math.abs(surface.left), url).toBeLessThanOrEqual(1);
          expect(Math.abs(surface.width - surface.viewport), url).toBeLessThanOrEqual(1);
        });
        const duplicateIds = await page.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
          return ids.filter((id, index) => ids.indexOf(id) !== index);
        });
        expect(duplicateIds, url).toEqual([]);
        if (url !== '/login.html') {
          if(width<768) {
            await expect(page.locator('#tt-tabbar'),url).toBeVisible();
            await expect(page.locator('#tt-header-tablet'),url).toBeHidden();
            await expect(page.locator('#tt-header-desktop-tablet'),url).toBeHidden();
          } else {
            const header = page.locator(width >= 1025 ? '#tt-header-desktop-tablet' : '#tt-header-tablet');
            await expect(header, url).toBeVisible();
            const logo = header.locator('.tt-logo-img,.tt-tablet-logo-img');
            const bounds = await logo.boundingBox();
            expect(bounds.width, url).toBeGreaterThanOrEqual(60);
            expect(bounds.width, url).toBeLessThanOrEqual(110);
            expect(bounds.height, url).toBeGreaterThanOrEqual(44);
            expect(bounds.height, url).toBeLessThanOrEqual(58);
          }
          const footerLogo = page.locator('.tt-footer .tt-logo-img');
          await footerLogo.scrollIntoViewIfNeeded();
          const tone = await page.locator('.tt-footer').getAttribute('data-tt-flow-block');
          await expect(footerLogo, url).toHaveCSS('filter', new RegExp(tone === 'pink' ? 'tt-brand-logo-tint-light' : 'tt-brand-logo-tint["\\)]'));
          await expect(page.locator('.tt-footer .tt-logo-link'), url).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
          await expect.poll(()=>footerLogo.evaluate(image=>image.complete && image.naturalWidth>0), {message:url}).toBe(true);
          await expect(page.locator('.tt-footer-wa-text'), url).toHaveCSS('color', 'rgb(255, 255, 255)');
          await expect(page.locator('.tt-footer-wa'), url).toHaveCSS('background-color', 'rgb(13, 128, 67)');
          for(const action of await page.locator('a[href*="wa.me"][class]').all()) {
            await expect(action,url).toHaveCSS('background-color','rgb(13, 128, 67)');
            await expect(action,url).toHaveCSS('color','rgb(255, 255, 255)');
          }
        }
      } finally {
        release();
        await page.unroute(/\.(?:m?js)(?:\?|$)/, defer);
      }
    }
  });
}
