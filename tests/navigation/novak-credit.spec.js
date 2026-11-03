const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { NOVAK_URL } = require('../../scripts/lib/firma-novak.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const documents = ['index', 'about', 'catalogo', 'collections', 'product', 'checkout', 'perfil', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404', 'login', 'admin', 'admin-images'];
const viewports = [[320, 568], [568, 320], [768, 1024], [1024, 768], [1366, 768], [768, 1366], [1920, 1080], [1080, 1920]];

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
        document.querySelectorAll('#page-loader, .page-loader, #admin-auth-gate').forEach(el => el.remove());
      });
      const credit = page.locator('footer .novak-credit');
      await expect(credit, name).toHaveCount(1);
      await expect(credit).toHaveAttribute('href', NOVAK_URL);
      await expect(credit).toHaveAccessibleName('Hecho por NOVAK, visitar su sitio');
      await expect(credit.locator('span')).toHaveText('Hecho por');
      await credit.scrollIntoViewIfNeeded();
      await expect(credit, name).toBeVisible();
      await expect.poll(() => credit.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), { message: name }).toBe(true);
      const box = await credit.boundingBox();
      expect(box.height, name).toBeGreaterThanOrEqual(48);
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(width + 1);
      const row = await credit.locator('..').boundingBox();
      expect(Math.abs(box.x + box.width / 2 - row.x - row.width / 2), name).toBeLessThanOrEqual(1);
      expect(await credit.evaluate(el => getComputedStyle(el).color), name).toBe('rgb(34, 34, 34)');
      await page.unroute('**/__novak-fixture');
    }
  });
}

test('animación original, foco de teclado y movimiento reducido', async ({ page }) => {
  const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../about.html'), 'utf8'), { removeModulePreloads: true });
  await page.route('**/__novak-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/__novak-fixture');
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
  await expect(credit).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.body.classList.add('water-paused'));
  await expect(credit).toHaveCSS('transition-duration', '0s');
});
