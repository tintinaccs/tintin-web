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

test('producto actualiza canonical y JSON-LD con URL coherente, PYG y stock', async ({ page }) => {
  test.setTimeout(35_000);
  await page.goto('/product.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._updateProductMeta === 'function' && typeof window._injectProductJsonLd === 'function');

  // product.html inicializa el catálogo de forma asíncrona. La función SEO se
  // prueba después de que esa carga termina para que el estado inicial de
  // “producto no encontrado / error” no vuelva a escribir el canonical base.
  await expect(page.locator('#product-loading')).toBeHidden({ timeout: 25_000 });

  // Aplicar y leer el resultado dentro de la misma tarea del navegador evita
  // que una carga asíncrona ajena a esta unidad de prueba reemplace el canonical
  // entre la llamada a la función SEO y la afirmación de Playwright.
  const resultadoSeo = await page.evaluate(() => {
    const product = { id: 'seo-prueba', name: 'Reloj SEO Prueba', price: 150000, desc: 'Producto de prueba SEO', category: 'Relojes' };
    window._updateProductMeta(product, 'https://tintinaccesorios.pages.dev/assets/og-cover.jpg');
    window._injectProductJsonLd(product, 'https://tintinaccesorios.pages.dev/assets/og-cover.jpg', [], 0);

    const canonical = document.querySelector('#link-canonical')?.getAttribute('href') || '';
    const jsonLd = JSON.parse(document.querySelector('#tt-product-jsonld')?.textContent || '{}');
    const expectedCanonicalUrl = new URL('/product?id=seo-prueba', location.origin).href;
    const expectedStructuredDataUrl = new URL('/product?id=seo-prueba', 'https://tintinaccesorios.pages.dev').href;
    return { canonical, jsonLd, expectedCanonicalUrl, expectedStructuredDataUrl };
  });

  // El canonical refleja el origen real donde se sirve la página. Durante la
  // auditoría es 127.0.0.1; en producción es el dominio público. El JSON-LD,
  // en cambio, fija deliberadamente la URL pública para no publicar localhost
  // en los datos estructurados que consumen los buscadores.
  expect(resultadoSeo.canonical).toBe(resultadoSeo.expectedCanonicalUrl);
  expect(resultadoSeo.jsonLd['@type']).toBe('Product');
  expect(resultadoSeo.jsonLd.offers.url).toBe(resultadoSeo.expectedStructuredDataUrl);
  expect(resultadoSeo.jsonLd.offers.priceCurrency).toBe('PYG');
  expect(resultadoSeo.jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
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
