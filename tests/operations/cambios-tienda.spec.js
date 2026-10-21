const { test, expect } = require('@playwright/test');

for (const [width, height] of [[320, 900], [390, 844], [844, 390], [768, 1024], [1024, 768], [820, 1180], [1180, 820], [1366, 900], [1920, 1080]]) {
  test(`cambio de datos se comunica sin aviso de recarga y conserva el formulario · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/__site-changes', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><input aria-label="Edición pendiente"><div id="adm-mobile-tabs" style="position:fixed;bottom:0;height:70px;width:100%">Navegación</div>' }));
    await page.goto('/__site-changes');
    await page.getByRole('textbox').fill('Conservar mi edición');
    await page.evaluate(() => localStorage.setItem('tintin-test-cart', '[{"id":"fixture","qty":2}]'));
    await page.addScriptTag({ type: 'module', content: `
      import { createSiteRevisionObserver } from '../../js/quality/vigilancia-version.js?v=tintin-20261018-page-updates-1';
      import { notifySiteContentChange } from '../../js/quality/vigilancia-version.js?v=tintin-20261018-page-updates-1';
      window.dataUpdates = 0;
      window.addEventListener('tintin:site-content-updated', () => window.dataUpdates++);
      window.receiveRevision = createSiteRevisionObserver(notifySiteContentChange);` });
    await page.waitForFunction(() => typeof window.receiveRevision === 'function');
    await page.evaluate(() => window.receiveRevision({ revision: 'initial' }));
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    await page.evaluate(() => { window.receiveRevision({ revision: 'new' }); window.receiveRevision({ revision: 'new' }); });
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveValue('Conservar mi edición');
    expect(await page.evaluate(() => localStorage.getItem('tintin-test-cart'))).toBe('[{"id":"fixture","qty":2}]');
    await page.evaluate(() => window.receiveRevision({ revision: 'next' }));
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    expect(await page.evaluate(() => window.dataUpdates)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('la señal de datos no pide recarga en ninguna página, incluido el panel de trabajo', async ({ page }) => {
  const routes = ['/', '/about', '/nosotros', '/catalogo', '/collections', '/product?id=fixture', '/checkout', '/login', '/perfil', '/contact', '/envios', '/preguntas-frecuentes', '/cambios-devoluciones', '/terminos', '/privacidad', '/404', '/admin?section=productos', '/admin-images', '/pages/pagina-propia'];
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><input aria-label="Borrador">' });
    return route.continue();
  });
  for (const path of routes) {
    await page.goto(path);
    await page.getByRole('textbox').fill('Sin perder mi trabajo');
    await page.addScriptTag({ type: 'module', content: `
      import { notifySiteContentChange } from '../../js/quality/vigilancia-version.js?v=tintin-20261018-page-updates-1';
      let received = 0;
      window.addEventListener('tintin:site-content-updated', () => received++);
      notifySiteContentChange();
      window.receivedDataUpdate = received;` });
    await expect.poll(() => page.evaluate(() => window.receivedDataUpdate)).toBe(1);
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveValue('Sin perder mi trabajo');
  }
});

// Publicación de código: usar el temporizador y los eventos reales del watcher,
// sin invocar checkNow ni depender del listener de cambios administrativos.
for (const device of [
  { name: 'celular vertical', width: 390, height: 844, mobile: true },
  { name: 'celular horizontal', width: 844, height: 390, mobile: true },
  { name: 'tablet vertical', width: 820, height: 1180, mobile: true },
  { name: 'tablet horizontal', width: 1180, height: 820, mobile: true },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'escritorio', width: 1920, height: 1080 },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: !!device.mobile, hasTouch: !!device.mobile });
    for (const trigger of ['intervalo', 'volver', 'historial', 'conexión']) {
      test(`aviso de publicación al ${trigger}`, async ({ page }) => {
        let published = false;
        let checks = 0;
        await page.route('**/__site-changes', route => {
          if (published) checks += 1;
          return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="alternate" href="/js/release.js?v=${published ? 'new' : 'old'}"><input aria-label="Borrador"><div id="tt-tabbar" style="position:fixed;bottom:0;height:72px;width:100%">Navegación</div>` });
        });
        await page.goto('/__site-changes');
        await page.getByRole('textbox').fill('Mi borrador');
        await page.clock.install();
        await page.addScriptTag({ type: 'module', url: '/js/quality/vigilancia-version.js' });
        await page.waitForFunction(() => !!window.TintinVersionWatch);
        published = true;
        if (trigger === 'intervalo') await page.clock.fastForward(60_001);
        else await page.evaluate(kind => {
          if (kind === 'volver') {
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
            document.dispatchEvent(new Event('visibilitychange'));
          } else if (kind === 'historial') window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          else window.dispatchEvent(new Event('online'));
        }, trigger);
        const notice = page.locator('#tt-version-notice');
        await expect(notice).toBeVisible({ timeout: 3000 });
        await expect(notice).toHaveCount(1);
        expect(checks).toBe(1);
        expect(await notice.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= document.getElementById('tt-tabbar').getBoundingClientRect().top; })).toBe(true);
        await notice.getByRole('button', { name: 'Más tarde' }).click();
        await expect(page.getByRole('textbox')).toHaveValue('Mi borrador');
      });
    }
  });
}
