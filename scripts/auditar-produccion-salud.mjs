import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const timeoutMs = Number(process.env.TINTIN_HEALTH_TIMEOUT_MS || 15000);
const attempts = 3;
const results = [];
const failures = [];
const corePages = ['/', '/catalogo', '/collections', '/product'];

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: options.redirect || 'follow',
        headers: { 'user-agent': 'TintinProductionHealth/4.0 (+https://tintinaccesorios.pages.dev/)' },
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

function assertStrongCsp(value, route) {
  const csp = String(value || '');
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) {
    if (!csp.includes(directive)) throw new Error(route + ': CSP débil o incompleta; falta ' + directive + '.');
  }
}

function xmlLocations(body) {
  return [...String(body || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
}

async function inspect(relative, expectedType) {
  const requestedUrl = origin + relative;
  const started = Date.now();
  try {
    const response = await fetchWithRetry(requestedUrl);
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    const headers = Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','cache-control','x-tintin-product-meta'].map(name => [name, response.headers.get(name) || '']));
    const ok = response.ok && (!expectedType || type.includes(expectedType));
    results.push({ requestedUrl, finalUrl: response.url, redirected: response.redirected, status: response.status, ms: Date.now() - started, type, ok, bytes: body.length, headers });
    if (!ok) throw new Error('Respuesta inesperada: ' + response.status + ' ' + type);
    return { body, response, headers };
  } catch (error) {
    if (!results.some(item => item.requestedUrl === requestedUrl && item.ms >= 0)) {
      results.push({ requestedUrl, status: 0, ms: Date.now() - started, type: '', ok: false, error: String(error?.message || error) });
    }
    throw error;
  }
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    failures.push({ name, error: String(error?.message || error) });
  }
}

for (const route of corePages) {
  await check('page:' + route, async () => {
    const result = await inspect(route, 'text/html');
    if (result.response.url !== origin + route) throw new Error(route + ': la URL final no coincide con la canónica limpia.');
    assertStrongCsp(result.headers['content-security-policy'], route);
  });
}

await check('home-security-headers', async () => {
  const home = results.find(item => item.requestedUrl === origin + '/');
  if (!home?.headers?.['strict-transport-security'] || !home?.headers?.['x-content-type-options'] || !home?.headers?.['x-frame-options'] || !home?.headers?.['referrer-policy']) {
    throw new Error('Inicio no entrega todos los headers de seguridad obligatorios.');
  }
});

await check('home-canonical', async () => {
  const response = await fetchWithRetry(origin + '/');
  const body = await response.text();
  if (!body.includes('<link rel="canonical" href="' + origin + '/">')) throw new Error('Canonical de inicio ausente o incorrecto.');
  if (body.includes('tintinaccs.github.io/tintin-web')) throw new Error('Producción todavía expone una URL antigua de GitHub Pages.');
});

await check('robots', async () => {
  const robots = await inspect('/robots.txt', 'text/plain');
  if (!robots.body.includes('Sitemap: ' + origin + '/sitemap.xml')) throw new Error('robots.txt no apunta al sitemap vigente.');
  for (const route of ['/admin', '/admin-images', '/checkout', '/login', '/perfil']) {
    if (!robots.body.includes('Disallow: ' + route + '\n')) throw new Error('robots.txt no bloquea la ruta limpia ' + route + '.');
  }
});

await check('sitemap-index', async () => {
  const sitemap = await inspect('/sitemap.xml', 'xml');
  const urls = xmlLocations(sitemap.body);
  const expected = [origin + '/sitemap-pages.xml', origin + '/sitemap-products.xml', origin + '/sitemap-collections.xml'];
  if (JSON.stringify(urls) !== JSON.stringify(expected)) throw new Error('El índice de sitemaps no contiene páginas, productos y colecciones esperados.');
});

await check('sitemap-pages', async () => {
  const sitemap = await inspect('/sitemap-pages.xml', 'xml');
  const urls = xmlLocations(sitemap.body);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/')) || urls.some(url => /\.html(?:$|[?#])/.test(url))) {
    throw new Error('Sitemap de páginas vacío, con otro origen o con URLs .html.');
  }
});

await check('sitemap-products', async () => {
  const sitemap = await inspect('/sitemap-products.xml', 'xml');
  const urls = xmlLocations(sitemap.body);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/product?id='))) {
    throw new Error('Sitemap dinámico de productos vacío o con URLs inválidas.');
  }
});

await check('sitemap-collections', async () => {
  const sitemap = await inspect('/sitemap-collections.xml', 'xml');
  const urls = xmlLocations(sitemap.body);
  if (urls.some(url => !url.startsWith(origin + '/catalogo?cat='))) {
    throw new Error('Sitemap dinámico de colecciones contiene URLs inválidas.');
  }
});

await check('manifest', async () => {
  await inspect('/manifest.json', 'json');
});

// Pages Functions: checks no destructivos. /api/health valida runtime,
// configuración crítica y una lectura mínima de Firestore. public-catalog
// valida además el endpoint público que alimenta catálogo/producto.
await check('api-health', async () => {
  const health = await inspect('/api/health', 'application/json');
  const payload = JSON.parse(health.body || '{}');
  if (payload?.ok !== true || payload?.checks?.runtime !== true || payload?.checks?.firebase !== true) {
    throw new Error('/api/health respondió sin estado saludable.');
  }
});

let sampleProductId = '';
await check('api-public-catalog', async () => {
  const catalog = await inspect('/api/public-catalog?resource=products', 'application/json');
  const payload = JSON.parse(catalog.body || '{}');
  if (payload?.ok !== true || payload?.resource !== 'products' || !Array.isArray(payload?.items)) {
    throw new Error('/api/public-catalog no devolvió el contrato esperado.');
  }
  sampleProductId = String(payload.items.find(item => item?.id)?.id || '');
  if (!sampleProductId) throw new Error('/api/public-catalog no devolvió ningún producto para el canary SEO.');
});

await check('product-server-metadata', async () => {
  if (!sampleProductId) throw new Error('No hay producto de muestra disponible para probar metadata.');
  const route = '/product?id=' + encodeURIComponent(sampleProductId);
  const product = await inspect(route, 'text/html');
  assertStrongCsp(product.headers['content-security-policy'], route);
  if (product.headers['x-tintin-product-meta'] !== 'server') throw new Error('Producto no fue enriquecido por Pages Function.');
  if (!product.body.includes('<meta property="og:type" content="product">')) throw new Error('Producto no entrega Open Graph específico desde servidor.');
  if (!product.body.includes('id="tt-product-jsonld-server"')) throw new Error('Producto no entrega JSON-LD específico desde servidor.');
  if (!product.body.includes('<link rel="canonical" href="' + origin + '/product?id=')) throw new Error('Producto no entrega canonical específico desde servidor.');
});

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase11-production-health.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  origin,
  ok: failures.length === 0,
  results,
  failures
}, null, 2));

results.forEach(item => console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.requestedUrl + ' → ' + (item.finalUrl || 'n/d') + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms'));
if (failures.length) {
  console.error('\nMonitoreo de producción fallido:');
  failures.forEach(item => console.error('- ' + item.name + ': ' + item.error));
  process.exit(1);
}
console.log('\nProducción disponible: páginas, metadatos, headers, sitemaps y Pages Functions verificados.');
