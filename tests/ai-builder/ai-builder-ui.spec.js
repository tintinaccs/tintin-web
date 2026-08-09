'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/admin/ai-builder.css'), 'utf8');
const start = admin.indexOf('<div class="adm-section" id="section-ai-builder">');
const end = admin.indexOf('<!-- ===================== CONTENIDO', start);
const section = admin.slice(start, end).replace('class="adm-section"', 'class="adm-section active"');
const documentHtml = `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><style>:root{--adm-border:#eadde2;--adm-accent:#ad3f67;--adm-text:#30242a;--adm-muted:#766a70}.adm-content{padding:16px}.adm-input{box-sizing:border-box;padding:10px}.adm-btn{min-height:38px;padding:8px 12px}.adm-section{display:block}${css}</style><body><main class="adm-content">${section}</main></body></html>`;

test.beforeEach(async ({ page }) => page.setContent(documentHtml));

for (const viewport of [
  { name: 'celular', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'escritorio', width: 1440, height: 900 }
]) {
  test(`no desborda en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    await expect(page.locator('#ai-builder-request')).toBeVisible();
    await expect(page.locator('#ai-builder-preview')).toBeVisible();
  });
}

test('controles críticos tienen nombre accesible y preview aislado', async ({ page }) => {
  await expect(page.getByLabel('¿Qué querés cambiar?')).toHaveAttribute('maxlength', '1200');
  await expect(page.getByRole('button', { name: 'Aprobar y publicar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir modificación' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  await expect(page.locator('#ai-builder-preview')).toHaveAttribute('title', 'Vista previa de la propuesta');
  await expect(page.locator('#ai-builder-preview')).toHaveAttribute('sandbox', '');
  await expect(page.locator('#ai-builder-live')).toHaveAttribute('aria-live', 'assertive');
});

test('los tres selectores aplican anchos responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator('#ai-builder-preview');
  const expected = { mobile: 392, tablet: 770, desktop: 954 };
  for (const [device, max] of Object.entries(expected)) {
    await page.locator('#ai-builder-device').evaluate((node, value) => { node.dataset.device = value; }, device);
    await page.waitForTimeout(250);
    const width = await frame.evaluate(node => node.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(max);
  }
});
