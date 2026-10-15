const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');
const root = path.resolve(__dirname, '../..');
const home = removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true });
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

async function openHome(page, reducedMotion = false) {
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'res.cloudinary.com') {
      return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(root, 'assets-tintin/images/collections/col-relojes.webp')) });
    }
    if (url.hostname !== 'tintin.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: home });
    if (url.pathname.endsWith('/estado-colecciones.js')) {
      return route.fulfill({ contentType: 'text/javascript', body: `export function onCollectionsUpdate(callback) { window.updateCollections = callback; callback([
        {slug:'relojes',name:'Relojes',image:'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/watch.webp'},
        {slug:'bolsos',name:'Bags',image:'https://res.cloudinary.com/demo/image/upload/v123/bag.webp'},
        {slug:'anillos',name:'Anillos',image:'https://res.cloudinary.com/demo/image/upload/v123/ring.webp'}
      ]); }` });
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try { return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    catch { return route.abort(); }
  });
  await page.goto('https://tintin.test/');
  await page.addScriptTag({ type: 'module', url: 'https://tintin.test/js/pages/home/carrusel-colecciones.js' });
  await expect(page.locator('.tt-collection-card')).toHaveCount(reducedMotion ? 3 : 15);
}

for (const [width, height] of [[320,568],[390,844],[640,900],[641,900],[768,1024],[820,1180],[1023,768],[1024,768],[1025,768],[1280,720],[1440,900],[1920,1080]]) {
  test(`inicio y carrusel adaptados en ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openHome(page);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main #hero')).toHaveCount(1);
    await expect(page.locator('main .tt-footer')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    // El hero administrado puede dejar parte del carrusel visible en tablet.
    // Sólo exigir carga diferida cuando su viewport está fuera de pantalla.
    const initiallyVisible = await page.locator('[data-collection-carousel]').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    });
    if (!initiallyVisible) expect(await page.evaluate(() => window.TintinHomeCollectionCarousel.gsap)).toBeNull();
    await page.locator('[data-collection-carousel]').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => Boolean(window.TintinHomeCollectionCarousel.gsap))).toBe(true);
    const image = page.locator('.tt-collection-card[aria-hidden="true"] img').first();
    await expect(image).toHaveAttribute('srcset', /w_240.*240w.*w_960.*960w/);
    await expect(image).toHaveAttribute('src', /w_480/);
    await expect.poll(() => page.evaluate(() => window.TintinHomeCollectionCarousel.cardGeometry.length)).toBe(15);
    const geometry = await page.evaluate(() => {
      const c = window.TintinHomeCollectionCarousel;
      return { count: c.cardGeometry.length, width: c.viewportWidth, actual: c.viewport.clientWidth };
    });
    expect(geometry.count).toBe(15);
    expect(geometry.width).toBe(geometry.actual);
    await page.locator('[data-collection-carousel-next]').click();
    await page.locator('body > .tt-footer').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.TintinHomeCollectionCarousel.inView)).toBe(false);
    expect(await page.evaluate(() => {
      const c = window.TintinHomeCollectionCarousel;
      const offset = c.offset;
      c.tick(1, 40);
      return c.offset === offset;
    })).toBe(true);
  });
}

test('respaldo de imagen, resize y actualización', async ({ page }) => {
  await openHome(page);
  await page.locator('[data-collection-carousel]').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => Boolean(window.TintinHomeCollectionCarousel.gsap))).toBe(true);
  const image = page.locator('.tt-collection-card img').first();
  await image.evaluate(img => img.dispatchEvent(new Event('error')));
  await expect(image).not.toHaveAttribute('srcset');
  await expect(image).toHaveAttribute('src', /col-relojes.webp$/);
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect.poll(() => page.evaluate(() => {
    const c = window.TintinHomeCollectionCarousel;
    return c.viewportWidth === c.viewport.clientWidth;
  })).toBe(true);
  await page.evaluate(() => window.updateCollections([]));
  await expect(page.getByRole('status')).toContainText('No hay colecciones');
});

test('movimiento reducido usa tarjetas nativas sin descargar GSAP', async ({ page }) => {
  await openHome(page, true);
  await page.locator('[data-collection-carousel]').scrollIntoViewIfNeeded();
  await expect(page.locator('.tt-collection-card')).toHaveCount(3);
  expect(await page.evaluate(() => window.TintinHomeCollectionCarousel.gsap)).toBeNull();
});

test('el editor conserva bloques y orden dentro del contenido principal', async ({ page }) => {
  await openHome(page);
  await page.evaluate(async () => {
    const { applyVisualBuilderConfig } = await import('https://tintin.test/js/core/store/editor-visual-runtime.js');
    applyVisualBuilderConfig('index', {
      sectionOrder: ['hero', 'reviews', 'trust', 'collections_carousel', 'editorial_relojes'],
      customBlocks: [{ id: 'pagespeed-check', type: 'text', afterSection: 'hero', title: 'Bloque de prueba', text: 'Contenido', style: {} }],
    });
  });
  await expect(page.locator('main #hero + [data-tt-visual-block="pagespeed-check"]')).toContainText('Bloque de prueba');
  await expect(page.locator('body > .tt-footer')).toHaveCount(1);
  await expect(page.locator('main > .tt-reviews-section')).toHaveCount(1);
});
