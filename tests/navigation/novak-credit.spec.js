const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { NOVAK_URL, renderNovakCredit, ensureNovakStyles } = require('../../scripts/lib/firma-novak.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const loader = fs.readFileSync(path.join(__dirname, '../../js/components/novak-credit.js'), 'utf8');

const documents = ['index', 'about', 'catalogo', 'collections', 'product', 'checkout', 'perfil', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404', 'login', 'admin', 'admin-images'];
const viewports = [[320, 568], [568, 320], [768, 1024], [1024, 768], [1366, 768], [768, 1366], [1920, 1080], [1080, 1920]];
const lazyFixture = ensureNovakStyles(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:1400px">Contenido de prueba</main><footer>${renderNovakCredit()}</footer></body></html>`);

test('descarga el original sólo al acercarse al pie y reserva su espacio', async ({ page }) => {
  let downloads = 0;
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/novak-mark.svg')) downloads++; });
  await page.route('**/__novak-lazy', route => route.fulfill({ contentType: 'text/html', body: lazyFixture }));
  await page.goto('/__novak-lazy');
  await page.waitForLoadState('networkidle');
  const img = page.locator('.novak-credit img');
  expect(downloads).toBe(0);
  await expect(img).not.toHaveAttribute('src');
  expect(await img.boundingBox()).toMatchObject({ width: 42, height: 40 });
  await page.locator('.novak-credit').scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(downloads).toBe(1);
});

test('conserva el símbolo original sin JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.route('**/__novak-lazy', route => route.fulfill({ contentType: 'text/html', body: lazyFixture }));
    await page.goto(new URL('/__novak-lazy', baseURL).href);
    const img = page.locator('.novak-credit img:visible');
    await expect(img).toHaveCount(1);
    await page.locator('.novak-credit').scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('src', /novak-mark\.svg$/);
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  } finally { await context.close(); }
});

for (const [width, height] of viewports) {
  test(`firma compartida en todos los documentos · ${width}×${height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    await page.route('https://**', route => route.abort());
    for (const name of documents) {
      const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, `../../${name}.html`), 'utf8'), { removeModulePreloads: true });
      await page.route('**/__novak-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto('/__novak-fixture');
      // Fixture de geometría: simula únicamente el estado visual autorizado;
      // no ejecuta auth, APIs ni escrituras de producción.
      await page.evaluate(() => {
        document.documentElement.classList.add('adm-auth-ready');
        const layout = document.getElementById('adm-layout');
        if (layout) layout.style.display = 'flex';
        document.querySelectorAll('#page-loader, .page-loader, #admin-auth-gate').forEach(el => el.remove());
      });
      await page.addScriptTag({ content: loader });
      const credit = page.locator('footer .novak-credit');
      await expect(credit, name).toHaveCount(1);
      await expect(credit).toHaveAttribute('href', NOVAK_URL);
      await expect(credit, name).toHaveAccessibleName('Desarrollado por NOVAK, visitar su sitio');
      await expect(credit.locator('span')).toHaveText('Desarrollado por');
      await expect(page.locator('#tt-footer-ending .tt-footer-bottom')).toHaveText('© 2026 TINTIN ACCESORIOS');
      await expect(credit).toHaveCSS('font-family', /Montserrat/);
      await credit.scrollIntoViewIfNeeded();
      await expect(credit, name).toBeVisible();
      await expect.poll(() => credit.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), { message: name }).toBe(true);
      const box = await credit.boundingBox();
      expect(box.height, name).toBeGreaterThanOrEqual(48);
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(width + 1);
      const row = await credit.locator('..').boundingBox();
      expect(Math.abs(box.x + box.width / 2 - row.x - row.width / 2), name).toBeLessThanOrEqual(1);
      const contrast = await credit.evaluate(el => {
        const luminance = color => {
          const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
            const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
          });
          return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
        };
        const foreground = luminance(getComputedStyle(el).color);
        const background = luminance(getComputedStyle(el.closest('.tt-footer-ending')).backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
      expect(contrast, name).toBeGreaterThanOrEqual(4.5);
      await page.unroute('**/__novak-fixture');
    }
  });
}

test('animación original, foco de teclado y movimiento reducido', async ({ page }) => {
  const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../about.html'), 'utf8'), { removeModulePreloads: true });
  await page.route('**/__novak-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/__novak-fixture');
  await page.addScriptTag({ content: loader });
  const credit = page.locator('.novak-credit');
  await credit.scrollIntoViewIfNeeded();
  await credit.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(credit).toBeFocused();
  await expect(credit).toHaveCSS('outline-style', 'solid');
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await credit.hover();
  await expect(credit).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
  await expect(credit.locator('img')).not.toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(credit).toHaveCSS('transform', 'none');
  await expect(credit.locator('img')).toHaveCSS('transform', 'none');
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.body.classList.add('water-paused'));
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001);
});
