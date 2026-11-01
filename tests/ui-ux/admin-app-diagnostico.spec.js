// App móvil, Fase 19 · Diagnóstico: en ≤768 los 10 selectores y la fecha van a la hoja
// "Filtros" (mismos campos reales), pestañas sin cortar y toques de 44 px; tablet y
// escritorio sin cambios. Resultado ficticio; no se ejecuta ningún diagnóstico.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const finding = '<details class="adm-diagnostic-page" open><summary><span>Inicio</span><small>1 resultado(s)</small></summary><div class="adm-diagnostic-page-body"><article class="adm-diagnostic-item adm-diagnostic-item-high"><div class="adm-diagnostic-item-head"><h4>Imagen sin texto alternativo en /productos/aros-dorados-con-nombre-largo</h4><div class="adm-diagnostic-badges"><span class="adm-diagnostic-badge adm-diagnostic-badge-confirmed">Error confirmado</span></div></div><p>Evidencia <code>img.product-card__image-con-selector-largo[data-x]</code></p><details><summary>Detalle técnico</summary><div class="adm-diagnostic-detail-grid"><div><strong>Ruta</strong> /</div></div></details></article></div></details>';

async function open(page, width) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(html => {
    const s = document.getElementById('section-diagnostico');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    ['site-diagnostic-toolbar', 'site-diagnostic-view-tabs'].forEach(id => { document.getElementById(id).hidden = false; });
    document.getElementById('site-diagnostic-results').innerHTML = html;
  }, finding);
}
const measure = page => page.evaluate(() => {
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-diagnostico');
  const bar = document.getElementById('site-diagnostic-toolbar');
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input, summary')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(n => n.id || n.textContent.trim()),
    visibleSelects: [...bar.querySelectorAll('select, input[type=date]')].filter(vis).length,
    button: [...bar.querySelectorAll('.adm-app-filter-btn')].some(vis),
  };
});

for (const width of [320, 390, 540, 768]) {
  test(`diagnóstico en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    const m = await measure(page);
    expect(m.app).toBe(true);
    expect(m.overflow).toBe(false);
    expect(m.wide).toEqual([]);
    expect(m.small).toEqual([]);
    expect(m.visibleSelects).toBe(0);
    const button = page.locator('#site-diagnostic-toolbar > .adm-app-filter-btn');
    await expect(button).toHaveText('Filtros');
    await button.click();
    const sheet = page.locator('#adm-app-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.adm-app-sheet-body > .adm-app-filter-field')).toHaveCount(11);
    await sheet.locator('#site-diagnostic-severity').selectOption('high');
    await sheet.locator('#site-diagnostic-date').fill('2026-11-01');
    await sheet.locator('#site-diagnostic-date').dispatchEvent('change');
    await sheet.locator('.adm-app-sheet-done').click();
    await expect(sheet).toBeHidden();
    await expect(button).toHaveText('Filtros · 2');
    await expect(button).toBeFocused();
    // Los campos vuelven a su lugar real en la barra.
    expect(await page.locator('#site-diagnostic-toolbar > #site-diagnostic-severity').count()).toBe(1);
  });
}

for (const width of [820, 1024, 1440]) {
  test(`diagnóstico sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    const m = await measure(page);
    expect(m.app).toBe(false);
    expect(m.button).toBe(false);
    expect(m.visibleSelects).toBe(11);
  });
}
