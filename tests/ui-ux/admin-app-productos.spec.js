// App móvil, Fase 9 · Productos: se conserva la capa móvil propia del catálogo
// (mosaico, filtros, selección, ficha) y solo se compactan los indicadores y se
// agrandan los toques. También cubre el arreglo de la Fase 0: la animación de
// entrada no debe dejar un transform que saque de pantalla la barra de selección fija.
// Catálogo ficticio del fixture; no se guarda nada.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { mockRuntime, fixtureHtml } = require('./helpers/admin-commerce-fixture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const links = [...fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
  .map(m => `<link rel="stylesheet" href="/${m[1]}">`).join('');

async function open(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await mockRuntime(page);
  const html = fixtureHtml()
    .replace('</head>', links + '</head>')
    .replace('body{margin:0;padding:24px;', 'body{margin:0;padding:12px;')
    .replace('<section class="adm-section active" id="section-pedidos">', '<section class="adm-section" id="section-pedidos">')
    .replace('<section class="adm-section" id="section-productos">', '<section class="adm-section active" id="section-productos">')
    .replace('</body>', '<script type="module" src="/js/admin/maestro/app-movil-admin.js"></script></body>');
  await page.route('https://tintin.test/admin-commerce-fixture', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
}
const metricColumns = page => page.locator('#tt-commerce-products .tt-product-metrics > button')
  .evaluateAll(list => new Set(list.map(n => Math.round(n.getBoundingClientRect().left))).size);

for (const width of [320, 390, 540, 768]) {
  test(`Productos en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    // Arreglo F0: terminada la animación, la sección no conserva transform.
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('section-productos')).transform)).toBe('none');
    expect(await metricColumns(page)).toBe(3);
    const m = await page.evaluate(() => {
      const root = document.getElementById('tt-commerce-products');
      const visible = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        small: [...root.querySelectorAll('button,select,input:not([type=checkbox]),a')].filter(visible)
          .filter(n => n.getBoundingClientRect().height < 44).map(n => n.dataset.action || n.tagName),
        fonts: [...root.querySelectorAll('select,input:not([type=checkbox])')].filter(visible)
          .filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).length,
        // Ninguna palabra partida a la mitad en los indicadores.
        broken: [...root.querySelectorAll('.tt-product-metrics span')].filter(n => n.textContent.trim().split(/\s+/).some(word => {
          const t = n.firstChild; if (!t || t.nodeType !== 3) return false;
          const r = document.createRange(); const i = t.textContent.indexOf(word); r.setStart(t, i); r.setEnd(t, i + word.length); return r.getClientRects().length > 1;
        })).map(n => n.textContent.trim()),
        // El selector de visibilidad ocupa el ancho de la tarjeta (antes 96 px y texto cortado).
        visibility: [...root.querySelectorAll('[data-card-active]')].map(s => s.getBoundingClientRect().width - s.closest('.tt-card-edit-grid').getBoundingClientRect().width),
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.small).toEqual([]);
    expect(m.fonts).toBe(0);
    expect(m.broken).toEqual([]);
    for (const diff of m.visibility) expect(Math.abs(diff)).toBeLessThan(1);

    // Barra de selección fija visible dentro de la pantalla.
    await page.locator('[data-select-product="p-reloj"]').check();
    const bar = page.locator('#tt-commerce-products .tt-product-selection');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('1 seleccionado');
    const box = await bar.boundingBox();
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await expect(bar.getByRole('button', { name: 'Acciones' })).toBeInViewport();
    expect((await page.evaluate(() => window.__calls)).filter(c => /Toggle|Guardar|Delete/i.test(c[0]))).toEqual([]);
  });
}

for (const [width, columns] of [[820, 4], [1440, 7]]) {
  test(`Productos sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    expect(await metricColumns(page)).toBe(columns);
    const label = await page.locator('[data-card-active]').first().evaluate(s => getComputedStyle(s.closest('.tt-card-visibility')).justifyContent);
    expect(label).toBe('start');
  });
}
