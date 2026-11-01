// App móvil, Fase 24 · Apariencia y contenido: en ≤768 las pestañas Diseño y Colores y sus controles
// (Deshacer/Rehacer/Guardar/Publicar, página, bloque nuevo, dispositivo, búsqueda) caben sin cortes,
// con toques de 44 px y campos de 16 px; tablet/escritorio sin cambios. Solo HTML estático del panel.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

async function open(page, width, tab) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(tab => {
    const s = document.getElementById('section-apariencia');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    s.querySelectorAll('.correos-panel').forEach(p => p.classList.toggle('active', p.id === 'apar-panel-' + tab));
    s.querySelectorAll('#apar-main-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.aparMainTab === tab));
    s.querySelectorAll('[hidden]').forEach(n => { if (!n.closest('dialog')) n.hidden = false; });
  }, tab);
  await page.waitForTimeout(500);
}
const measure = page => page.evaluate(() => {
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-apariencia');
  const name = n => n.id || n.dataset.visualDevice || n.dataset.aparMainTab || n.textContent.trim().slice(0, 24);
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]), textarea')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(name),
    smallFont: [...s.querySelectorAll('select, input:not([type=checkbox]):not([type=radio]), textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(name),
    // Palabra partida entre dos líneas (p. ej. "ESCRITORI/O"): un rango de una sola palabra con más de un rectángulo.
    brokenWords: [...s.querySelectorAll('button')].filter(vis).flatMap(b => {
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); const out = [];
      for (let t; (t = w.nextNode());) if (t.parentElement.getBoundingClientRect().width > 1) for (const m of t.data.matchAll(/\S+/g)) {
        const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length);
        if (rg.getClientRects().length > 1) out.push(m[0]);
      }
      return out;
    }),
    controls: [...s.querySelectorAll('button, select, input, textarea')].filter(vis).length,
  };
});

for (const width of [320, 390, 540, 768]) {
  for (const tab of ['diseno', 'colores']) {
    test(`apariencia (${tab}) en modo app a ${width}px`, async ({ page }) => {
      await open(page, width, tab);
      const m = await measure(page);
      expect(m.app).toBe(true);
      expect(m.controls).toBeGreaterThan(0);
      expect(m.overflow).toBe(false);
      expect(m.wide).toEqual([]);
      expect(m.small).toEqual([]);
      expect(m.smallFont).toEqual([]);
      expect(m.brokenWords).toEqual([]);
    });
  }
}

for (const width of [820, 1024, 1440]) {
  test(`apariencia sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width, 'diseno');
    expect((await measure(page)).app).toBe(false);
  });
}
