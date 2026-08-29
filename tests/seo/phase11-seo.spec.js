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

test('producto llega con canonical, social preview y JSON-LD server-side coherentes', async ({ request }) => {
  // SEO server-side se valida sobre la respuesta HTTP inicial, que es lo que
  // reciben crawlers, WhatsApp y previews sociales. Ejecutar el runtime cliente
  // aquí mezclaría esta responsabilidad con Firestore/Firebase y puede bloquear
  // un harness local que deliberadamente no emula esas autoridades.
  const response = await request.get('/product?id=seo-prueba');
  expect(response.status()).toBe(200);
  expect(response.headers()['x-tintin-product-meta']).toBe('server-test');

  const html = await response.text();
  const canonical = 'https://tintinaccesorios.pages.dev/product?id=seo-prueba';
  expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
  expect(html).toContain(`<meta property="og:url" content="${canonical}">`);
  expect(html).toContain('<meta property="og:title" content="Reloj SEO Prueba | Tintin Accesorios &amp; Relojes">');
  expect(html).toContain('<meta property="og:type" content="product">');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html).toMatch(/<link rel="preload" as="image"[^>]*fetchpriority="high"[^>]*id="tt-product-image-preload">/);

  const jsonLdMatch = html.match(/<script type="application\/ld\+json" id="tt-product-jsonld-server">([\s\S]*?)<\/script>/);
  expect(jsonLdMatch, 'el HTML inicial debe incluir Product JSON-LD server-side').toBeTruthy();
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  expect(jsonLd['@type']).toBe('Product');
  expect(jsonLd.name).toBe('Reloj SEO Prueba');
  expect(jsonLd.url).toBe(canonical);
  expect(jsonLd.offers.url).toBe(canonical);
  expect(jsonLd.offers.priceCurrency).toBe('PYG');
  expect(jsonLd.offers.price).toBe('150000');
  expect(jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
});

test('metadata de producto no puede bloquear indefinidamente la respuesta HTML', async () => {
  const { resolveProductMetadataWithin } = await import('../../functions/product.js');
  const started = Date.now();
  await expect(resolveProductMetadataWithin(new Promise(() => {}), 120)).rejects.toThrow('product_metadata_timeout');
  expect(Date.now() - started).toBeLessThan(800);
});

test('ruta limpia de producto con id siempre entrega el documento navegable', async ({ request }) => {
  // Este contrato es de routing/HTML, no de hidratación. La funcionalidad de la
  // ficha se cubre en sus pruebas específicas; aquí protegemos que Cloudflare
  // entregue siempre el documento base para cualquier id válido en la URL.
  const response = await request.get('/product?id=route-probe-inexistente');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('id="product-detail"');
  expect(html).toContain('id="product-loading"');
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
