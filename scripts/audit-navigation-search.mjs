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
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
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
    if (window.__ttSearchAuditCatalogLock !== true) {
      window.__ttSearchAuditCatalogLock = true;
      window.addEventListener('tintin:products-loaded', event => {
        if (event.detail?.source !== 'audit-seed') event.stopImmediatePropagation();
      }, true);
    }

    window.PRODUCTS = products;
    const synced = window.TintinSearchController.syncCatalog(products);
    if (synced !== products.length || window.TintinSearchController.catalogSize() !== products.length) {
      throw new Error(`El catálogo de prueba sincronizó ${synced} de ${products.length} productos`);
    }
  }, SEEDED_PRODUCTS);
}

async function renderSeededQuery(page, input) {
  await input.fill('reloj');
  await page.evaluate(products => {
    window.PRODUCTS = products;
    window.TintinSearchController.syncCatalog(products);
  }, SEEDED_PRODUCTS);
  await page.waitForSelector('#search-results .tt-search-result-item', { timeout:5000 });
}

async function auditSearch(label, viewport, triggerSelector) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(`${baseURL}/index.html`, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('tt-public-shell-mounted'), null, { timeout:10000 });
    await installSeededCatalog(page);

    await page.locator(triggerSelector).click();
    await page.waitForFunction(() => document.getElementById('search-panel')?.getAttribute('aria-hidden') === 'false');

    const input = page.locator('#search-input');
    await renderSeededQuery(page, input);

    const names = await page.locator('#search-results .tt-search-result-copy strong').allTextContents();
    check(names.some(name => /Reloj Ovalado Dorado/i.test(name)), `[${label}] no encontró el producto sembrado`);

    await input.press('ArrowDown');
    const activeDescendant = await input.getAttribute('aria-activedescendant');
    check(Boolean(activeDescendant), `[${label}] ArrowDown no actualizó aria-activedescendant`);
    if (activeDescendant) {
      const selected = await page.locator(`#${activeDescendant}`).getAttribute('aria-selected');
      check(selected === 'true', `[${label}] el resultado activo no anunció aria-selected=true`);
    }

    await page.locator('#btn-search-close').click();
    await page.waitForFunction(() => document.getElementById('search-panel')?.getAttribute('aria-hidden') === 'true');
    check(await input.inputValue() === '', `[${label}] el buscador no limpió el texto al cerrar`);
    check(await page.locator('#search-results').evaluate(node => getComputedStyle(node).display === 'none'), `[${label}] los resultados siguieron visibles al cerrar`);
    check(pageErrors.length === 0, `[${label}] errores de página: ${pageErrors.join(' | ')}`);
  } catch (error) {
    failures.push(`[${label}] ${error.message}`);
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
