const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
const sha = String(process.env.TINTIN_TARGET_SHA || process.env.GITHUB_SHA || '').trim();
const githubToken = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
const timeoutMs = 15000;
const pollAttempts = Math.max(1, Math.min(60, Number(process.env.TINTIN_PRODUCT_PREVIEW_ATTEMPTS || 45)));
const pollMs = Math.max(1000, Math.min(60000, Number(process.env.TINTIN_PRODUCT_PREVIEW_POLL_MS || 10000)));

if (!repository || !sha) throw new Error('Faltan GITHUB_REPOSITORY o TINTIN_TARGET_SHA/GITHUB_SHA.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function githubJson(url) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'TintinProductRouteGate/1.0'
  };
  if (githubToken) headers.authorization = `Bearer ${githubToken}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`GitHub API ${response.status} buscando preview de Cloudflare.`);
  return response.json();
}

function previewUrlFromCheck(check) {
  const text = [check?.output?.summary, check?.output?.text, check?.details_url].filter(Boolean).join('\n');
  return [...text.matchAll(/https:\/\/[a-z0-9-]+\.tintinaccesorios\.pages\.dev/gi)].map(match => match[0])[0] || '';
}

async function waitForPreview() {
  const endpoint = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`;
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const data = await githubJson(endpoint);
    const checks = (Array.isArray(data?.check_runs) ? data.check_runs : [])
      .filter(item => item?.name === 'Cloudflare Pages' || item?.app?.slug === 'cloudflare-workers-and-pages')
      .sort((a, b) => new Date(b?.started_at || 0) - new Date(a?.started_at || 0));
    const success = checks.find(item => item.status === 'completed' && item.conclusion === 'success' && previewUrlFromCheck(item));
    if (success) return previewUrlFromCheck(success).replace(/\/$/, '');
    const failed = checks.find(item => item.status === 'completed' && item.conclusion && item.conclusion !== 'success');
    if (failed) throw new Error(`Cloudflare Pages terminó en ${failed.conclusion}.`);
    console.log(`Esperando preview Cloudflare para ruta de producto (${attempt}/${pollAttempts})…`);
    if (attempt < pollAttempts) await sleep(pollMs);
  }
  throw new Error(`No apareció un preview verificable de Cloudflare para ${sha.slice(0, 12)}.`);
}

async function fetchStable(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      return await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'TintinProductRouteGate/1.0', ...(options.headers || {}) },
        method: options.method || 'GET',
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      lastError = error;
      console.log(`Ruta de producto aún no estable (${attempt}/8): ${error?.message || error}`);
      if (attempt < 8) await sleep(Math.min(10000, attempt * 1500));
    }
  }
  throw lastError || new Error('No se pudo consultar la ruta de producto.');
}

const preview = await waitForPreview();
const probeUrl = `${preview}/product?id=route-probe-inexistente`;

const head = await fetchStable(probeUrl, { method: 'HEAD' });
if (head.status >= 300 && head.status < 400) {
  throw new Error(`HEAD ${probeUrl} redirige (${head.status}) a ${head.headers.get('location') || '(sin location)'}.`);
}
if (!head.ok) throw new Error(`HEAD ${probeUrl} respondió HTTP ${head.status}.`);

const response = await fetchStable(probeUrl);
if (response.status >= 300 && response.status < 400) {
  throw new Error(`GET ${probeUrl} redirige (${response.status}) a ${response.headers.get('location') || '(sin location)'}.`);
}
if (!response.ok) throw new Error(`GET ${probeUrl} respondió HTTP ${response.status}.`);
if (!(response.headers.get('content-type') || '').includes('text/html')) {
  throw new Error(`GET ${probeUrl} no devolvió HTML (${response.headers.get('content-type') || 'sin content-type'}).`);
}
const html = await response.text();
if (!/id=["']product-detail["']/.test(html) || !/id=["']product-loading["']/.test(html)) {
  throw new Error('La ruta con id respondió, pero no entregó el documento real de la ficha de producto.');
}

console.log(`OK — ${probeUrl} abre la ficha de producto en el preview real de Cloudflare sin redirect.`);
