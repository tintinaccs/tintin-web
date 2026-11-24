// App móvil, Fase 12 · Colecciones: se conservan las tarjetas propias del catálogo
// (shopify-commerce-admin.js); Visibilidad y Orden pasan a la hoja de filtros,
// búsqueda y casillas de 44 px, y el detalle ocupa toda la pantalla con Cerrar de
// 44 px. Catálogo ficticio del fixture (las escrituras lanzan error); no se guarda nada.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { mockRuntime, fixtureHtml } = require('./helpers/admin-commerce-fixture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const links = [...fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
  .map(m => `<link rel="stylesheet" href="/${m[1]}">`).join('');

async function open(page, width, options = {}) {
  await page.setViewportSize({ width, height: 844 });
  await mockRuntime(page, options);
  const html = fixtureHtml()
    .replace('</head>', links + '</head>')
    .replace('body{margin:0;padding:24px;', 'body{margin:0;padding:12px;')
    .replace('<section class="adm-section active" id="section-pedidos">', '<section class="adm-section" id="section-pedidos">')
    .replace('<section class="adm-section" id="section-colecciones">', '<section class="adm-section active" id="section-colecciones">')
    .replace('</body>', '<script type="module" src="/js/admin/maestro/app-movil-admin.js"></script></body>');
  await page.route('https://tintin.test/admin-commerce-fixture', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('#tt-commerce-collections tbody tr')).toHaveCount(options.collections?.length ?? 3);
}
const rows = page => page.locator('#tt-commerce-collections tbody tr');
const visibleSelects = page => page.locator('#tt-commerce-collections .tt-commerce-toolbar > select').evaluateAll(list => list.filter(n => n.getClientRects().length).length);
const drawerBox = page => page.locator('.tt-commerce-drawer').evaluate(node => {
  const ref = document.createElement('div'); ref.style.cssText = 'position:fixed;left:0;right:0;top:0;height:0'; document.body.append(ref);
  const vw = ref.getBoundingClientRect().width; ref.remove(); // el navegador de pruebas reserva el canal de la barra de desplazamiento
  const r = node.getBoundingClientRect();
  return { w: r.width, h: r.height, vw, close: node.querySelector('[data-action="drawer-close"]').getBoundingClientRect() };
});

for (const width of [320, 390, 540, 768]) {
  test(`Colecciones en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    const button = page.locator('#tt-commerce-collections .tt-commerce-toolbar > .adm-app-filter-btn');
    await expect(button).toHaveText('Filtros');
    expect(await visibleSelects(page)).toBe(0);
    const m = await page.evaluate(() => {
      const root = document.getElementById('tt-commerce-collections');
      const visible = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        toolbarH: root.querySelector('.tt-commerce-toolbar').getBoundingClientRect().height,
        small: [...root.querySelectorAll('button, select, input:not([type="checkbox"]), .tt-commerce-product-check, .tt-collection-select-page')].filter(visible)
          .map(n => ({ t: (n.textContent || n.dataset.filter || n.className).trim().slice(0, 24), r: n.getBoundingClientRect() }))
          .filter(x => Math.round(x.r.height) < 44 || Math.round(x.r.width) < 44).map(x => x.t),
        minFont: Math.min(...[...root.querySelectorAll('input:not([type="checkbox"]), select')].filter(visible).map(n => parseFloat(getComputedStyle(n).fontSize))),
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.toolbarH).toBeLessThan(80);
    expect(m.small).toEqual([]);
    expect(m.minFont).toBeGreaterThanOrEqual(16);

    // Hoja con los selectores reales: filtrar sigue funcionando aunque la barra se redibuje.
    await button.click();
    const sheet = page.locator('#adm-app-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('select')).toHaveCount(2);
    await sheet.locator('[data-filter="collection-visibility"]').selectOption('hidden');
    await expect(rows(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    const current = page.locator('#tt-commerce-collections .tt-commerce-toolbar > .adm-app-filter-btn');
    await expect(current).toBeFocused();
    await expect(current).toHaveText('Filtros · 1');
    expect(await visibleSelects(page)).toBe(0);
    await current.click();
    await sheet.locator('[data-filter="collection-visibility"]').selectOption('');
    await sheet.getByRole('button', { name: 'Listo' }).click();
    await expect(current).toHaveText('Filtros');
    await expect(rows(page)).toHaveCount(3);

    // Detalle a pantalla completa con Cerrar de 44 px.
    await rows(page).first().locator('.tt-commerce-maintext').click();
    await expect(page.locator('.tt-commerce-drawer.open')).toBeVisible();
    await expect.poll(async () => { const d = await drawerBox(page); return Math.round(d.w) - Math.round(d.vw); }).toBe(0);
    const d = await drawerBox(page);
    expect(Math.round(d.h)).toBe(844);
    expect(Math.round(d.close.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(d.close.width)).toBeGreaterThanOrEqual(44);
  });
}

for (const width of [820, 1440]) {
  test(`Colecciones sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    expect(await page.locator('.adm-app-filter-btn').evaluateAll(list => list.filter(n => n.getClientRects().length).length)).toBe(0);
    expect(await visibleSelects(page)).toBe(2);
    await rows(page).first().locator('.tt-commerce-maintext').click();
    await expect(page.locator('.tt-commerce-drawer.open')).toBeVisible();
    await expect.poll(() => page.locator('.tt-commerce-drawer').evaluate(n => Math.round(n.getBoundingClientRect().width))).toBe(440);
    expect(Math.round((await drawerBox(page)).close.height)).toBe(32);
  });
}

// Regresión: el contenedor de la grilla heredaba el alto máximo de las tablas
// (62vh) sin desplazamiento propio y la tarjeta recortaba la segunda fila en adelante.
for (const width of [1566, 1024, 390]) {
  test(`Colecciones muestra todas las tarjetas sin recorte a ${width}px`, async ({ page }) => {
    const collections = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, data: { name: `Colección ${i + 1}`, visible: true, order: i } }));
    await open(page, width, { collections });
    const clip = await page.locator('#tt-commerce-collections').evaluate(root => {
      const card = root.querySelector('.tt-commerce-card');
      const last = [...root.querySelectorAll('tbody tr')].at(-1);
      const footer = root.querySelector('.tt-commerce-footer');
      return { overflow: card.scrollHeight - card.clientHeight, lastBottom: last.getBoundingClientRect().bottom, cardBottom: card.getBoundingClientRect().bottom, footerHeight: footer?.getBoundingClientRect().height ?? 0 };
    });
    expect(clip.overflow).toBeLessThanOrEqual(1);
    expect(clip.lastBottom).toBeLessThanOrEqual(clip.cardBottom);
    await rows(page).last().scrollIntoViewIfNeeded();
    await expect(rows(page).last()).toBeInViewport();
    await expect(page.locator('#tt-commerce-collections .tt-commerce-footer')).toContainText('12 de 12 colecciones');
  });
}
