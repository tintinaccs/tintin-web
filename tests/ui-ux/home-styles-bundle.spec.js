const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const bundled = removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true });
const original = restoreStyleSources(bundled);
const types = { '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

for (const [width, height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
  test(`una petición CSS conserva la primera pantalla completa en ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let html = original;
    let failBundle = false;
    const requests = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'styles.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
      if (url.pathname.endsWith('.css')) requests.push(url.pathname);
      if (failBundle && url.pathname === '/css/generated/inicio.css') return route.abort();
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
      catch { return route.abort(); }
    });
    async function capture() {
      await page.goto('https://styles.test/');
      await page.waitForFunction(() => [...document.querySelectorAll('link[rel~="stylesheet"]')].every(link => link.sheet));
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#tt-hero-img').evaluate(img => img.decode());
      return page.screenshot({ animations: 'disabled' });
    }
    const baseline = await capture();
    const baselineFooter = await page.locator('footer').screenshot({ animations: 'disabled' });
    async function expectSameScreen(actual, label, expected = baseline) {
      if (!actual.equals(expected)) {
        await testInfo.attach('original', { body: expected, contentType: 'image/png' });
        await testInfo.attach(label, { body: actual, contentType: 'image/png' });
      }
      expect(actual.equals(expected), label).toBe(true);
    }
    expect(requests.length).toBeGreaterThan(20);
    requests.length = 0;
    html = bundled;
    await expectSameScreen(await capture(), 'bundle');
    await expectSameScreen(await page.locator('footer').screenshot({ animations: 'disabled' }), 'pie-bundle', baselineFooter);
    expect(requests).toEqual(['/css/generated/inicio.css']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    requests.length = 0;
    failBundle = true;
    await expectSameScreen(await capture(), 'respaldo');
    await expectSameScreen(await page.locator('footer').screenshot({ animations: 'disabled' }), 'pie-respaldo', baselineFooter);
    expect(requests.length).toBeGreaterThan(20);
    await expect(page.locator('link[data-tt-style-bundle]')).toHaveCount(0);
  });
}
