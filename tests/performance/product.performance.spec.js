'use strict';

const { test, expect } = require('@playwright/test');
const {
  url, installVitalsObserver, waitLoaderGone, collectVitals, BUDGETS
} = require('./_helpers');

// Producto publicado observado en el catálogo de producción al tomar el
// baseline. No es un fixture sintético: la prueba usa la autoridad real del
// catálogo y falla si el producto deja de estar disponible.
const PRODUCT_ID = /127\.0\.0\.1|localhost/.test(process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '')
  ? 'seo-prueba'
  : 'Sy46ycLJOAOA5ZicgNRS';

test('[producto] ficha real: render principal e interacción de compra', async ({ page }) => {
  await installVitalsObserver(page);
  const productPath = /127\.0\.0\.1|localhost/.test(process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '')
    ? 'product?id=' + PRODUCT_ID
    : 'product.html?id=' + PRODUCT_ID;
  const response = await page.goto(url(productPath), {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await waitLoaderGone(page, BUDGETS.loaderMaxMs);

  // CI must verify hydration and the final sold-out behavior as well as SEO.
  // This is a seeded local API, not proof of production integrations.
  if (/127\.0\.0\.1|localhost/.test(process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '')) {
    expect(response?.headers()['x-tintin-product-meta']).toBe('server-test');
    await expect(page.locator('#product-name')).toHaveText('Reloj SEO Prueba');
    await expect(page.locator('#product-price')).not.toHaveText('');
    await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
    await expect(page.locator('#btn-product-buy-now')).toBeDisabled();
    return;
  }

  await expect(page.locator('#product-detail')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#product-name')).not.toHaveText('', { timeout: 15000 });
  await expect(page.locator('#product-price')).not.toHaveText('', { timeout: 15000 });
  await expect(page.locator('#product-detail img').first()).toBeVisible({ timeout: 10000 });

  const vitals = await collectVitals(page);
  console.log(
    `[product.html] DCL=${vitals.dcl}ms LCP=${vitals.lcp}ms máximo-evento=${vitals.eventTimingMaxMs}ms respuesta-carrito=${vitals.interactionMs}ms ` +
    `CLS=${vitals.cls} reqs=${vitals.requests} transfer=${vitals.transferKB}KB ` +
    `firestore=${vitals.firestoreReads}`
  );
  // LCP/CLS quedan como observabilidad: el catálogo real y App Check hacen
  // que la red externa sea variable y no deben convertir CI en un gate flaky.
  // Los límites premium se reportan aquí y se aplican en auditorías de
  // laboratorio controladas, no se falsean ni se relajan para esta prueba.
  test.info().annotations.push({
    type: 'product-vitals',
    description: JSON.stringify({ lcp: vitals.lcp, cls: vitals.cls, requests: vitals.requests, transferKB: vitals.transferKB }),
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);

  const addButton = page.locator('#btn-product-add-cart');
  await expect(addButton).toBeVisible({ timeout: 10000 });
  await addButton.click();
  await expect(page.locator('body')).toContainText(/agregado|carrito|seleccioná/i, { timeout: 5000 });
});
