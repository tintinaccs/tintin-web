import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4194;
const baseURL = `http://${host}:${port}`;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
    });
    fs.createReadStream(absolute).pipe(response);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('tt_privacy_consent', 'accepted');
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  const routes = [
    'index.html', 'catalogo.html', 'collections.html', 'checkout.html',
    'preguntas-frecuentes.html', 'envios.html', 'cambios-devoluciones.html',
    'about.html', 'contacto.html', 'login.html', 'perfil.html', '404.html',
  ];
  for (const viewport of [
    { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`${baseURL}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      check(geometry.scrollWidth <= geometry.clientWidth + 1,
        `${route} desborda a ${viewport.width}px (${geometry.scrollWidth}px)`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/checkout.html`, { waitUntil: 'domcontentloaded' });
  const backHeight = await page.locator('.ck-header-back').evaluate(node => node.getBoundingClientRect().height);
  check(backHeight >= 44, `Volver en checkout mide ${backHeight}px; debe medir al menos 44px`);

  await page.goto(`${baseURL}/preguntas-frecuentes.html`, { waitUntil: 'domcontentloaded' });
  const footerToggle = page.locator('.tt-footer-accordion-toggle').first();
  await footerToggle.waitFor({ state: 'visible' });
  check(await footerToggle.getAttribute('aria-expanded') === 'false', 'El footer móvil no inicia compacto');
  const footerPanelId = await footerToggle.getAttribute('aria-controls');
  check(Boolean(footerPanelId), 'El acordeón del footer no expone aria-controls');
  await footerToggle.evaluate(node => node.click());
  check(await footerToggle.getAttribute('aria-expanded') === 'true', 'El footer móvil no abre la sección');
  if (footerPanelId) check(!(await page.locator(`#${footerPanelId}`).isHidden()), 'El panel del footer sigue oculto');

  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const hero = document.querySelector('.tt-hero-media');
    return hero && getComputedStyle(hero).backgroundImage.includes('editorial-relojes-mobile.webp');
  }, null, { timeout: 5000 });
  const heroBackground = await page.locator('.tt-hero-media').evaluate(node => getComputedStyle(node).backgroundImage);
  check(heroBackground.includes('editorial-relojes-mobile.webp'), 'El hero móvil no usa el respaldo responsive');
  check(!runtimeErrors.some(message => /appendChild|mobileMoreGrid/i.test(message)),
    `Hay errores de runtime: ${runtimeErrors.join(' | ')}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const adminHtml = read('admin.html');
const adminCss = read('css/admin.css');
const adminJs = read('js/admin-app.js');
const collectionsCss = read('css/pages/collections/collections-page.css');
const primaryTabs = adminHtml.match(/data-mobile-primary/g) || [];
check(primaryTabs.length === 5, `La barra admin debe tener 5 accesos primarios; tiene ${primaryTabs.length}`);
check(adminHtml.includes('id="adm-mobile-more-toggle"'), 'Falta el acceso Más del admin móvil');
check(adminHtml.includes('id="adm-mobile-more-sheet"'), 'Falta la hoja de opciones del admin móvil');
check(adminCss.includes('#adm-mobile-tabs > .adm-mobile-tab'), 'La barra admin móvil no reparte el ancho');
check(adminCss.includes('min-height: 58px'), 'Las opciones secundarias del admin no tienen superficie táctil');
check(adminJs.includes('moveSecondaryMobileTab'), 'Las opciones secundarias del admin no se montan en Más');
check(adminJs.includes("event.key === 'Escape'"), 'La hoja Más no se cierra con Escape');
check(collectionsCss.includes('visibility: visible !important'), 'Colecciones todavía puede quedar oculta tras cargar');

if (failures.length) {
  console.error(failures.map(message => `FALTA — ${message}`).join('\n'));
  process.exit(1);
}

console.log('Auditoría mobile: 3 viewports, 12 rutas, navegación, tacto y fallbacks correctos.');
