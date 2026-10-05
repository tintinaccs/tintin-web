const { test, expect } = require('@playwright/test');

for (const width of [390, 768, 1440]) {
  for (const route of ['/', '/about']) {
    test(`colecciones e imágenes compartidas ${route} en ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const origin = new URL(test.info().project.use.baseURL).origin;
      await page.route('**/api/public-catalog?resource=*', async request => {
        const resource = new URL(request.request().url()).searchParams.get('resource');
        if (!['products', 'collections'].includes(resource)) return request.continue();
        const items = resource === 'collections'
          ? [{ id: 'relojes', data: { name: 'Relojes', visible: true } }, { id: 'bolsos', data: { name: 'Bags', visible: true } }]
          : ['relojes', 'bolsos'].map((category, i) => ({ id: `fixture-${i}`, data: { name: `Producto ${i}`, price: 100000, stock: 5, active: true, category, imageUrl: `${origin}/__collection-test-${category}.svg`, createdAt: '2026-01-01' } }));
        return request.fulfill({ json: { ok: true, resource, items } });
      });
      await page.route('**/__collection-test-*.svg', request => request.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#F8AACA"/></svg>' }));
      // El catálogo es simulado; no se crean sesiones ni datos comerciales.
      await page.goto(route, { waitUntil: 'load' });
      await page.waitForSelector('body.tt-public-shell-mounted');
      await page.evaluate(() => window.TintinLoader?.hide?.());
      const surface = width < 768 ? 'sheet' : width <= 1024 ? 'tablet' : 'desktop';
      if (surface === 'tablet') {
        await page.locator('#btn-menu-tablet').click();
        await page.locator('#btn-tablet-tienda').click();
      } else {
        await page.locator(surface === 'sheet' ? '#tabbar-tienda' : '#btn-tienda').click();
      }
      const grid = page.locator(`[data-collections-nav="${surface}"]`);
      await expect(grid).toHaveAttribute('data-phase4-collections-state', 'ready');
      await expect(grid.locator('a')).toHaveCount(2);
      for (const slug of ['relojes', 'bolsos']) {
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
    });
  }
}
