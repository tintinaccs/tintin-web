// App móvil, Fase 22 · Configuración: en ≤768 todo el módulo (datos, envíos, redes, medición, cuentas,
// notificaciones) cabe sin cortes, con toques de 44 px y campos de 16 px; tablet/escritorio sin cambios.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

async function open(page, width, shipTab) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(shipTab => {
    const s = document.getElementById('section-configuracion');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    s.querySelectorAll('[hidden]').forEach(n => { if (n.closest('.adm-card')) n.hidden = false; });
    const b = s.querySelector(`[data-ship-tab="${shipTab}"]`); if (b) b.click();
  }, shipTab);
  await page.waitForTimeout(500);
}
const measure = page => page.evaluate(() => {
  const clipped = n => { const h = n.closest('thead'); return h && h.getBoundingClientRect().width <= 1; };
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && !clipped(n);
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-configuracion');
  const name = n => n.id || n.getAttribute('onclick') || n.dataset.shipTab || n.textContent.trim().slice(0, 24);
  const hit = n => { const l = n.closest('label') || (n.id && s.querySelector(`label[for="${n.id}"]`)) || n; return Math.max(r(n).height, r(l).height); };
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, a.adm-btn')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(name),
    smallHit: [...s.querySelectorAll('input[type=checkbox], input[type=radio]')].filter(vis).filter(n => Math.round(hit(n)) < 44).map(name),
    smallFont: [...s.querySelectorAll('select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(name),
  };
});

for (const width of [320, 390, 540, 768]) {
  for (const tab of ['delivery', 'encomienda']) {
    test(`configuración (${tab}) en modo app a ${width}px`, async ({ page }) => {
      await open(page, width, tab);
      const m = await measure(page);
      expect(m.app).toBe(true);
      expect(m.overflow).toBe(false);
      expect(m.wide).toEqual([]);
      expect(m.small).toEqual([]);
      expect(m.smallHit).toEqual([]);
      expect(m.smallFont).toEqual([]);
    });
  }
}

for (const width of [820, 1024, 1440]) {
  test(`configuración sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width, 'delivery');
    expect((await measure(page)).app).toBe(false);
  });
}
