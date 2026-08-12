'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'css/admin/editor-visual.css'), 'utf8');

// Contrato responsive: dos editores arriba cuando entran y preview siempre debajo.
const html = `<!doctype html>
<html lang="es">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--adm-border:#eadde2;--adm-bg:#fff7fa;--adm-card:#fff;--adm-text:#30242a;--adm-muted:#766a70;--adm-accent:#ad3f67;--shadow-sm:0 2px 10px rgba(0,0,0,.05)}
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{padding:16px;background:#fff}
${css}
</style>
<body>
  <main style="width:100%;max-width:1400px;margin:0 auto">
    <section class="visual-editor">
      <div class="visual-editor-layout">
        <aside class="visual-editor-sidebar">
          <label>Página completa</label>
          <select style="width:100%"><option>Inicio</option></select>
          <div class="visual-section-list">
            <button class="visual-section-select">Banner principal</button>
            <button class="visual-section-select">Productos destacados</button>
          </div>
        </aside>
        <section class="visual-editor-properties">
          <h3>Propiedades</h3>
          <div class="visual-property-grid">
            <div class="visual-property"><label>Título</label><input style="width:100%"></div>
            <div class="visual-property"><label>Subtítulo</label><input style="width:100%"></div>
          </div>
        </section>
        <section class="visual-editor-preview">
          <div class="visual-preview-head">
            <div><h3>Vista previa en tiempo real</h3><small>Versión publicada</small></div>
            <div class="visual-devices">
              <button>Celular</button><button>Tablet</button><button>Escritorio</button>
            </div>
          </div>
          <div class="visual-preview-stage" data-device="desktop"><iframe title="Vista previa"></iframe></div>
        </section>
      </div>
    </section>
  </main>
</body></html>`;

const viewports = [
  { name: 'desktop grande', width: 1440, height: 1000, twoColumns: true },
  { name: 'desktop compacto', width: 1180, height: 900, twoColumns: true },
  { name: 'tablet horizontal', width: 900, height: 800, twoColumns: true },
  { name: 'tablet vertical', width: 768, height: 1024, twoColumns: false },
  { name: 'mobile', width: 430, height: 900, twoColumns: false },
  { name: 'mobile angosto', width: 360, height: 800, twoColumns: false },
];

for (const viewport of viewports) {
  test(`Apariencia mantiene editores y preview fit en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(html);

    const geometry = await page.evaluate(() => {
      const grid = document.querySelector('.visual-editor-layout');
      const sidebar = document.querySelector('.visual-editor-sidebar');
      const properties = document.querySelector('.visual-editor-properties');
      const preview = document.querySelector('.visual-editor-preview');
      const stage = document.querySelector('.visual-preview-stage');
      const iframe = document.querySelector('.visual-preview-stage iframe');
      const rect = element => element.getBoundingClientRect();
      const g = rect(grid);
      const s = rect(sidebar);
      const p = rect(properties);
      const v = rect(preview);
      const st = rect(stage);
      const f = rect(iframe);
      return {
        grid: g, sidebar: s, properties: p, preview: v, stage: st, iframe: f,
        bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
        gridOverflow: grid.scrollWidth - grid.clientWidth,
      };
    });

    expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
    expect(geometry.gridOverflow).toBeLessThanOrEqual(1);
    expect(geometry.preview.width).toBeLessThanOrEqual(geometry.grid.width + 1);
    expect(geometry.iframe.width).toBeLessThanOrEqual(geometry.stage.width + 1);

    if (viewport.twoColumns) {
      expect(Math.abs(geometry.sidebar.top - geometry.properties.top)).toBeLessThanOrEqual(2);
      expect(geometry.properties.left).toBeGreaterThan(geometry.sidebar.right);
      expect(geometry.preview.top).toBeGreaterThanOrEqual(Math.max(geometry.sidebar.bottom, geometry.properties.bottom) + 10);
      expect(geometry.preview.left).toBeLessThanOrEqual(geometry.sidebar.left + 2);
      expect(geometry.preview.right).toBeGreaterThanOrEqual(geometry.properties.right - 2);
    } else {
      expect(geometry.properties.top).toBeGreaterThanOrEqual(geometry.sidebar.bottom + 8);
      expect(geometry.preview.top).toBeGreaterThanOrEqual(geometry.properties.bottom + 8);
      expect(Math.abs(geometry.preview.width - geometry.sidebar.width)).toBeLessThanOrEqual(2);
    }
  });
}
