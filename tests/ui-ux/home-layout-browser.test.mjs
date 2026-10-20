import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);
import { normalizeContentValue } from '../../js/core/store/esquema-contenido.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('la fachada usa las definiciones actuales y conserva copys personalizados', async () => {
  const facade = await fs.readFile(path.join(root, 'js/core/store/esquema-contenido.js'), 'utf8');
  const dependency = './definiciones-contenido.js' + '?v=';
  assert.ok(facade.includes(dependency), 'Las definiciones deben tener una versión de caché');
  assert.equal(normalizeContentValue('index', 'trust', 'items.2.label', 'Pago segurooxsd'), 'Pago seguro');
  assert.equal(normalizeContentValue('index', 'trust', 'items.2.label', 'Tu compra está protegida'), 'Tu compra está protegida');
});

test('el arte del hero usa un único tag de caché en el HTML y en el runtime de imágenes', async () => {
  // /assets-tintin/images/* es inmutable por un año: si el runtime pidiera el arte con otra URL que
  // el HTML, quien ya visitó la tienda seguiría viendo el arte anterior debajo del rótulo nuevo.
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const runtime = await fs.readFile(path.join(root, 'js/components/images/gestion-imagenes.js'), 'utf8');
  const references = [...home.matchAll(/hero-nuevo\/[a-z-]+\.(?:webp|png|svg)\?v=([A-Za-z0-9._-]+)/g)].map(match => match[1]);
  assert.equal(references.length, 9, 'Se esperan 4 fuentes PNG originales, el rótulo y 4 precargas exclusivas por dispositivo, todas versionadas');
  assert.equal(new Set(references).size, 1, `El arte del hero mezcla tags: ${[...new Set(references)].join(', ')}`);
  assert.ok(runtime.includes(`const HERO_ART_QUERY = '?v=${references[0]}';`), 'El runtime debe pedir el arte por defecto con el mismo tag que index.html');
  for (const key of ['hero_bg_desktop', 'hero_bg_tablet_landscape', 'hero_bg_tablet', 'hero_bg_mobile']) {
    assert.match(runtime, new RegExp(`${key}: HERO_IMAGE_FALLBACKS\\.\\w+ \\+ HERO_ART_QUERY`), `${key} sin versión de caché`);
  }
});

test('los banners originales se muestran completos por dispositivo y conservan enlaces accesibles', { timeout: 60000 }, async () => {
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  const css = await Promise.all(['styles.min.css', 'css/pages/home/hero-bienvenida-inicio.css', 'css/pages/home/ajuste-inicio.css', 'css/theme/paridad-segura-tintin.css', 'css/components/navigation/compartido/paneles.css'].map(file => fs.readFile(path.join(root, file), 'utf8')));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (url.hostname !== 'tintin.test' || !file.startsWith(root)) return route.abort();
      try { await route.fulfill({ status: 200, body: await fs.readFile(file), ...(file.endsWith('.svg') ? { contentType: 'image/svg+xml' } : {}) }); }
      catch { await route.abort(); }
    });
    // Después del hero va un bloque de relleno: representa "la sección siguiente".
    await page.setContent(`<!doctype html><html><head><base href="https://tintin.test/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0}*,*::before,*::after{animation:none!important;transition:none!important}</style>${css.map(source => `<style>${source}</style>`).join('')}</head><body class="tt-home-premium tt-hero-atomic-ready tt-home-runtime-ready tt-public-shell-mounted">${hero}<div id="next-section" style="height:400px"></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    // [ancho, alto, debe entrar exacto]. Los altos bajos (650, 664, 553) son ventanas chicas y celulares con la barra del navegador a la vista.
    const viewports = [[1920,950,true],[1720,860,true],[1440,900,true],[1366,768,true],[1366,650,true],[1280,720,true],[1024,768,true],[900,600,true],[820,1180,true],[768,1024,true],[600,960,true],[430,932,true],[390,844,true],[390,664,true],[375,667,true],[360,740,false],[320,568,false]];
    for (const [width, height, exact] of viewports) {
      await page.setViewportSize({ width, height });
      const phone = width <= 767;
      const landscapeTablet = width >= 768 && width <= 1120 && width > height;
      const sideBySide = width >= 1121 || landscapeTablet;
      const art = phone ? 'hero-nuevo-mobile' : width <= 1120 ? (landscapeTablet ? 'hero-nuevo-tablet-horizontal' : 'hero-nuevo-tablet-vertical') : 'hero-nuevo-desktop';
      await page.waitForFunction(expected => {
        const photo = document.getElementById('tt-hero-img'); const welcome = document.querySelector('.tt-hero-welcome');
        return photo.currentSrc.includes(expected) && [photo, welcome].every(img => img.complete && img.naturalWidth > 0);
      }, art);
      const g = await page.evaluate(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const heroElement = document.querySelector('.tt-hero');
        return { hero: box('.tt-hero'), media: box('.tt-hero-media'), content: box('.tt-hero-content'), title: box('.tt-hero-title'), welcome: box('.tt-hero-welcome'), eyebrow: box('.tt-hero-eyebrow'), actions: box('.tt-hero-actions'), next: box('#next-section'),
          viewport: innerHeight, scrollWidth: document.documentElement.scrollWidth,
          titleAlign: getComputedStyle(document.querySelector('.tt-hero-title')).textAlign,
          targets: [...document.querySelectorAll('.tt-hero-actions a')].map(link => Math.round(link.getBoundingClientRect().height)),
          background: getComputedStyle(heroElement, '::before').backgroundImage,
          navClearance: parseFloat(getComputedStyle(heroElement).getPropertyValue('--tt-hero-nav')) || 0 };
      });
      const detail = `${width}x${height}: ${JSON.stringify(g)}`;
      const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
      const ratio = phone ? 1024 / 1366 : width <= 1120 ? 1536 / 1024 : 1920 / 900;
      assert.ok(Math.abs(g.media.width / g.media.height - ratio) <= .002, `Banner original deformado o recortado a ${detail}`);
      assert.ok(g.scrollWidth <= width + 1, `Overflow horizontal a ${detail}`);
      assert.ok(Math.abs(g.next.top - g.hero.bottom) <= 1, `Hueco después del banner a ${detail}`);
      assert.ok(g.targets.every(size => size >= 44), `Enlace menor de 44 px a ${detail}`);
      if (phone) assert.ok(g.content.top >= g.media.bottom - 1, `Acciones móviles tapan la foto a ${detail}`);
      assert.equal(await page.locator('.tt-hero-welcome').isVisible(), false, 'El banner ya incluye su bienvenida');
      for (const [selector, href] of [['.tt-hero-cta', '/catalogo'], ['.tt-hero-link', '/about']]) {
        const link = page.locator(selector);
        assert.equal(await link.getAttribute('href'), href);
        await link.scrollIntoViewIfNeeded();
        assert.ok(await link.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        }), `Enlace tapado a ${detail}`);
        await link.focus();
        assert.equal(await link.evaluate(el => document.activeElement === el), true);
      }

    }
  } finally { await browser.close(); }
});

test('el reloj llena su marco sin franjas antes y después del snapshot en tablet y demás tamaños', { timeout: 60000 }, async () => {
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const section = home.match(/<section[^>]*data-tt-section="editorial_relojes"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  const bundle = await fs.readFile(path.join(root, 'css/generated/inicio.css'), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.host !== 'tintin.test') return route.abort();
      if (url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
      if (url.pathname.endsWith('/imagenes.js')) return route.fulfill({ contentType: 'text/javascript', body: "export const HERO_IMAGE_CONFIG_VERSION='test';export const HERO_IMAGE_FALLBACKS={};export const resolveSlotImage=()=>'';export const onImagesUpdate=callback=>{window.confirmImages=callback;callback({});};" });
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root)) return route.abort();
      try { await route.fulfill({ body: await fs.readFile(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' }); }
      catch { await route.abort(); }
    });
    for (const [width, height] of [[320,568],[390,844],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await page.goto('https://tintin.test/index.html');
      await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle}</style><body class="tt-home-premium">${section}</body>`);
      for (const phase of ['HTML', 'snapshot']) {
        if (phase === 'snapshot') {
          await page.addScriptTag({ type: 'module', url: '/js/components/images/gestion-imagenes.js' });
          await page.waitForFunction(() => !!window.confirmImages);
          await page.evaluate(() => window.confirmImages({}));
          await page.waitForFunction(() => !!document.querySelector('[data-img-slot="edit_relojes"] picture'));
        }
        const image = page.locator('[data-img-slot="edit_relojes"] img');
        await image.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => { const img = document.querySelector('[data-img-slot="edit_relojes"] img'); return img.complete && img.naturalWidth > 0; }, null, { timeout: 5000 }).catch(async error => { throw new Error(`${width}x${height} ${phase}: ${await image.evaluate(img => JSON.stringify({ src: img.src, current: img.currentSrc, complete: img.complete, natural: img.naturalWidth, html: img.outerHTML }))}: ${error}`); });
        const g = await image.evaluate(img => {
          const frame = img.closest('.tt-watch-feature-img').getBoundingClientRect();
          const rect = img.getBoundingClientRect(), css = getComputedStyle(img);
          const scale = css.objectFit === 'cover' ? Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight) : Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
          return { frame: { width: frame.width, height: frame.height }, width: rect.width, height: rect.height, paintedWidth: img.naturalWidth * scale, paintedHeight: img.naturalHeight * scale, border: getComputedStyle(img.closest('.tt-watch-feature')).borderTopWidth };
        });
        const label = `${width}x${height} ${phase}: ${JSON.stringify(g)}`;
        assert.ok(g.paintedWidth >= g.frame.width - 1 && g.paintedHeight >= g.frame.height - 1, `Franjas en el reloj: ${label}`);
        assert.ok(Math.abs(g.height - g.frame.height) < 1 && Math.abs(g.width - g.frame.width) < 1, `Imagen fuera del marco: ${label}`);
        assert.equal(g.border, '0px', label);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
      }
    }
  } finally { await browser.close(); }
});
