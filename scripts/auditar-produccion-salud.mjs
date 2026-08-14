import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const timeoutMs = Number(process.env.TINTIN_HEALTH_TIMEOUT_MS || 15000);
const attempts = 3;
const results = [];
const corePages = ['/', '/catalogo', '/collections', '/product'];

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: options.redirect || 'follow',
        headers: { 'user-agent': 'TintinProductionHealth/2.0 (+https://tintinaccesorios.pages.dev/)' },
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

async function inspect(relative, expectedType) {
  const requestedUrl = origin + relative;
  const started = Date.now();
  try {
    const response = await fetchWithRetry(requestedUrl);
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    const headers = Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','cache-control'].map(name => [name, response.headers.get(name) || '']));
    const ok = response.ok && (!expectedType || type.includes(expectedType));
    results.push({ requestedUrl, finalUrl: response.url, redirected: response.redirected, status: response.status, ms: Date.now() - started, type, ok, bytes: body.length, headers });
    if (!ok) throw new Error('Respuesta inesperada: ' + response.status + ' ' + type);
    return { body, response, headers };
  } catch (error) {
    results.push({ requestedUrl, status: 0, ms: Date.now() - started, type: '', ok: false, error: String(error?.message || error) });
    throw error;
  }
}

let failure = null;
try {
  for (const route of corePages) {
    const result = await inspect(route, 'text/html');
    if (result.response.url !== origin + route) throw new Error(route + ': la URL final no coincide con la canónica limpia.');
    assertStrongCsp(result.headers['content-security-policy'], route);
  }
  const home = results.find(item => item.requestedUrl === origin + '/');
  if (!home?.headers?.['strict-transport-security'] || !home?.headers?.['x-content-type-options'] || !home?.headers?.['x-frame-options'] || !home?.headers?.['referrer-policy']) {
    throw new Error('Inicio no entrega todos los headers de seguridad obligatorios.');
  }
  const homeBody = (await fetchWithRetry(origin + '/')).text();
  const resolvedHomeBody = await homeBody;
  if (!resolvedHomeBody.includes('<link rel="canonical" href="' + origin + '/">')) throw new Error('Canonical de inicio ausente o incorrecto.');
  if (resolvedHomeBody.includes('tintinaccs.github.io/tintin-web')) throw new Error('Producción todavía expone una URL antigua de GitHub Pages.');

  const robots = await inspect('/robots.txt', 'text/plain');
  if (!robots.body.includes('Sitemap: ' + origin + '/sitemap.xml')) throw new Error('robots.txt no apunta al sitemap vigente.');
  const sitemap = await inspect('/sitemap.xml', 'xml');
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/')) || urls.some(url => /\.html(?:$|[?#])/.test(url))) throw new Error('Sitemap vacío, con otro origen o con URLs .html redirigidas.');
  await inspect('/manifest.json', 'json');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase11-production-health.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, results, error: failure ? String(failure.message || failure) : '' }, null, 2));
results.forEach(item => console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.requestedUrl + ' → ' + (item.finalUrl || 'n/d') + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms'));
if (failure) { console.error('\nMonitoreo de producción fallido:', failure); process.exit(1); }
console.log('\nProducción disponible, URLs finales y headers fuertes verificados.');
