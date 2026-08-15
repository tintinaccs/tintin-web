'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
});

test('inicio publica canonical, OG y Store JSON-LD consistentes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tintinaccesorios.pages.dev/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://tintinaccesorios.pages.dev/');
  const store = JSON.parse(await page.locator('#tt-store-jsonld').textContent());
  expect(store['@type']).toBe('Store');
  expect(store.url).toBe('https://tintinaccesorios.pages.dev/');
});

test('producto llega con canonical, social preview y JSON-LD server-side coherentes', async ({ page }) => {
  const response = await page.goto('/product?id=seo-prueba', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-tintin-product-meta']).toBe('server-test');

  const canonical = 'https://tintinaccesorios.pages.dev/product?id=seo-prueba';
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Reloj SEO Prueba/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('#tt-product-image-preload')).toHaveAttribute('fetchpriority', 'high');

  const jsonLd = JSON.parse(await page.locator('#tt-product-jsonld-server').textContent());
  expect(jsonLd['@type']).toBe('Product');
  expect(jsonLd.name).toBe('Reloj SEO Prueba');
  expect(jsonLd.url).toBe(canonical);
  expect(jsonLd.offers.url).toBe(canonical);
  expect(jsonLd.offers.priceCurrency).toBe('PYG');
  expect(jsonLd.offers.price).toBe('150000');
  expect(jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
});

test('superficies privadas y auxiliares permanecen noindex', async ({ browser, baseURL }) => {
  // Las etiquetas robots forman parte del HTML inicial. Se verifican sin
  // JavaScript para que las redirecciones legítimas de autenticación de una
  // página privada no interrumpan la navegación hacia la siguiente superficie.
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    for (const file of ['admin.html', 'admin-images.html', 'checkout.html', 'login.html', 'perfil.html', '404.html']) {
      await page.goto('/' + file, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
    }
  } finally {
    await context.close();
  }
});
