import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProductMetadataHtml } from '../functions/product.js';
import { lightenHtml, isLightweightPageName } from '../functions/[page].js';

const port = Math.max(1024, Math.min(65535, Number(process.argv[2]) || 4184));
const root = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const SEO_PRODUCT_FIXTURE = Object.freeze({
  id: 'seo-prueba',
  name: 'Reloj SEO Prueba',
  description: 'Producto determinista para validar el renderer SEO de Cloudflare.',
  price: 150000,
  stock: 0,
  active: true,
  handle: 'reloj-seo-prueba',
  imageUrl: 'https://tintinaccesorios.pages.dev/assets/og-cover.jpg',
});

function serveSeoProductFixture(url, response) {
  if (url.pathname !== '/product' || url.searchParams.get('id') !== SEO_PRODUCT_FIXTURE.id) return false;
  try {
    const source = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
    const rendered = renderProductMetadataHtml(source, SEO_PRODUCT_FIXTURE.id, SEO_PRODUCT_FIXTURE);
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'x-tintin-product-meta': 'server-test',
    });
    response.end(rendered.html);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`SEO fixture error: ${error?.message || error}`);
  }
  return true;
}

function serveCleanHtmlRoute(url, response) {
  const page = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!page || path.extname(page)) return false;
  const file = path.resolve(root, `${page}.html`);
  if (file === root || !file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) return false;
  const stat = fs.statSync(file);
  if (!stat.isFile()) return false;

  let html = fs.readFileSync(file, 'utf8');
  const lightweight = isLightweightPageName(page);
  if (lightweight) html = lightenHtml(html);
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8',
    ...(lightweight ? { 'x-tintin-page-runtime': 'lightweight-test' } : {})
  });
  response.end(html);
  return true;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  if (serveSeoProductFixture(url, response)) return;
  if (url.pathname === '/api/public-catalog') {
    const resource = url.searchParams.get('resource');
    if (!['products', 'collections'].includes(resource)) {
      response.writeHead(400, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
      response.end('{"ok":false,"error":"resource_invalid"}');
      return;
    }
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-tintin-cache': 'test' });
    response.end(JSON.stringify({ ok: true, resource, items: [], count: 0 }));
    return;
  }
  if (url.pathname === '/api/visual-builder-public') {
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
    response.end('{"ok":true,"config":null,"version":0}');
    return;
  }
  if (url.pathname === '/api/visual-studio-global-public') {
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
    response.end('{"ok":true,"version":0,"config":{"popups":[],"campaigns":[]}}');
    return;
  }
  if (serveCleanHtmlRoute(url, response)) return;

  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.resolve(root, `.${requested}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
});

server.listen(port, host, () => console.log(`Servidor de pruebas: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
