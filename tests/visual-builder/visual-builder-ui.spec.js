'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/admin/editor-visual.css'), 'utf8');
const start = admin.indexOf('<section class="visual-editor"');
const end = admin.indexOf('<div class="adm-card" style="margin-bottom:20px">', start);
const section = admin.slice(start, end);
const html = `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><style>:root{--adm-border:#eadde2;--adm-accent:#ad3f67;--adm-text:#30242a;--adm-muted:#766a70}.adm-btn{min-height:38px}.adm-input,.adm-select{box-sizing:border-box;width:100%;min-height:38px}${css}</style><body>${section}</body></html>`;

test.beforeEach(async ({ page }) => page.setContent(html));

for (const viewport of [{ name: 'celular', width: 375, height: 812 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'escritorio', width: 1440, height: 900 }]) {
  test(`editor no desborda en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
    await expect(page.locator('#visual-preview-frame')).toBeVisible();
    await expect(page.locator('#visual-page')).toBeVisible();
  });
}

test('acciones y preview tienen nombres accesibles', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rehacer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar y publicar' })).toBeVisible();
  await expect(page.locator('#visual-preview-frame')).toHaveAttribute('title', 'Vista previa real de la página');
  await expect(page.locator('#visual-status')).toHaveAttribute('aria-live', 'polite');
});

test('selector responsive limita el iframe', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const capped = { mobile: 392, tablet: 770 };
  for (const [device, max] of Object.entries(capped)) {
    await page.locator('#visual-preview-stage').evaluate((node, value) => { node.dataset.device = value; }, device);
    await page.waitForTimeout(250);
    expect(await page.locator('#visual-preview-frame').evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(max);
  }

  // El escritorio ya no comparte columna con el panel de propiedades: la vista
  // previa ocupa toda la fila de abajo, así que su iframe debe usar casi todo
  // el ancho disponible del stage en vez de quedar acotado a un valor fijo.
  await page.locator('#visual-preview-stage').evaluate(node => { node.dataset.device = 'desktop'; });
  await page.waitForTimeout(250);
  const desktop = await page.evaluate(() => ({
    frameWidth: document.querySelector('#visual-preview-frame').getBoundingClientRect().width,
    stageWidth: document.querySelector('#visual-preview-stage').getBoundingClientRect().width,
  }));
  expect(desktop.frameWidth).toBeGreaterThan(1000);
  expect(desktop.stageWidth - desktop.frameWidth).toBeLessThanOrEqual(60);
});
