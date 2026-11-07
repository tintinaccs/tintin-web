// App móvil, Fase 21 · Correos: en ≤768 las 8 pestañas y sus paneles caben sin cortes, con toques de 44 px
// y campos de 16 px; tablet y escritorio sin cambios. Filas ficticias; no se envía ningún correo.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const PANELS = ['dashboard', 'pedidos', 'prueba', 'plantillas', 'clientas', 'promociones', 'historial', 'config'];
const rows = {
  'correos-dash-recent': '<tr><td>01/11/2026 10:00</td><td>Pedido recibido para clienta</td><td>cliente.con.un.email.muy.largo@ejemplo-dominio.com</td><td><span class="adm-badge">Enviado</span></td></tr>',
  'correos-pedidos-tbody': '<tr><td class="col-select"><input type="checkbox"></td><td>Pedido recibido para clienta</td><td><label class="adm-toggle"><input type="checkbox"><span class="adm-toggle-slider"></span></label></td><td>Plantilla</td><td>—</td><td><button type="button" class="adm-btn adm-btn-sm">Editar</button></td></tr>',
};

async function open(page, width, panel) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(({ panel, rows }) => {
    const s = document.getElementById('section-correos');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    document.querySelectorAll('.correos-panel').forEach(p => p.classList.toggle('active', p.id === 'correos-panel-' + panel));
    document.querySelectorAll('#correos-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.correosTab === panel));
    Object.entries(rows).forEach(([id, h]) => { const t = document.getElementById(id); if (t) t.innerHTML = h; });
  }, { panel, rows });
  await page.waitForTimeout(400);
}
const measure = page => page.evaluate(() => {
  // La cabecera de las tablas-tarjeta queda recortada a 1×1 px (solo lectores de pantalla): no cuenta como visible.
  const clipped = n => { const h = n.closest('thead'); return h && h.getBoundingClientRect().width <= 1; };
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && !clipped(n);
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-correos');
  const name = n => n.id || n.getAttribute('onclick') || n.dataset.correosTab || n.dataset.pruebaMode || n.textContent.trim().slice(0, 24);
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]), textarea')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(name),
    smallFont: [...s.querySelectorAll('select, input:not([type=checkbox]):not([type=radio]), textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(name),
  };
});

for (const width of [320, 390, 540, 768]) {
  for (const panel of PANELS) {
    test(`correos/${panel} en modo app a ${width}px`, async ({ page }) => {
      await open(page, width, panel);
      const m = await measure(page);
      expect(m.app).toBe(true);
      expect(m.overflow).toBe(false);
      expect(m.wide).toEqual([]);
      expect(m.small).toEqual([]);
      expect(m.smallFont).toEqual([]);
    });
  }
}

for (const width of [820, 1024, 1440]) {
  test(`correos sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width, 'pedidos');
    expect((await measure(page)).app).toBe(false);
  });
}
