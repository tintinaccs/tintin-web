const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const products = ['anillos', 'earcuff'].flatMap(category => Array.from({ length: 60 }, (_, index) => ({
  id: `${category}-${index}`, name: `Pieza prueba ${String(index).padStart(2, '0')}`, category,
  price: 50000 + index, stock: 2, active: true, imageUrl: '/favicon-192x192.png',
})));
const collections = ['anillos', 'earcuff'].map(slug => ({ id: slug, name: slug, slug, visible: true }));

for (const [width, height, reducedMotion] of [
  [390, 844, 'no-preference'], [844, 390, 'no-preference'],
  [768, 1024, 'no-preference'], [1366, 768, 'no-preference'],
  [390, 844, 'reduce'], [1366, 768, 'reduce'],
]) test(`otra colección vuelve arriba ${width}×${height} ${reducedMotion}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion });
  await page.route('**/api/public-catalog?**', route => {
    const resource = new URL(route.request().url()).searchParams.get('resource');
    if (!['products', 'collections'].includes(resource)) return route.continue();
    return route.fulfill({ json: { ok: true, resource, items: (resource === 'products' ? products : collections)
      .map(({ id, ...data }) => ({ id, data })) } });
  });
  await page.goto('/catalogo?cat=anillos', { waitUntil: 'domcontentloaded' });
  const cards = page.locator('#cat-grid [data-product-id]');
  await expect(cards).toHaveCount(48);
  if (width <= 768) {
    const geometry = await page.locator('#cat-tabs-shell').evaluate(shell => {
      const rect = shell.getBoundingClientRect();
      return { left: rect.left, right: rect.right, available: document.documentElement.clientWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.available + 1);
  }
  await page.locator('#cat-search').fill('pieza');
  await page.locator('#cat-sort').selectOption('precio-asc');
  if (width <= 768) await page.locator('#filter-toggle').click();
  await page.locator('#filtro-stock').check();
  if (width <= 768) await page.locator('#filter-toggle').click();
  const category = page.locator(`${width <= 768 ? '#cat-tabs-mobile .tt-filtro-btn' : '.cat-filter-option'}[data-cat="earcuff"]`);
  await expect(category).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  // Click the actual collection button without Playwright scrolling it into
  // view first, which could hide the original regression on a short viewport.
  await category.evaluate(button => button.click());
  await expect(page).toHaveURL(/cat=earcuff/);
  await expect(cards).toHaveCount(48);
  await expect(cards.first()).toHaveAttribute('data-product-id', 'earcuff-0');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('#cat-search')).toHaveValue('pieza');
  await expect(page.locator('#cat-sort')).toHaveValue('precio-asc');
  await expect(page.locator('#filtro-stock')).toBeChecked();

  await page.evaluate(() => window.scrollTo({ top: 650, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  await page.evaluate(items => window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
    detail: { products: items.map(item => ({ ...item, name: 'Actualizado ' + item.name })) },
  })), products);
  await expect(cards.first()).toContainText('Actualizado');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);

  const all = page.locator(`${width <= 768 ? '#cat-tabs-mobile .tt-filtro-btn' : '.cat-filter-option'}[data-cat="todos"]`);
  await all.evaluate(button => button.click());
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(new URL(page.url()).searchParams.has('cat')).toBe(false);
});

for (const width of [320, 768]) test(`categorías desplazables conservan todos los destinos con teclado ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/__catalog-category-fit', route => route.fulfill({ contentType: 'text/html',
    body: removeFixtureScripts(fs.readFileSync('catalogo.html', 'utf8'), { removeModulePreloads: true }) }));
  await page.goto('/__catalog-category-fit');
  await page.evaluate(() => {
    document.getElementById('tt-loader')?.remove();
    document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending');
  });
  const buttons = page.locator('#cat-tabs-mobile .tt-filtro-btn');
  expect(await buttons.count()).toBeGreaterThan(5);
  await buttons.first().focus();
  for (let index = 1; index < await buttons.count(); index++) await page.keyboard.press('Tab');
  await expect(buttons.last()).toBeFocused();
  const geometry = await page.locator('#cat-tabs-mobile').evaluate(track => {
    const shell = track.parentElement.getBoundingClientRect(), last = track.lastElementChild.getBoundingClientRect();
    return { left: shell.left, right: shell.right, available: document.documentElement.clientWidth,
      scrolled: track.scrollLeft > 0, lastLeft: last.left, lastRight: last.right, trackRight: track.getBoundingClientRect().right };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.available + 1);
  expect(geometry.scrolled).toBe(true);
  expect(geometry.lastLeft).toBeGreaterThanOrEqual(geometry.left);
  expect(geometry.lastRight).toBeLessThanOrEqual(geometry.trackRight + 1);
});
