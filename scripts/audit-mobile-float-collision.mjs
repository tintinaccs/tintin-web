import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4177;
const baseURL = `http://${host}:${port}`;
const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__float__'], ['nosotros', '/about.html'], ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'], ['privacidad', '/privacidad.html'], ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'], ['faq', '/preguntas-frecuentes.html'], ['404', '/404.html'],
];
const viewports = [[320,720],[360,800],[390,844],[430,932],[480,900],[481,900],[767,1024],[768,1024]];
const mime = {
  '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(absolute).pipe(response);
  });
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
const closeServer = () => new Promise(resolve => server.close(resolve));

async function prepare(page) {
  await page.waitForSelector('body', { state:'attached', timeout:5_000 });
  await page.waitForFunction(() => document.getElementById('tt-tabbar') || document.body?.classList.contains('tt-public-shell-mounted'), null, { timeout:4_000 }).catch(() => {});
  await page.evaluate(() => {
    const root = document.documentElement, body = document.body;
    ['tt-initializing','tt-store-gate-pending','tt-store-gate-blocked','tt-scroll-locked'].forEach(name => root.classList.remove(name));
    body?.classList.remove('tt-scroll-locked');
    root.removeAttribute('style');
    ['position','top','left','right','width','overflow','visibility','touch-action'].forEach(name => body?.style.removeProperty(name));
    document.getElementById('tt-loader')?.remove();
    const closed = document.getElementById('tt-store-closed-overlay');
    if (closed) closed.style.display = 'none';
    window.scrollTo(0,0);
  });
  await page.waitForTimeout(180);
}

await listen();
const browser = await chromium.launch({ headless:true });
const failures = [];
try {
  for (const [width,height] of viewports) {
    const context = await browser.newContext({ viewport:{width,height}, serviceWorkers:'block', reducedMotion:'reduce' });
    await context.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false; });
    for (const [name,url] of routes) {
      const page = await context.newPage();
      try {
        await page.goto(`${baseURL}${url}`, { waitUntil:'domcontentloaded', timeout:15_000 });
        await prepare(page);
        const issue = await page.evaluate(() => {
          const visible = node => {
            if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 &&
              rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
          };
          const wa = document.querySelector('.tt-wa-float');
          if (!visible(wa)) return '';
          const a = wa.getBoundingClientRect();
          const controls = [...document.querySelectorAll('a,button')].filter(node =>
            visible(node) &&
            !node.closest('.tt-wa-float,.tt-tabbar,.tt-privacy-consent,.tt-search-panel,.tt-cart-drawer,.tt-collections-sheet,.tt-header')
          );
          const collided = controls.find(node => {
            const b = node.getBoundingClientRect();
            return a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
          });
          return collided ? `WhatsApp pisa ${collided.id ? '#' + collided.id : collided.className || collided.tagName}` : '';
        });
        if (issue) failures.push(`${name} ${width}px: ${issue}`);
        console.log(`${issue ? 'ERROR' : 'OK'} — ${name} ${width}×${height}${issue ? ' — ' + issue : ''}`);
      } catch (error) {
        failures.push(`${name} ${width}px: ${error.message || String(error)}`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await closeServer();
}

console.log(`\nColisiones del flotante: ${failures.length}.`);
if (failures.length) {
  failures.forEach(item => console.error(item));
  process.exit(1);
}
