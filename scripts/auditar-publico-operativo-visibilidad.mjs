import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = 'http://127.0.0.1:4196';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(absolute).pipe(response);
  });
});

await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4196, '127.0.0.1', resolve); });
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const viewport of [{ width: 320, height: 700 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/catalogo.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tt-catalog-sync-state', { state: 'attached' });
    check(await page.locator('#tt-catalog-sync-state').evaluate(node => getComputedStyle(node).display === 'none'), `Catálogo expone telemetría pública a ${viewport.width}px`);
    check(await page.locator('.tt-cart-sync-status').evaluate(node => getComputedStyle(node).display === 'none'), `Carrito expone telemetría pública a ${viewport.width}px`);

    await page.evaluate(() => document.documentElement.classList.add('tt-staff-session'));
    check(await page.locator('#tt-catalog-sync-state').evaluate(node => getComputedStyle(node).display === 'flex'), `Equipo no puede ver estado de catálogo a ${viewport.width}px`);
    check(await page.locator('.tt-cart-sync-status').evaluate(node => getComputedStyle(node).display === 'flex'), `Equipo no puede ver estado de carrito a ${viewport.width}px`);

    check(await page.locator('#btn-tienda').getAttribute('aria-current') === 'page', `Header no marca Tienda a ${viewport.width}px`);
    // El header de tablet usa el mismo contrato de ruta que el estado
    // compartido (`btn-tablet-tienda`). `btn-mobile-tienda` era un id legado
    // que ya no existe y convertía esta comprobación en un falso negativo.
    check(await page.locator('#btn-tablet-tienda').getAttribute('aria-current') === 'page', `Menú tablet no marca Tienda a ${viewport.width}px`);
    check(await page.locator('#tabbar-tienda').getAttribute('aria-current') === 'page', `Tabbar no expone la ruta Tienda a ${viewport.width}px`);
    check(await page.locator('#tabbar-tienda').evaluate(node => node.classList.contains('active')), `Tabbar no marca Tienda a ${viewport.width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tt-checkout-sync-state', { state: 'attached' });
  check(await page.locator('#tt-checkout-sync-state').evaluate(node => getComputedStyle(node).display === 'none'), 'Checkout expone telemetría al cliente');
  check(await page.locator('#tabbar-cart').evaluate(node => node.classList.contains('active')), 'Checkout no marca Carrito en mobile');
  check(await page.locator('#btn-cart').getAttribute('aria-current') === 'page', 'Checkout no marca Carrito en desktop/tablet');
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const authNav = read('js/core/auth/navegacion-autenticacion.js');
const roles = read('js/core/auth/roles.js');
const styles = read('styles.css');
for (const role of ['superadmin', 'admin', 'agent', 'viewer']) check(new RegExp(`${role}:[\\s\\S]*?viewDashboard:\\s*true`).test(roles), `Falta cobertura del rol ${role}`);
check(/client:[\s\S]*?viewDashboard:\s*false/.test(roles), 'El rol cliente puede revelar telemetría');
check(authNav.includes("classList.toggle('tt-staff-session',staff)"), 'La sesión de equipo no controla la visibilidad');
check(styles.includes('[data-tt-operational-status]'), 'Falta el selector operativo compartido');
check(styles.includes('html.tt-staff-session'), 'Falta la excepción visual para equipo');

if (failures.length) {
  console.error(failures.map(message => `FALTA — ${message}`).join('\n'));
  process.exit(1);
}
console.log('Visibilidad operativa y navegación activa correctas en 320, 390, 768 y 1440 px.');
