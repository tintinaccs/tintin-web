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
const UI_WAIT_MS = 4000;
const NAVIGATION_WAIT_MS = 8000;
const SHELL_READY_MS = 6500;

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

function routeLabel(route, width) {
  return `${route} @ ${width}px`;
}

async function exposePage(page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');
    try { window.TintinLoader?.hide?.(); } catch {}
    document.getElementById('tt-loader')?.remove();
  });
}

async function waitForNavigationReady(page, route, width) {
  try {
    await page.waitForFunction(() => {
      const root = document.documentElement;
      return root.dataset.ttModularSurfacesReady === '1'
        && root.dataset.ttSurfacesReady === '1'
        && !!window.TintinSurfaceController
        && !!document.getElementById('tt-header-desktop-tablet')
        && !!document.getElementById('tt-header-tablet')
        && !!document.getElementById('tt-tabbar');
    }, null, { timeout: SHELL_READY_MS });
  } catch {
    const state = await page.evaluate(() => ({
      readyState: document.readyState,
      modularSurfaces: document.documentElement.dataset.ttModularSurfacesReady || '',
      surfaces: document.documentElement.dataset.ttSurfacesReady || '',
      shellMounted: document.body?.classList.contains('tt-public-shell-mounted') || false,
      shellMounting: document.body?.classList.contains('tt-public-shell-mounting') || false,
      controller: !!window.TintinSurfaceController,
      controllerSurface: window.TintinSurfaceController?.surface || 'none',
      controllerState: window.TintinSurfaceController?.state || 'missing',
    })).catch(() => ({}));
    throw new Error(`${routeLabel(route, width)} no dejó la navegación interactiva en ${SHELL_READY_MS} ms (${JSON.stringify(state)})`);
  }
}

async function gotoRoute(page, route, width) {
  await page.setViewportSize({ width, height: Math.max(760, Math.round(width * .72)) });
  try {
    await page.goto(`${baseURL}/${route}`, { waitUntil:'domcontentloaded', timeout:NAVIGATION_WAIT_MS });
  } catch (error) {
    throw new Error(`${routeLabel(route, width)} no alcanzó DOMContentLoaded en ${NAVIGATION_WAIT_MS} ms: ${error.message}`);
  }
  await exposePage(page);
  await waitForNavigationReady(page, route, width);
}

async function expectSurfaceCycle(page, { route, width, trigger, surface }) {
  const label = routeLabel(route, width);
  const triggerNode = page.locator(trigger);
  const surfaceNode = page.locator(surface);
  if (await triggerNode.count() !== 1) throw new Error(`${label} no contiene el trigger ${trigger}`);
  if (await surfaceNode.count() !== 1) throw new Error(`${label} no contiene la superficie ${surface}`);
  try {
    await triggerNode.click({ timeout:UI_WAIT_MS });
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-hidden') === 'false', surface, { timeout:UI_WAIT_MS });
    await page.keyboard.press('Escape');
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-hidden') === 'true', surface, { timeout:UI_WAIT_MS });
  } catch (error) {
    const state = await page.evaluate(({ trigger, surface }) => ({
      triggerExpanded: document.querySelector(trigger)?.getAttribute('aria-expanded'),
      surfaceHidden: document.querySelector(surface)?.getAttribute('aria-hidden'),
      controllerSurface: window.TintinSurfaceController?.surface,
      controllerState: window.TintinSurfaceController?.state,
    }), { trigger, surface }).catch(() => ({}));
    throw new Error(`${label} no completa abrir/cerrar ${surface} desde ${trigger}: ${error.message} (${JSON.stringify(state)})`);
  }
}

const browser = await chromium.launch({ headless:true });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
  });
  const page = await context.newPage();
  page.setDefaultTimeout(UI_WAIT_MS);
  page.setDefaultNavigationTimeout(NAVIGATION_WAIT_MS);
  const runtimeErrors = [];
  page.on('pageerror',error => runtimeErrors.push(error.message));
  const widths = [320,360,390,430,767,768,820,1023,1024,1280,1440,1920];
  const routes = ['index.html','catalogo.html','collections.html','product.html','about.html','contact.html','checkout.html','perfil.html','envios.html','cambios-devoluciones.html','preguntas-frecuentes.html','terminos.html','privacidad.html'];

  console.log('Responsive audit: validando navegación base en 12 anchos...');
  for (const width of widths) {
    await gotoRoute(page, 'index.html', width);
    if (width > 1024) {
      await page.waitForFunction(() => {
        const pill = document.querySelector('.tt-desktop-active-pill');
        return !!pill && pill.classList.contains('is-ready') && pill.getBoundingClientRect().width > 20;
      }, null, { timeout: 3000 }).catch(() => check(false, `${width}px no prepara el indicador activo desktop dentro de 3 s`));
    }
    const state = await page.evaluate(() => {
      const visible = node => !!node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().width > 0;
      const solidWhite = node => ['rgb(255, 255, 255)','rgba(255, 255, 255, 1)'].includes(getComputedStyle(node).backgroundColor);
      const hitTarget = node => {
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === node || node.contains(top);
      };
      const activeNavigation = innerWidth < 768 ? document.getElementById('tt-tabbar') : innerWidth <= 1024 ? document.getElementById('tt-header-tablet') : document.getElementById('tt-header-desktop-tablet');
      const activeControls = [...activeNavigation.querySelectorAll('a,button')].filter(visible);
      const blockedControls = activeControls.filter(control => !hitTarget(control)).map(control => ({ id:control.id, label:control.getAttribute('aria-label') || control.textContent.trim().slice(0,40) }));
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
        solidDesktop:solidWhite(document.getElementById('tt-header-desktop-tablet')),
        solidTablet:solidWhite(document.getElementById('tt-header-tablet')),
        solidMobile:solidWhite(document.getElementById('tt-tabbar')),
        activeControlsClickable:blockedControls.length === 0,
        blockedControls,
      };
    });
    const expected = width < 768 ? [false,false,true] : width <= 1024 ? [false,true,false] : [true,false,false];
    check([state.desktop,state.tablet,state.mobile].filter(Boolean).length === 1, `${width}px no tiene exactamente una navegación visible (${JSON.stringify(state)})`);
    check(state.desktop === expected[0] && state.tablet === expected[1] && state.mobile === expected[2], `${width}px muestra el dispositivo incorrecto (${JSON.stringify(state)})`);
    check(width < 768 ? state.solidMobile : width <= 1024 ? state.solidTablet : state.solidDesktop, `${width}px conserva un fondo transparente en la navegación activa (${JSON.stringify(state)})`);
    check(state.activeControlsClickable, `${width}px tiene controles visibles cubiertos o no clicables (${JSON.stringify(state)})`);
    check(state.duplicates.length === 0, `${width}px contiene IDs duplicados: ${state.duplicates.join(', ')}`);
    check(state.overflow <= 1, `${width}px desborda horizontalmente ${state.overflow}px`);
    if (width < 768) { check(state.activeMobile === 'Inicio', `${width}px no marca Inicio en mobile`); check(state.haloReady, `${width}px no posicionó el halo mobile`); }
    else if (width <= 1024) check(state.activeTablet.includes('INICIO'), `${width}px no marca Inicio en tablet`);
    else { check(state.activeDesktop.includes('INICIO'), `${width}px no marca Inicio en desktop`); check(state.pillWidth > 20, `${width}px no calculó el pill desktop`); }
  }

  console.log('Responsive audit: validando menú tablet...');
  for (const width of [768,820,1023,1024]) {
    await gotoRoute(page, 'index.html', width);
    await expectSurfaceCycle(page, { route:'index.html', width, trigger:'#btn-menu-tablet', surface:'#tt-tablet-menu' });
  }

  console.log('Responsive audit: validando superficies desktop...');
  await gotoRoute(page, 'catalogo.html', 1440);
  await expectSurfaceCycle(page, { route:'catalogo.html', width:1440, trigger:'#btn-tienda', surface:'#tt-tienda-dropdown-panel' });
  await expectSurfaceCycle(page, { route:'catalogo.html', width:1440, trigger:'#btn-cuenta', surface:'#account-drawer' });

  console.log('Responsive audit: validando superficies mobile...');
  await gotoRoute(page, 'catalogo.html', 390);
  await expectSurfaceCycle(page, { route:'catalogo.html', width:390, trigger:'#tabbar-tienda', surface:'#collections-sheet' });
  await expectSurfaceCycle(page, { route:'catalogo.html', width:390, trigger:'#tabbar-search', surface:'#search-panel' });
  await expectSurfaceCycle(page, { route:'catalogo.html', width:390, trigger:'#tabbar-cart', surface:'#cart-drawer' });
  await expectSurfaceCycle(page, { route:'catalogo.html', width:390, trigger:'#tabbar-cuenta', surface:'#account-drawer' });

  console.log('Responsive audit: validando 13 rutas en mobile/tablet/desktop...');
  for (const route of routes) {
    for (const width of [360,820,1280]) {
      console.log(`Responsive audit: ${route} @ ${width}px`);
      await gotoRoute(page, route, width);
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth,document.body.scrollWidth) - document.documentElement.clientWidth);
      check(overflow <= 1, `${route} desborda ${overflow}px a ${width}px`);
      const loginSurface = await page.evaluate(() => !!document.querySelector('.login-page'));
      if (loginSurface) continue;
      const trigger = width === 360 ? '#tabbar-tienda' : width === 820 ? '#btn-menu-tablet' : '#btn-tienda';
      const surface = width === 360 ? '#collections-sheet' : width === 820 ? '#tt-tablet-menu' : '#tt-tienda-dropdown-panel';
      await expectSurfaceCycle(page, { route, width, trigger, surface });
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
console.log('Navegación responsive: 12 anchos, 13 rutas e interacciones desktop/tablet/mobile correctas.');
