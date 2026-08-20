import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
// GITHUB_SHA es una variable reservada de GitHub Actions: cualquier intento de
// sobrescribirla vía `env:` a nivel de step es ignorado por el runner, que
// siempre inyecta el SHA del merge ref efímero de la PR en su lugar. Por eso
// el commit real a auditar viaja en TINTIN_TARGET_SHA (con GITHUB_SHA como
// fallback para invocaciones fuera de pull_request, donde ambos coinciden).
const sha = String(process.env.TINTIN_TARGET_SHA || process.env.GITHUB_SHA || '').trim();
const githubToken = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
const timeoutMs = Number(process.env.TINTIN_CLOUDFLARE_GATE_TIMEOUT_MS || 15000);
const pollAttempts = Number(process.env.TINTIN_CLOUDFLARE_GATE_ATTEMPTS || 45);
const pollIntervalMs = Number(process.env.TINTIN_CLOUDFLARE_GATE_POLL_MS || 20000);

if (!repository || !sha) throw new Error('Faltan GITHUB_REPOSITORY o TINTIN_TARGET_SHA/GITHUB_SHA para auditar Cloudflare.');
if (!Number.isFinite(pollAttempts) || pollAttempts < 1 || pollAttempts > 180) throw new Error('TINTIN_CLOUDFLARE_GATE_ATTEMPTS debe estar entre 1 y 180.');
if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 1000 || pollIntervalMs > 60000) throw new Error('TINTIN_CLOUDFLARE_GATE_POLL_MS debe estar entre 1000 y 60000 ms.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function githubJson(url) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'TintinCloudflareDeliveryGate/3.1'
  };
  if (githubToken) headers.authorization = `Bearer ${githubToken}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const details = [remaining != null ? `remaining=${remaining}` : '', reset ? `reset=${reset}` : ''].filter(Boolean).join(', ');
    throw new Error(`GitHub API ${response.status} al buscar el deployment de Cloudflare${details ? ` (${details})` : ''}.`);
  }
  return response.json();
}

function previewUrlFromCheck(check) {
  const text = [check?.output?.summary, check?.output?.text, check?.details_url].filter(Boolean).join('\n');
  return [...text.matchAll(/https:\/\/[a-z0-9-]+\.tintinaccesorios\.pages\.dev/gi)].map(match => match[0])[0] || '';
}

// Vía directa contra la API de Cloudflare: el check-run "Cloudflare Pages" en
// GitHub depende de un webhook de la app de Cloudflare que, en la práctica,
// a veces no se entrega aunque el deploy termine bien (visible en el propio
// dashboard de Cloudflare). La API de Cloudflare es la fuente autoritativa y
// no depende de ese webhook, así que se usa como vía primaria cuando hay
// credenciales; si no las hay, el gate cae al polling de check-runs de abajo
// sin cambiar de comportamiento.
const cloudflareApiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const cloudflareAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const cloudflarePagesProject = String(process.env.CLOUDFLARE_PAGES_PROJECT || 'tintinaccesorios').trim();
const cloudflareApiEnabled = Boolean(cloudflareApiToken && cloudflareAccountId);

async function findCloudflareDeploymentBySha() {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects/${cloudflarePagesProject}/deployments?per_page=25`;
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${cloudflareApiToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Cloudflare API ${response.status} al listar deployments de ${cloudflarePagesProject}.`);
  const data = await response.json();
  const deployments = Array.isArray(data?.result) ? data.result : [];
  return deployments.find(item => item?.deployment_trigger?.metadata?.commit_hash === sha) || null;
}

async function waitForCloudflarePreview() {
  const endpoint = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`;
  let lastState = 'sin check';
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    if (cloudflareApiEnabled) {
      const deployment = await findCloudflareDeploymentBySha();
      const stage = deployment?.latest_stage;
      if (deployment && stage?.name === 'deploy' && stage?.status === 'success' && deployment.url) {
        return String(deployment.url).replace(/\/$/, '');
      }
      if (deployment && stage?.status === 'failure') {
        throw new Error(`Cloudflare Pages (API) terminó en failure para el SHA ${sha.slice(0, 12)}; no se puede aprobar la entrega real.`);
      }
      if (deployment) lastState = `cloudflare-api:${stage?.name || 'deploy'}/${stage?.status || 'pendiente'}`;
    }
    const data = await githubJson(endpoint);
    const cloudflare = (Array.isArray(data?.check_runs) ? data.check_runs : [])
      .filter(item => item?.name === 'Cloudflare Pages' || item?.app?.slug === 'cloudflare-workers-and-pages')
      .sort((a, b) => new Date(b?.started_at || 0) - new Date(a?.started_at || 0));
    const success = cloudflare.find(item => item.status === 'completed' && item.conclusion === 'success' && previewUrlFromCheck(item));
    if (success) return previewUrlFromCheck(success).replace(/\/$/, '');
    const failed = cloudflare.find(item => item.status === 'completed' && item.conclusion && item.conclusion !== 'success');
    if (failed) throw new Error(`Cloudflare Pages terminó en ${failed.conclusion}; no se puede aprobar la entrega real.`);
    if (!cloudflareApiEnabled && cloudflare[0]) lastState = `${cloudflare[0].status}/${cloudflare[0].conclusion || 'pendiente'}`;
    console.log(`Esperando preview de Cloudflare (${attempt}/${pollAttempts}) — ${lastState} — ${Math.round((Date.now() - startedAt) / 1000)}s`);
    if (attempt < pollAttempts) await sleep(pollIntervalMs);
  }
  throw new Error(`Cloudflare Pages no publicó un preview verificable del SHA ${sha.slice(0, 12)}. Último estado: ${lastState}.`);
}

async function fetchPreview(url, { acceptNotFound = false } = {}) {
  const retryableStatuses = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
  let lastError;
  let lastResponse;
  const attempts = 8;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinCloudflareDeliveryGate/3.2' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.ok || (acceptNotFound && response.status === 404)) return response;
      lastResponse = response;
      if (!retryableStatuses.has(response.status)) return response;
      console.log(`Preview aún no estable (${attempt}/${attempts}) — ${url} — HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      console.log(`Preview aún no accesible (${attempt}/${attempts}) — ${url} — ${error?.message || error}`);
    }
    if (attempt < attempts) await sleep(Math.min(10000, attempt * 2000));
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error(`No se pudo consultar ${url}.`);
}

async function fetchPreviewWithExpectedCsp(url, expectedPolicy) {
  // Cloudflare puede entregar el HTML nuevo antes de propagar el bundle de
  // Functions que contiene la CSP del mismo commit. En previews recientes
  // observamos esa ventana durante algo más de dos minutos.
  const attempts = 24;
  let lastResponse;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchPreview(url);
    lastResponse = response;
    const csp = response.headers.get('content-security-policy') || '';
    if (response.ok && csp === expectedPolicy) return response;
    console.log(`Esperando propagación CSP (${attempt}/${attempts}) — ${url} — HTTP ${response.status}`);
    if (attempt < attempts) await sleep(Math.min(10000, attempt * 2000));
  }
  return lastResponse;
}

function assertStrongCsp(csp, route) {
  for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) {
    if (!csp.includes(directive)) throw new Error(`${route}: Cloudflare entregó una CSP incompleta; falta ${directive}.`);
  }
}

function assertCleanInternalRoutes(html, route) {
  const legacy = /\b(?:href|action)=["'](?:\.\/|\/)?(?:index|catalogo|collections|product|about|contact|envios|cambios-devoluciones|preguntas-frecuentes|terminos|privacidad|checkout|login|perfil|admin|admin-images|nosotros)\.html(?:[?#][^"']*)?["']/i;
  const match = String(html || '').match(legacy);
  if (match) throw new Error(`${route}: Cloudflare todavía entrega un enlace interno heredado: ${match[0]}`);
}

function staticFallbackPolicy(headersText) {
  const lines = headersText.split('\n');
  const wildcard = lines.findIndex(line => line.trim() === '/*');
  if (wildcard < 0) throw new Error('_headers no contiene el bloque wildcard /*.');
  for (let index = wildcard + 1; index < lines.length && (/^\s/.test(lines[index]) || !lines[index].trim()); index += 1) {
    const match = lines[index].match(/^\s+Content-Security-Policy:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  throw new Error('_headers no contiene la CSP fallback corta bajo /*.');
}

execFileSync(process.execPath, ['scripts/normalizar-rutas-publicas.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/generar-csp-cloudflare.js'], { stdio: 'inherit' });

const staticHeaders = fs.readFileSync('_headers', 'utf8').replace(/\r\n?/g, '\n');
const cspLines = staticHeaders.split('\n').filter(line => line.includes('Content-Security-Policy:'));
if (cspLines.length !== 1) throw new Error(`_headers debe contener exactamente una CSP fallback corta; encontradas: ${cspLines.length}.`);
const fallbackPolicy = staticFallbackPolicy(staticHeaders);
if (cspLines[0].length > 2000) throw new Error(`La CSP fallback de _headers supera 2000 caracteres (${cspLines[0].length}).`);
if (fallbackPolicy.includes('https://api.cloudinary.com')) throw new Error('La CSP fallback estática no debe autorizar upload Cloudinary.');
if (fallbackPolicy.includes("script-src-attr 'unsafe-inline'")) throw new Error('La CSP fallback estática no debe reabrir handlers inline.');
if (!fallbackPolicy.includes("script-src-attr 'none'")) throw new Error("La CSP fallback estática debe bloquear handlers con script-src-attr 'none'.");
assertStrongCsp(fallbackPolicy, '/* fallback');
const overlong = staticHeaders.split('\n').filter(line => line.length > 2000);
if (overlong.length) throw new Error(`_headers tiene ${overlong.length} línea(s) por encima de 2000 caracteres.`);

const runtime = JSON.parse(fs.readFileSync('config/csp-runtime.json', 'utf8'));
if (runtime.generatedBy !== 'scripts/generar-csp-cloudflare.js') throw new Error('config/csp-runtime.json no fue generado por build:csp.');
const preview = await waitForCloudflarePreview();

// El check-run "Cloudflare Pages" puede marcarse success antes de que el
// alias del preview esté propagado en todo el edge (404 "Deployment Not
// Found" transitorio de Cloudflare). Se exige disponibilidad real antes de
// correr las aserciones estrictas de contrato.
async function waitForPreviewReady() {
  const readinessAttempts = 8;
  let lastStatus = 'sin respuesta';
  for (let attempt = 1; attempt <= readinessAttempts; attempt += 1) {
    try {
      const response = await fetch(preview + '/', {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinCloudflareDeliveryGate/3.2' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
        console.log(`Preview Cloudflare disponible (${attempt}/${readinessAttempts}) — ${preview}/ — ${lastStatus}`);
        return;
      }
    } catch (error) {
      lastStatus = error?.message || String(error);
    }
    console.log(`Esperando propagación HTTP del preview (${attempt}/${readinessAttempts}) — ${lastStatus}`);
    if (attempt < readinessAttempts) await sleep(Math.min(10000, attempt * 2000));
  }
  throw new Error(`Cloudflare marcó success pero el preview ${preview}/ no quedó disponible. Último estado: ${lastStatus}.`);
}
await waitForPreviewReady();

const publicRoutes = [
  '/', '/catalogo', '/collections', '/product', '/about', '/contact', '/envios',
  '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad',
  '/checkout', '/login', '/perfil'
];

for (const route of publicRoutes) {
  const expectedPolicy = runtime.routes?.[route] || runtime.public;
  const response = await fetchPreviewWithExpectedCsp(preview + route, expectedPolicy);
  const csp = response.headers.get('content-security-policy') || '';
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) throw new Error(`${route}: preview inesperado HTTP ${response.status}.`);
  if (response.headers.get('x-tintin-csp') !== 'edge-runtime') throw new Error(`${route}: la respuesta HTML no pasó por el middleware CSP.`);
  const html = await response.text();
  assertStrongCsp(csp, route);
  assertCleanInternalRoutes(html, route);
  if (csp.includes('https://api.cloudinary.com')) throw new Error(`${route}: la CSP pública no debe autorizar upload Cloudinary.`);
  if (csp.includes("script-src-attr 'unsafe-inline'")) throw new Error(`${route}: la CSP pública no debe reabrir handlers inline.`);
  if (!expectedPolicy || csp !== expectedPolicy) throw new Error(`${route}: Cloudflare no entregó la CSP runtime exacta generada por este commit.`);
  console.log(`OK — ${preview}${route} — CSP runtime exacta y rutas limpias.`);
}

for (const route of ['/admin', '/admin-images']) {
  const expectedPolicy = runtime.routes?.[route];
  const response = await fetchPreviewWithExpectedCsp(preview + route, expectedPolicy);
  const csp = response.headers.get('content-security-policy') || '';
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) throw new Error(`${route}: preview Admin inesperado HTTP ${response.status}.`);
  if (response.headers.get('x-tintin-csp') !== 'edge-runtime') throw new Error(`${route}: Admin no pasó por middleware CSP.`);
  const html = await response.text();
  assertStrongCsp(csp, route);
  assertCleanInternalRoutes(html, route);
  if (!csp.includes('https://api.cloudinary.com')) throw new Error(`${route}: Admin necesita upload Cloudinary.`);
  if (csp.includes("script-src-attr 'unsafe-inline'")) throw new Error(`${route}: Admin no debe reabrir handlers inline.`);
  if (csp !== expectedPolicy) throw new Error(`${route}: Cloudflare no entregó la CSP Admin exacta.`);
  console.log(`OK — ${preview}${route} — CSP Admin runtime exacta con upload aislado.`);
}

const notFoundRoute = `/__tintin-csp-404-probe-${sha.slice(0, 8)}__`;
const notFound = await fetchPreview(preview + notFoundRoute, { acceptNotFound: true });
const notFoundCsp = notFound.headers.get('content-security-policy') || '';
if (notFound.status !== 404) throw new Error(`${notFoundRoute}: se esperaba HTTP 404 y llegó ${notFound.status}.`);
if (!(notFound.headers.get('content-type') || '').includes('text/html')) throw new Error(`${notFoundRoute}: el 404 no se entregó como HTML.`);
if (notFound.headers.get('x-tintin-csp') === 'edge-runtime') throw new Error(`${notFoundRoute}: una ruta inexistente no debería depender del middleware de páginas conocidas.`);
if (notFoundCsp !== fallbackPolicy) throw new Error(`${notFoundRoute}: Cloudflare no entregó la CSP fallback estática exacta.`);
assertStrongCsp(notFoundCsp, notFoundRoute);
console.log(`OK — ${preview}${notFoundRoute} — 404 protegido por CSP fallback corta.`);

execFileSync(process.execPath, ['scripts/auditar-shopify-redirects.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, TINTIN_MIGRATION_ORIGIN: preview }
});

console.log(`\nGate Cloudflare aprobado para ${preview}: CSP runtime, fallback 404, rutas limpias y migración Shopify.`);
