const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const product = {
  id: 'qa-spacing', name: 'Reloj de acero inoxidable con nombre largo para comprobar la ficha',
  category: 'relojes', price: 70000, stock: 8,
  desc: 'Un accesorio para acompañarte cada día. Esta descripción conserva toda la información y se adapta sin tocar los bordes de la tarjeta.',
  imageUrl: '/assets-tintin/images/general/logo.png',
  variants: { Color: ['Dorado', 'Plateado'] },
  variantInventory: [{ variant: 'Dorado', stock: 4 }, { variant: 'Plateado', stock: 4 }]
};

async function mockPublicReads(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.route('**/js/pages/collections/presentacion-colecciones.js?*', async route => {
    const source = fs.readFileSync('js/pages/collections/presentacion-colecciones.js', 'utf8')
      .replace(/^import .*;\n/gm, '');
    await route.fulfill({ contentType: 'text/javascript', body:
      `const onCollectionsUpdate = listener => listener([{ id:'relojes', slug:'relojes', name:'Relojes y accesorios con un nombre de colección largo', description:'Toda la descripción de esta colección debe permanecer disponible.' }]);\n` + source });
  });
  // Ejecutar los módulos reales de interfaz con transporte/sesión aislados:
  // no dependemos de reCAPTCHA ni consultamos Firestore de producción.
  await page.route('**/js/pages/product/resenas-producto.js?*', async route => {
    const source = fs.readFileSync('js/pages/product/resenas-producto.js', 'utf8')
      .replace(/^import .*firebase\.js.*;\n/m, '')
      .replace(/^import .*coordinador-sesion\.js.*;\n/m, '')
      .replace(/^import .*firebase-firestore\.js.*;\n/m, '');
    const transport = `
      const db = {}, appCheckReady = Promise.resolve(false);
      const AUTH_STATES = { AUTHENTICATED:'authenticated', RESTORING:'restoring', UNKNOWN:'unknown' };
      const getSessionUser = () => null, waitForSession = async () => ({ status:'guest' });
      const subscribeSession = listener => listener({ status:'guest' });
      const collection = () => ({}), doc = () => ({}), limit = () => ({}), orderBy = () => ({}), query = () => ({}), startAfter = () => ({});
      const getDocs = async () => ({ docs:[], empty:true, forEach(){} });
      const onSnapshot = () => () => {};
    `;
    await route.fulfill({ contentType: 'text/javascript', body: transport + source });
  });
  await page.route('**/js/pages/product/mantenimiento-producto.js?*', async route => {
    const source = fs.readFileSync('js/pages/product/mantenimiento-producto.js', 'utf8')
      .replace(/^import .*;\n/gm, '');
    await route.fulfill({ contentType: 'text/javascript', body:
      "const auth = {}, SUPER_ADMIN = ''; const subscribeAuthState = listener => listener(null);\n" + source });
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    // Estas pruebas nunca escriben en servicios reales.
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { ok: false } });
    if (url.pathname === '/api/public-catalog') {
      const resource = url.searchParams.get('resource');
      if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id')
        ? { ok: true, resource, item: { id: product.id, data: product } }
        : { ok: true, resource, items: [{ id: product.id, data: product }], count: 1 } });
      if (resource === 'collections') return route.fulfill({ json: { ok: true, resource,
        items: [{ id: 'relojes', data: { name: 'Relojes', slug: 'relojes', active: true } }] } });
      return route.fulfill({ json: { ok: true, resource, data: { storeOpen: true, maintenanceAccess: {} } } });
    }
    if (url.pathname === '/api/engagement') return route.fulfill({ json: {
      ok: true, reviews: [], items: [], likeCount: 0,
      stats: { count: 0, average: 0, distribution: {} },
      interactions: { reviewIds: [], replyIds: [] }, favorite: false
    } });
    return route.fulfill({ json: { ok: true, config: null, version: 0 } });
  });
}

for (const [width, height] of [[320,568], [390,844], [768,1024], [1024,768],
  [1280,720], [1440,900], [1920,1080]]) {
  test(`producto, carrito y comentarios conservan sus marcos en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockPublicReads(page);
    await page.goto('/product?id=qa-spacing', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ type: 'module', url: '/js/pages/product/mantenimiento-producto.js?v=tintin-20261008-product-layout-1' });
    await page.waitForFunction(() => typeof window._renderProductDetail === 'function');
    await page.evaluate(product => {
      Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [product], set: () => {} });
      window._renderProductDetail(product);
    }, product);
    await expect(page.locator('#product-name')).toHaveText(product.name);
    await expect(page.locator('#product-reviews')).toBeAttached();
    await page.waitForFunction(() => document.body.classList.contains('tt-product-maintenance'));
    await expect(page.locator('.tinben')).toHaveCount(0);
    await expect(page.locator('#product-selection-title')).toHaveText('Tu selección');
    await expect(page.locator('.tinsel-title')).toContainText('Tu carrito');
    const geometry = await page.evaluate(() => {
      const issues = [];
      for (const selector of ['.tt-product-gallery', '.tt-product-info-panel', '.tinsel-box']) {
        const node = document.querySelector(selector), r = node.getBoundingClientRect(), s = getComputedStyle(node);
        if (r.left < 0 || r.right > innerWidth) issues.push(`${selector} fuera del viewport`);
        if (parseFloat(s.paddingLeft) < 12 || parseFloat(s.paddingRight) < 12) issues.push(`${selector} sin inset`);
        if (node.scrollWidth > node.clientWidth + 1) issues.push(`${selector} desborda`);
      }
      const desc = document.querySelector('#product-desc'), selection = document.querySelector('.tt-product-selection');
      if (!(desc.compareDocumentPosition(selection) & Node.DOCUMENT_POSITION_FOLLOWING)) issues.push('selección antes de descripción');
      const reviews = document.querySelector('#product-reviews');
      if (reviews.nextElementSibling !== document.querySelector('.tt-footer')) issues.push('comentarios no cierran contenido');
      return issues;
    });
    expect(geometry).toEqual([]);
    await page.locator('.tt-variant-option').filter({ hasText: 'Dorado' }).click();
    await page.locator('#btn-qty-plus').click();
    await expect(page.locator('#qty-val')).toHaveText('2');
    await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
    // El contrato comercial tiene su propia suite. Aquí verificamos la
    // presentación del carrito usando el evento público de actualización.
    await page.evaluate(product => {
      window.syncCartWithCatalog = () => [{ ...product, variant: 'Dorado', qty: 2 }];
      window.dispatchEvent(new CustomEvent('tt_cart_updated'));
    }, product);
    await expect(page.locator('#tinsel-count')).toHaveText('2');
    await expect(page.locator('#tinsel-items')).toContainText('Dorado');
    await expect(page.locator('#tinsel-total-footer')).toContainText('140.000');
    expect(await page.locator('.tinsel-item').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    // Abrir comentarios también funciona para invitados y con lista vacía.
    await page.locator('[data-open-community]').click();
    await expect(page.locator('#product-reviews')).toBeFocused();
    await expect(page.locator('#product-reviews-title')).toBeVisible();
    expect(await page.locator('#tinsel-checkout-btn').evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(90);
    const top = await page.locator('#product-reviews').evaluate(node => node.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(height);
    await page.screenshot({ path: `test-results/product-spacing-${width}.png`, fullPage: true });
  });
  for (const [route, card] of [['/index.html', '.tt-product-card'],
    ['/catalogo.html', '.tt-card'], ['/collections.html', '.tt-coll-page-card']]) {
    test(`${route} muestra tarjetas pobladas sin recortes en ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mockPublicReads(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.renderProductCardMarkup === 'function');
      await page.evaluate(product => {
        Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [product], set: () => {} });
        window.dispatchEvent(new CustomEvent('tintin:products-loaded', { detail: { products: [product] } }));
      }, product);
      if (route === '/collections.html') await page.addScriptTag({ type: 'module',
        url: '/js/pages/collections/presentacion-colecciones.js?v=tintin-20261001-inventory-fix-1' });
      const first = page.locator(card).first();
      await expect(first).toBeVisible();
      await expect(first.locator('a').first()).toHaveAttribute('href', /product|catalogo/);
      const issues = await first.evaluate(node => {
        const body = node.querySelector('.tt-product-info,.tt-card-info,.tt-coll-page-body');
        const style = getComputedStyle(body), rect = node.getBoundingClientRect();
        const title = node.querySelector('.tt-product-name,.tt-card-name,.tt-coll-page-name');
        return {
          outside: rect.left < 0 || rect.right > innerWidth,
          overflow: body.scrollWidth > body.clientWidth + 1,
          inset: Math.min(parseFloat(style.paddingLeft), parseFloat(style.paddingRight)),
          titleClamped: getComputedStyle(title).webkitLineClamp !== 'none'
        };
      });
      expect(issues.outside).toBe(false);
      expect(issues.overflow).toBe(false);
      expect(issues.inset).toBeGreaterThanOrEqual(12);
      expect(issues.titleClamped).toBe(false);
    });
  }
}
