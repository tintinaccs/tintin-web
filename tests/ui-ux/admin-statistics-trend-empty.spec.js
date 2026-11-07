// "Esperando datos…" de la tendencia de 7 días ocupaba solo la primera de las
// 7 columnas de la cuadrícula y se partía letra a letra. Debe ocupar todo el ancho.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [390, 820, 1440]) {
  test(`mensaje vacío de tendencia a todo el ancho a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    const m = await page.evaluate(() => {
      document.querySelectorAll('.adm-content > .adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-estadisticas'));
      const chart = document.getElementById('statistics-revenue-trend');
      const empty = chart.querySelector('.adm-analytics-empty');
      const lineHeight = parseFloat(getComputedStyle(empty).fontSize) * 2;
      return { chart: chart.clientWidth, empty: empty.getBoundingClientRect().width, tall: empty.scrollHeight > Math.max(lineHeight, parseFloat(getComputedStyle(empty).minHeight)) };
    });
    expect(m.empty).toBeGreaterThan(m.chart * 0.8);
    expect(m.tall).toBe(false);
  });
}
