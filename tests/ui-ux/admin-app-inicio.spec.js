// App móvil, Fase 1 · Inicio: resumen compacto, accesos en lista y últimos
// pedidos como filas legibles. Markup real del panel; filas ficticias con el
// mismo HTML que genera renderDashboardData (sin sesión, red ni datos reales).
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const fakeOrders = page => page.evaluate(() => {
  document.querySelectorAll('.tt-dashboard-link').forEach(n => { n.hidden = false; });
  document.getElementById('dash-recent-orders').innerHTML = [
    ['Ana Pérez Ficticia', '+52 000 000 0000', '$1,250.00', 'Pagado', 'Monterrey', '01 nov 2026'],
    ['cliente.de.prueba.con.correo.largo@example.test', '', '$89.00', 'Pendiente', 'Ciudad de México', '31 oct 2026'],
  ].map(([n, p, t, s, c, d]) => `<tr><td><strong>${n}</strong><br><small style="color:#777">${p}</small></td><td style="font-weight:700">${t}</td><td><span class="adm-badge">${s}</span></td><td>${c}</td><td>${d}</td></tr>`).join('');
});

for (const width of [320, 390, 540, 768]) {
  test(`Inicio en modo app a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await fakeOrders(page);
    const m = await page.evaluate(() => {
      const box = n => n.getBoundingClientRect();
      const stats = [...document.querySelectorAll('#dash-stats > .adm-stat')].map(box);
      const links = [...document.querySelectorAll('.tt-dashboard-link')].map(box);
      const rows = [...document.querySelectorAll('#dash-recent-orders > tr')];
      return {
        statCols: new Set(stats.map(r => Math.round(r.left))).size,
        statMaxH: Math.max(...stats.map(r => r.height)),
        linkLefts: new Set(links.map(r => Math.round(r.left))).size,
        linkMinH: Math.min(...links.map(r => r.height)),
        launcher: box(document.querySelector('.tt-dashboard-intro > button')),
        hero: box(document.querySelector('.tt-dashboard-hero')),
        thead: box(document.querySelector('.tt-dashboard-orders thead')),
        label: getComputedStyle(rows[0].children[0], '::before').content,
        rowDisplay: getComputedStyle(rows[0]).display,
        rowRight: Math.max(...rows.flatMap(r => [...r.children].map(c => box(c).right))),
        total: box(rows[0].children[1]), client: box(rows[0].children[0]),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(m.statCols).toBe(2);
    expect(m.statMaxH).toBeLessThanOrEqual(96);
    expect(m.linkLefts).toBe(1);
    expect(m.linkMinH).toBeGreaterThanOrEqual(44);
    expect(m.launcher.height).toBeGreaterThanOrEqual(44);
    expect(Math.round(m.launcher.width)).toBeGreaterThan(m.hero.width - 40);
    // Encabezados solo para lector de pantalla (patrón existente) y sin etiquetas repetidas por celda.
    expect(m.thead.height).toBeLessThanOrEqual(1);
    expect(['none', 'normal']).toContain(m.label);
    expect(m.rowDisplay).toBe('grid');
    expect(m.rowRight).toBeLessThanOrEqual(width);
    // Total a la derecha del cliente, en la misma fila.
    expect(m.total.left).toBeGreaterThanOrEqual(m.client.right - 1);
    expect(Math.abs(m.total.top - m.client.top)).toBeLessThanOrEqual(4);
    expect(m.overflow).toBe(false);
  });
}

for (const width of [820, 1440]) {
  test(`Inicio conserva la tabla a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await fakeOrders(page);
    expect(await page.locator('.tt-dashboard-orders thead').evaluate(n => getComputedStyle(n).display)).toBe('table-header-group');
    expect(await page.locator('#dash-recent-orders > tr').first().evaluate(n => getComputedStyle(n).display)).toBe('table-row');
  });
}
