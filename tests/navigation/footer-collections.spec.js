const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES } = require('../../js/components/navigation/compartido/iconos.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const pages = ['index', 'about', 'catalogo', 'collections', 'product', 'checkout', 'perfil', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404'];
const expectedLinks = ['/catalogo', ...CATEGORIES.map(({ slug }) => `/catalogo?cat=${slug}`)];

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`todas las páginas ofrecen todas las colecciones en el footer · ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const name of pages) {
      const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, `../../${name}.html`), 'utf8'), { removeModulePreloads: true });
      await page.route('**/__footer-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto('/__footer-fixture');
      const links = page.locator('[data-collections-nav="footer"] a');
      expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), name).toEqual(expectedLinks);
      for (const link of await links.all()) await expect(link, name).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), name).toBeLessThanOrEqual(1);
      await page.unroute('**/__footer-fixture');
    }
  });
}

for (const width of [390, 768, 1440]) {
  test(`footer actualiza metadata pública sin cargar productos · ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let productRequests = 0;
    let items = [
      { id: 'relojes', data: { name: 'Relojes', visible: true, order: 2 } },
      { id: 'nueva', data: { name: 'Nueva colección & detalles', visible: true, order: 1 } },
      { id: 'oculta', data: { name: 'Oculta', visible: false, order: 0 } },
    ];
    await page.route('**/api/public-catalog?resource=*', route => {
      const resource = new URL(route.request().url()).searchParams.get('resource');
      if (resource === 'products') productRequests++;
      if (resource !== 'collections') return route.continue();
      return route.fulfill({ json: { ok: true, resource, items } });
    });
    await page.goto('/about');
    await expect(page.locator('body')).toHaveClass(/tt-public-shell-mounted/);
    await page.evaluate(() => window.TintinLoader?.hide?.());
    const footer = page.locator('[data-collections-nav="footer"]');
    const toggle = page.locator('.tt-footer-col[aria-label="Tienda"] button');
    if (width <= 480) {
      await toggle.scrollIntoViewIfNeeded();
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveAttribute('data-phase4-collections-state', 'ready');
    await expect(footer.locator('a')).toHaveText(['Catálogo', 'Nueva colección & detalles', 'Relojes']);
    await expect(footer.locator('a[href="/catalogo?cat=nueva"]')).toBeVisible();
    expect(productRequests).toBe(0);
    items = [];
    await page.evaluate(async () => {
      const runtimeUrl = performance.getEntriesByType('resource')
        .find(entry => new URL(entry.name).pathname.endsWith('/carga-colecciones.js')).name;
      const module = await import(runtimeUrl);
      await module.initNavCollections(true);
    });
    await expect(footer.locator('a')).toHaveText(['Catálogo']);
    // An authoritative empty response retires cached/default categories from
    // every navigation surface, including the mobile catalogue sheet.
    for (const surface of ['sheet', 'desktop', 'tablet']) {
      const menu = page.locator(`[data-collections-nav="${surface}"]`);
      await expect(menu.locator('a[href]')).toHaveCount(0);
      await expect(menu).toHaveAttribute('data-phase4-collections-state', 'empty');
      await expect(menu.locator('[role="status"]')).toHaveText('No hay colecciones disponibles');
    }
    expect(productRequests).toBe(0);
  });
}
