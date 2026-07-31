'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
});

test('inicio publica canonical, OG y Store JSON-LD consistentes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tintinaccesorios.pages.dev/index.html');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://tintinaccesorios.pages.dev/index.html');
  const store = JSON.parse(await page.locator('#tt-store-jsonld').textContent());
  expect(store['@type']).toBe('Store');
  expect(store.url).toBe('https://tintinaccesorios.pages.dev/index.html');
});

test('producto actualiza canonical y JSON-LD con URL pública, PYG y stock', async ({ page }) => {
  await page.goto('/product.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._updateProductMeta === 'function' && typeof window._injectProductJsonLd === 'function');
  await page.evaluate(() => {
    const product = { id: 'seo-prueba', name: 'Reloj SEO Prueba', price: 150000, desc: 'Producto de prueba SEO', category: 'Relojes' };
    window._updateProductMeta(product, 'https://tintinaccesorios.pages.dev/assets/og-cover.jpg');
    window._injectProductJsonLd(product, 'https://tintinaccesorios.pages.dev/assets/og-cover.jpg', [], 0);
  });
  await expect(page.locator('#link-canonical')).toHaveAttribute('href', 'https://tintinaccesorios.pages.dev/product.html?id=seo-prueba');
  const data = JSON.parse(await page.locator('#tt-product-jsonld').textContent());
  expect(data['@type']).toBe('Product');
  expect(data.offers.url).toBe('https://tintinaccesorios.pages.dev/product.html?id=seo-prueba');
  expect(data.offers.priceCurrency).toBe('PYG');
  expect(data.offers.availability).toBe('https://schema.org/OutOfStock');
});

test('superficies privadas y auxiliares permanecen noindex', async ({ page }) => {
  for (const file of ['admin.html', 'admin-images.html', 'checkout.html', 'login.html', 'perfil.html', '404.html']) {
    await page.goto('/' + file, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
  }
});
