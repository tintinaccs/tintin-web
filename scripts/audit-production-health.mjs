import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const timeoutMs = Number(process.env.TINTIN_HEALTH_TIMEOUT_MS || 15000);
const attempts = 3;
const results = [];

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinProductionHealth/1.0 (+https://tintinaccesorios.pages.dev/)' },
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
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/'))) throw new Error('Sitemap vacío o con origen inconsistente.');
  await inspect('/manifest.json', 'json');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase11-production-health.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, results, error: failure ? String(failure.message || failure) : '' }, null, 2));
results.forEach(item => console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.url + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms'));
if (failure) { console.error('\nMonitoreo de producción fallido:', failure); process.exit(1); }
console.log('\nProducción disponible y metadatos públicos coherentes.');
