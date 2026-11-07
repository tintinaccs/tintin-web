// App móvil, Fase 16 · Mensajes: la sección es una tarjeta con texto y un enlace a
// WhatsApp. En ≤768 el enlace pasa a botón principal a todo el ancho (44px); en
// tablet/escritorio se conserva el botón en línea. No se abre WhatsApp ni se envía nada.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [320, 390, 540, 768, 820, 1024, 1440]) {
  test(`mensajes ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    await page.evaluate(() => document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-mensajes')));
    const m = await page.evaluate(() => {
      const box = n => n.getBoundingClientRect();
      const a = document.getElementById('mensajes-wa-link');
      const card = document.querySelector('#section-mensajes .adm-card-body');
      const cs = getComputedStyle(card);
      const inner = box(card).width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      return { app: document.documentElement.classList.contains('adm-app'), w: box(a).width, h: box(a).height, inner,
        overflow: document.documentElement.scrollWidth > innerWidth, font: parseFloat(getComputedStyle(a).fontSize) };
    });
    expect(m.overflow).toBe(false);
    if (width <= 768) {
      expect(m.app).toBe(true);
      expect(m.h).toBeGreaterThanOrEqual(44);
      expect(Math.abs(m.w - m.inner)).toBeLessThanOrEqual(1);
    } else {
      expect(m.app).toBe(false);
      expect(m.w).toBeLessThan(m.inner - 40);
    }
  });
}
