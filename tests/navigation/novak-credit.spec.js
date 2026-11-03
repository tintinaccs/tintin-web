const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { NOVAK_URL, renderNovakCredit, ensureNovakStyles } = require('../../scripts/lib/firma-novak.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const loader = fs.readFileSync(path.join(__dirname, '../../js/components/novak-credit.js'), 'utf8');

const currentCopyright = `© 2024-${new Date().getUTCFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;

const documents = ['index', 'about', 'catalogo', 'collections', 'product', 'checkout', 'perfil', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404', 'login', 'admin', 'admin-images'];
const viewports = [[320, 568], [375, 667], [390, 844], [568, 320], [768, 1024], [1024, 768], [1366, 768], [768, 1366], [1920, 1080], [1080, 1920]];
const lazyFixture = ensureNovakStyles(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:1400px">Contenido de prueba</main><footer>${renderNovakCredit()}</footer></body></html>`);

test('descarga el original sólo al acercarse al pie y reserva su espacio', async ({ page }) => {
  let downloads = 0;
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/novak-mark.svg')) downloads++; });
  await page.route('**/__novak-lazy', route => route.fulfill({ contentType: 'text/html', body: lazyFixture }));
  await page.goto('/__novak-lazy');
  await page.waitForLoadState('networkidle');
  const img = page.locator('.novak-credit img');
  expect(downloads).toBe(0);
  await expect(img).not.toHaveAttribute('src');
  expect(await img.boundingBox()).toMatchObject({ width: 42, height: 40 });
  await page.locator('.novak-credit').scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(downloads).toBe(1);
});

test('conserva el símbolo original sin JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.route('**/__novak-lazy', route => route.fulfill({ contentType: 'text/html', body: lazyFixture }));
    await page.goto(new URL('/__novak-lazy', baseURL).href);
    const img = page.locator('.novak-credit img:visible');
    await expect(img).toHaveCount(1);
    await page.locator('.novak-credit').scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('src', /novak-mark\.svg$/);
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  } finally { await context.close(); }
});

for (const [width, height] of viewports) {
  test(`firma compartida en todos los documentos · ${width}×${height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    await page.route('https://**', route => route.abort());
    for (const name of documents) {
      const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, `../../${name}.html`), 'utf8'), { removeModulePreloads: true });
      await page.route('**/__novak-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto('/__novak-fixture');
      // Fixture de geometría: simula únicamente el estado visual autorizado;
      // no ejecuta auth, APIs ni escrituras de producción.
      await page.evaluate(() => {
        if (document.querySelector('.tt-footer')) document.body.classList.add('tt-public-shell-mounted');
        document.documentElement.classList.add('adm-auth-ready');
        const layout = document.getElementById('adm-layout');
        if (layout) layout.style.display = 'flex';
        document.querySelectorAll('#page-loader, .page-loader, #admin-auth-gate').forEach(el => el.remove());
      });
      await page.addScriptTag({ content: loader });
      const credit = page.locator('footer .novak-credit');
      await expect(credit, name).toHaveCount(1);
      await expect(credit).toHaveAttribute('href', NOVAK_URL);
      await expect(credit, name).toHaveAccessibleName('Desarrollado por NOVAK, visitar su sitio');
      await expect(credit.locator('span')).toHaveText('Desarrollado por');
      await expect(credit.locator('span')).toHaveCSS('text-transform', 'uppercase');
      for (const label of await page.locator('footer :is(.tt-footer-col-title, .tt-footer-accordion-toggle, .tt-footer-col a, .tt-footer-tagline, .tt-footer-hours, .tt-footer-wa-text)').all()) {
        await expect(label, name).toHaveCSS('text-transform', 'uppercase');
      }
      await expect(page.locator('#tt-footer-ending .tt-footer-bottom')).toHaveText(currentCopyright);
      await expect(credit).toHaveCSS('font-family', /Montserrat/);
      await credit.scrollIntoViewIfNeeded();
      await expect(credit, name).toBeVisible();
      await expect.poll(() => credit.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), { message: name }).toBe(true);
      const box = await credit.boundingBox();
      expect(box.height, name).toBeGreaterThanOrEqual(48);
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(width + 1);
      const row = await credit.locator('..').boundingBox();
      expect(Math.abs(box.x + box.width / 2 - row.x - row.width / 2), name).toBeLessThanOrEqual(1);
      const contrast = await credit.evaluate(el => {
        const luminance = color => {
          const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
            const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
          });
          return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
        };
        const foreground = luminance(getComputedStyle(el).color);
        const background = luminance(getComputedStyle(el.closest('.tt-footer-ending')).backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
      expect(contrast, name).toBeGreaterThanOrEqual(4.5);
      if (width <= 480) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const overlap = await credit.evaluate(el => {
          const wa = document.querySelector('.tt-wa-float');
          if (!wa || getComputedStyle(wa).display === 'none' || getComputedStyle(wa).visibility === 'hidden') return false;
          const a = wa.getBoundingClientRect(), b = el.getBoundingClientRect();
          return a.width > 0 && a.height > 0 && a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
        });
        expect(overlap, `${name}: WhatsApp no debe cubrir la firma`).toBe(false);
      }
      await page.unroute('**/__novak-fixture');
    }
  });
}

test('animación original, foco de teclado y movimiento reducido', async ({ page }) => {
  const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../about.html'), 'utf8'), { removeModulePreloads: true });
  await page.route('**/__novak-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/__novak-fixture');
  await page.addScriptTag({ content: loader });
  const credit = page.locator('.novak-credit');
  await credit.scrollIntoViewIfNeeded();
  await credit.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(credit).toBeFocused();
  await expect(credit).toHaveCSS('outline-style', 'solid');
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await credit.hover();
  await expect(credit).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
  await expect(credit.locator('img')).not.toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(credit).toHaveCSS('transform', 'none');
  await expect(credit.locator('img')).toHaveCSS('transform', 'none');
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.body.classList.add('water-paused'));
  expect(await credit.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001);
});

test('las capas de cada página no sobrescriben el copyright compartido', async () => {
  const { FOOTER_COPYRIGHT } = require('../../scripts/lib/firma-novak.js');
  const maintenance = [
    'home/mantenimiento-inicio.js', 'institutional/mantenimiento-nosotros.js',
    'institutional/mantenimiento-legal.js', 'institutional/mantenimiento-contacto.js',
    'catalog/mantenimiento-catalogo.js', 'collections/mantenimiento-colecciones.js',
    'product/mantenimiento-producto.js',
  ];
  for (const file of maintenance) {
    const source = fs.readFileSync(path.join(__dirname, '../../js/pages', file), 'utf8');
    expect(source, file).not.toContain('.tt-footer-bottom');
    expect(source, file).not.toMatch(/(?:updateFooterYear|normalizeFooterYear)/);
  }
  for (const name of documents) {
    const html = fs.readFileSync(path.join(__dirname, `../../${name}.html`), 'utf8');
    expect(html, name).toContain(`<div class="tt-footer-bottom">${FOOTER_COPYRIGHT}</div>`);
  }
});

test('en pantalla táctil tocar el enlace no deja un hover animado', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const html = ensureNovakStyles(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><footer>${require('../../scripts/lib/firma-novak.js').renderNovakFooterEnd()}</footer></body></html>`);
    await page.route('**/__novak-touch', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(new URL('/__novak-touch', baseURL).href);
    await page.locator('.novak-credit').evaluate(el => el.addEventListener('click', event => event.preventDefault()));
    await page.locator('.novak-credit').tap();
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    await expect.poll(() => page.locator('.novak-credit').evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect.poll(() => page.locator('.novak-credit img').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  } finally { await context.close(); }
});

test('un solo componente mantiene el año automático, también al restaurar y editar contenido', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    window.__footerTestYear = 2032;
    window.Date = class extends NativeDate { getUTCFullYear() { return window.__footerTestYear; } };
  });
  const html = ensureNovakStyles(`<!doctype html><html><head><meta charset="utf-8"></head><body><footer>${require('../../scripts/lib/firma-novak.js').renderNovakFooterEnd()}</footer></body></html>`);
  await page.route('**/__novak-year', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/__novak-year');
  const copyright = page.locator('#tt-footer-ending .tt-footer-bottom');
  await expect(copyright).toHaveText('© 2024-2032 TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS');
  await page.evaluate(() => {
    window.__footerTestYear = 2033;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(copyright).toHaveText('© 2024-2033 TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS');
  await copyright.evaluate(el => { el.textContent = '© 2024-2026 TINTIN ACCESORIOS — Texto editado por la tienda'; });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:content-phase6-ready')));
  await expect(copyright).toHaveText('© 2024-2033 TINTIN ACCESORIOS — Texto editado por la tienda');
  await copyright.evaluate(el => { el.textContent = 'Texto propio sin intervalo automático'; });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:visual-builder-ready')));
  await expect(copyright).toHaveText('Texto propio sin intervalo automático');
});
