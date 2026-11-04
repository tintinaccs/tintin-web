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
  assert.equal(normalizeContentValue('index', 'hero', 'title', 'DETALLES QUE ELEVAN TU ESTILO'), 'Tintin Accesorios & Relojes');
  assert.equal(normalizeContentValue('index', 'hero', 'title', 'Mi texto propio'), 'Mi texto propio');
  assert.equal(normalizeContentValue('index', 'editorial_relojes', 'title', 'EL RELOJ DEL QUE\nTODAS SE ENAMORAN'), 'RELOJES TINTIN');
  assert.equal(normalizeContentValue('index', 'editorial_relojes', 'title', 'Mis relojes favoritos'), 'Mis relojes favoritos');
  assert.equal(normalizeContentValue('index', 'trust', 'items.2.label', 'Pago segurooxsd'), 'Pago seguro');
  assert.equal(normalizeContentValue('index', 'trust', 'items.2.label', 'Tu compra está protegida'), 'Tu compra está protegida');
});

test('el hero conserva marca, productos y enlaces reales sin recortes ni desbordamiento', { timeout: 60000 }, async () => {
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)?.[0];
  const css = await fs.readFile(path.join(root, 'css/generated/inicio.css'), 'utf8');
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (url.hostname !== 'tintin.test' || !file.startsWith(path.resolve(root) + path.sep)) return route.abort();
      try { await route.fulfill({ body: await fs.readFile(file), contentType: file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); } catch { await route.abort(); }
    });
    await page.setContent(`<base href="https://tintin.test/"><style>body{margin:0}${css}</style><body class="tt-home-premium">${hero}<div id="next-section"></div></body>`);
    for (const [width,height] of [[320,568],[390,844],[667,375],[844,390],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>[...document.querySelectorAll('#hero img')].every(img=>img.complete&&img.naturalWidth>0));
      const g = await page.evaluate(()=>{
        const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        const hero=document.querySelector('#hero');
        return {hero:box(hero),brand:box(hero.querySelector('.tt-hero-brand')),next:box(document.querySelector('#next-section')),overflow:document.documentElement.scrollWidth-innerWidth,targets:[...hero.querySelectorAll('.tt-hero-actions a')].map(box),pieces:hero.querySelectorAll('.tt-hero-piece img').length};
      });
      assert.ok(g.overflow<=1,JSON.stringify(g));
      assert.equal(g.pieces,4);
      assert.ok(Math.abs(g.brand.left+g.brand.width/2-(g.hero.left+g.hero.width/2))<=1);
      assert.ok(g.brand.top>=g.hero.top&&g.brand.bottom<=g.hero.bottom);
      assert.ok(Math.abs(g.next.top-g.hero.bottom)<=1);
      assert.ok(g.targets.every(t=>t.height>=44&&t.left>=0&&t.right<=width&&t.bottom<=g.hero.bottom));
      for(const selector of ['.tt-hero-cta','.tt-hero-link']) {
        const link=page.locator(selector);await link.scrollIntoViewIfNeeded();
        assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));
        await link.focus();assert.ok(await link.evaluate(e=>document.activeElement===e));
      }
    }
  } finally { await browser.close(); }
});

test('el reloj llena su marco sin franjas antes y después del snapshot en tablet y demás tamaños', { timeout: 60000 }, async () => {
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const section = home.match(/<section[^>]*data-tt-section="editorial_relojes"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  const bundle = await fs.readFile(path.join(root, 'css/generated/inicio.css'), 'utf8');
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
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
