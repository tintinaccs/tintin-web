import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4195;
const baseURL = `http://${host}:${port}`;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
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
    window.TT_DISABLE_STORE_GATE = true;
    try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  const routes = [
    '404.html', 'about.html', 'admin-images.html', 'admin.html',
    'cambios-devoluciones.html', 'catalogo.html', 'checkout.html', 'collections.html',
    'contact.html', 'envios.html', 'index.html', 'login.html', 'nosotros.html',
    'perfil.html', 'preguntas-frecuentes.html', 'privacidad.html', 'product.html', 'terminos.html',
  ];
  const viewports = [
    { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1120, height: 800 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`${baseURL}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(350);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      }));
      check(geometry.scrollWidth <= geometry.clientWidth + 1,
        `${route} desborda a ${viewport.width}px (${geometry.scrollWidth}px)`);
    }
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const shell = await page.evaluate(() => {
      const visible = node => node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
      const targets = [...document.querySelectorAll('#tt-header-desktop-tablet button,#tt-header-desktop-tablet a')]
        .filter(visible).map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
      const media = document.querySelector('.tt-hero-media');
      const picture = media?.querySelector('picture');
      return {
        headerVisible: visible(document.getElementById('tt-header-desktop-tablet')),
        tabbarVisible: visible(document.getElementById('tt-tabbar')),
        homeCurrent: document.querySelector('[data-shell-route="home"]')?.getAttribute('aria-current'),
        tabbarCurrent: document.querySelector('[data-shell-tab="home"]')?.getAttribute('aria-current'),
        targets,
        heroBackground: media ? getComputedStyle(media).backgroundImage : '',
        pictureBackground: picture ? getComputedStyle(picture).backgroundColor : '',
      };
    });
    if (viewport.width === 768) {
      check(shell.tabbarVisible, 'La tablet de 768px no muestra la navegación inferior');
      check(shell.tabbarCurrent === 'page', 'La tablet de 768px no marca Inicio en la tabbar');
    } else {
      check(shell.headerVisible, `El header tablet no aparece a ${viewport.width}px`);
      check(shell.homeCurrent === 'page', `El header tablet no marca Inicio a ${viewport.width}px`);
      shell.targets.forEach((target, index) => check(target.width >= 40 && target.height >= 40,
        `Control ${index + 1} del header mide ${Math.round(target.width)}x${Math.round(target.height)} a ${viewport.width}px`));
    }
    check(shell.heroBackground.includes('editorial-relojes-tablet.webp'),
      `El hero no usa el fallback tablet a ${viewport.width}px`);
    check(shell.pictureBackground === 'rgba(0, 0, 0, 0)' || shell.pictureBackground === 'transparent',
      `La capa picture cubre el fallback tablet a ${viewport.width}px`);
  }

  check(!runtimeErrors.some(message => /appendChild|TypeError|ReferenceError/i.test(message)),
    `Errores de runtime en tablet: ${runtimeErrors.join(' | ')}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (failures.length) {
  console.error(failures.map(message => `FALTA - ${message}`).join('\n'));
  process.exit(1);
}

console.log('Auditoria tablet: 4 viewports, 18 rutas, navegacion, tacto y hero correctos.');
