import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.TT_SMOKE_PORT || 4173);
const baseURL = `http://${host}:${port}`;

const routes = [
  { name: 'Inicio', url: '/index.html' },
  { name: 'Catálogo', url: '/catalogo.html' },
  { name: 'Colecciones', url: '/collections.html' },
  { name: 'Producto', url: '/product.html?id=__tintin_smoke_missing__', product: true },
  { name: 'Checkout', url: '/checkout.html' },
  { name: 'Login', url: '/login.html' },
  { name: 'Perfil', url: '/perfil.html' },
  { name: 'Nosotros', url: '/about.html' },
  { name: 'Contacto', url: '/contact.html' },
  { name: 'Términos', url: '/terminos.html' },
  { name: 'Privacidad', url: '/privacidad.html' },
  { name: 'Envíos', url: '/envios.html' },
  { name: 'Cambios y devoluciones', url: '/cambios-devoluciones.html' },
  { name: 'Preguntas frecuentes', url: '/preguntas-frecuentes.html' },
  { name: '404', url: '/404.html' },
  { name: 'Nosotros legacy', url: '/nosotros.html', redirectPath: '/about' },
  { name: 'Super Admin', url: '/admin.html' },
  { name: 'Admin imágenes', url: '/admin-images.html' },
];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

// Cloudflare Pages publica estos HTML con URL limpia. El smoke usa un
// servidor Node mínimo, así que debe reproducir esa resolución en vez de
// inventar 404 cuando la propia aplicación navega correctamente a /about,
// /login, /perfil, etc. El pathname del navegador se mantiene limpio: solo
// cambia el archivo físico que el servidor de prueba entrega.
const cleanRouteFiles = new Map([
  ['/', '/index.html'],
  ['/about', '/about.html'],
  ['/admin', '/admin.html'],
  ['/admin-images', '/admin-images.html'],
  ['/cambios-devoluciones', '/cambios-devoluciones.html'],
  ['/catalogo', '/catalogo.html'],
  ['/checkout', '/checkout.html'],
  ['/collections', '/collections.html'],
  ['/contact', '/contact.html'],
  ['/envios', '/envios.html'],
  ['/login', '/login.html'],
  ['/nosotros', '/nosotros.html'],
  ['/perfil', '/perfil.html'],
  ['/preguntas-frecuentes', '/preguntas-frecuentes.html'],
  ['/privacidad', '/privacidad.html'],
  ['/product', '/product.html'],
  ['/terminos', '/terminos.html'],
]);

function safeLocalPath(requestURL) {
  const pathname = decodeURIComponent(new URL(requestURL, baseURL).pathname);
  const requested = cleanRouteFiles.get(pathname) || pathname;
  const absolute = path.resolve(root, `.${requested}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  if (pathname === '/api/public-catalog') {
    const resource = new URL(request.url || '/', baseURL).searchParams.get('resource');
    if (!['products', 'collections'].includes(resource)) {
      response.writeHead(400, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
      response.end('{"ok":false,"error":"resource_invalid"}');
      return;
    }
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-tintin-cache': 'test' });
    response.end(JSON.stringify({ ok: true, resource, items: [], count: 0 }));
    return;
  }
  if (pathname === '/api/visual-builder-public') {
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
    response.end('{"ok":true,"config":null,"version":0}');
    return;
  }
  if (pathname === '/api/visual-studio-global-public') {
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
    response.end('{"ok":true,"config":null,"version":0}');
    return;
  }
  const absolute = safeLocalPath(request.url || '/');
  if (!absolute) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(absolute, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    const extension = path.extname(absolute).toLowerCase();
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mimeTypes[extension] || 'application/octet-stream',
    });
    fs.createReadStream(absolute).pipe(response);
  });
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
}

function closeServer() {
  return new Promise(resolve => server.close(resolve));
}

await listen();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
});

const failures = [];

try {
  for (const route of routes) {
    const page = await context.newPage();
    const pageErrors = [];
    const localHttpErrors = [];

    page.on('pageerror', error => {
      const message = error.message || String(error);
      // Chromium informa este rechazo interno cuando una redirección cancela
      // la transición cross-document automática; no proviene del JavaScript
      // de la aplicación. Cualquier otro error sigue siendo bloqueante.
      if (/^Transition was skipped\.?$/.test(message)) return;
      // Un iframe de vista previa sin allow-same-origin debe impedir Service Worker.
      if (/Service worker is disabled because the context is sandboxed/i.test(message)) return;
      pageErrors.push(message);
    });
    page.on('response', response => {
      const responseURL = new URL(response.url());
      if (responseURL.origin === baseURL && response.status() >= 400) {
        localHttpErrors.push(`${response.status()} ${responseURL.pathname}`);
      }
    });

    try {
      await page.goto(`${baseURL}${route.url}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      await page.waitForFunction(() => {
        const visible = node => {
          if (!node) return false;
          const style = getComputedStyle(node);
          return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        };
        const storeOverlay = document.getElementById('tt-store-closed-overlay');
        if (visible(storeOverlay)) return true;
        const loader = document.getElementById('tt-loader');
        return !visible(loader);
      }, null, { timeout: 15_000 }).catch(() => {});

      if (route.product) {
        // mantenimiento-producto.js llega vía import() dinámico, disparado
        // por cargador-mantenimiento-pagina.js según el pathname — es una
        // cadena async separada del cierre del loader. Con MIN_SHOW_MS bajo,
        // el loader ya puede estar oculto antes de que termine; se espera la
        // señal real (con timeout) en vez de sumar una demora fija que
        // penalizaría también al camino feliz.
        await page.waitForFunction(
          () => window.TintinProductPageRecognized === true,
          null,
          { timeout: 8_000 }
        ).catch(() => {});
      }

      await page.waitForTimeout(350);

      const state = await page.evaluate(() => {
        const visible = node => {
          if (!node) return false;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
        };
        const loader = document.getElementById('tt-loader');
        const storeOverlay = document.getElementById('tt-store-closed-overlay');
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        const productStates = [
          document.getElementById('product-loading'),
          document.getElementById('product-grid'),
          document.getElementById('product-not-found'),
          document.getElementById('product-load-error'),
        ];
        return {
          bodyExists: Boolean(document.body),
          bodyTextLength: bodyText.length,
          bodyVisible: visible(document.body),
          loaderVisible: visible(loader),
          storeOverlayVisible: visible(storeOverlay),
          productRecognized: window.TintinProductPageRecognized === true,
          productRuntimeClass: document.body?.classList.contains('tt-product-maintenance') === true,
          productStateVisible: productStates.some(visible),
          productBusy: document.getElementById('product-grid')?.getAttribute('aria-busy') || '',
          pathname: location.pathname,
        };
      });

      const responsiveness = await Promise.race([
        page.evaluate(async () => {
          const started = performance.now();
          await new Promise(resolve => setTimeout(resolve, 120));
          return performance.now() - started;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('event loop bloqueado')), 4_000)),
      ]);

      if (!state.bodyExists || !state.bodyVisible) failures.push(`${route.name}: body ausente u oculto.`);
      if (state.bodyTextLength < 10 && !state.storeOverlayVisible) failures.push(`${route.name}: contenido visible insuficiente.`);
      if (state.loaderVisible && !state.storeOverlayVisible) failures.push(`${route.name}: el loader quedó visible.`);
      if (localHttpErrors.length) failures.push(`${route.name}: recursos locales con error (${[...new Set(localHttpErrors)].join(', ')}).`);
      if (pageErrors.length) failures.push(`${route.name}: errores JavaScript (${[...new Set(pageErrors)].join(' | ')}).`);
      if (!Number.isFinite(responsiveness) || responsiveness > 2_500) failures.push(`${route.name}: hilo principal sin respuesta (${responsiveness} ms).`);

      if (route.redirectPath && state.pathname !== route.redirectPath) {
        failures.push(`${route.name}: no redirigió a ${route.redirectPath}; terminó en ${state.pathname}.`);
      }

      if (route.product) {
        if (!state.productRecognized) failures.push('Producto: el runtime no reconoció product.html.');
        if (!state.productRuntimeClass) failures.push('Producto: no se montó la capa de mantenimiento.');
        if (!state.productStateVisible && !state.storeOverlayVisible) failures.push('Producto: ningún estado visible quedó disponible.');
        if (state.productBusy === 'true' && !state.storeOverlayVisible) failures.push('Producto: product-grid permaneció aria-busy=true.');
      }

      console.log(`OK — ${route.name} · ${state.pathname} · loader cerrado · ${Math.round(responsiveness)} ms`);
    } catch (error) {
      failures.push(`${route.name}: ${error.message || String(error)}.`);
    } finally {
      await page.close();
    }
  }

  for (const width of [390]) {
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        window.TT_DISABLE_STORE_GATE = true;
      });
      await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('#tt-tabbar #tabbar-tienda', { state: 'attached', timeout: 10_000 });
      await page.waitForTimeout(350);
      const surfaces = await page.evaluate(() => {
        const ids = ['tt-tabbar', 'tabbar-tienda', 'tabbar-search', 'tabbar-cart', 'tabbar-cuenta', 'search-panel', 'cart-drawer', 'collections-sheet'];
        return Object.fromEntries(ids.map(id => {
          const element = document.getElementById(id);
          if (!element) return [id, null];
          const style = getComputedStyle(element);
          return [id, {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderColor,
            borderStyle: style.borderStyle,
            borderWidth: style.borderWidth,
            opacity: style.opacity,
          }];
        }));
      });
      const borderedPanels = new Set(['search-panel', 'cart-drawer', 'collections-sheet']);
      for (const [id, style] of Object.entries(surfaces)) {
        if (!style) {
          failures.push(`Header mobile ${width}px: falta #${id}.`);
          continue;
        }
        if (style.backgroundColor !== 'rgb(255, 255, 255)') {
          failures.push(`Header mobile ${width}px: #${id} no es blanco (${style.backgroundColor}).`);
        }
        if (style.backgroundImage !== 'none') {
          failures.push(`Header mobile ${width}px: #${id} conserva imagen o degradado de fondo.`);
        }
        if (style.opacity !== '1') {
          failures.push(`Header mobile ${width}px: #${id} conserva opacidad ${style.opacity}.`);
        }
        if (borderedPanels.has(id) && (style.borderColor !== 'rgb(241, 200, 213)' || style.borderStyle === 'none' || style.borderWidth === '0px')) {
          failures.push(`Header mobile ${width}px: #${id} no conserva el borde rosado sólido.`);
        }
      }
      console.log(`OK — Header mobile ${width}px · Tienda · Buscar · Carrito · Cuenta · fondos blancos`);
    } catch (error) {
      failures.push(`Header mobile ${width}px: ${error.message || String(error)}.`);
    } finally {
      await page.close();
    }
  }

  for (const width of [768, 820, 1023, 1024]) {
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
      await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('#tt-header-tablet #btn-menu-tablet', { state: 'attached', timeout: 10_000 });
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => {
        const visible = node => !!node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
        const required = ['tt-header-tablet','btn-menu-tablet','btn-search-tablet','btn-cuenta-tablet','btn-cart-tablet','tt-tablet-menu'];
        return {
          missing: required.filter(id => !document.getElementById(id)),
          tabletVisible: visible(document.getElementById('tt-header-tablet')),
          desktopVisible: visible(document.getElementById('tt-header-desktop-tablet')),
          mobileVisible: visible(document.getElementById('tt-tabbar')),
        };
      });
      if (state.missing.length) failures.push(`Header tablet ${width}px: faltan ${state.missing.join(', ')}.`);
      if (!state.tabletVisible || state.desktopVisible || state.mobileVisible) failures.push(`Header tablet ${width}px: aislamiento responsive incorrecto.`);
      console.log(`OK — Header tablet ${width}px · menú · Buscar · Cuenta · Carrito`);
    } catch (error) {
      failures.push(`Header tablet ${width}px: ${error.message || String(error)}.`);
    } finally {
      await page.close();
    }
  }

  for (const width of [1025, 1440]) {
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        window.TT_DISABLE_STORE_GATE = true;
      });
      await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('#tt-header-desktop-tablet #btn-tienda', { state: 'attached', timeout: 10_000 });
      await page.waitForTimeout(350);
      const surfaces = await page.evaluate(() => {
        const ids = [
          'tt-header-desktop-tablet',
          'btn-tienda',
          'btn-search',
          'btn-cuenta',
          'btn-cart',
          'tt-tienda-dropdown-panel',
          'search-panel',
          'account-panel',
          'cart-drawer',
        ];
        return Object.fromEntries(ids.map(id => {
          const element = document.getElementById(id);
          if (!element) return [id, null];
          const style = getComputedStyle(element);
          return [id, {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderColor,
            borderStyle: style.borderStyle,
            borderWidth: style.borderWidth,
            opacity: style.opacity,
          }];
        }));
      });
      const borderedSurfaces = new Set([
        'btn-tienda',
        'btn-search',
        'btn-cuenta',
        'btn-cart',
        'tt-tienda-dropdown-panel',
        'search-panel',
        'account-panel',
        'cart-drawer',
      ]);
      for (const [id, style] of Object.entries(surfaces)) {
        if (!style) {
          failures.push(`Header desktop/tablet ${width}px: falta #${id}.`);
          continue;
        }
        if (style.backgroundColor !== 'rgb(255, 255, 255)') {
          failures.push(`Header desktop/tablet ${width}px: #${id} no es blanco (${style.backgroundColor}).`);
        }
        if (style.backgroundImage !== 'none') {
          failures.push(`Header desktop/tablet ${width}px: #${id} conserva imagen o degradado de fondo.`);
        }
        if (style.opacity !== '1') {
          failures.push(`Header desktop/tablet ${width}px: #${id} conserva opacidad ${style.opacity}.`);
        }
        if (borderedSurfaces.has(id) && (style.borderColor !== 'rgb(241, 200, 213)' || style.borderStyle === 'none' || style.borderWidth === '0px')) {
          failures.push(`Header desktop/tablet ${width}px: #${id} no conserva el borde rosado sólido.`);
        }
      }
      console.log(`OK — Header desktop/tablet ${width}px · Tienda · Buscar · Cuenta · Carrito · fondos blancos`);
    } catch (error) {
      failures.push(`Header desktop/tablet ${width}px: ${error.message || String(error)}.`);
    } finally {
      await page.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
  await closeServer();
}

if (failures.length) {
  console.error('\nSMOKE DE TODAS LAS PÁGINAS: FALLÓ');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`\nSMOKE DE TODAS LAS PÁGINAS: OK · ${routes.length} rutas · loaders · recursos locales · JavaScript · redirecciones · Producto · header mobile y desktop/tablet.`);
