import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4193;
const baseURL = `http://${host}:${port}`;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
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
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['index.html', 'catalogo.html', 'collections.html', 'checkout.html', 'preguntas-frecuentes.html', '404.html']) {
      await page.goto(`${baseURL}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(450);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      check(
        geometry.scrollWidth <= geometry.clientWidth + 1,
        `${route} desborda a ${viewport.width}px (${geometry.scrollWidth}px)`,
      );
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-step1-next');
  check(await page.locator('#btn-step1-next').isDisabled(), 'Checkout vacío permite continuar');
  check(
    await page.locator('#btn-step1-next').getAttribute('aria-disabled') === 'true',
    'Checkout vacío no expone aria-disabled=true',
  );

  await page.goto(`${baseURL}/preguntas-frecuentes.html`, { waitUntil: 'domcontentloaded' });
  const firstQuestion = page.locator('.tt-faq-q').first();
  await firstQuestion.waitFor({ state: 'visible' });
  check(await firstQuestion.getAttribute('aria-expanded') === 'false', 'FAQ no inicia cerrada en ARIA');
  await firstQuestion.click();
  check(await firstQuestion.getAttribute('aria-expanded') === 'true', 'FAQ no actualiza aria-expanded');
  const answerId = await firstQuestion.getAttribute('aria-controls');
  check(Boolean(answerId), 'FAQ no relaciona pregunta y respuesta');
  if (answerId) {
    check(
      await page.locator(`#${answerId}`).getAttribute('aria-hidden') === 'false',
      'FAQ abierta mantiene la respuesta oculta para accesibilidad',
    );
  }

  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  check(
    !runtimeErrors.some(message => /appendChild/i.test(message)),
    `App Check falló antes de existir el DOM: ${runtimeErrors.join(' | ')}`,
  );
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const catalog = read('catalogo.html');
const social = read('js/components/contact/whatsapp.js');
const collections = read('js/pages/collections/pagina-colecciones.js');
check(catalog.includes('Ver todo el catálogo'), 'El estado vacío conserva el CTA incorrecto');
check(!social.includes("new URL(String(value || ''), location.href)"), 'Una red social vacía aún resuelve a la página actual');
check(collections.includes('colecciones cargadas.'), 'El plural de colecciones sigue incorrecto');

for (const variant of ['desktop', 'tablet', 'mobile']) {
  const file = path.join(root, 'assets-tintin', 'images', 'home', 'editorial-relojes', `editorial-relojes-${variant}.webp`);
  check(fs.existsSync(file) && fs.statSync(file).size > 40_000, `Editorial ${variant} sigue siendo un placeholder`);
}

if (failures.length) {
  console.error(failures.map(message => `FALTA — ${message}`).join('\n'));
  process.exit(1);
}

console.log('Auditoría desktop: 3 viewports, 6 rutas y estados críticos correctos.');
