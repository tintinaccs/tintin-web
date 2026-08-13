'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const baseCss = fs.readFileSync(path.join(root, 'css/admin/editor-visual.css'), 'utf8');
const studioCss = fs.readFileSync(path.join(root, 'css/admin/visual-studio-v2.css'), 'utf8');

// Contrato responsive: Página real arriba a todo el ancho;
// Constructor + inspector abajo, lado a lado cuando entra el ancho. En pantallas angostas se apilan.
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
  { name: 'desktop grande', width: 1440, height: 1000, twoColumns: true },
  { name: 'desktop compacto', width: 1180, height: 900, twoColumns: true },
  { name: 'tablet horizontal', width: 900, height: 800, twoColumns: true },
  { name: 'tablet vertical', width: 768, height: 1024, twoColumns: false },
  { name: 'mobile', width: 430, height: 900, twoColumns: false },
  { name: 'mobile angosto', width: 360, height: 800, twoColumns: false },
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
      const stage = document.querySelector('.visual-preview-stage');
      const iframe = document.querySelector('.visual-preview-stage iframe');
      const rect = element => element.getBoundingClientRect();
      return {
        grid: rect(grid), sidebar: rect(sidebar), properties: rect(properties), preview: rect(preview),
        stage: rect(stage), iframe: rect(iframe),
        stageScrollWidth: stage.scrollWidth, stageClientWidth: stage.clientWidth,
        bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
        gridOverflow: grid.scrollWidth - grid.clientWidth,
      };
    });

    expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
    expect(geometry.gridOverflow).toBeLessThanOrEqual(1);
    expect(geometry.preview.width).toBeLessThanOrEqual(geometry.grid.width + 1);
    expect(geometry.properties.width).toBeLessThanOrEqual(geometry.grid.width + 1);
    expect(geometry.iframe.width).toBeGreaterThanOrEqual(1024);
    expect(geometry.stageScrollWidth).toBeGreaterThanOrEqual(Math.floor(geometry.iframe.width));

    if (viewport.twoColumns) {
      expect(geometry.sidebar.top).toBeGreaterThanOrEqual(geometry.preview.bottom + 8);
      expect(Math.abs(geometry.sidebar.top - geometry.properties.top)).toBeLessThanOrEqual(2);
      expect(geometry.properties.left).toBeGreaterThan(geometry.sidebar.right);
      expect(geometry.preview.left).toBeLessThanOrEqual(geometry.sidebar.left + 2);
      expect(geometry.preview.right).toBeGreaterThanOrEqual(geometry.properties.right - 2);
    } else {
      expect(geometry.sidebar.top).toBeGreaterThanOrEqual(geometry.preview.bottom + 8);
      expect(geometry.properties.top).toBeGreaterThanOrEqual(geometry.sidebar.bottom + 8);
      expect(Math.abs(geometry.preview.width - geometry.sidebar.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.properties.width - geometry.sidebar.width)).toBeLessThanOrEqual(2);
    }
  });
}


test('Preview usa breakpoints reales de celular, tablet y escritorio', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.setContent(html);
  const stage = page.locator('.visual-preview-stage');
  const iframe = page.locator('.visual-preview-stage iframe');
  await iframe.evaluate(node => { node.style.transition = 'none'; });
  const previewFrame = page.frames().find(frame => frame.parentFrame() === page.mainFrame());
  expect(previewFrame).toBeTruthy();
  const measure = async device => {
    await stage.evaluate((node, value) => { node.dataset.device = value; }, device);
    await page.waitForTimeout(20);
    return previewFrame.evaluate(() => ({
      width: window.innerWidth,
      mobile: window.matchMedia('(max-width: 767px)').matches,
      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches,
      desktop: window.matchMedia('(min-width: 1025px)').matches,
    }));
  };
  const mobile = await measure('mobile');
  expect(mobile.width).toBe(390);
  expect(mobile.mobile).toBe(true);
  const tablet = await measure('tablet');
  expect(tablet.width).toBe(768);
  expect(tablet.tablet).toBe(true);
  expect(tablet.mobile).toBe(false);
  expect(tablet.desktop).toBe(false);
  const tabletScroll = await stage.evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  expect(tabletScroll.scrollWidth).toBeGreaterThan(tabletScroll.clientWidth);
  const desktop = await measure('desktop');
  expect(desktop.width).toBeGreaterThanOrEqual(1025);
  expect(desktop.desktop).toBe(true);
  expect(desktop.tablet).toBe(false);
});
