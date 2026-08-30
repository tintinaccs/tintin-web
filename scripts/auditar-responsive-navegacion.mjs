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
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(10000);
  const runtimeErrors = [];
  page.on('pageerror',error => runtimeErrors.push(error.message));
  const widths = [320,360,390,430,767,768,820,1023,1024,1280,1440,1920];
  const routes = ['index.html','catalogo.html','collections.html','product.html','about.html','contact.html','checkout.html','perfil.html','envios.html','cambios-devoluciones.html','preguntas-frecuentes.html','terminos.html','privacidad.html'];

  for (const width of widths) {
    console.error(`[responsive] ancho ${width}px`);
    await page.setViewportSize({ width,height:Math.max(760,Math.round(width * .72)) });
    await page.goto(`${baseURL}/index.html`,{ waitUntil:'domcontentloaded', timeout:10000 });
    await page.waitForTimeout(550);
    await page.evaluate(() => {
      document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');
      try { window.TintinLoader?.hide?.(); } catch {}
      document.getElementById('tt-loader')?.remove();
    });
    if (width > 1024) {
      await page.waitForFunction(() => {
        const pill = document.querySelector('.tt-desktop-active-pill');
        return !!pill && pill.classList.contains('is-ready') && pill.getBoundingClientRect().width > 20;
      }, { timeout: 3000 }).catch(() => {});
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
      const blockedControls = activeControls.filter(control => !hitTarget(control)).map(control => ({
        id:control.id,
        label:control.getAttribute('aria-label') || control.textContent.trim().slice(0,40),
        top:(() => { const rect = control.getBoundingClientRect(); const node = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return node?.id || node?.className || node?.tagName || 'none'; })(),
      }));
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
        diagnostics:['tt-header-desktop-tablet','tt-header-tablet','tt-tabbar'].map(id => { const node=document.getElementById(id),style=getComputedStyle(node),rect=node.getBoundingClientRect(); return {id,display:style.display,visibility:style.visibility,opacity:style.opacity,width:rect.width,height:rect.height}; }),
        rootClasses:document.documentElement.className,
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

  for (const width of [768,820,1023,1024]) {
    await page.setViewportSize({ width,height:900 });
    await page.goto(`${baseURL}/index.html`,{ waitUntil:'domcontentloaded', timeout:10000 });
    await page.waitForTimeout(450);
    await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
    await page.click('#btn-menu-tablet');
    check(await page.locator('#tt-tablet-menu').getAttribute('aria-hidden') === 'false', `${width}px no abre el menú tablet`);
    check(await page.locator('#btn-menu-tablet').getAttribute('aria-expanded') === 'true', `${width}px no actualiza aria-expanded tablet`);
    const tabletMenuState = await page.evaluate(() => {
      const menu = document.getElementById('tt-tablet-menu');
      const style = getComputedStyle(menu);
      return {
        background:style.backgroundColor,
        pointer:style.pointerEvents,
        links:[...menu.querySelectorAll('a[href]')].filter(link => getComputedStyle(link).pointerEvents !== 'none').length,
      };
    });
    check(['rgb(255, 255, 255)','rgba(255, 255, 255, 1)'].includes(tabletMenuState.background), `${width}px menú tablet no tiene fondo blanco sólido (${JSON.stringify(tabletMenuState)})`);
    check(tabletMenuState.pointer === 'auto' && tabletMenuState.links > 0, `${width}px menú tablet no es interactivo (${JSON.stringify(tabletMenuState)})`);
    await page.click('#btn-tablet-tienda');
    check(await page.locator('#tt-tablet-menu').evaluate(node => node.classList.contains('tt-tablet-shop-view')), `${width}px no abre el submenú Tienda tablet`);
    check(await page.locator('#tablet-cats').evaluate(node => getComputedStyle(node).pointerEvents === 'auto' && node.querySelectorAll('a[href]').length > 0), `${width}px categorías tablet no son clicables`);
    await page.click('#btn-tablet-cats-back');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#tt-tablet-menu')?.getAttribute('aria-hidden') === 'true', null, { timeout:1800 });
    check(await page.locator('#tt-tablet-menu').getAttribute('aria-hidden') === 'true', `${width}px Escape no cierra el menú tablet`);
    check(await page.evaluate(() => document.activeElement?.id === 'btn-menu-tablet'), `${width}px no devuelve foco al botón tablet`);
  }

  await page.setViewportSize({ width:1440,height:900 });
  await page.goto(`${baseURL}/catalogo.html`,{ waitUntil:'domcontentloaded', timeout:10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
  await page.click('#btn-tienda');
  check(await page.locator('#tt-tienda-dropdown-panel').getAttribute('aria-hidden') === 'false', 'Desktop no abre el dropdown Tienda');
  check(await page.locator('#tt-tienda-dropdown-panel').evaluate(node => getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(node).pointerEvents === 'auto' && [...node.querySelectorAll('a[href]')].every(link => getComputedStyle(link).pointerEvents !== 'none')), 'Desktop dropdown Tienda no es sólido o clicable');
  await page.evaluate(() => window.TintinSurfaceController.open('search', document.getElementById('btn-search')));
  check(await page.locator('#search-panel').getAttribute('aria-hidden') === 'false', 'Desktop no abre Buscar');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#search-panel')?.getAttribute('aria-hidden') === 'true', null, { timeout: 4000 });
  await page.click('#btn-cuenta');
  await page.waitForFunction(() => document.querySelector('#account-drawer')?.getAttribute('aria-hidden') === 'false', null, { timeout: 4000 });
  check(await page.locator('#account-drawer').evaluate(node => {
    const panel = node.querySelector('#account-panel');
    const controls = [...panel.querySelectorAll('a,button')];
    return getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(node).pointerEvents === 'auto' && getComputedStyle(panel).pointerEvents === 'auto' && controls.length > 0 && controls.every(control => getComputedStyle(control).pointerEvents !== 'none');
  }), 'Desktop Cuenta muestra controles bloqueados o fondo no sólido');
  await page.click('#btn-account-close');
  await page.waitForFunction(() => document.querySelector('#account-drawer')?.getAttribute('aria-hidden') === 'true', null, { timeout: 4000 });
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
  await page.waitForFunction(() => window.TintinSurfaceController.surface === 'none', null, { timeout: 4000 });

  await page.setViewportSize({ width:390,height:844 });
  await page.goto(`${baseURL}/catalogo.html`,{ waitUntil:'domcontentloaded', timeout:10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending'));
  await page.click('#tabbar-tienda');
  check(await page.locator('#collections-sheet').getAttribute('aria-hidden') === 'false', 'Mobile no abre colecciones');
  check(await page.locator('#collections-sheet').evaluate(node => getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(node).pointerEvents === 'auto'), 'Mobile colecciones no es sólido o clicable');
  await page.keyboard.press('Escape');
  await page.click('#tabbar-search');
  check(await page.locator('#search-panel').getAttribute('aria-hidden') === 'false', 'Mobile no abre Buscar');
  check(await page.locator('#search-panel').evaluate(node => getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(node).pointerEvents === 'auto'), 'Mobile Buscar no es sólido o clicable');
  await page.keyboard.press('Escape');
  await page.click('#tabbar-cart');
  check(await page.locator('#cart-drawer').getAttribute('aria-hidden') === 'false', 'Mobile no abre Carrito');
  check(await page.locator('#cart-drawer').evaluate(node => getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(node).pointerEvents === 'auto'), 'Mobile Carrito no es sólido o clicable');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#cart-drawer')?.getAttribute('aria-hidden') === 'true', null, { timeout: 4000 });
  await page.click('#tabbar-cuenta');
  check(await page.locator('#account-drawer').getAttribute('aria-hidden') === 'false', 'Mobile no abre Cuenta compartida');
  check(await page.locator('#account-drawer').evaluate(node => {
    const panel = node.querySelector('#account-panel');
    const controls = [...panel.querySelectorAll('a,button')];
    return getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(panel).pointerEvents === 'auto' && controls.length > 0 && controls.every(control => getComputedStyle(control).pointerEvents !== 'none');
  }), 'Mobile Cuenta muestra controles bloqueados o fondo no sólido');
  await page.keyboard.press('Escape');

  for (const route of routes) {
    for (const width of [360,820,1280]) {
      console.error(`[responsive] ruta ${route} · ${width}px`);
      await page.setViewportSize({ width,height:820 });
      const routeURL = `${baseURL}/${route}${route === 'product.html' ? '?id=d3KaJsEEF0HhhFCrhFq9' : ''}`;
      await page.goto(routeURL,{ waitUntil:'commit', timeout:10000 });
      await page.waitForTimeout(240);
      await page.evaluate(() => {
        document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');
        try { window.TintinLoader?.hide?.(); } catch {}
        document.getElementById('tt-loader')?.remove();
      });
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth,document.body.scrollWidth) - document.documentElement.clientWidth);
      check(overflow <= 1, `${route} desborda ${overflow}px a ${width}px`);
      const loginSurface = await page.evaluate(() => !!document.querySelector('.login-page'));
      if (loginSurface) continue;
      const trigger = width === 360 ? '#tabbar-tienda' : width === 820 ? '#btn-menu-tablet' : '#btn-tienda';
      const surface = width === 360 ? '#collections-sheet' : width === 820 ? '#tt-tablet-menu' : '#tt-tienda-dropdown-panel';
      const triggerReady = await page.locator(trigger).count()
        && await page.locator(trigger).waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
      if (!triggerReady) {
        check(false, `${route} no montó ${trigger} a ${width}px dentro del tiempo esperado`);
        continue;
      }
      try {
        await page.click(trigger, { timeout: 4000 });
      } catch (error) {
        check(false, `${route} no pudo activar ${trigger} a ${width}px: ${error.message}`);
        continue;
      }
      check(await page.locator(surface).getAttribute('aria-hidden') === 'false', `${route} no abre ${surface} a ${width}px`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-hidden') === 'true', surface, { timeout:4000 })
        .catch(() => check(false, `${route} no cierra ${surface} tras Escape a ${width}px`));
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
