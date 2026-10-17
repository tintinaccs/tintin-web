const { test, expect } = require('@playwright/test');

for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  test(`cambio de datos se comunica sin aviso de recarga y conserva el formulario · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/__site-changes', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><input aria-label="Edición pendiente"><div id="adm-mobile-tabs" style="position:fixed;bottom:0;height:70px;width:100%">Navegación</div>' }));
    await page.goto('/__site-changes');
    await page.getByRole('textbox').fill('Conservar mi edición');
    await page.evaluate(() => localStorage.setItem('tintin-test-cart', '[{"id":"fixture","qty":2}]'));
    await page.addScriptTag({ type: 'module', content: `
      import { createSiteRevisionObserver } from '../../js/quality/vigilancia-version.js?v=tintin-20261017-data-refresh-1';
      import { notifySiteContentChange } from '../../js/quality/vigilancia-version.js?v=tintin-20261017-data-refresh-1';
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
