// App móvil, Fase 5 · Ventas locales, Clientes que compraron y Espejos de Sheets:
// acciones en 2 columnas, búsqueda + botón Filtros (Mes/Casilla/Estado en la hoja,
// también tras redibujar la lista), editor a pantalla completa con barra fija y
// resumen mensual compacto. Datos ficticios; no se guarda nada (no se toca Guardar).
const { test, expect } = require('@playwright/test');
const safeJson = value => JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const html = removeFixtureScripts(fs.readFileSync(path.resolve(__dirname, '../../admin.html'), 'utf8'), { removeModulePreloads: true });
const payload = {
  ok: true, revision: 'fixture', checkedAt: '2026-10-20T12:00:00Z', contacts: [], webOrders: [],
  customers: [{ id: 'fixture', name: 'Clienta de ejemplo', hasWebAccount: false, orderCount: 1, totalPurchased: 50000, totalPaid: 50000, lastPurchase: '2026-10-20', phone: '0981123456', city: 'San Lorenzo' }],
  entries: [
    { id: 'LOCAL_sale', kind: 'sale', year: 2026, month: 10, customerName: 'Clienta de ejemplo', total: 50000, paymentStatus: 'pagado', lines: [], notes: 'Registro ficticio' },
    { id: 'LOCAL_expense', kind: 'expense', year: 2026, month: 3, detail: 'Gasto de ejemplo', amount: 1250000, category: 'insumos' },
  ],
};

async function open(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/__local-app', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/js/core/auth/cliente-api-autenticado.js?*', route => route.fulfill({ contentType: 'text/javascript', body: `export async function authenticatedFetch(){return Response.json(${safeJson(payload)});}` }));
  await page.goto('/__local-app');
  await page.evaluate(() => { document.documentElement.classList.add('adm-auth-ready'); document.querySelectorAll('.adm-section').forEach(node => node.classList.toggle('active', node.id === 'section-ventas-locales')); });
  await page.addScriptTag({ type: 'module', url: '/js/admin/maestro/app-movil-admin.js' });
  await page.addScriptTag({ type: 'module', url: '/js/admin/comercio-local-admin.js' });
  await expect(page.locator('#local-ledger .local-record')).toHaveCount(2);
}
const show = (page, id) => page.evaluate(id => document.querySelectorAll('.adm-section').forEach(node => node.classList.toggle('active', node.id === 'section-' + id)), id);
const visibleLabels = page => page.locator('#local-ledger > .local-toolbar > label').evaluateAll(list => list.filter(l => l.getClientRects().length).length);

for (const width of [320, 390, 540, 768]) {
  test(`Ventas locales en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    const ledgerButton = () => page.locator('#local-ledger > .local-toolbar > .adm-app-filter-btn');
    await expect(ledgerButton()).toHaveText('Filtros');
    expect(await visibleLabels(page)).toBe(1);
    const m = await page.evaluate(() => {
      const actions = [...document.querySelectorAll('#section-ventas-locales > .adm-card > .local-toolbar > button')];
      return {
        searchFont: parseFloat(getComputedStyle(document.querySelector('[data-local-search]')).fontSize),
        actionsMinH: Math.min(...actions.map(b => b.getBoundingClientRect().height)),
        primaryFirst: actions.find(b => b.classList.contains('adm-btn-primary')).getBoundingClientRect().top <= Math.min(...actions.map(b => b.getBoundingClientRect().top)),
        // Ninguna palabra partida a la mitad en los botones de acción.
        broken: actions.filter(b => b.textContent.trim().split(/\s+/).some(word => {
          const t = b.firstChild; if (!t || t.nodeType !== 3) return false;
          const r = document.createRange(); const i = t.textContent.indexOf(word); r.setStart(t, i); r.setEnd(t, i + word.length); return r.getClientRects().length > 1;
        })).map(b => b.textContent.trim()),
      };
    });
    expect(m.searchFont).toBeGreaterThanOrEqual(16);
    expect(m.actionsMinH).toBeGreaterThanOrEqual(44);
    expect(m.primaryFirst).toBe(true);
    expect(m.broken).toEqual([]);

    for (const id of ['ventas-locales', 'clientes-compraron', 'espejos-sheets']) {
      await show(page, id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), id).toBe(true);
    }
    const cols = await page.locator('#local-mirror-map .local-grid > .local-record').evaluateAll(list => new Set(list.map(n => Math.round(n.getBoundingClientRect().left))).size);
    expect(cols).toBe(width < 360 ? 1 : 2);
    await show(page, 'ventas-locales');

    // Hoja de filtros con los selectores reales; la lista se redibuja con la hoja abierta.
    await ledgerButton().click();
    const sheet = page.locator('#adm-app-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('select')).toHaveCount(3);
    for (const f of await sheet.locator('select').evaluateAll(list => list.map(s => ({ h: s.getBoundingClientRect().height, f: parseFloat(getComputedStyle(s).fontSize) })))) {
      expect(f.h).toBeGreaterThanOrEqual(44); expect(f.f).toBeGreaterThanOrEqual(16);
    }
    await sheet.locator('[data-local-filter="kind"]').selectOption('expense');
    await expect(page.locator('#local-ledger .local-record')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(ledgerButton()).toHaveCount(1);
    await expect(ledgerButton()).toBeFocused();
    await expect(ledgerButton()).toHaveText('Filtros · 1');
    await expect(page.locator('#local-ledger > .local-toolbar [data-local-filter="kind"]')).toHaveValue('expense');
    expect(await visibleLabels(page)).toBe(1);

    // Buscar redibuja la barra: el botón y la hoja siguen enganchados.
    await page.locator('[data-local-search]').fill('gasto');
    await expect(page.locator('#local-ledger .local-record')).toHaveCount(1);
    await expect(ledgerButton()).toHaveText('Filtros · 1');
    expect(await visibleLabels(page)).toBe(1);
    await page.locator('[data-local-search]').fill('');
    await ledgerButton().click();
    await sheet.locator('[data-local-filter="kind"]').selectOption('');
    await sheet.getByRole('button', { name: 'Listo' }).click();
    await expect(ledgerButton()).toHaveText('Filtros');
    await expect(page.locator('#local-ledger .local-record')).toHaveCount(2);

    // Editor a pantalla completa con barra fija de Cerrar/Guardar visible.
    await page.locator('[data-local-new="sale"]').click();
    const dialog = page.locator('dialog.local-dialog');
    await expect(dialog).toBeVisible();
    const d = await dialog.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const bar = node.querySelector('form > .local-toolbar').getBoundingClientRect();
      return {
        w: rect.width, h: rect.height, vw: (() => { const ref = document.createElement('div'); ref.style.cssText = 'position:fixed;left:0;right:0;top:0;height:0'; document.body.append(ref); const w = ref.getBoundingClientRect().width; ref.remove(); return w; })(), // ancho fijo disponible (el navegador de pruebas reserva el canal de la barra de desplazamiento; en teléfono es 0)
        barBottom: bar.bottom, barH: bar.height,
        fonts: Math.min(...[...node.querySelectorAll('.local-form input, .local-form select, .local-form textarea')].map(n => parseFloat(getComputedStyle(n).fontSize))),
        buttonsMinH: Math.min(...[...node.querySelectorAll('form > .local-toolbar > button')].map(n => n.getBoundingClientRect().height)),
      };
    });
    expect(Math.round(d.w)).toBe(d.vw);
    expect(d.vw).toBeGreaterThan(width - 20);
    expect(Math.round(d.h)).toBe(844);
    expect(d.barBottom).toBeLessThanOrEqual(845);
    expect(d.barBottom).toBeGreaterThan(844 - d.barH - 2); // pegada al borde inferior
    expect(d.fonts).toBeGreaterThanOrEqual(16);
    expect(d.buttonsMinH).toBeGreaterThanOrEqual(44);
    await expect(dialog.getByRole('button', { name: /Guardar y sincronizar/ })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialog).toHaveCount(0);
  });
}

for (const width of [820, 1440]) {
  test(`Ventas locales sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    await expect(page.locator('.adm-app-filter-btn')).toBeHidden();
    expect(await visibleLabels(page)).toBe(4);
    await page.locator('[data-local-new="sale"]').click();
    const w = await page.locator('dialog.local-dialog').evaluate(node => node.getBoundingClientRect().width);
    expect(w).toBeLessThan(width);
    expect(w).toBeLessThanOrEqual(800);
  });
}
