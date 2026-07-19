'use strict';

/**
 * Rendimiento de las páginas públicas: el loader se cierra, las métricas de
 * Web Vitals están dentro de presupuesto y no hay desplazamiento horizontal.
 */
const { test, expect } = require('@playwright/test');
const { PUBLIC_PAGES, url, waitLoaderGone, collectVitals, BUDGETS } = require('./_helpers');

for (const pageName of PUBLIC_PAGES) {
  test(`[público] ${pageName}: carga, cierra loader y respeta presupuestos`, async ({ page }) => {
    await page.goto(url(pageName), { waitUntil: 'load', timeout: 45000 });

    // 1) El loader SIEMPRE se retira (nunca infinito).
    await waitLoaderGone(page, BUDGETS.loaderMaxMs);
    const loaderGone = await page.evaluate(() => {
      const l = document.getElementById('tt-loader');
      return !l || getComputedStyle(l).display === 'none' || l.classList.contains('tt-out');
    });
    expect(loaderGone, 'el loader debe cerrarse antes del timeout de emergencia').toBeTruthy();

    // 2) Sin desplazamiento horizontal.
    const overflowX = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, `no debe haber scroll horizontal (${pageName})`).toBeLessThanOrEqual(2);

    // 3) Web Vitals dentro de presupuesto (con tolerancia).
    const v = await collectVitals(page);
    console.log(`[${pageName}] FCP=${v.fcp} LCP=${v.lcp} CLS=${v.cls} reqs=${v.requests} transfer=${v.transferKB}KB`);
    if (v.lcp != null) expect(v.lcp, 'LCP dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.lcpMs);
    expect(v.cls, 'CLS dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.clsMax);
  });
}
