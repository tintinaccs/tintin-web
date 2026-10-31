const { test, expect } = require('@playwright/test');

// La ficha escucha su propio documento. La primera entrega del listener sólo
// confirma lo que ya se ve; un cambio posterior (precio, stock, fotos) se aplica
// en la ficha y se anuncia una sola vez. Las demás páginas no reciben aviso.
const product = {
  id: 'qa-live', name: 'Pulsera de prueba en vivo', category: 'pulseras', price: 12000, stock: 5,
  imageUrl: '/assets-tintin/images/general/logo.png', active: true,
};

async function isolate(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  // Listener controlable: ninguna conexión a Firestore real.
  await page.route('**/js/core/store/tiempo-real-producto.js?*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export function loadProductRealtimeDependencies() {
      return Promise.resolve({
        db: {}, appCheckReady: Promise.resolve(true),
        doc: (_db, _col, id) => ({ id }),
        getDoc: async () => ({ exists: () => false }),
        onSnapshot: (ref, next) => {
          window.__ttEmitProduct = data => next({ id: ref.id, exists: () => true, data: () => JSON.parse(JSON.stringify(data)) });
          window.__ttEmitProduct(window.__ttInitialProduct);
          return () => { window.__ttEmitProduct = null; };
        },
      });
    }` }));
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { ok: false } });
    const url = new URL(route.request().url());
    if (url.pathname === '/api/public-catalog') {
      const resource = url.searchParams.get('resource');
      if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id')
        ? { ok: true, resource, item: { id: product.id, data: product } }
        : { ok: true, resource, items: [{ id: product.id, data: product }], count: 1 } });
      if (resource === 'collections') return route.fulfill({ json: { ok: true, resource,
        items: [{ id: 'pulseras', data: { name: 'Pulseras', slug: 'pulseras', active: true } }] } });
      return route.fulfill({ json: { ok: true, resource, data: { storeOpen: true, maintenanceAccess: {} } } });
    }
    return route.fulfill({ json: { ok: true } });
  });
}

test('la ficha anuncia sólo cambios reales de su producto', async ({ page }) => {
  await isolate(page);
  await page.addInitScript(initial => { window.__ttInitialProduct = initial; }, product);
  await page.goto('/product?id=qa-live', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#product-name')).toHaveText(product.name);
  await page.waitForFunction(() => typeof window.__ttEmitProduct === 'function');
  const feedback = page.locator('#tt-cart-feedback');

  // Repetir el mismo documento con otro orden de claves no es un cambio.
  await page.evaluate(p => window.__ttEmitProduct(Object.fromEntries(Object.entries(p).reverse())), product);
  await page.waitForTimeout(300);
  await expect(feedback.filter({ hasText: 'actualizó' })).toHaveCount(0);

  // Un producto distinto no afecta esta ficha.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:product-live-updated', { detail: { id: 'otro' } })));
  await expect(feedback.filter({ hasText: 'actualizó' })).toHaveCount(0);

  await page.evaluate(p => window.__ttEmitProduct({ ...p, price: 15000 }), product);
  await expect(feedback).toHaveText('Esta ficha se actualizó con los últimos cambios de precio, stock o fotos.');
  await expect(feedback).toHaveAttribute('role', 'status');
  await expect(page.locator('#product-price')).toContainText('15');
});
