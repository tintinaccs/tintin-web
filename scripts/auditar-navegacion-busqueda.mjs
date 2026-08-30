import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4203;
const baseURL = `http://${host}:${port}`;
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
const SEEDED_PRODUCTS = [
  { id:'reloj-prueba', name:'Reloj Ovalado Dorado', category:'Relojes', price:180000, active:true, stock:2, imageUrl:'' },
  { id:'collar-prueba', name:'Collar Corazón', category:'Collares', price:80000, active:true, stock:3, imageUrl:'' },
];

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', baseURL);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/api/public-catalog') {
    const resource = url.searchParams.get('resource');
    if (resource === 'storeGate') {
      response.writeHead(200, { 'cache-control':'no-store', 'content-type':'application/json; charset=utf-8', 'x-tintin-cache':'audit' });
      return response.end(JSON.stringify({ ok:true, resource, data:{ storeOpen:true, maintenanceAccess:{} } }));
    }
    if (!['products', 'collections'].includes(resource)) {
      response.writeHead(400, { 'cache-control':'no-store', 'content-type':'application/json; charset=utf-8' });
      return response.end('{"ok":false,"error":"resource_invalid"}');
    }
    response.writeHead(200, { 'cache-control':'no-store', 'content-type':'application/json; charset=utf-8', 'x-tintin-cache':'audit' });
    return response.end(JSON.stringify({ ok:true, resource, items:[], count:0 }));
  }
  if (pathname === '/api/visual-builder-public') {
    response.writeHead(200, { 'cache-control':'no-store', 'content-type':'application/json' });
    return response.end('{"ok":true,"config":null,"version":0}');
  }
  if (pathname === '/api/visual-studio-global-public') {
    response.writeHead(200, { 'cache-control':'no-store', 'content-type':'application/json' });
    return response.end('{"ok":true,"version":0,"config":{"popups":[],"campaigns":[]}}');
  }
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end();
    response.writeHead(200, { 'cache-control':'no-store', 'content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(absolute).pipe(response);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});

const browser = await chromium.launch({ headless:true, executablePath:process.env.TT_CHROMIUM_PATH || undefined });
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

async function installSeededCatalog(page) {
  await page.waitForFunction(
    () => document.getElementById('search-input')?.dataset.ttModularSearchReady === '1'
      && typeof window.TintinSearchController?.syncCatalog === 'function',
    null,
    { timeout:10000 }
  );

  await page.evaluate(products => {
    window.PRODUCTS = products;
    const synced = window.TintinSearchController.syncCatalog(products);
    if (synced !== products.length || window.TintinSearchController.catalogSize() !== products.length) {
      throw new Error(`El catálogo de prueba sincronizó ${synced} de ${products.length} productos`);
    }
  }, SEEDED_PRODUCTS);
}

async function renderSeededQuery(page, input) {
  await input.fill('reloj');
  await page.waitForFunction(products => {
    const controller = window.TintinSearchController;
    if (!controller || typeof controller.syncCatalog !== 'function') return false;

    // Una carga real del catálogo puede terminar en paralelo con esta auditoría.
    // En cada sondeo restauramos el catálogo controlado y renderizamos la consulta
    // en el mismo turno del navegador para evitar una carrera ajena al buscador.
    window.PRODUCTS = products;
    controller.syncCatalog(products);
    controller.renderCurrentQuery();

    return [...document.querySelectorAll('#search-results .tt-search-result-copy strong')]
      .some(node => /Reloj Ovalado Dorado/i.test(node.textContent || ''));
  }, SEEDED_PRODUCTS, { timeout:5000, polling:100 });
}

async function readSeededKeyboardState(page) {
  return page.evaluate(products => {
    const controller = window.TintinSearchController;
    const inputNode = document.getElementById('search-input');
    const resultsNode = document.getElementById('search-results');
    if (!controller || !inputNode || !resultsNode) {
      throw new Error('No están disponibles los controles del buscador');
    }

    // La sincronización, el render y el evento de teclado ocurren en un único
    // turno. Así ninguna carga asíncrona externa puede reemplazar el catálogo
    // entre la comprobación visual y la comprobación de accesibilidad.
    window.PRODUCTS = products;
    controller.syncCatalog(products);
    controller.renderCurrentQuery();

    const names = [...resultsNode.querySelectorAll('.tt-search-result-copy strong')]
      .map(node => node.textContent || '');

    inputNode.focus();
    inputNode.dispatchEvent(new KeyboardEvent('keydown', {
      key:'ArrowDown',
      code:'ArrowDown',
      bubbles:true,
      cancelable:true,
    }));

    const activeDescendant = inputNode.getAttribute('aria-activedescendant');
    const selected = activeDescendant
      ? document.getElementById(activeDescendant)?.getAttribute('aria-selected') || null
      : null;

    return { names, activeDescendant, selected };
  }, SEEDED_PRODUCTS);
}

async function auditSearch(label, viewport, triggerSelector) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  const missingResources = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.status() === 404) missingResources.push(response.url());
  });

  try {
    // Se instala antes de cualquier script de la página para que una carga real
    // de Firestore no reemplace el catálogo controlado mientras corre la prueba.
    // Esto aísla la auditoría; no modifica el código ni el comportamiento del sitio.
    await page.addInitScript(() => {
      window.__ttSearchAuditCatalogLock = true;
      window.addEventListener('tintin:products-loaded', event => {
        if (event.detail?.source !== 'audit-seed') event.stopImmediatePropagation();
      }, true);
    });

    await page.goto(`${baseURL}/index.html`, { waitUntil:'domcontentloaded' });
    await page.addStyleTag({ content:'#tt-store-gate-network-notice{display:none!important}' });
    await page.waitForFunction(() => document.body.classList.contains('tt-public-shell-mounted'), null, { timeout:10000 });

    await page.locator(triggerSelector).click();
    await page.waitForFunction(() => document.getElementById('search-panel')?.getAttribute('aria-hidden') === 'false');
    await installSeededCatalog(page);

    const input = page.locator('#search-input');
    await renderSeededQuery(page, input);

    const keyboardState = await readSeededKeyboardState(page);
    check(keyboardState.names.some(name => /Reloj Ovalado Dorado/i.test(name)), `[${label}] no encontró el producto sembrado`);
    check(Boolean(keyboardState.activeDescendant), `[${label}] ArrowDown no actualizó aria-activedescendant`);
    check(keyboardState.selected === 'true', `[${label}] el resultado activo no anunció aria-selected=true`);

    await page.locator('#btn-search-close').click();
    await page.waitForFunction(() => document.getElementById('search-panel')?.getAttribute('aria-hidden') === 'true');
    await page.waitForFunction(() => {
      const inputNode = document.getElementById('search-input');
      const resultsNode = document.getElementById('search-results');
      return inputNode?.value === '' && resultsNode && getComputedStyle(resultsNode).display === 'none';
    }, null, { timeout:3000 });
    check(missingResources.length === 0, `[${label}] recursos 404: ${missingResources.join(' | ')}`);
    check(pageErrors.length === 0, `[${label}] errores de página: ${pageErrors.join(' | ')}`);
  } catch (error) {
    const details = [
      error.message,
      missingResources.length ? `recursos 404: ${missingResources.join(' | ')}` : '',
      pageErrors.length ? `errores de página: ${pageErrors.join(' | ')}` : '',
    ].filter(Boolean).join(' — ');
    failures.push(`[${label}] ${details}`);
  } finally {
    await context.close();
  }
}

await auditSearch('desktop', { width:1280, height:900 }, '#btn-search');
await auditSearch('mobile', { width:390, height:844 }, '#tabbar-search');

await browser.close();
await new Promise(resolve => server.close(resolve));

if (failures.length) {
  console.error(`Auditoría de búsqueda falló (${failures.length})`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Búsqueda modular: desktop y mobile encuentran productos, navegan por teclado y limpian su estado al cerrar.');
