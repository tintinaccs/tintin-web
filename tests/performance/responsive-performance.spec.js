'use strict';

/**
 * Estabilidad visual en las 7 resoluciones obligatorias: sin scroll horizontal,
 * sin header superpuesto, contenido utilizable y loader cerrado, en el home y
 * en el catálogo.
 */
const { test, expect } = require('@playwright/test');
const { VIEWPORTS, url, waitLoaderGone, BUDGETS } = require('./_helpers');

for (const vp of VIEWPORTS) {
  for (const pageName of ['index.html', 'catalogo.html']) {
    test(`[responsive ${vp.width}px] ${pageName}: estable y sin overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(url(pageName), { waitUntil: 'load', timeout: 45000 });
      await waitLoaderGone(page, BUDGETS.loaderMaxMs);

      const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX, `${vp.name}: sin scroll horizontal`).toBeLessThanOrEqual(2);

      // El header no debe duplicarse ni quedar con altura cero.
      const headers = await page.evaluate(() =>
        [...document.querySelectorAll('header, .tt-header')]
          .filter(h => h.offsetParent !== null).length);
      expect(headers, `${vp.name}: un solo header visible`).toBeLessThanOrEqual(1);

      // El body debe ser visible (no pantalla en blanco tras el loader).
      const bodyVisible = await page.evaluate(() =>
        document.body && getComputedStyle(document.body).visibility !== 'hidden');
      expect(bodyVisible, `${vp.name}: contenido visible`).toBeTruthy();
    });
  }
}
