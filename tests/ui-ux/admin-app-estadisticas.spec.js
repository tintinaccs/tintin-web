// App móvil, Fase 2 · Estadísticas: KPIs en 2 columnas, filtros cómodos,
// barras con etiqueta y valor en una fila y texto legible. Filas ficticias con
// el mismo HTML que genera renderStatisticsBars (sin sesión, red ni datos reales).
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const open = page => page.evaluate(() => {
  document.querySelectorAll('.adm-content > .adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-estadisticas'));
  document.getElementById('statistics-order-status').innerHTML = [['Pagado', 12, 100], ['Pendiente de confirmación por transferencia', 3, 25]]
    .map(([l, c, w]) => `<div class="adm-bar-row"><div class="adm-bar-label" title="${l}">${l}</div><div class="adm-bar-track"><div class="adm-bar-fill" style="--adm-bar-width:${w}%"></div></div><div class="adm-bar-value">${c}</div></div>`).join('');
});

for (const width of [320, 390, 540, 768]) {
  test(`Estadísticas en modo app a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await open(page);
    const m = await page.evaluate(() => {
      const box = n => n.getBoundingClientRect();
      const section = document.getElementById('section-estadisticas');
      const kpis = [...section.querySelectorAll('.adm-stat-kpi')].map(box);
      const select = section.querySelector('.adm-statistics-toolbar .adm-select');
      const row = section.querySelector('#statistics-order-status .adm-bar-row');
      const [label, track, value] = ['.adm-bar-label', '.adm-bar-track', '.adm-bar-value'].map(s => box(row.querySelector(s)));
      const tiny = [...section.querySelectorAll('*')].filter(n => n.getClientRects().length && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(n).fontSize) < 11).map(n => n.className || n.tagName);
      return {
        kpiCols: new Set(kpis.map(r => Math.round(r.left))).size,
        select: { h: box(select).height, font: parseFloat(getComputedStyle(select).fontSize) },
        label, track, value, rowBox: box(row), tiny,
        empty: box(document.querySelector('#statistics-revenue-trend > .adm-analytics-empty')).width,
        trend: box(document.getElementById('statistics-revenue-trend')).width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(m.kpiCols).toBe(2);
    expect(m.select.h).toBeGreaterThanOrEqual(44);
    expect(m.select.font).toBeGreaterThanOrEqual(16);
    // Etiqueta y valor en la misma fila; la barra ocupa el ancho completo debajo.
    expect(Math.abs(m.label.top - m.value.top)).toBeLessThanOrEqual(4);
    expect(m.track.top).toBeGreaterThanOrEqual(m.label.bottom - 1);
    expect(m.track.width).toBeGreaterThan(m.rowBox.width - 4);
    expect(m.tiny).toEqual([]);
    expect(m.empty).toBeGreaterThan(m.trend * 0.8);
    expect(m.overflow).toBe(false);
  });
}

for (const width of [820, 1440]) {
  test(`Estadísticas conserva barras en una fila a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await open(page);
    const tops = await page.locator('#statistics-order-status .adm-bar-row').first().evaluate(row => ['.adm-bar-label', '.adm-bar-track', '.adm-bar-value'].map(s => row.querySelector(s).getBoundingClientRect()).map(r => r.top + r.height / 2));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
  });
}
