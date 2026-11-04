const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
// Exercise the actual early CSS recovery listener without booting Firebase or overlays.
const loaderSource = fs.readFileSync(path.join(root, 'js/cargador-pagina.js'), 'utf8');
const loaderAst = require('acorn').parse(loaderSource, { ecmaVersion: 'latest' });
const recovery = loaderAst.body[0].expression.callee.body.body.find(node => node.type === 'ExpressionStatement' && node.expression.callee?.property?.name === 'addEventListener' && node.expression.arguments[0]?.value === 'error');
if (!recovery) throw new Error('Canonical CSS recovery listener missing');
const bundled = removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true });
const original = restoreStyleSources(bundled);
const types = { '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

for (const [width, height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
  test(`una petición CSS conserva la primera pantalla completa en ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript({ content: loaderSource.slice(recovery.start, recovery.end) });
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
      if (failBundle) await expect(page.locator('link[data-tt-style-bundle]')).toHaveCount(0);
      await page.waitForFunction(() => [...document.querySelectorAll('link[rel~="stylesheet"]')].every(link => link.sheet || link.dataset.ttBundleError === '1'));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.querySelectorAll('#hero img')].every(img => img.complete && img.naturalWidth > 0));
      await page.locator('#hero img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Match Playwright visual assertions: compare only consecutive stable paints.
      // Transparent WebP uploads may reach the compositor after decode resolves.
      let previous;
      for (let frame = 0; frame < 6; frame++) {
        const current = await page.screenshot({ animations: 'disabled' });
        if (previous?.equals(current)) return current;
        previous = current;
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
      throw new Error('First screen did not reach a stable paint');
    }
    async function captureFooter() {
      const footer = page.locator('footer');
      const logo = page.locator('footer .tt-logo-img');
      await logo.scrollIntoViewIfNeeded();
      await expect.poll(() => logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await logo.evaluate(img => img.decode());
      await page.evaluate(() => document.fonts.ready);
      const viewport = page.viewportSize();
      const { height } = await footer.boundingBox();
      // Un pie más alto que el viewport puede colocar el WhatsApp fijo en
      // distintas posiciones de la captura al recargar. Capturar el pie
      // completo en un viewport suficiente conserva también ese control.
      if (height > viewport.height) await page.setViewportSize({ width:viewport.width, height:Math.ceil(height)+1 });
      try { return await footer.screenshot({ animations: 'disabled' }); }
      finally { await page.setViewportSize(viewport); }
    }
    const baseline = await capture();
    const baselineFooter = await captureFooter();
    async function expectSameScreen(actual, label, expected = baseline) {
      // A rotated transparent edge can round one blue level differently after
      // rasterization. Permit only <=16 such pixels; content/layout differences fail.
      const same = actual.equals(expected) || await page.evaluate(async ({ actual, expected }) => {
        const load = async source => { const image = new Image(); image.src = 'data:image/png;base64,' + source; await image.decode(); return image; };
        const [a,b] = await Promise.all([load(actual),load(expected)]);
        if (a.width !== b.width || a.height !== b.height) return false;
        const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(a,0,0); const first = context.getImageData(0,0,a.width,a.height).data;
        context.clearRect(0,0,a.width,a.height); context.drawImage(b,0,0); const second = context.getImageData(0,0,a.width,a.height).data;
        let changed = 0;
        for (let index = 0; index < first.length; index += 4) {
          let different = false;
          for (let channel = 0; channel < 4; channel++) {
            const delta = Math.abs(first[index+channel]-second[index+channel]);
            if (delta > 1) return false;
            different ||= delta !== 0;
          }
          if (different && ++changed > 16) return false;
        }
        return true;
      }, { actual: actual.toString('base64'), expected: expected.toString('base64') });
      if (!same) {
        const originalPath = testInfo.outputPath('original.png');
        const actualPath = testInfo.outputPath(`${label}.png`);
        fs.writeFileSync(originalPath, expected);
        fs.writeFileSync(actualPath, actual);
        await testInfo.attach('original', { path: originalPath, contentType: 'image/png' });
        await testInfo.attach(label, { path: actualPath, contentType: 'image/png' });
      }
      expect(same, label).toBe(true);
    }
    expect(requests.length).toBeGreaterThan(20);
    requests.length = 0;
    html = bundled;
    await expectSameScreen(await capture(), 'bundle');
    await expectSameScreen(await captureFooter(), 'pie-bundle', baselineFooter);
    expect(requests).toEqual(['/css/generated/inicio.css']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    requests.length = 0;
    failBundle = true;
    await expectSameScreen(await capture(), 'respaldo');
    await expectSameScreen(await captureFooter(), 'pie-respaldo', baselineFooter);
    expect(requests.length).toBeGreaterThan(20);
    await expect(page.locator('link[data-tt-style-bundle]')).toHaveCount(0);
  });
}
