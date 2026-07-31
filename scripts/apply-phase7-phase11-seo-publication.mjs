import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const ORIGIN = 'https://tintinaccesorios.pages.dev';
const COVER = `${ORIGIN}/assets/og-cover.jpg`;
const LOGO = `${ORIGIN}/assets-tintin/images/general/logo.png`;

const PUBLIC_PAGES = {
  'index.html': {
    title: 'TINTIN Accesorios & Relojes | Accesorios Femeninos — Paraguay',
    description: 'Tintin Accesorios & Relojes — tienda de accesorios femeninos elegantes en Paraguay. Relojes, bolsos, collares, aros, brazaletes y más.',
    priority: '1.0', changefreq: 'daily'
  },
  'catalogo.html': {
    title: 'Catálogo de Accesorios | TINTIN Accesorios & Relojes',
    description: 'Explorá el catálogo de Tintin: relojes, aros, collares, pulseras, anillos y accesorios femeninos con envíos a todo Paraguay.',
    priority: '0.9', changefreq: 'daily'
  },
  'collections.html': {
    title: 'Colecciones | TINTIN Accesorios & Relojes',
    description: 'Descubrí las colecciones de accesorios y relojes de Tintin, organizadas para encontrar fácilmente tu próximo favorito.',
    priority: '0.8', changefreq: 'weekly'
  },
  'product.html': {
    title: 'Producto | TINTIN Accesorios & Relojes',
    description: 'Detalle de producto — Tintin Accesorios & Relojes, tu boutique femenina en Paraguay.',
    priority: null, changefreq: null, type: 'product', dynamic: true
  },
  'about.html': {
    title: 'Quiénes Somos | TINTIN Accesorios & Relojes',
    description: 'Conocé la historia y la esencia de Tintin Accesorios & Relojes, una tienda paraguaya dedicada a accesorios femeninos.',
    priority: '0.6', changefreq: 'monthly'
  },
  'contact.html': {
    title: 'Contacto | TINTIN Accesorios & Relojes',
    description: 'Contactá con Tintin Accesorios & Relojes para consultas, pedidos y atención personalizada en Paraguay.',
    priority: '0.6', changefreq: 'monthly'
  },
  'envios.html': {
    title: 'Envíos | TINTIN Accesorios & Relojes',
    description: 'Consultá las opciones, zonas y condiciones de envío de Tintin Accesorios & Relojes en Paraguay.',
    priority: '0.5', changefreq: 'monthly'
  },
  'cambios-devoluciones.html': {
    title: 'Cambios y Devoluciones | TINTIN Accesorios & Relojes',
    description: 'Conocé las condiciones de cambios y devoluciones de Tintin Accesorios & Relojes.',
    priority: '0.5', changefreq: 'monthly'
  },
  'preguntas-frecuentes.html': {
    title: 'Preguntas Frecuentes | TINTIN Accesorios & Relojes',
    description: 'Respuestas sobre compras, pagos, envíos, productos y atención de Tintin Accesorios & Relojes.',
    priority: '0.5', changefreq: 'monthly'
  },
  'terminos.html': {
    title: 'Términos y Condiciones | TINTIN Accesorios & Relojes',
    description: 'Términos y condiciones de uso y compra en Tintin Accesorios & Relojes.',
    priority: '0.3', changefreq: 'yearly'
  },
  'privacidad.html': {
    title: 'Política de Privacidad | TINTIN Accesorios & Relojes',
    description: 'Conocé cómo Tintin protege y utiliza la información relacionada con la tienda y sus servicios.',
    priority: '0.3', changefreq: 'yearly'
  }
};

const NOINDEX_PAGES = new Set([
  '404.html', 'admin.html', 'admin-images.html', 'checkout.html',
  'login.html', 'perfil.html', 'nosotros.html'
]);

function absolute(relative) { return path.join(ROOT, relative); }
function read(relative) { return fs.readFileSync(absolute(relative), 'utf8'); }
function write(relative, content) {
  const target = absolute(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content).replace(/\r\n?/g, '\n'), 'utf8');
}
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function removeTag(html, regex) { return html.replace(regex, ''); }

function metadataBlock(file, config) {
  const url = `${ORIGIN}/${file}`;
  const productIds = config.dynamic;
  return [
    `  <meta name="description" content="${escapeAttr(config.description)}"${productIds ? ' id="meta-description"' : ''}>`,
    '  <meta name="robots" content="index, follow, max-image-preview:large">',
    `  <meta property="og:title" content="${escapeAttr(config.title)}"${productIds ? ' id="meta-og-title"' : ''}>`,
    `  <meta property="og:description" content="${escapeAttr(config.description)}"${productIds ? ' id="meta-og-description"' : ''}>`,
    `  <meta property="og:image" content="${COVER}"${productIds ? ' id="meta-og-image"' : ''}>`,
    `  <meta property="og:url" content="${url}"${productIds ? ' id="meta-og-url"' : ''}>`,
    `  <meta property="og:type" content="${config.type || 'website'}">`,
    '  <meta property="og:site_name" content="Tintin Accesorios & Relojes">',
    '  <meta property="og:locale" content="es_PY">',
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeAttr(config.title)}"${productIds ? ' id="meta-twitter-title"' : ''}>`,
    `  <meta name="twitter:description" content="${escapeAttr(config.description)}"${productIds ? ' id="meta-twitter-description"' : ''}>`,
    `  <meta name="twitter:image" content="${COVER}"${productIds ? ' id="meta-twitter-image"' : ''}>`,
    `  <link rel="canonical" href="${url}"${productIds ? ' id="link-canonical"' : ''}>`
  ].join('\n');
}

function normalizePublicPage(file, config) {
  let html = read(file);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${config.title}</title>`);
  html = removeTag(html, /\s*<meta\b[^>]*\bname=["']description["'][^>]*>\s*/gi);
  html = removeTag(html, /\s*<meta\b[^>]*\bname=["']robots["'][^>]*>\s*/gi);
  html = removeTag(html, /\s*<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi);
  html = removeTag(html, /\s*<meta\b[^>]*\bname=["']twitter:[^"']+["'][^>]*>\s*/gi);
  html = removeTag(html, /\s*<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi);
  html = html.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n${metadataBlock(file, config)}`);

  const pwaTags = [
    '<link rel="icon" type="image/x-icon" href="favicon.ico">',
    '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">',
    '<link rel="manifest" href="manifest.json">',
    '<meta name="theme-color" content="#AD3F67">'
  ];
  for (const tag of pwaTags) {
    const marker = tag.match(/(?:href|name)="([^"]+)/)?.[1] || tag;
    if (!html.includes(marker)) html = html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
  write(file, html);
}

function normalizeNoindexPage(file) {
  let html = read(file);
  html = removeTag(html, /\s*<meta\b[^>]*\bname=["']robots["'][^>]*>\s*/gi);
  html = html.replace(/(<title>[\s\S]*?<\/title>)/i, '$1\n  <meta name="robots" content="noindex, nofollow, noarchive">');
  write(file, html);
}

for (const [file, config] of Object.entries(PUBLIC_PAGES)) normalizePublicPage(file, config);
for (const file of NOINDEX_PAGES) normalizeNoindexPage(file);

let index = read('index.html');
if (!index.includes('id="tt-store-jsonld"')) {
  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${ORIGIN}/#store`,
    name: 'Tintin Accesorios & Relojes',
    url: `${ORIGIN}/index.html`,
    logo: LOGO,
    image: COVER,
    description: PUBLIC_PAGES['index.html'].description,
    areaServed: { '@type': 'Country', name: 'Paraguay' },
    currenciesAccepted: 'PYG'
  };
  index = index.replace(/<\/head>/i, `  <script type="application/ld+json" id="tt-store-jsonld">${JSON.stringify(store)}</script>\n</head>`);
  write('index.html', index);
}

let classic = read('script.js');
classic = classic
  .replace("url: window.location.href,", "url: canonicalProductUrl.href,")
  .replace(
    "  const available = !(stock !== null && stock <= 0);\n  const data = {",
    `  const available = !(stock !== null && stock <= 0);\n  const canonicalProductUrl = new URL('/product.html', '${ORIGIN}');\n  canonicalProductUrl.searchParams.set('id', String(product.id));\n  const data = {`
  )
  .replace(
    "    category: product.category || product.cat || undefined,\n    offers:",
    "    category: product.category || product.cat || undefined,\n    brand: { '@type': 'Brand', name: 'Tintin' },\n    offers:"
  )
  .replace(
    "  const productUrl = new URL('product.html', window.location.href);\n  productUrl.search = '';",
    `  const productUrl = new URL('/product.html', '${ORIGIN}');\n  productUrl.search = '';`
  )
  .replaceAll('https://tintinaccs.github.io/tintin-web/assets/og-cover.jpg', COVER);
write('script.js', classic);

let homeMaintenance = read('js/home-maintenance.js');
homeMaintenance = homeMaintenance
  .replace(
    "  function currentBaseUrl() {\n    const base = new URL('./', window.location.href);\n    return base.href;\n  }",
    `  function currentBaseUrl() {\n    return '${ORIGIN}/';\n  }`
  )
  .replaceAll('https://tintinaccs.github.io/tintin-web/', `${ORIGIN}/`)
  .replaceAll('https://tintinaccs.github.io/tintin-web', ORIGIN);
write('js/home-maintenance.js', homeMaintenance);

let geoSearch = read('functions/api/geo-search.js');
geoSearch = geoSearch.replaceAll('https://tintinaccs.github.io/tintin-web/', `${ORIGIN}/`);
write('functions/api/geo-search.js', geoSearch);

const manifest = {
  id: '/',
  name: 'Tintin Accesorios & Relojes',
  short_name: 'Tintin',
  description: 'Accesorios y relojes femeninos en Paraguay — anillos, aros, pulseras, collares y más.',
  start_url: '/index.html',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#FFF6FA',
  theme_color: '#AD3F67',
  lang: 'es-PY',
  dir: 'ltr',
  categories: ['shopping', 'lifestyle'],
  icons: [
    { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
  ]
};
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const sitemapEntries = Object.entries(PUBLIC_PAGES)
  .filter(([, config]) => config.priority)
  .map(([file, config]) => `  <url>\n    <loc>${ORIGIN}/${file}</loc>\n    <changefreq>${config.changefreq}</changefreq>\n    <priority>${config.priority}</priority>\n  </url>`)
  .join('\n');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-images.html\nDisallow: /checkout.html\nDisallow: /login.html\nDisallow: /perfil.html\nDisallow: /404.html\nDisallow: /nosotros.html\nDisallow: /functions/\nDisallow: /scripts/\nDisallow: /maintenance/\nDisallow: /firebase-cloud-functions-inactive/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

const audit = `'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const origin = '${ORIGIN}';
const indexed = ${JSON.stringify(Object.keys(PUBLIC_PAGES))};
const noindex = ${JSON.stringify([...NOINDEX_PAGES])};
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, ok, problem) => checks.push({ name, ok: Boolean(ok), problem });
const count = (text, regex) => (text.match(regex) || []).length;

for (const file of indexed) {
  const html = read(file);
  const expected = origin + '/' + file;
  check(file + ': título único', count(html, /<title>/gi) === 1 && /<title>[^<]{8,}<\\/title>/i.test(html), 'Cada página indexable necesita un título descriptivo.');
  check(file + ': descripción única', count(html, /<meta\\b[^>]*name=["']description["']/gi) === 1, 'Debe existir una sola descripción.');
  check(file + ': canonical único', count(html, /<link\\b[^>]*rel=["']canonical["']/gi) === 1 && html.includes('href="' + expected), 'El canonical debe apuntar al dominio público vigente.');
  check(file + ': Open Graph completo', /property="og:title"/.test(html) && /property="og:description"/.test(html) && /property="og:image"/.test(html) && html.includes('property="og:url" content="' + expected), 'Faltan etiquetas sociales absolutas.');
  check(file + ': Twitter completo', /name="twitter:card" content="summary_large_image"/.test(html) && /name="twitter:title"/.test(html) && /name="twitter:description"/.test(html) && /name="twitter:image"/.test(html), 'Faltan etiquetas para compartir.');
  check(file + ': PWA e iconos', /rel="manifest" href="manifest.json"/.test(html) && /apple-touch-icon/.test(html) && /favicon-32x32/.test(html), 'La publicación debe conservar manifest e iconos.');
  check(file + ': indexable', /name="robots" content="index, follow, max-image-preview:large"/.test(html), 'La página pública debe declarar indexación coherente.');
}
for (const file of noindex) {
  const html = read(file);
  check(file + ': noindex', /name="robots" content="noindex, nofollow, noarchive"/.test(html), 'Las superficies privadas, auxiliares o duplicadas no deben indexarse.');
}

const activeFiles = [
  ...fs.readdirSync(root).filter(file => /\\.(?:html|js|json|xml|txt)$/.test(file)),
  ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => 'js/' + file),
  ...fs.readdirSync(path.join(root, 'functions/api')).filter(file => file.endsWith('.js')).map(file => 'functions/api/' + file)
];
const oldRefs = activeFiles.filter(file => read(file).includes('tintinaccs.github.io/tintin-web'));
check('No quedan URLs activas de GitHub Pages', oldRefs.length === 0, 'Referencias antiguas: ' + oldRefs.join(', '));

const script = read('script.js');
check('Producto genera canonical absoluto y estable', script.includes("new URL('/product.html', '" + origin + "')") && script.includes("canonicalProductUrl.searchParams.set('id', String(product.id))"), 'El producto no debe canonicalizar previews, localhost ni URLs sin id.');
check('Producto publica JSON-LD vigente', /'@type': 'Product'/.test(script) && /priceCurrency: 'PYG'/.test(script) && /schema.org\\/InStock/.test(script) && /schema.org\\/OutOfStock/.test(script) && /canonicalProductUrl.href/.test(script), 'Los datos estructurados deben reflejar precio, moneda, URL y stock.');

const sitemap = read('sitemap.xml');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(match => match[1]);
const expectedLocations = indexed.filter(file => file !== 'product.html').map(file => origin + '/' + file);
check('Sitemap contiene solo páginas indexables', JSON.stringify(locations) === JSON.stringify(expectedLocations), 'El sitemap debe coincidir exactamente con páginas públicas estáticas.');
check('robots enlaza el sitemap vigente', read('robots.txt').includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt debe enlazar el sitemap de producción.');

const manifest = JSON.parse(read('manifest.json'));
check('Manifest tiene identidad, scope e iconos válidos', manifest.id === '/' && manifest.start_url === '/index.html' && manifest.scope === '/' && manifest.icons?.some(icon => icon.sizes === '192x192') && manifest.icons?.some(icon => icon.sizes === '512x512'), 'La PWA debe instalarse desde una identidad estable.');
check('Inicio publica Store JSON-LD', /id="tt-store-jsonld"/.test(read('index.html')) && /"@type":"Store"/.test(read('index.html')), 'La organización debe tener datos estructurados básicos.');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\\/\\/)/i.test(raw) || raw.includes('${')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\\//, '');
    if (!clean) continue;
    const resolved = path.normalize(path.join(path.dirname(file), clean));
    check(file + ': recurso local ' + raw, fs.existsSync(path.join(root, resolved)), 'Enlace o recurso local roto.');
  }
}

const pkg = JSON.parse(read('package.json'));
check('Fase 11 forma parte del cierre', pkg.scripts['audit:phase11'] === 'node scripts/audit-phase11-seo.js' && pkg.scripts['test:phase11-seo'] === 'playwright test tests/seo/phase11-seo.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase11'), 'Las verificaciones SEO deben quedar permanentes.');
check('Existe monitor de producción', fs.existsSync(path.join(root, 'scripts/audit-production-health.mjs')) && fs.existsSync(path.join(root, '.github/workflows/phase11-seo-production.yml')), 'La disponibilidad pública debe revisarse de forma recurrente.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\\nAuditoría Fase 11 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\\nAuditoría Fase 11: SEO y publicación correctos (' + checks.length + ' comprobaciones).');
`;
write('scripts/audit-phase11-seo.js', audit);

const health = `import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || '${ORIGIN}').replace(/\\/$/, '');
const timeoutMs = Number(process.env.TINTIN_HEALTH_TIMEOUT_MS || 15000);
const attempts = 3;
const results = [];

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinProductionHealth/1.0 (+${ORIGIN}/)' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status >= 500) throw new Error('HTTP ' + response.status);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function inspect(relative, expectedType) {
  const url = origin + relative;
  const started = Date.now();
  try {
    const response = await fetchWithRetry(url);
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    const ok = response.ok && (!expectedType || type.includes(expectedType));
    results.push({ url, status: response.status, ms: Date.now() - started, type, ok, bytes: body.length });
    if (!ok) throw new Error('Respuesta inesperada: ' + response.status + ' ' + type);
    return body;
  } catch (error) {
    results.push({ url, status: 0, ms: Date.now() - started, type: '', ok: false, error: String(error?.message || error) });
    throw error;
  }
}

let failure = null;
try {
  const home = await inspect('/index.html', 'text/html');
  if (!home.includes('<link rel="canonical" href="' + origin + '/index.html">')) throw new Error('Canonical de inicio ausente o incorrecto.');
  if (home.includes('tintinaccs.github.io/tintin-web')) throw new Error('Producción todavía expone una URL antigua de GitHub Pages.');
  await inspect('/catalogo.html', 'text/html');
  await inspect('/collections.html', 'text/html');
  await inspect('/product.html', 'text/html');
  const robots = await inspect('/robots.txt', 'text/plain');
  if (!robots.includes('Sitemap: ' + origin + '/sitemap.xml')) throw new Error('robots.txt no apunta al sitemap vigente.');
  const sitemap = await inspect('/sitemap.xml', 'xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(match => match[1]);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/'))) throw new Error('Sitemap vacío o con origen inconsistente.');
  await inspect('/manifest.json', 'json');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase11-production-health.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, results, error: failure ? String(failure.message || failure) : '' }, null, 2));
results.forEach(item => console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.url + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms'));
if (failure) { console.error('\\nMonitoreo de producción fallido:', failure); process.exit(1); }
console.log('\\nProducción disponible y metadatos públicos coherentes.');
`;
write('scripts/audit-production-health.mjs', health);

const spec = `'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
});

test('inicio publica canonical, OG y Store JSON-LD consistentes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', '${ORIGIN}/index.html');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', '${ORIGIN}/index.html');
  const store = JSON.parse(await page.locator('#tt-store-jsonld').textContent());
  expect(store['@type']).toBe('Store');
  expect(store.url).toBe('${ORIGIN}/index.html');
});

test('producto actualiza canonical y JSON-LD con URL pública, PYG y stock', async ({ page }) => {
  await page.goto('/product.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._updateProductMeta === 'function' && typeof window._injectProductJsonLd === 'function');
  await page.evaluate(() => {
    const product = { id: 'seo-prueba', name: 'Reloj SEO Prueba', price: 150000, desc: 'Producto de prueba SEO', category: 'Relojes' };
    window._updateProductMeta(product, '${COVER}');
    window._injectProductJsonLd(product, '${COVER}', [], 0);
  });
  await expect(page.locator('#link-canonical')).toHaveAttribute('href', '${ORIGIN}/product.html?id=seo-prueba');
  const data = JSON.parse(await page.locator('#tt-product-jsonld').textContent());
  expect(data['@type']).toBe('Product');
  expect(data.offers.url).toBe('${ORIGIN}/product.html?id=seo-prueba');
  expect(data.offers.priceCurrency).toBe('PYG');
  expect(data.offers.availability).toBe('https://schema.org/OutOfStock');
});

test('superficies privadas y auxiliares permanecen noindex', async ({ page }) => {
  for (const file of ['admin.html', 'admin-images.html', 'checkout.html', 'login.html', 'perfil.html', '404.html']) {
    await page.goto('/' + file, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
  }
});
`;
write('tests/seo/phase11-seo.spec.js', spec);

const workflow = `name: Fase 11 — SEO, publicación y producción

on:
  pull_request:
    branches: [main]
    paths:
      - '**.html'
      - 'script.js'
      - 'js/**'
      - 'functions/api/**'
      - 'manifest.json'
      - 'robots.txt'
      - 'sitemap.xml'
      - 'scripts/audit-phase11-seo.js'
      - 'scripts/audit-production-health.mjs'
      - 'tests/seo/**'
      - 'package.json'
      - '.github/workflows/phase11-seo-production.yml'
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'

permissions:
  contents: read

concurrency:
  group: phase11-seo-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  seo-contract:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Auditar SEO y publicación
        run: npm run audit:phase11
      - name: Instalar Chromium
        run: npx playwright install --with-deps chromium
      - name: Iniciar sitio local
        run: |
          python3 -m http.server 4173 > /tmp/tintin-phase11-http.log 2>&1 &
          for attempt in {1..30}; do
            curl -fsS http://127.0.0.1:4173/index.html >/dev/null && exit 0
            sleep 1
          done
          cat /tmp/tintin-phase11-http.log
          exit 1
      - name: Probar metadatos en navegador
        env:
          PLAYWRIGHT_BASE_URL: http://127.0.0.1:4173
        run: npm run test:phase11-seo

  production-health:
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Verificar producción
        run: npm run monitor:production
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: phase11-production-health
          path: artifacts/phase11-production-health.json
          if-no-files-found: warn
          retention-days: 30
`;
write('.github/workflows/phase11-seo-production.yml', workflow);

write('docs/PHASE11_SEO_PUBLICATION.md', `# Fase 11 — SEO y publicación\n\nLa URL pública única es \`${ORIGIN}\`. Las páginas indexables tienen título, descripción, canonical, Open Graph, Twitter Card, iconos y manifest. Las superficies privadas o auxiliares usan \`noindex\`.\n\nLos productos generan canonical con \`id\`, JSON-LD \`Product\`, moneda PYG y disponibilidad en tiempo real.\n\nEl workflow \`phase11-seo-production.yml\` ejecuta contratos SEO en cada PR relevante y monitorea la producción cada hora.\n\nComandos:\n\n- \`npm run audit:phase11\`\n- \`npm run test:phase11-seo\`\n- \`npm run monitor:production\`\n`);

const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
pkg.scripts['audit:phase11'] = 'node scripts/audit-phase11-seo.js';
pkg.scripts['test:phase11-seo'] = 'playwright test tests/seo/phase11-seo.spec.js --project=chromium';
pkg.scripts['monitor:production'] = 'node scripts/audit-production-health.mjs';
if (!pkg.scripts['audit:final'].includes('audit:phase11')) {
  pkg.scripts['audit:final'] += ' && npm run audit:phase11';
}
write(packagePath, JSON.stringify(pkg, null, 2) + '\n');

fs.unlinkSync(SELF);
console.log('Fase 11 aplicada: metadatos, producto estructurado, sitemap, robots, PWA, auditorías y monitor de producción.');
