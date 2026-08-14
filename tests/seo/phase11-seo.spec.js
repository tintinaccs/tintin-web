'use strict';
const { test, expect } = require('@playwright/test');
const { publicOrigin } = require('../../config/origenes-tintin.json');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
});

test('inicio publica canonical, OG y Store JSON-LD consistentes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${publicOrigin}/`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${publicOrigin}/`);
  const store = JSON.parse(await page.locator('#tt-store-jsonld').textContent());
  expect(store['@type']).toBe('Store');
  expect(store.url).toBe(`${publicOrigin}/`);
});

test('producto actualiza canonical y JSON-LD con URL coherente, PYG y stock', async ({ page }) => {
  test.setTimeout(35_000);
  await page.goto('/product.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._updateProductMeta === 'function' && typeof window._injectProductJsonLd === 'function');
  await expect(page.locator('#product-loading')).toBeHidden({ timeout: 25_000 });

  const resultadoSeo = await page.evaluate(publicOriginInTest => {
    const product = { id: 'seo-prueba', name: 'Reloj SEO Prueba', price: 150000, desc: 'Producto de prueba SEO', category: 'Relojes' };
    window._updateProductMeta(product, `${publicOriginInTest}/assets/og-cover.jpg`);
    window._injectProductJsonLd(product, `${publicOriginInTest}/assets/og-cover.jpg`, [], 0);

    const canonical = document.querySelector('#link-canonical')?.getAttribute('href') || '';
    const jsonLd = JSON.parse(document.querySelector('#tt-product-jsonld')?.textContent || '{}');
    const expectedCanonicalUrl = new URL('/product?id=seo-prueba', location.origin).href;
    const expectedStructuredDataUrl = new URL('/product?id=seo-prueba', publicOriginInTest).href;
    return { canonical, jsonLd, expectedCanonicalUrl, expectedStructuredDataUrl };
  }, publicOrigin);

  expect(resultadoSeo.canonical).toBe(resultadoSeo.expectedCanonicalUrl);
  expect(resultadoSeo.jsonLd['@type']).toBe('Product');
  expect(resultadoSeo.jsonLd.offers.url).toBe(resultadoSeo.expectedStructuredDataUrl);
  expect(resultadoSeo.jsonLd.offers.priceCurrency).toBe('PYG');
  expect(resultadoSeo.jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
});

test('superficies privadas y auxiliares permanecen noindex', async ({ browser, baseURL }) => {
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
