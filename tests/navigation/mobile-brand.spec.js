const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');
const included = ['index', 'about', 'catalogo', 'collections', 'product', 'perfil', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404'];
const excluded = ['checkout', 'login', 'admin', 'admin-images', 'nosotros'];
const fixture = name => removeFixtureScripts(fs.readFileSync(path.join(__dirname, `../../${name}.html`), 'utf8'), { removeModulePreloads: true });

for (const [width, height] of [[320, 568], [390, 844], [430, 932], [600, 960], [667, 375], [767, 1024]]) {
  test(`marca móvil original centrada y sin invadir contenido en ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const name of included) {
      await page.route('**/__brand-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture(name) }));
      await page.goto('/__brand-fixture');
      const brand = page.locator('#tt-mobile-brand');
      await expect(brand, name).toHaveCount(1);
      await expect(brand, name).toBeVisible();
      await expect(brand.locator('feFlood'), name).toHaveCSS('flood-color', 'rgb(255, 255, 255)');
      expect(await brand.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toMatch(/linear-gradient/);
      expect(await brand.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).not.toMatch(/184,\s*76,\s*114/);
      await expect(brand, name).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const image = brand.locator('img');
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth === 480 && img.naturalHeight === 600)).toBe(true);
      const geometry = await brand.evaluate(el => {
        const header = el.getBoundingClientRect();
        const link = el.querySelector('a').getBoundingClientRect();
        const img = el.querySelector('img');
        const rect = img.getBoundingClientRect();
        const clip = el.querySelector('.tt-mobile-brand-art').getBoundingClientRect();
        const content = [...document.querySelectorAll('body > main,body > .tt-page-hero,body > .cat-wrap,body > .perfil-wrap,body > .tt-404-wrap')].find(node => node.getBoundingClientRect().height > 0);
        const contentTop = content?.getBoundingClientRect().top ?? header.bottom;
        return { height: header.height, bottom: header.bottom, contentTop, center: Math.abs((link.left + link.right) / 2 - (header.left + header.right) / 2), target: link.height,
          ratio: rect.width / rect.height, position: getComputedStyle(el).position,
          // La caja alfa del PNG original: todo el dibujo debe entrar en la ventana.
          alphaTop: rect.top + 172 * rect.height / 600, alphaBottom: rect.top + 429 * rect.height / 600,
          clipTop: clip.top, clipBottom: clip.bottom };
      });
      expect(geometry.height, name).toBe(68);
      expect(geometry.contentTop, name).toBeGreaterThanOrEqual(geometry.bottom);
      expect(geometry.center, name).toBeLessThanOrEqual(1);
      expect(geometry.target, name).toBeGreaterThanOrEqual(44);
      expect(geometry.ratio, name).toBeCloseTo(480 / 600, 5);
      expect(geometry.position, name).toBe('relative');
      expect(geometry.alphaTop, name).toBeGreaterThanOrEqual(geometry.clipTop);
      expect(geometry.alphaBottom, name).toBeLessThanOrEqual(geometry.clipBottom);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), name).toBeLessThanOrEqual(1);
      await page.unroute('**/__brand-fixture');
    }
  });
}

test('excluye checkout, acceso, administración y redirecciones; tablet/desktop no muestran la barra', async ({ page }) => {
  for (const name of excluded) expect(fixture(name), name).not.toContain('id="tt-mobile-brand"');
  await page.route('**/__brand-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture('about') }));
  await page.goto('/__brand-fixture');
  for (const width of [768, 820, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#tt-mobile-brand')).toBeHidden();
  }
});

test('el encabezado conserva rosa y logo blanco al cambiar contenido, sin duplicar ni alterar el PNG original', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/__brand-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture('about') }));
  await page.goto('/__brand-fixture');
  await page.addScriptTag({ url: '/js/components/color/logotipo-marca.js' });
  await page.evaluate(async moduleUrl => {
    const { initMobileBrandHeader } = await import(moduleUrl);
    initMobileBrandHeader();
    initMobileBrandHeader();
  }, '/js/components/navigation/movil/marca-movil.js');
  const brand = page.locator('#tt-mobile-brand');
  const image = brand.locator('img');
  await expect(brand).toHaveCount(1);
  await expect(image).toHaveAttribute('src', /\/assets-tintin\/images\/general\/logo\.png\?v=/);
  await expect(image).toHaveCSS('filter', /tt-mobile-brand-tint/);
  for (const [background, surface, next] of [['#9a2f55', 'light', 'rgb(154, 47, 85)'], ['#fff0f7', 'pink', 'rgb(255, 240, 247)']]) {
    await page.locator('.tt-page-hero').evaluate((el, color) => el.style.setProperty('background', color, 'important'), background);
    await expect(brand).toHaveAttribute('data-brand-surface', surface);
    await expect.poll(() => brand.evaluate(el => el.style.getPropertyValue('--tt-mobile-brand-next'))).toBe(next);
    await expect(brand.locator('feFlood')).toHaveCSS('flood-color', 'rgb(255, 255, 255)');
    expect(await brand.evaluate(el => getComputedStyle(el).getPropertyValue('--tt-mobile-brand-bg').trim().toLowerCase())).toBe('#f8aaca');
    expect(await brand.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toMatch(/linear-gradient/);
    expect(await brand.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).not.toMatch(/184,\s*76,\s*114/);
    await expect(brand).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(brand).toHaveCSS('border-bottom-width', '0px');
    expect(await brand.evaluate(el=>getComputedStyle(el,'::before').backdropFilter)).toMatch(/blur\(18px\)/);
    expect(await brand.evaluate(el=>getComputedStyle(el,'::before').maskImage)).toMatch(/linear-gradient/);
  }
  await page.locator('.tt-page-hero').evaluate(el => { el.style.removeProperty('background'); el.id = 'brand-test-content'; });
  await page.addStyleTag({ content: 'html:root body #brand-test-content { background:#fff0f7!important } @media (orientation:landscape) { html:root body #brand-test-content { background:#9a2f55!important } }' });
  await page.setViewportSize({ width: 667, height: 375 });
  await expect(brand).toHaveAttribute('data-brand-surface', 'light');
  await expect(brand.locator('feFlood')).toHaveCSS('flood-color', 'rgb(255, 255, 255)');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(brand).toHaveAttribute('data-brand-surface', 'pink');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(brand).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(brand).toBeVisible();
  await brand.locator('a').focus();
  await expect(brand.locator('a')).toBeFocused();
  await expect(brand.locator('a')).toHaveAttribute('href', '/');
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await brand.boundingBox()).y).toBeLessThan(0);
});

test('el shell real conserva una sola barra y el contenido debajo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');
  await expect(page.locator('body')).toHaveClass(/tt-public-shell-mounted/);
  const brand = page.locator('#tt-mobile-brand');
  await expect(brand).toHaveCount(1);
  await expect(brand).toBeVisible();
  const brandBox = await brand.boundingBox();
  const contentBox = await page.locator('.tt-page-hero').boundingBox();
  expect(contentBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height);
});
