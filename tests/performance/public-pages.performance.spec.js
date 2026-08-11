'use strict';

const { test, expect } = require('@playwright/test');
const {
  PUBLIC_PAGES, url, installVitalsObserver, waitLoaderGone,
  probeInteraction, collectVitals, BUDGETS
} = require('./_helpers');

for (const pageName of PUBLIC_PAGES) {
  test(`[público] ${pageName}: carga, estabilidad y Web Vitals`, async ({ page }) => {
    await installVitalsObserver(page);
    await page.goto(url(pageName), { waitUntil: 'load', timeout: 45000 });
    await waitLoaderGone(page, BUDGETS.loaderMaxMs);

    const loaderGone = await page.evaluate(() => {
      const loader = document.getElementById('tt-loader');
      return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
    });
    expect(loaderGone, 'el loader debe cerrarse antes del timeout de emergencia').toBeTruthy();

    const overflowX = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, `no debe haber scroll horizontal (${pageName})`).toBeLessThanOrEqual(2);

    await probeInteraction(page);
    const vitals = await collectVitals(page);
    console.log(
      `[${pageName}] DCL=${vitals.dcl}ms LCP=${vitals.lcp}ms CLS=${vitals.cls} ` +
      `INP=${vitals.inp}ms reqs=${vitals.requests} duplicadas=${vitals.duplicateRequests} ` +
      `transfer=${vitals.transferKB}KB firestore=${vitals.firestoreReads}`
    );
    if (vitals.shifts?.length) {
      console.log(`[${pageName}] LAYOUT_SHIFTS=${JSON.stringify(vitals.shifts)}`);
    }

    if (vitals.dcl != null) expect(vitals.dcl, 'DOMContentLoaded dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.dclMs);
    if (vitals.lcp != null) expect(vitals.lcp, 'LCP dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.lcpMs);
    if (vitals.inp != null) expect(vitals.inp, 'INP de laboratorio dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.inpMs);
    expect(vitals.cls, 'CLS dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.clsMax);
    expect(vitals.transferKB, 'peso transferido dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.transferKB);
    expect(vitals.duplicateRequests, 'sin cascadas de solicitudes duplicadas').toBeLessThanOrEqual(BUDGETS.duplicateRequests);
    if (pageName === 'index.html') {
      expect(vitals.firestoreReads, 'la portada no debe descargar todo el catálogo').toBeLessThanOrEqual(BUDGETS.homeFirestoreReads);
    }
  });
}
