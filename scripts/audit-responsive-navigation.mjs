import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4198;
const baseURL = `http://${host}:${port}`;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const mime = { '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2' };

const server = http.createServer((request,response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/',baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute,(error,stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200,{'cache-control':'no-store','content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(absolute).pipe(response);
  });
});
await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,host,resolve); });

const browser = await chromium.launch({ headless:true });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror',error => runtimeErrors.push(error.message));
  const widths = [320,360,390,430,767,768,820,1023,1024,1280,1440,1920];
  const routes = ['index.html','catalogo.html','collections.html','product.html','about.html','contact.html','checkout.html','perfil.html','envios.html','cambios-devoluciones.html','preguntas-frecuentes.html','terminos.html','privacidad.html'];

  for (const width of widths) {
    await page.setViewportSize({ width,height:Math.max(760,Math.round(width * .72)) });
    await page.goto(`${baseURL}/index.html`,{ waitUntil:'domcontentloaded' });
    await page.waitForTimeout(550);
    await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
    const state = await page.evaluate(() => {
      const visible = node => !!node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().width > 0;
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      const duplicates = ids.filter((id,index) => ids.indexOf(id) !== index);
      return {
        desktop:visible(document.getElementById('tt-header-desktop-tablet')),
        tablet:visible(document.getElementById('tt-header-tablet')),
        mobile:visible(document.getElementById('tt-tabbar')),
        duplicates:[...new Set(duplicates)],
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth) - document.documentElement.clientWidth,
        activeDesktop:document.querySelector('#tt-header-desktop-tablet [aria-current="page"]')?.textContent.trim() || '',
        activeTablet:document.querySelector('#tt-tablet-menu [aria-current="page"]')?.textContent.trim() || '',
        activeMobile:document.querySelector('#tt-tabbar [aria-current="page"]')?.getAttribute('aria-label') || '',
        haloReady:document.getElementById('tt-tabbar')?.classList.contains('tt-mobile-nav-ready') || false,
        pillWidth:document.querySelector('.tt-desktop-active-pill')?.getBoundingClientRect().width || 0,
        diagnostics:['tt-header-desktop-tablet','tt-header-tablet','tt-tabbar'].map(id => { const node=document.getElementById(id),style=getComputedStyle(node),rect=node.getBoundingClientRect(); return {id,display:style.display,visibility:style.visibility,opacity:style.opacity,width:rect.width,height:rect.height}; }),
        rootClasses:document.documentElement.className,
      };
    });
    const expected = width < 768 ? [false,false,true] : width < 1024 ? [false,true,false] : [true,false,false];
    check([state.desktop,state.tablet,state.mobile].filter(Boolean).length === 1, `${width}px no tiene exactamente una navegación visible (${JSON.stringify(state)})`);
    check(state.desktop === expected[0] && state.tablet === expected[1] && state.mobile === expected[2], `${width}px muestra el dispositivo incorrecto (${JSON.stringify(state)})`);
    check(state.duplicates.length === 0, `${width}px contiene IDs duplicados: ${state.duplicates.join(', ')}`);
    check(state.overflow <= 1, `${width}px desborda horizontalmente ${state.overflow}px`);
    if (width < 768) { check(state.activeMobile === 'Inicio', `${width}px no marca Inicio en mobile`); check(state.haloReady, `${width}px no posicionó el halo mobile`); }
    else if (width < 1024) check(state.activeTablet.includes('INICIO'), `${width}px no marca Inicio en tablet`);
    else { check(state.activeDesktop.includes('INICIO'), `${width}px no marca Inicio en desktop`); check(state.pillWidth > 20, `${width}px no calculó el pill desktop`); }
  }

  for (const width of [768,820,1023]) {
    await page.setViewportSize({ width,height:900 });
    await page.goto(`${baseURL}/index.html`,{ waitUntil:'domcontentloaded' });
    await page.waitForTimeout(450);
    await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
    await page.click('#btn-menu-tablet');
    check(await page.locator('#tt-tablet-menu').getAttribute('aria-hidden') === 'false', `${width}px no abre el menú tablet`);
    check(await page.locator('#btn-menu-tablet').getAttribute('aria-expanded') === 'true', `${width}px no actualiza aria-expanded tablet`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#tt-tablet-menu')?.getAttribute('aria-hidden') === 'true', null, { timeout:1800 });
    check(await page.locator('#tt-tablet-menu').getAttribute('aria-hidden') === 'true', `${width}px Escape no cierra el menú tablet`);
    check(await page.evaluate(() => document.activeElement?.id === 'btn-menu-tablet'), `${width}px no devuelve foco al botón tablet`);
  }

  await page.setViewportSize({ width:1440,height:900 });
  await page.goto(`${baseURL}/catalogo.html`,{ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
  await page.click('#btn-tienda');
  check(await page.locator('#tt-tienda-dropdown-panel').getAttribute('aria-hidden') === 'false', 'Desktop no abre el dropdown Tienda');
  await page.evaluate(() => window.TintinSurfaceController.open('search', document.getElementById('btn-search')));
  check(await page.locator('#search-panel').getAttribute('aria-hidden') === 'false', 'Desktop no abre Buscar');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#search-panel')?.getAttribute('aria-hidden') === 'true');
  const rapidState = await page.evaluate(async () => {
    const controller = window.TintinSurfaceController;
    await Promise.allSettled([
      controller.open('cart', document.getElementById('btn-cart')),
      controller.open('search', document.getElementById('btn-search')),
    ]);
    return {
      surface: controller.surface,
      state: controller.state,
      backdrops: document.querySelectorAll('#tt-shared-backdrop.open').length,
      cartHidden: document.getElementById('cart-drawer')?.getAttribute('aria-hidden'),
      searchHidden: document.getElementById('search-panel')?.getAttribute('aria-hidden'),
    };
  });
  check(rapidState.surface === 'search' && rapidState.state === 'open', `Cambio rápido deja estado incorrecto (${JSON.stringify(rapidState)})`);
  check(rapidState.backdrops === 1 && rapidState.cartHidden === 'true' && rapidState.searchHidden === 'false', `Cambio rápido deja superficies solapadas (${JSON.stringify(rapidState)})`);
  await page.setViewportSize({ width:820,height:900 });
  await page.waitForFunction(() => window.TintinSurfaceController.surface === 'none');

  await page.setViewportSize({ width:390,height:844 });
  await page.goto(`${baseURL}/catalogo.html`,{ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
  await page.click('#tabbar-tienda');
  check(await page.locator('#collections-sheet').getAttribute('aria-hidden') === 'false', 'Mobile no abre colecciones');
  await page.keyboard.press('Escape');
  await page.click('#tabbar-search');
  check(await page.locator('#search-panel').getAttribute('aria-hidden') === 'false', 'Mobile no abre Buscar');
  await page.keyboard.press('Escape');
  await page.click('#tabbar-cart');
  check(await page.locator('#cart-drawer').getAttribute('aria-hidden') === 'false', 'Mobile no abre Carrito');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#cart-drawer')?.getAttribute('aria-hidden') === 'true');
  await page.click('#tabbar-cuenta');
  check(await page.locator('#account-drawer').getAttribute('aria-hidden') === 'false', 'Mobile no abre Cuenta compartida');
  await page.keyboard.press('Escape');

  for (const route of routes) {
    for (const width of [360,820,1280]) {
      await page.setViewportSize({ width,height:820 });
      await page.goto(`${baseURL}/${route}`,{ waitUntil:'domcontentloaded' });
      await page.waitForTimeout(240);
      await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth,document.body.scrollWidth) - document.documentElement.clientWidth);
      check(overflow <= 1, `${route} desborda ${overflow}px a ${width}px`);
    }
  }
  check(!runtimeErrors.some(message => /SyntaxError|ReferenceError|TypeError/i.test(message)), `Errores runtime: ${runtimeErrors.join(' | ')}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (failures.length) {
  console.error(failures.map(message => `FALTA - ${message}`).join('\n'));
  process.exit(1);
}
console.log('Navegación responsive: 12 anchos, 14 rutas e interacciones desktop/tablet/mobile correctas.');
