import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const publicOrigin = new URL(origin).origin;
const timeoutMs = Number(process.env.TINTIN_PHASE12_TIMEOUT_MS || 20000);
const attempts = 3;
const results = [];
const indexablePages = ['/', '/catalogo', '/collections', '/about', '/contact', '/envios', '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(relative) {
  const url = origin + relative;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'TintinPhase12Smoke/2.0 (+https://tintinaccesorios.pages.dev/)' }, signal: AbortSignal.timeout(timeoutMs) });
      const body = await response.text();
      const result = { relative, requestedUrl: url, url: response.url, redirected: response.redirected, status: response.status, ok: response.ok, ms: Date.now() - started, type: response.headers.get('content-type') || '', bytes: body.length, headers: Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','cache-control'].map(name => [name, response.headers.get(name) || ''])) };
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
function assert(condition, message) { if (!condition) throw new Error(message); }
function assertStrongCsp(value, page) {
  const csp = String(value || '');
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) assert(csp.includes(directive), page + ': CSP incompleta; falta ' + directive + '.');
}
function assertManifestUrlIsLocal(value, fieldName) {
  const raw = String(value || '').trim(); assert(raw, 'El ' + fieldName + ' del manifest está vacío.');
  let resolved; try { resolved = new URL(raw, origin + '/'); } catch { throw new Error('El ' + fieldName + ' del manifest no es una URL válida.'); }
  assert(resolved.origin === publicOrigin, 'El ' + fieldName + ' del manifest apunta a otro origen.'); return resolved;
}

let failure = null;
try {
  for (const page of indexablePages) {
    const { response, body, result } = await request(page);
    assert(response.ok, page + ' respondió ' + response.status);
    assert(result.url === origin + page, page + ' no terminó en su URL canónica limpia.');
    assert((response.headers.get('content-type') || '').includes('text/html'), page + ' no devolvió HTML.');
    assert(/<title>[^<]{3,}<\/title>/i.test(body), page + ' no tiene título útil.');
    assert(body.includes('<link rel="canonical" href="' + origin + page + '">'), page + ' tiene canonical incorrecto.');
    assert(!body.includes('tintinaccs.github.io/tintin-web'), page + ' expone el origen antiguo.');
    assertStrongCsp(result.headers['content-security-policy'], page);
    for (const header of ['strict-transport-security','x-content-type-options','x-frame-options','referrer-policy']) assert(Boolean(result.headers[header]), page + ' no entrega ' + header + '.');
  }
  const notFound = await request('/404');
  assert(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(notFound.body), '404 no declara noindex.');
  const robots = await request('/robots.txt');
  assert(robots.response.ok && robots.result.type.includes('text/plain'), 'robots.txt no está disponible como texto.');
  assert(robots.body.includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt no apunta al sitemap de producción.');
  const sitemap = await request('/sitemap.xml');
  assert(sitemap.response.ok && /xml/.test(sitemap.result.type), 'sitemap.xml no está disponible como XML.');
  let sitemapUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  if (/<sitemapindex[\s>]/i.test(sitemap.body)) {
    const childSitemaps = sitemapUrls;
    sitemapUrls = [];
    for (const childUrl of childSitemaps) {
      assert(childUrl.startsWith(origin + '/'), 'El sitemap index referencia un origen ajeno: ' + childUrl);
      const child = await request(childUrl.slice(origin.length));
      assert(child.response.ok && /xml/.test(child.result.type), childUrl + ' no está disponible como XML.');
      sitemapUrls.push(...[...child.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
    }
  }
  for (const page of indexablePages) assert(sitemapUrls.includes(origin + page), 'El sitemap no incluye ' + page);
  assert(!sitemapUrls.some(url => /\.html(?:$|[?#])/.test(url)), 'El sitemap publica URLs .html que Cloudflare redirige.');
  assert(!sitemapUrls.some(url => /\/(admin|login|checkout|perfil|404)(?:\.html)?$/.test(url)), 'El sitemap expone una superficie privada.');
  const manifestResponse = await request('/manifest.json');
  assert(manifestResponse.response.ok && manifestResponse.result.type.includes('json'), 'manifest.json no está disponible como JSON.');
  const manifestData = JSON.parse(manifestResponse.body);
  assert(manifestData.name && manifestData.short_name, 'El manifest no identifica la aplicación.');
  assert(Array.isArray(manifestData.icons) && manifestData.icons.length >= 2, 'El manifest no contiene iconos suficientes.');
  assert(assertManifestUrlIsLocal(manifestData.start_url, 'start_url').pathname === '/', 'start_url debe ser la raíz limpia.');
  if (manifestData.scope) assertManifestUrlIsLocal(manifestData.scope, 'scope');
  const homeResult = results.find(item => item.relative === '/');
  assert(/no-cache|no-store/.test(homeResult?.headers?.['cache-control'] || ''), 'El HTML inicial no evita una caché obsoleta.');
} catch (error) { failure = error; }

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase12-production-smoke.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, routes: results, error: failure ? String(failure.message || failure) : '' }, null, 2));
for (const item of results) console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.relative + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms');
if (failure) { console.error('\nSmoke de producción fallido:', failure.message || failure); process.exit(1); }
console.log('\nProducción verificada con URLs limpias y CSP fuerte: ' + results.length + ' respuestas correctas.');
