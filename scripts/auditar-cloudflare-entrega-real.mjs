import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
const sha = String(process.env.GITHUB_SHA || '').trim();
const timeoutMs = Number(process.env.TINTIN_CLOUDFLARE_GATE_TIMEOUT_MS || 15000);
const pollAttempts = Number(process.env.TINTIN_CLOUDFLARE_GATE_ATTEMPTS || 30);

if (!repository || !sha) {
  throw new Error('Faltan GITHUB_REPOSITORY o GITHUB_SHA para auditar Cloudflare.');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'TintinCloudflareDeliveryGate/2.0'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} al buscar el deployment de Cloudflare.`);
  return response.json();
}

function previewUrlFromCheck(check) {
  const text = [check?.output?.summary, check?.output?.text, check?.details_url].filter(Boolean).join('\n');
  const urls = [...text.matchAll(/https:\/\/[a-z0-9-]+\.tintinaccesorios\.pages\.dev/gi)].map(match => match[0]);
  return urls[0] || '';
}

async function waitForCloudflarePreview() {
  const endpoint = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`;
  let lastState = 'sin check';
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const data = await githubJson(endpoint);
    const checks = Array.isArray(data?.check_runs) ? data.check_runs : [];
    const cloudflare = checks
      .filter(item => item?.name === 'Cloudflare Pages' || item?.app?.slug === 'cloudflare-workers-and-pages')
      .sort((a, b) => new Date(b?.started_at || 0) - new Date(a?.started_at || 0));

    const success = cloudflare.find(item => item.status === 'completed' && item.conclusion === 'success' && previewUrlFromCheck(item));
    if (success) return previewUrlFromCheck(success).replace(/\/$/, '');

    const failed = cloudflare.find(item => item.status === 'completed' && item.conclusion && item.conclusion !== 'success');
    if (failed) throw new Error(`Cloudflare Pages terminó en ${failed.conclusion}; no se puede aprobar la entrega real.`);

    if (cloudflare[0]) lastState = `${cloudflare[0].status}/${cloudflare[0].conclusion || 'pendiente'}`;
    console.log(`Esperando preview de Cloudflare (${attempt}/${pollAttempts}) — ${lastState}`);
    await sleep(10000);
  }
  throw new Error('Cloudflare Pages no publicó un preview verificable dentro del límite del gate.');
}

function readRoutePolicies() {
  const headers = fs.readFileSync('_headers', 'utf8').replace(/\r\n?/g, '\n');
  const policies = new Map();
  const lines = headers.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const route = lines[index].trim();
    const next = lines[index + 1] || '';
    const match = next.match(/^\s+Content-Security-Policy:\s+(.+)$/);
    if (route.startsWith('/') && match) policies.set(route, match[1].trim());
  }
  return policies;
}

async function fetchPreview(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'TintinCloudflareDeliveryGate/2.0' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

function assertStrongCsp(csp, route) {
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'frame-ancestors',
    'upgrade-insecure-requests'
  ]) {
    if (!csp.includes(directive)) throw new Error(`${route}: Cloudflare entregó una CSP incompleta; falta ${directive}.`);
  }
}

function assertCleanInternalRoutes(html, route) {
  const legacy = /\b(?:href|action)=["'](?:\.\/|\/)?(?:index|catalogo|collections|product|about|contact|envios|cambios-devoluciones|preguntas-frecuentes|terminos|privacidad|checkout|login|perfil|admin|admin-images|nosotros)\.html(?:[?#][^"']*)?["']/i;
  const match = String(html || '').match(legacy);
  if (match) throw new Error(`${route}: Cloudflare todavía entrega un enlace interno heredado: ${match[0]}`);
}

// Repository audit también invoca este gate directamente. Normalizamos el
// workspace acá para que el contrato local sea exactamente el mismo que debe
// construir Pages antes de comparar la entrega real.
execFileSync(process.execPath, ['scripts/normalizar-rutas-publicas.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/generar-csp-cloudflare.js'], { stdio: 'inherit' });

const preview = await waitForCloudflarePreview();
const policies = readRoutePolicies();
const routes = [
  '/', '/catalogo', '/collections', '/product', '/about', '/contact', '/envios',
  '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad',
  '/checkout', '/login', '/perfil'
];

for (const route of routes) {
  const response = await fetchPreview(preview + route);
  const csp = response.headers.get('content-security-policy') || '';
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) {
    throw new Error(`${route}: preview inesperado HTTP ${response.status}.`);
  }
  const html = await response.text();
  assertStrongCsp(csp, route);
  assertCleanInternalRoutes(html, route);

  const expectedKey = route === '/' ? '/index.html' : route;
  const expectedPolicy = policies.get(expectedKey) || policies.get(route);
  if (!expectedPolicy) throw new Error(`${route}: no existe CSP generada en _headers para comparar.`);
  if (!csp.includes(expectedPolicy)) {
    throw new Error(`${route}: Cloudflare no entregó la CSP generada por este commit.`);
  }
  console.log(`OK — ${preview}${route} — CSP y rutas internas reales correctas.`);
}

console.log(`\nGate Cloudflare aprobado para ${preview}.`);
