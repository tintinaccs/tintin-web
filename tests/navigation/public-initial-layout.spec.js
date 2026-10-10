const { test, expect } = require('@playwright/test');

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
        await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
        await page.evaluate(() => document.fonts.ready);
        const initial = await page.locator(selector).boundingBox();
        expect(initial, url).not.toBeNull();
        const structural = await page.locator('head #tt-responsive-brand-safety-css').evaluate(link => Boolean(link.sheet));
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
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        expect(overflow, url).toBe(false);
        const duplicateIds = await page.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
          return ids.filter((id, index) => ids.indexOf(id) !== index);
        });
        expect(duplicateIds, url).toEqual([]);
      } finally {
        release();
        await page.unroute(/\.(?:m?js)(?:\?|$)/, defer);
      }
    }
  });
}
