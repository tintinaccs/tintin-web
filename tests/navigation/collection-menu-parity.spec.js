const { test, expect } = require('@playwright/test');
const visibleCategories = ['bolsos', 'relojes', 'aros', 'collares', 'pulseras', 'anillos', 'tobilleras', 'earcuff', 'armcuff', 'gafas', 'joyeros'];
const categories = ['relojes', 'bolsos', 'aros', 'collares', 'pulseras', 'anillos', 'tobilleras', 'brazaletes', 'earcuff', 'armcuff', 'gafas', 'joyeros'];

for (const width of [390, 768, 1440]) {
  for (const route of ['/', '/about', '/catalogo', '/collections']) {
    test(`colecciones e imágenes compartidas ${route} en ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const origin = new URL(test.info().project.use.baseURL).origin;
      let productRequests = 0, fullProductRequests = 0;
      await page.route('**/api/public-catalog?resource=*', async request => {
        const resource = new URL(request.request().url()).searchParams.get('resource');
        const params = new URL(request.request().url()).searchParams;
        if (resource === 'products') {
          productRequests += 1;
          if (!params.has('view') && !params.has('ids')) fullProductRequests += 1;
        }
        if (!['products', 'collections'].includes(resource)) return request.continue();
        const items = resource === 'collections'
          ? categories.map(id => ({ id, data: { name: id === 'bolsos' ? 'Bags' : id, visible: true } }))
          : categories.map((category, i) => ({ id: `fixture-${i}`, data: { name: `Producto ${i}`, price: 100000, stock: 5, active: true, category, imageUrl: `${origin}/__collection-test-${category}.svg`, createdAt: '2026-01-01' } }));
        const payload = params.get('view') === 'home-index' ? items.map(({id,data})=>({id,data:{category:data.category,destacado:false,available:true}})) : items;
        return request.fulfill({ json: { ok: true, resource, items: payload } });
      });
      await page.route('**/__collection-test-*.svg', request => request.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#F8AACA"/></svg>' }));
      // El catálogo es simulado; no se crean sesiones ni datos comerciales.
      await page.goto(route, { waitUntil: 'load' });
      await page.waitForSelector('body.tt-public-shell-mounted');
      await page.evaluate(() => window.TintinLoader?.hide?.());
      if (route === '/') {
        await expect.poll(()=>page.evaluate(()=>Boolean(window.TintinProductsStore?.homeSelection))).toBe(true);
        expect(fullProductRequests, 'Inicio conserva el índice sin catálogo completo antes de usar el menú').toBe(0);
      }
      if (route === '/about') {
        await page.waitForTimeout(1600);
        expect(productRequests, 'Una página informativa no debe leer productos antes de abrir el menú').toBe(0);
      }
      const surface = width < 768 ? 'sheet' : width <= 1024 ? 'tablet' : 'desktop';
      if (surface === 'tablet') {
        await page.locator('#btn-menu-tablet').click();
        await page.locator('#btn-tablet-tienda').click();
      } else {
        await page.locator(surface === 'sheet' ? '#tabbar-tienda' : '#btn-tienda').click();
      }
      const grid = page.locator(`[data-collections-nav="${surface}"]`);
      await expect(grid).toHaveAttribute('data-phase4-collections-state', 'ready');
      await expect(grid.locator('a')).toHaveCount(visibleCategories.length);
      await expect(grid.locator('a[href="/catalogo?cat=bolsos"]')).toHaveCount(1);
      for (const slug of visibleCategories) {
        const card = grid.locator(`a[href="/catalogo?cat=${slug}"]`);
        const image = card.locator('img');
        await expect(image).toHaveAttribute('src', `${origin}/__collection-test-${slug}.svg`);
        await expect(image).toHaveCSS('object-fit', 'contain');
        await expect(image).toBeVisible();
        const geometry = await card.evaluate(element => {
          const image = element.querySelector('img').getBoundingClientRect();
          const label = element.lastElementChild.getBoundingClientRect();
          const card = element.getBoundingClientRect();
          return { imageBottom: image.bottom, labelTop: label.top, imageLeft: image.left, imageRight: image.right, left: card.left, right: card.right, labelRight: label.right };
        });
        expect(geometry.imageBottom).toBeLessThanOrEqual(geometry.labelTop);
        expect(geometry.imageLeft).toBeGreaterThanOrEqual(geometry.left);
        expect(geometry.imageRight).toBeLessThanOrEqual(geometry.right);
        expect(geometry.labelRight).toBeLessThanOrEqual(geometry.right);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      await grid.evaluate(container => {
        window.__collectionFirstCard = container.firstElementChild;
        window.dispatchEvent(new CustomEvent('tintin:products-loaded', { detail: { products: window.PRODUCTS } }));
      });
      expect(await grid.evaluate(container => container.firstElementChild === window.__collectionFirstCard)).toBe(true);
      expect(productRequests).toBe(route === '/' ? 2 : 1);
      expect(fullProductRequests).toBe(1);
    });
  }
}
