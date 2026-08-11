'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/admin/admin.css'), 'utf8');

const start = admin.indexOf('<div class="correos-panel" id="apar-panel-colores">');
const end = admin.indexOf('</div>\n    </div>\n\n    <!-- ========== CONFIGURACIÓN', start);
const panel = admin.slice(start, end > start ? end : undefined);

const html = `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><style>:root{--adm-border:#eadde2;--adm-bg:#fff7fa;--adm-card:#fff;--adm-text:#30242a;--adm-muted:#766a70;--adm-accent:#ad3f67}${css}</style><body><main style="max-width:1400px;margin:0 auto;padding:24px">${panel}</main></body></html>`;

test('la vista previa de colores queda debajo de la configuración en escritorio', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setContent(html);

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector('.apar-main-grid');
    const config = grid?.firstElementChild;
    const preview = document.querySelector('.apar-preview-column');
    if (!grid || !config || !preview) return null;
    const gridRect = grid.getBoundingClientRect();
    const configRect = config.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      configBottom: configRect.bottom,
      previewTop: previewRect.top,
      gridWidth: gridRect.width,
      previewWidth: previewRect.width,
      position: getComputedStyle(preview).position,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry.previewTop).toBeGreaterThanOrEqual(geometry.configBottom - 1);
  expect(geometry.previewWidth).toBeGreaterThanOrEqual(geometry.gridWidth - 2);
  expect(geometry.position).toBe('static');
});
