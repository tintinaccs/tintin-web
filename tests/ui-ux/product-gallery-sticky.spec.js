const { test, expect } = require('@playwright/test');

// En dos columnas (>=768px) la galería acompaña el scroll mientras la ficha de
// la derecha sigue a la vista y termina alineada con su borde inferior. En una
// columna (móvil) no cambia el flujo normal.
const product = {
  id: 'qa-sticky', name: 'Reloj de prueba sticky', category: 'relojes', price: 12000, stock: 5,
  imageUrl: '/assets-tintin/images/general/logo.png', active: true,
  description: Array(60).fill('Texto largo de descripción para alargar el panel derecho.').join(' '),
};

async function isolate(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.route('**/js/core/store/tiempo-real-producto.js?*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export function loadProductRealtimeDependencies() {
      return Promise.resolve({ db: {}, appCheckReady: Promise.resolve(true), doc: (_d, _c, id) => ({ id }),
        getDoc: async () => ({ exists: () => false }), onSnapshot: () => () => {} });
    }` }));
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { ok: false } });
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/public-catalog') return route.fulfill({ json: { ok: true } });
    const resource = url.searchParams.get('resource');
    if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id')
      ? { ok: true, resource, item: { id: product.id, data: product } }
      : { ok: true, resource, items: [{ id: product.id, data: product }], count: 1 } });
    if (resource === 'collections') return route.fulfill({ json: { ok: true, resource,
      items: [{ id: 'relojes', data: { name: 'Relojes', slug: 'relojes', active: true } }] } });
    return route.fulfill({ json: { ok: true, resource, data: { storeOpen: true, maintenanceAccess: {} } } });
  });
}

async function open(page) {
  await isolate(page);
  await page.goto('/product?id=qa-sticky', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#product-name')).toHaveText(product.name);
}

const rects = page => page.evaluate(() => {
  const g = document.querySelector('#product-detail .tt-product-gallery').getBoundingClientRect();
  const i = document.querySelector('#product-detail .tt-product-info-panel').getBoundingClientRect();
  return { gTop: g.top, gBottom: g.bottom, iTop: i.top, iBottom: i.bottom, vh: innerHeight };
});


for (const [label, width, height] of [['desktop', 1440, 900], ['laptop', 1024, 768], ['tablet horizontal', 1180, 820], ['tablet vertical', 820, 1180]]) {
  test(`${label}: la galería acompaña el scroll y termina en el borde de la ficha`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const start = await rects(page);
    expect(start.iBottom - start.iTop, 'la ficha derecha debe ser más alta que la galería').toBeGreaterThan(start.gBottom - start.gTop + 200);

    // A mitad de la ficha: la galería sigue completa dentro de la pantalla.
    await page.evaluate(() => {
      const i = document.querySelector('#product-detail .tt-product-info-panel');
      window.scrollTo({ top: i.getBoundingClientRect().top + scrollY + i.offsetHeight / 2 - innerHeight / 2, behavior: 'instant' });
    });
    await expect.poll(async () => {
      const r = await rects(page);
      return r.gTop >= 0 && r.gBottom <= r.vh && r.gTop > r.iTop;
    }).toBe(true);

    // Pasado el final de la ficha (su borde inferior queda por encima de donde
    // estaría la galería fija): ambas tarjetas comparten el borde inferior.
    const reached = await page.evaluate(() => {
      const i = document.querySelector('#product-detail .tt-product-info-panel');
      const g = document.querySelector('#product-detail .tt-product-gallery');
      const target = i.getBoundingClientRect().bottom + scrollY - g.offsetHeight - 40;
      window.scrollTo({ top: target, behavior: 'instant' });
      return Math.abs(scrollY - target) <= 1;
    });
    expect(reached, 'la página debe poder desplazarse hasta pasar el final de la ficha').toBe(true);
    await expect.poll(async () => {
      const r = await rects(page);
      return Math.abs(r.gBottom - r.iBottom);
    }).toBeLessThanOrEqual(1);
  });
}

test('móvil: la galería mantiene el flujo normal en una columna', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const position = await page.locator('#product-detail .tt-product-gallery').evaluate(el => getComputedStyle(el).position);
  expect(position).toBe('static');
  const r = await rects(page);
  expect(r.gBottom).toBeLessThanOrEqual(r.iTop + 1);
});
