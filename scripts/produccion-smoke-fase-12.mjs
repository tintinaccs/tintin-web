import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const publicOrigin = new URL(origin).origin;
const timeoutMs = Number(process.env.TINTIN_PHASE12_TIMEOUT_MS || 20000);
const attempts = 3;
const results = [];
const indexablePages = [
  '/index.html',
  '/catalogo.html',
  '/collections.html',
  '/about.html',
  '/contact.html',
  '/envios.html',
  '/cambios-devoluciones.html',
  '/preguntas-frecuentes.html',
  '/terminos.html',
  '/privacidad.html'
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(relative) {
  const url = origin + relative;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinPhase12Smoke/1.0 (+https://tintinaccesorios.pages.dev/)' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      const body = await response.text();
      const result = {
        relative,
        url: response.url,
        status: response.status,
        ok: response.ok,
        ms: Date.now() - started,
        type: response.headers.get('content-type') || '',
        bytes: body.length,
        headers: Object.fromEntries([
          'content-security-policy',
          'strict-transport-security',
          'x-content-type-options',
          'x-frame-options',
          'referrer-policy',
          'cache-control'
        ].map(name => [name, response.headers.get(name) || '']))
      };
      if (response.status >= 500) throw new Error('HTTP ' + response.status);
      results.push(result);
      return { response, body, result };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1200);
    }
  }
  results.push({ relative, url, status: 0, ok: false, ms: timeoutMs * attempts, error: String(lastError?.message || lastError) });
  throw lastError;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertManifestUrlIsLocal(value, fieldName) {
  const raw = String(value || '').trim();
  assert(raw, `El ${fieldName} del manifest está vacío.`);
  let resolved;
  try {
    resolved = new URL(raw, origin + '/');
  } catch {
    throw new Error(`El ${fieldName} del manifest no es una URL válida.`);
  }
  assert(resolved.origin === publicOrigin, `El ${fieldName} del manifest apunta a otro origen.`);
  return resolved;
}

let failure = null;
try {
  for (const page of indexablePages) {
    const { response, body } = await request(page);
    assert(response.ok, page + ' respondió ' + response.status);
    assert((response.headers.get('content-type') || '').includes('text/html'), page + ' no devolvió HTML.');
    assert(/<title>[^<]{3,}<\/title>/i.test(body), page + ' no tiene título útil.');
    assert(body.includes(`<link rel="canonical" href="${origin}${page}">`), page + ' tiene canonical incorrecto.');
    assert(!body.includes('tintinaccs.github.io/tintin-web'), page + ' expone el origen antiguo.');
  }

  const notFound = await request('/404.html');
  assert(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(notFound.body), '404.html no declara noindex.');

  const robots = await request('/robots.txt');
  assert(robots.response.ok && robots.result.type.includes('text/plain'), 'robots.txt no está disponible como texto.');
  assert(robots.body.includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt no apunta al sitemap de producción.');
  for (const privateRoute of ['/admin.html', '/admin-images.html', '/login.html', '/checkout.html', '/perfil.html']) {
    assert(robots.body.includes('Disallow: ' + privateRoute), 'robots.txt no excluye ' + privateRoute);
  }

  const sitemap = await request('/sitemap.xml');
  assert(sitemap.response.ok && /xml/.test(sitemap.result.type), 'sitemap.xml no está disponible como XML.');
  const sitemapUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  for (const page of indexablePages) assert(sitemapUrls.includes(origin + page), 'El sitemap no incluye ' + page);
  assert(sitemapUrls.every(url => url.startsWith(origin + '/')), 'El sitemap contiene otro origen.');
  assert(!sitemapUrls.some(url => /\/(admin|login|checkout|perfil|404)(?:\.html)?$/.test(url)), 'El sitemap expone una superficie privada.');

  const manifest = await request('/manifest.json');
  assert(manifest.response.ok && manifest.result.type.includes('json'), 'manifest.json no está disponible como JSON.');
  const manifestData = JSON.parse(manifest.body);
  assert(manifestData.name && manifestData.short_name, 'El manifest no identifica la aplicación.');
  assert(Array.isArray(manifestData.icons) && manifestData.icons.length >= 2, 'El manifest no contiene iconos suficientes.');
  assertManifestUrlIsLocal(manifestData.start_url, 'start_url');
  if (manifestData.scope) assertManifestUrlIsLocal(manifestData.scope, 'scope');

  const homeResult = results.find(item => item.relative === '/index.html');
  for (const header of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) {
    assert(Boolean(homeResult?.headers?.[header]), 'Producción no entrega el encabezado ' + header + '.');
  }
  assert(/no-cache|no-store/.test(homeResult?.headers?.['cache-control'] || ''), 'El HTML inicial no evita una caché obsoleta.');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  ok: !failure,
  routes: results,
  error: failure ? String(failure.message || failure) : ''
};
fs.writeFileSync(path.resolve('artifacts/phase12-production-smoke.json'), JSON.stringify(report, null, 2));
for (const item of results) console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.relative} — ${item.status || item.error} — ${item.ms} ms`);
if (failure) {
  console.error('\nSmoke de producción fallido:', failure.message || failure);
  process.exit(1);
}
console.log(`\nProducción verificada: ${results.length} respuestas correctas en ${origin}.`);
