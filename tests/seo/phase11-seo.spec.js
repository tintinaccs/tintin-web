'use strict';
const { test, expect } = require('@playwright/test');
const { origin: PUBLIC_ORIGIN } = require('../../config/public-site.json');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
});

test('inicio publica canonical, OG y Store JSON-LD consistentes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${PUBLIC_ORIGIN}/`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${PUBLIC_ORIGIN}/`);
  const store = JSON.parse(await page.locator('#tt-store-jsonld').textContent());
  expect(store['@type']).toBe('Store');
  expect(store.url).toBe(`${PUBLIC_ORIGIN}/`);
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
  const canonical = `${PUBLIC_ORIGIN}/product?id=seo-prueba`;
  expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
  expect(html).toContain(`<meta property="og:url" content="${canonical}">`);
  expect(html).toContain('<meta property="og:title" content="Reloj SEO Prueba | Tintin Accesorios &amp; Relojes">');
  expect(html).toContain('<meta property="og:type" content="product">');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html).toMatch(/<link rel="preload" as="image"[^>]*fetchpriority="high"[^>]*id="tt-product-image-preload">/);
  expect(html).toMatch(/<body[^>]*data-tt-product-server-preview="1"/);
  expect(html).toMatch(/<img[^>]*data-tt-server-image="1"[^>]*loading="eager"[^>]*fetchpriority="high"/);

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

test('ficha sin producto válido no es indexable; los errores transitorios no tocan la indexación', async () => {
  const { generateKeyPairSync } = require('node:crypto');
  const { onRequest } = await import('../../functions/product.js');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'seo-test',
      client_email: 'seo-test@seo-test.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
    }),
    ASSETS: {
      fetch: async () => new Response('<html><head><title>Producto</title></head><body></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }
  };
  const firestore = {
    'products/inexistente': { status: 404, body: {} },
    'products/inactivo': { status: 200, body: { fields: { active: { booleanValue: false }, name: { stringValue: 'Oculto' } } } },
    'products/activo': { status: 200, body: { fields: { active: { booleanValue: true }, name: { stringValue: 'Reloj Test' } } } },
    'products/transitorio': { status: 503, body: {} }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 });
    }
    const docPath = url.split('/documents/')[1];
    const entry = firestore[docPath];
    if (!entry) throw new Error('fetch inesperado en prueba: ' + url);
    return new Response(JSON.stringify(entry.body), { status: entry.status });
  };
  const productRequest = query => onRequest({ request: new Request('https://tintin.test/product' + query), env });
  try {
    for (const query of ['', '?id=', '?id=..%2Fetc%2Fpasswd', '?id=inexistente', '?id=inactivo']) {
      const response = await productRequest(query);
      expect(response.status, query).toBe(200);
      expect(response.headers.get('x-robots-tag'), query).toBe('noindex, nofollow');
      expect(response.headers.get('cache-control'), query).toBe('no-store');
    }

    const active = await productRequest('?id=activo');
    expect(active.headers.get('x-robots-tag')).toBeNull();
    expect(active.headers.get('x-tintin-product-meta')).toBe('server');
    expect(await active.text()).toContain('Reloj Test | Tintin Accesorios &amp; Relojes');

    const transient = await productRequest('?id=transitorio');
    expect(transient.status).toBe(200);
    expect(transient.headers.get('x-robots-tag')).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
  }
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
