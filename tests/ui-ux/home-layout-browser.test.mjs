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

test('el hero contiene texto e imagen sin recorte al cambiar de escritorio a móvil', { timeout: 30000 }, async () => {
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  const css = await Promise.all(['styles.min.css', 'css/pages/home/hero-bienvenida-inicio.css', 'css/pages/home/ajuste-inicio.css', 'css/theme/paridad-segura-tintin.css'].map(file => fs.readFile(path.join(root, file), 'utf8')));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (url.hostname !== 'tintin.test' || !file.startsWith(root)) return route.abort();
      try { await route.fulfill({ status: 200, body: await fs.readFile(file) }); }
      catch { await route.abort(); }
    });
    await page.setContent(`<!doctype html><html><head><base href="https://tintin.test/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0}*,*::before,*::after{animation:none!important;transition:none!important}</style>${css.map(source => `<style>${source}</style>`).join('')}</head><body class="tt-home-premium tt-hero-atomic-ready tt-home-runtime-ready tt-public-shell-mounted">${hero}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[390,844],[320,568]]) {
      await page.setViewportSize({ width, height });
      const geometry = await page.evaluate(() => {
        const hero = document.querySelector('.tt-hero').getBoundingClientRect();
        const media = document.querySelector('.tt-hero-media').getBoundingClientRect();
        const content = document.querySelector('.tt-hero-content').getBoundingClientRect();
        const actions = document.querySelector('.tt-hero-actions').getBoundingClientRect();
        return { heroBottom:hero.bottom,mediaBottom:media.bottom,contentBottom:content.bottom,heroLeft:hero.left,contentLeft:content.left,mediaTop:media.top,actionsBottom:actions.bottom,contentBottomRaw:content.bottom,scrollWidth:document.documentElement.scrollWidth,width:innerWidth };
      });
      assert.ok(geometry.mediaBottom <= geometry.heroBottom + 2, `Imagen recortada a ${width}: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.contentBottom <= geometry.heroBottom + 2, `Texto recortado a ${width}`);
      assert.ok(geometry.scrollWidth <= width + 2, `Overflow a ${width}`);
      assert.ok(geometry.contentLeft > geometry.heroLeft + 10, `Sin margen de lectura a ${width}`);
      if (width <= 1023) assert.ok(geometry.mediaTop - geometry.actionsBottom <= 48, `Espacio vacío excesivo a ${width}: ${JSON.stringify(geometry)}`);
      if (width < 768) assert.ok(geometry.mediaTop >= geometry.contentBottomRaw, `Imagen y contenido se pisan a ${width}`);
    }
  } finally { await browser.close(); }
});
