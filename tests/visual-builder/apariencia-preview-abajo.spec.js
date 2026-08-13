'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const baseCss = fs.readFileSync(path.join(root, 'css/admin/editor-visual.css'), 'utf8');
const studioCss = fs.readFileSync(path.join(root, 'css/admin/visual-studio-v2.css'), 'utf8');

// Contrato responsive: en escritorio se ven constructor, página real e inspector
// en paralelo. En anchos intermedios y móviles se reorganizan sin desbordar.
const html = `<!doctype html>
<html lang="es">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--adm-border:#eadde2;--adm-bg:#fff7fa;--adm-card:#fff;--adm-text:#30242a;--adm-muted:#766a70;--adm-accent:#ad3f67;--shadow-sm:0 2px 10px rgba(0,0,0,.05)}
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{padding:16px;background:#fff}
${baseCss}
${studioCss}
</style>
<body>
  <main style="width:100%;max-width:1400px;margin:0 auto">
    <section class="visual-editor visual-studio-v2">
      <header class="visual-editor-topbar"><h2>Editor visual seguro</h2><div class="visual-editor-actions"><button>Guardar</button></div></header>
      <div class="visual-editor-status">Borrador sincronizado</div>
      <div class="visual-editor-layout">
        <aside class="visual-editor-sidebar">
          <div class="visual-studio-brand"><strong>Tintin</strong><span>Constructor visual</span></div>
          <div class="visual-section-list">
            <button class="visual-section-select">Banner principal</button>
            <button class="visual-section-select">Productos destacados</button>
          </div>
        </aside>
        <section class="visual-editor-properties">
          <h3>Banner principal</h3>
          <div class="visual-inspector-tabs"><button>Contenido</button><button>Diseño</button><button>Responsive</button><button>Avanzado</button></div>
          <div id="visual-properties">
            <div class="visual-property-grid">
              <div class="visual-property"><label>Título</label><input style="width:100%"></div>
              <div class="visual-property"><label>Subtítulo</label><input style="width:100%"></div>
            </div>
          </div>
        </section>
        <section class="visual-editor-preview">
          <div class="visual-preview-head">
            <div><h3>Página real</h3><small>Versión publicada</small></div>
            <div class="visual-devices"><button>Celular</button><button>Tablet</button><button>Escritorio</button></div>
          </div>
          <div class="visual-preview-stage" data-device="desktop"><iframe title="Vista previa"></iframe></div>
        </section>
      </div>
    </section>
  </main>
</body></html>`;

const viewports = [
  { name: 'desktop grande', width: 1440, height: 1000, mode: 'three' },
  { name: 'desktop compacto', width: 1180, height: 900, mode: 'three' },
  { name: 'tablet horizontal', width: 900, height: 800, mode: 'two' },
  { name: 'tablet vertical', width: 768, height: 1024, mode: 'two' },
  { name: 'mobile', width: 430, height: 900, mode: 'stacked' },
  { name: 'mobile angosto', width: 360, height: 800, mode: 'stacked' },
];

for (const viewport of viewports) {
  test(`Apariencia unificada fit en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(html);

    const geometry = await page.evaluate(() => {
      const grid = document.querySelector('.visual-editor-layout');
      const sidebar = document.querySelector('.visual-editor-sidebar');
      const properties = document.querySelector('.visual-editor-properties');
      const preview = document.querySelector('.visual-editor-preview');
      const topbar = document.querySelector('.visual-editor-topbar');
      const status = document.querySelector('.visual-editor-status');
      const stage = document.querySelector('.visual-preview-stage');
      const iframe = document.querySelector('.visual-preview-stage iframe');
      const rect = element => element.getBoundingClientRect();
      return {
        grid: rect(grid), sidebar: rect(sidebar), properties: rect(properties), preview: rect(preview),
        topbar: rect(topbar), status: rect(status),
        stage: rect(stage), iframe: rect(iframe),
        bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
        gridOverflow: grid.scrollWidth - grid.clientWidth,
      };
    });

    expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
    expect(geometry.gridOverflow).toBeLessThanOrEqual(1);
    expect(geometry.preview.width).toBeLessThanOrEqual(geometry.grid.width + 1);
    expect(geometry.properties.width).toBeLessThanOrEqual(geometry.grid.width + 1);
    expect(geometry.iframe.width).toBeLessThanOrEqual(geometry.stage.width + 1);
    expect(geometry.topbar.height).toBeGreaterThan(0);
    expect(geometry.status.height).toBeGreaterThan(0);
    expect(geometry.grid.top).toBeGreaterThanOrEqual(geometry.status.bottom - 1);

    if (viewport.mode === 'three') {
      expect(Math.abs(geometry.sidebar.top - geometry.preview.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.sidebar.top - geometry.properties.top)).toBeLessThanOrEqual(2);
      expect(geometry.preview.left).toBeGreaterThanOrEqual(geometry.sidebar.right - 1);
      expect(geometry.properties.left).toBeGreaterThan(geometry.sidebar.right);
      expect(geometry.properties.left).toBeGreaterThanOrEqual(geometry.preview.right - 1);
    } else if (viewport.mode === 'two') {
      expect(Math.abs(geometry.sidebar.top - geometry.preview.top)).toBeLessThanOrEqual(2);
      expect(geometry.preview.left).toBeGreaterThanOrEqual(geometry.sidebar.right - 1);
      expect(geometry.properties.top).toBeGreaterThanOrEqual(Math.max(geometry.sidebar.bottom, geometry.preview.bottom) - 1);
    } else {
      expect(geometry.preview.top).toBeGreaterThanOrEqual(geometry.sidebar.bottom - 1);
      expect(geometry.properties.top).toBeGreaterThanOrEqual(geometry.preview.bottom - 1);
      expect(Math.abs(geometry.preview.width - geometry.sidebar.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.properties.width - geometry.sidebar.width)).toBeLessThanOrEqual(2);
    }
  });
}
