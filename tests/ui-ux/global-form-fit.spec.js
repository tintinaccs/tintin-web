const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');
const root = path.resolve(__dirname, '../..');
const fields = '.tt-form-input,.tt-form-textarea,.perfil-input,.ck-input,.ck-select,.ck-textarea,.login-email-input';
const cards = '#contact-form,.tt-contact-alt,.perfil-card,.ck-panel';

// HTML y cascada reales. La sesión y los envíos quedan fuera de esta prueba
// geométrica: abrir el paso Datos no debe crear pedidos ni alterar perfiles.
for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],
  [1024,768],[1280,720],[1440,900],[1920,1080],[2560,1440]]) {
  test(`formularios comparten bordes y espacio sin solapes ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'surface.test') return route.abort();
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      if (file.endsWith('.html')) return route.fulfill({ contentType: 'text/html',
        body: removeFixtureScripts(fs.readFileSync(file, 'utf8'), { removeModulePreloads: true }) });
      return route.fulfill({ path: file });
    });
    for (const file of ['contact.html', 'perfil.html', 'checkout.html', 'login.html']) {
      await page.goto('https://surface.test/' + file);
      if (file === 'login.html') await page.addStyleTag({ path: 'css/pages/login/login-maintenance.css' });
      if (file === 'checkout.html') {
        await page.addStyleTag({ path: 'css/pages/checkout/checkout-maintenance.css' });
        await page.evaluate(() => document.querySelectorAll('.ck-panel').forEach(n => n.classList.toggle('active', n.id === 'panel-2')));
      }
      await page.evaluate(() => {
        document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending', 'login-auth-pending');
        document.body.classList.add('tt-public-shell-mounted');
        document.getElementById('tt-loader')?.remove();
        return document.fonts.ready;
      });
      const visibleFields = page.locator(fields).filter({ visible: true });
      expect(await visibleFields.count(), file).toBeGreaterThan(0);
      const geometry = await visibleFields.evaluateAll(nodes => nodes.map(node => {
        const b = node.getBoundingClientRect(), s = getComputedStyle(node);
        return { id: node.id, left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height,
          radius: parseFloat(s.borderTopLeftRadius), font: parseFloat(s.fontSize) };
      }));
      for (const field of geometry) {
        expect(field.left, file + field.id).toBeGreaterThanOrEqual(12);
        expect(field.right, file + field.id).toBeLessThanOrEqual(width - 12);
        expect(field.height, file + field.id).toBeGreaterThanOrEqual(44);
        expect(field.radius, file + field.id).toBe(14);
        if (width <= 1024) expect(field.font, file + field.id).toBeGreaterThanOrEqual(16);
      }
      const overlaps = geometry.flatMap((a, i) => geometry.slice(i + 1).filter(b =>
        a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)
        .map(b => [a.id, b.id]));
      expect(overlaps).toEqual([]);
      for (const radius of await page.locator(cards).filter({ visible: true }).evaluateAll(nodes =>
        nodes.map(n => parseFloat(getComputedStyle(n).borderTopLeftRadius)))) {
        expect(radius, file).toBeGreaterThanOrEqual(16);
        expect(radius, file).toBeLessThanOrEqual(20);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true);
      await visibleFields.first().focus();
      expect(await visibleFields.first().evaluate(n => getComputedStyle(n).outlineStyle)).not.toBe('none');
      if ([390,1440].includes(width)) await page.screenshot({ path: info.outputPath(file + '.png'), fullPage: true });
    }
  });
}
