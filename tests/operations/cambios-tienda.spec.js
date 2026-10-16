const { test, expect } = require('@playwright/test');

for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  test(`cambio confirmado muestra un aviso responsive y conserva el formulario · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/__site-changes', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><input aria-label="Edición pendiente"><div id="adm-mobile-tabs" style="position:fixed;bottom:0;height:70px;width:100%">Navegación</div>' }));
    await page.goto('/__site-changes');
    await page.getByRole('textbox').fill('Conservar mi edición');
    await page.evaluate(() => localStorage.setItem('tintin-test-cart', '[{"id":"fixture","qty":2}]'));
    await page.addScriptTag({ type: 'module', content: `
      import { createSiteRevisionObserver } from '../../js/quality/vigilancia-version.js?v=tintin-20261016-admin-live-1';
      import { notifySiteContentChange } from '../../js/quality/vigilancia-version.js?v=tintin-20261016-admin-live-1';
      window.receiveRevision = createSiteRevisionObserver(notifySiteContentChange);` });
    await page.waitForFunction(() => typeof window.receiveRevision === 'function');
    await page.evaluate(() => window.receiveRevision({ revision: 'initial' }));
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    await page.evaluate(() => { window.receiveRevision({ revision: 'new' }); window.receiveRevision({ revision: 'new' }); });
    const notice = page.locator('#tt-version-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText('Hay cambios nuevos en la tienda');
    expect(await notice.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    expect(await notice.evaluate(node => node.getBoundingClientRect().bottom <= document.getElementById('adm-mobile-tabs').getBoundingClientRect().top)).toBe(true);
    const update = notice.getByRole('button', { name: 'Actualizar', exact: true });
    expect((await update.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await notice.getByRole('button', { name: 'Más tarde', exact: true }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveValue('Conservar mi edición');
    expect(await page.evaluate(() => localStorage.getItem('tintin-test-cart'))).toBe('[{"id":"fixture","qty":2}]');
    await page.evaluate(() => window.receiveRevision({ revision: 'next' }));
    await expect(notice).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
