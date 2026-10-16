const { test, expect } = require('@playwright/test');

for (const width of [390, 768, 1366]) test(`venta local se refresca con el aviso y conserva una edición abierta · ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/__local-live', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><section id="section-ventas-locales" class="active"><p data-local-status></p><div id="local-ledger"></div></section><section hidden><div id="local-mirror-map"></div></section>' }));
  await page.route('**/js/core/auth/cliente-api-autenticado.js?*', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function authenticatedFetch(_url, options) {
      if (options.method !== 'GET') throw new Error('Este fixture no permite escrituras');
      window.reads=(window.reads||0)+1;
      return new Response(JSON.stringify({ok:true,...window.localData}),{headers:{'content-type':'application/json'}});
    }` }));
  await page.goto('/__local-live');
  await page.evaluate(() => {
    window.localData = { revision: 'first', checkedAt: new Date().toISOString(), contacts: [], customers: [], webOrders: [], entries: [
      { id: 'LOCAL_fixture', kind: 'sale', year: 2026, month: 10, customerName: 'Clienta inicial', total: 50000, lines: [], notes: '' },
    ] };
  });
  await page.addScriptTag({ type: 'module', url: '/js/admin/comercio-local-admin.js?v=tintin-20261016-admin-live-1' });
  await expect(page.locator('#section-ventas-locales')).toContainText('Clienta inicial');
  await page.evaluate(() => {
    window.localData.revision = 'second'; window.localData.entries[0].customerName = 'Clienta actualizada';
    window.dispatchEvent(new Event('tintin:site-content-updated'));
  });
  await expect(page.locator('#section-ventas-locales')).toContainText('Clienta actualizada');
  await page.locator('[data-local-edit="LOCAL_fixture"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="notes"]').fill('Mi edición pendiente');
  const reads = await page.evaluate(() => window.reads);
  await page.evaluate(() => {
    window.localData.revision = 'third'; window.localData.entries[0].customerName = 'Cambio remoto';
    window.dispatchEvent(new Event('tintin:site-content-updated'));
  });
  await expect(dialog.locator('[name="notes"]')).toHaveValue('Mi edición pendiente');
  expect(await page.evaluate(() => window.reads)).toBe(reads);
  await dialog.locator('[data-local-close]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#section-ventas-locales')).toContainText('Cambio remoto');
});
