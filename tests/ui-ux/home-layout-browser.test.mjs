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
  assert.equal(references.length, 9, 'Se esperaban 8 variantes del arte y el rótulo, todas versionadas');
  assert.equal(new Set(references).size, 1, `El arte del hero mezcla tags: ${[...new Set(references)].join(', ')}`);
  assert.ok(runtime.includes(`const HERO_ART_QUERY = '?v=${references[0]}';`), 'El runtime debe pedir el arte por defecto con el mismo tag que index.html');
  for (const key of ['hero_bg_desktop', 'hero_bg_tablet_landscape', 'hero_bg_tablet', 'hero_bg_mobile']) {
    assert.match(runtime, new RegExp(`${key}: HERO_IMAGE_FALLBACKS\\.\\w+ \\+ HERO_ART_QUERY`), `${key} sin versión de caché`);
  }
});

test('el hero entra exacto en la primera pantalla: rótulo, foto y texto adentro en todos los dispositivos', { timeout: 60000 }, async () => {
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
      // Primera pantalla: el hero termina justo en el borde inferior visible y la sección siguiente arranca ahí.
      if (exact) {
        assert.ok(Math.abs(g.hero.bottom - g.viewport) <= 1, `El hero no ocupa exactamente la primera pantalla a ${detail}`);
        assert.ok(g.next.top >= g.viewport - 1, `La sección siguiente asoma en la primera pantalla a ${detail}`);
        // En celular los botones quedan por encima de la barra de navegación flotante (88 px desde abajo)
        // y del botón de WhatsApp que flota 16 px más arriba (34 px de alto): 141 px desde el borde inferior.
        assert.ok(g.actions.bottom <= g.viewport - (phone ? 141 : 0), `Los botones no entran en la primera pantalla a ${detail}`);
      } else {
        assert.ok(g.hero.bottom >= g.viewport - 1, `El hero deja un hueco en la primera pantalla a ${detail}`);
      }
      for (const name of ['welcome', 'media', 'content', 'actions']) assert.ok(inside(g[name], g.hero), `${name} se sale del hero a ${detail}`);
      assert.ok(g.scrollWidth <= width + 2, `Overflow horizontal a ${width}`);
      assert.ok(g.title.left >= g.hero.left + 19 && g.title.right <= width - 19, `Sin margen de lectura a ${detail}`);
      assert.ok(Math.abs(g.hero.width - width) <= 12, `El hero no ocupa el ancho a ${detail}`);
      assert.ok(/gradient/.test(g.background), `Falta el fondo del hero a ${width}: ${g.background}`);
      assert.ok(g.targets.every(size => size >= 44), `Botón por debajo de 44 px a ${width}: ${g.targets}`);
      // La tarjeta conserva la proporción de la foto de cada dispositivo (no se deforma ni se corta distinto).
      const ratio = { 'hero-nuevo-desktop': 718 / 744, 'hero-nuevo-tablet-horizontal': 677 / 923, 'hero-nuevo-tablet-vertical': 755 / 842, 'hero-nuevo-mobile': 787 / 798 }[art];
      assert.ok(Math.abs(g.media.width / g.media.height - ratio) <= .02, `Tarjeta de la foto deformada a ${detail}`);
      if (sideBySide) {
        // Desktop/laptop y tablet horizontal: rótulo y contenido a la izquierda, foto a la derecha.
        assert.ok(g.welcome.right <= g.media.left && g.content.right <= g.media.left, `El texto invade la foto a ${detail}`);
        assert.ok(g.content.top >= g.welcome.bottom - 1, `El contenido pisa el rótulo a ${detail}`);
        assert.equal(g.titleAlign, 'left', `Título sin alinear a la izquierda a ${width}`);
        for (const name of ['eyebrow', 'title', 'actions']) assert.ok(Math.abs(g[name].left - g.content.left) <= 1, `${name} fuera del eje izquierdo a ${detail}`);
        assert.ok(Math.abs(g.content.left - g.welcome.left) <= g.hero.width * .012, `Contenido y rótulo sin eje izquierdo común a ${detail}`);
      } else {
        // Tablet vertical y celular: rótulo, foto y contenido apilados; el contenido va debajo del borde inferior de la tarjeta.
        assert.ok(g.welcome.top < g.media.top && g.welcome.bottom <= g.media.top + g.welcome.height * .2, `El rótulo tapa la foto a ${detail}`);
        assert.ok(g.content.top >= g.media.bottom - 1, `El contenido pisa la tarjeta de la foto a ${detail}`);
        assert.equal(g.titleAlign, 'center', `Título sin centrar a ${width}`);
        for (const name of ['welcome', 'media', 'content']) assert.ok(Math.abs((g[name].left + g[name].right) - (g.hero.left + g.hero.right)) <= 3, `${name} descentrado a ${detail}`);
      }
    }
  } finally { await browser.close(); }
});
