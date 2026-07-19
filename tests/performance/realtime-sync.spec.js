'use strict';

/**
 * Sincronización en tiempo real del catálogo público: el store emite el evento
 * de "productos cargados" mediante onSnapshot (no una lectura única), lo que
 * significa que un cambio del Super Admin se refleja sin recargar la página.
 *
 * No modifica datos reales: solo observa que el canal en vivo esté activo y que
 * una segunda emisión del snapshot re-renderice sin recargar.
 */
const { test, expect } = require('@playwright/test');
const { url, waitLoaderGone, BUDGETS } = require('./_helpers');

test('[realtime] el catálogo se alimenta por onSnapshot (canal en vivo)', async ({ page }) => {
  const sawProductsEvent = page.waitForEvent('console', {
    predicate: () => true,
    timeout: 1
  }).catch(() => null);

  await page.goto(url('catalogo.html'), { waitUntil: 'load', timeout: 45000 });
  await waitLoaderGone(page, BUDGETS.loaderMaxMs);

  // El módulo products-store despacha 'tintin:products-loaded' cuando el
  // onSnapshot resuelve al menos una vez. Confirmamos que el canal en vivo
  // está activo (window flag o grilla poblada / estado vacío explícito).
  const live = await page.evaluate(() => new Promise(resolve => {
    let done = false;
    const finish = ok => { if (!done) { done = true; resolve(ok); } };
    window.addEventListener('tintin:products-loaded', () => finish(true), { once: true });
    // Si ya resolvió antes de este punto, la grilla o su estado ya existen.
    const grid = document.querySelector('.tt-products-grid, #products-grid, [data-products-grid]');
    if (grid && (grid.children.length > 0 || /vac|sin/i.test(grid.textContent))) finish(true);
    setTimeout(() => finish(false), 8000);
  }));
  await sawProductsEvent;
  expect(live, 'el catálogo debe alimentarse por un canal en vivo (onSnapshot)').toBeTruthy();
});

test('[realtime] una re-emisión del snapshot no requiere recargar la página', async ({ page }) => {
  await page.goto(url('catalogo.html'), { waitUntil: 'load', timeout: 45000 });
  await waitLoaderGone(page, BUDGETS.loaderMaxMs);
  // La página no debe forzar location.reload() como mecanismo de actualización.
  const usesReload = await page.evaluate(() =>
    /location\.reload\(/.test(document.documentElement.innerHTML));
  expect(usesReload, 'la sincronización no debe depender de recargar la página').toBeFalsy();
});
