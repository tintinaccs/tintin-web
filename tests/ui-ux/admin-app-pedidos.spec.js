// App móvil, Fase 4 · Pedidos: acciones y contadores compactos, búsqueda +
// botón Filtros (Pago/Entrega/Orden en la hoja inferior) y vistas en una fila.
// Tablero real con pedidos ficticios (sin red, sesión ni datos reales).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { mockRuntime, fixtureHtml } = require('./helpers/admin-commerce-fixture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const links = [...fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
  .map(m => `<link rel="stylesheet" href="/${m[1]}">`).join('');
const seed = () => ['pendiente', 'preparando', 'listo', 'en_camino', 'entregado'].map((status, i) => ({
  id: `order_fixture_${i}`, orderNumber: `TINPED${i + 101}`, status, shippingMethod: 'delivery',
  createdAt: { seconds: 1791840000 - i * 60 }, lastChangeId: `initial_${i}`, inventoryRevision: 1,
  userName: 'Cliente QA ' + i, userPhone: '0981123456', userEmail: 'cliente@example.test',
  shipping: { method: 'delivery', city: 'San Lorenzo', address: 'Dirección de prueba' },
  paymentStatus: 'pendiente', paymentMethod: 'transferencia', subtotal: 35000, shippingCost: 15000, total: 50000,
  items: [{ id: 'product_1', name: 'Pulsera de prueba', variant: 'Rosa', qty: 1, price: 35000 }],
}));

async function open(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await mockRuntime(page, { orders: seed() });
  const html = fixtureHtml()
    .replace('</head>', links + '</head>')
    .replace('body{margin:0;padding:24px;', 'body{margin:0;padding:12px;')
    .replace('</body>', '<script type="module" src="/js/admin/maestro/app-movil-admin.js"></script></body>');
  await page.route('https://tintin.test/admin-commerce-fixture', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('.tt-order-card').first()).toBeVisible();
}

for (const width of [320, 390, 540, 768]) {
  test(`Pedidos en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    const button = page.locator('#tt-commerce-orders .tt-order-toolbar .adm-app-filter-btn');
    await expect(button).toHaveText('Filtros');
    const m = await page.evaluate(() => {
      const box = n => n.getBoundingClientRect();
      const root = document.getElementById('tt-commerce-orders');
      const toolbar = root.querySelector('.tt-order-toolbar');
      const views = root.querySelector('.tt-order-views');
      return {
        visibleLabels: [...toolbar.querySelectorAll(':scope > label')].filter(l => l.getClientRects().length).length,
        searchFont: parseFloat(getComputedStyle(toolbar.querySelector('input')).fontSize),
        toolbarH: box(toolbar).height,
        metricCols: new Set([...root.querySelectorAll('.tt-order-metrics > div')].map(n => Math.round(box(n).left))).size,
        viewsTop: new Set([...views.children].map(n => Math.round(box(n).top))).size,
        viewsMinH: Math.min(...[...views.children].map(n => box(n).height)),
        actionsMinH: Math.min(...[...root.querySelectorAll('.tt-commerce-actions > button')].map(n => box(n).height)),
        // Ninguna palabra partida a la mitad en contadores ni pestañas de etapa.
        broken: [...root.querySelectorAll('.tt-order-metrics span, .tt-order-stage-tabs .tt-order-step-label')].filter(n => n.scrollWidth > n.clientWidth + 1 || [...n.textContent.trim().split(/\s+/)].some(word => {
          const r = document.createRange(); const t = n.firstChild; if (!t || t.nodeType !== 3) return false;
          const i = t.textContent.indexOf(word); r.setStart(t, i); r.setEnd(t, i + word.length); return r.getClientRects().length > 1;
        })).map(n => n.textContent.trim()),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(m.visibleLabels).toBe(1); // solo la búsqueda queda en la barra
    expect(m.searchFont).toBeGreaterThanOrEqual(16);
    expect(m.toolbarH).toBeLessThan(140);
    expect(m.metricCols).toBe(width < 360 ? 2 : 3);
    expect(m.viewsTop).toBe(1); // vistas en una sola fila deslizable
    expect(m.viewsMinH).toBeGreaterThanOrEqual(44);
    expect(m.actionsMinH).toBeGreaterThanOrEqual(44);
    expect(m.broken).toEqual([]);
    expect(m.overflow).toBe(false);

    // La hoja usa los selectores reales: filtrar sigue funcionando y al cerrar vuelven a su lugar.
    await button.click();
    const sheet = page.locator('#adm-app-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('select')).toHaveCount(3);
    const fields = await sheet.locator('select').evaluateAll(list => list.map(s => ({ h: s.getBoundingClientRect().height, f: parseFloat(getComputedStyle(s).fontSize) })));
    for (const f of fields) { expect(f.h).toBeGreaterThanOrEqual(44); expect(f.f).toBeGreaterThanOrEqual(16); }
    await sheet.locator('[data-filter="order-delivery"]').selectOption('encomienda');
    await expect(page.locator('.tt-order-card')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveText('Filtros · 1');
    await expect(page.locator('#tt-commerce-orders .tt-order-toolbar [data-filter="order-delivery"]')).toHaveValue('encomienda');
    await button.click();
    await sheet.locator('[data-filter="order-delivery"]').selectOption('');
    await sheet.getByRole('button', { name: 'Listo' }).click();
    await expect(button).toHaveText('Filtros');
    await expect(page.locator('.tt-order-card').first()).toBeVisible();
  });
}

for (const width of [820, 1440]) {
  test(`Pedidos sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    await expect(page.locator('.adm-app-filter-btn')).toBeHidden();
    const visible = await page.locator('#tt-commerce-orders .tt-order-toolbar > label').evaluateAll(list => list.filter(l => l.getClientRects().length).length);
    expect(visible).toBe(4);
  });
}
