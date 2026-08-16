'use strict';

const { test, expect } = require('@playwright/test');
const {
  PUBLIC_PAGES, LIGHTWEIGHT_PAGES, url, installVitalsObserver, waitLoaderGone,
  probeInteraction, collectVitals, BUDGETS
} = require('./_helpers');

function productionRoute(pageName) {
  return pageName === 'index.html' ? '' : pageName.replace(/\.html$/i, '');
}

for (const pageName of PUBLIC_PAGES) {
  test(`[público] ${pageName}: carga, estabilidad y Web Vitals`, async ({ page }) => {
    await installVitalsObserver(page);
    await page.goto(url(productionRoute(pageName)), { waitUntil: 'load', timeout: 45000 });
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
    const thirdPartyDuplicateExtras = (vitals.thirdPartyDuplicateUrls || [])
      .reduce((sum, item) => sum + Math.max(0, Number(item.count || 0) - 1), 0);
    const effectiveRequests = Math.max(0, vitals.requests - thirdPartyDuplicateExtras);

    console.log(
      `[${pageName}] DCL=${vitals.dcl}ms LCP=${vitals.lcp}ms CLS=${vitals.cls} ` +
      `INP=${vitals.inp}ms reqs=${vitals.requests} reqs-efectivas=${effectiveRequests} ` +
      `duplicadas-first-party=${vitals.duplicateRequests} transfer=${vitals.transferKB}KB ` +
      `firestore=${vitals.firestoreReads}`
    );
    if (vitals.duplicateUrls?.length) {
      console.log(`[${pageName}] FIRST_PARTY_DUPLICATE_URLS=${JSON.stringify(vitals.duplicateUrls)}`);
    }
    if (vitals.thirdPartyDuplicateUrls?.length) {
      console.log(`[${pageName}] THIRD_PARTY_DUPLICATE_URLS=${JSON.stringify(vitals.thirdPartyDuplicateUrls)}`);
    }
    if (vitals.shifts?.length) {
      console.log(`[${pageName}] LAYOUT_SHIFTS=${JSON.stringify(vitals.shifts)}`);
    }

    if (vitals.dcl != null) expect(vitals.dcl, 'DOMContentLoaded dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.dclMs);
    if (vitals.lcp != null) {
      const lcpBudget = pageName === 'product.html' ? BUDGETS.productLcpMs : BUDGETS.lcpMs;
      expect(vitals.lcp, 'LCP dentro de presupuesto').toBeLessThanOrEqual(lcpBudget);
    }
    if (vitals.inp != null) expect(vitals.inp, 'INP de laboratorio dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.inpMs);
    expect(vitals.cls, 'CLS dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.clsMax);
    expect(vitals.transferKB, 'peso transferido dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.transferKB);
    expect(
      vitals.duplicateRequests,
      `sin solicitudes first-party duplicadas: ${JSON.stringify(vitals.duplicateUrls || [])}`
    ).toBeLessThanOrEqual(BUDGETS.duplicateRequests);

    if (pageName === 'index.html') {
      expect(effectiveRequests, 'Inicio no debe volver a superar la matriz pre-optimización').toBeLessThanOrEqual(BUDGETS.homeRequests);
      expect(vitals.firestoreReads, 'la portada no debe descargar todo el catálogo').toBeLessThanOrEqual(BUDGETS.homeFirestoreReads);
    }

    if (LIGHTWEIGHT_PAGES.has(pageName)) {
      expect(effectiveRequests, `${pageName} debe conservar runtime informativo liviano`).toBeLessThanOrEqual(BUDGETS.lightweightRequests);
      expect(vitals.transferKB, `${pageName} no debe volver a cargar infraestructura comercial completa`).toBeLessThanOrEqual(BUDGETS.lightweightTransferKB);
    }
  });
}
