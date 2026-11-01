// App móvil del Super Admin — Fase 15: Imágenes (admin-images.html) con datos ficticios.
// Sin escrituras reales: los dobles de Firestore y de la biblioteca lanzan error al escribir.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');
const { respond, boot } = require('./helpers/imagenes-stubs.cjs');

for (const width of [320, 390, 540, 768, 820, 1024, 1440]) {
  test(`imágenes ${width}px: contenido visible, sin desborde y toques de 44px en teléfono`, async ({ page }) => {
    await load(page, width, 'admin-images.html', { respond });
    await boot(page);
    await expect(page.locator('.adm-img-card').first()).toBeVisible();
    for (const sec of ['hero', 'biblioteca']) {
      if (sec !== 'hero') await page.evaluate(s => document.querySelector(`[data-section="${s}"]`).click(), sec);
      const m = await page.evaluate(() => {
        const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
        const side = document.getElementById('adm-sidebar');
        const sideRight = vis(side) ? side.getBoundingClientRect().right : 0;
        const main = document.querySelector('.adm-main');
        const firstCard = document.querySelector('.adm-img-card, .tt-mlib, #adm-cards-grid > *');
        const tabs = document.getElementById('adm-mobile-tabs');
        const tabEls = [...tabs.querySelectorAll('.adm-mobile-tab')].filter(vis);
        const clipped = tabEls.filter(t => t.scrollWidth > t.clientWidth + 1).map(t => t.textContent.trim());
        const targets = [...main.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),.adm-card-select,.adm-autoreuse-toggle')]
          .filter(vis).filter(n => n.getBoundingClientRect().height < 44 || n.getBoundingClientRect().width < 44)
          .map(n => (n.id || n.className) + ':' + Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height));
        const fonts = [...main.querySelectorAll('input:not([type=checkbox]):not([type=file]),select,textarea')].filter(vis)
          .map(n => parseFloat(getComputedStyle(n).fontSize));
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          mainLeft: main.getBoundingClientRect().left, sideRight,
          cardLeft: firstCard ? firstCard.getBoundingClientRect().left : null,
          cols: getComputedStyle(document.getElementById('adm-cards-grid')).gridTemplateColumns.split(' ').length,
          tabs: tabEls.length, clipped, targets, minFont: fonts.length ? Math.min(...fonts) : 16,
        };
      });
      expect(m.overflow, `${sec}: desborde horizontal`).toBeLessThanOrEqual(0);
      // La barra lateral fija nunca tapa el contenido.
      expect(m.mainLeft, `${sec}: contenido bajo la barra lateral`).toBeGreaterThanOrEqual(m.sideRight - 1);
      if (m.cardLeft !== null) expect(m.cardLeft).toBeGreaterThanOrEqual(m.sideRight - 1);
      if (width <= 768) {
        expect(m.targets, `${sec}: toques menores a 44px`).toEqual([]);
        expect(m.minFont).toBeGreaterThanOrEqual(16);
        if (sec === 'hero') expect(m.cols).toBe(1);
        if (width <= 480) { expect(m.tabs).toBe(8); expect(m.clipped, 'etiquetas recortadas').toEqual([]); }
      }
    }
  });
}
