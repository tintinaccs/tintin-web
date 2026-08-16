import { execFileSync } from 'node:child_process';

const origin = String(process.env.TINTIN_CUTOVER_ORIGIN || 'https://tintinaccs.com').replace(/\/$/, '');
const timeoutMs = Number(process.env.TINTIN_CUTOVER_TIMEOUT_MS || 15000);
const failures = [];
const results = [];

if (new URL(origin).protocol !== 'https:') throw new Error('El cutover solo puede auditarse sobre HTTPS.');

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK — ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error?.message || error) });
    console.error(`ERROR — ${name}: ${error?.message || error}`);
  }
}

async function fetchChecked(path, expectedType = '') {
  const started = Date.now();
  const response = await fetch(origin + path, {
    redirect: 'follow',
    headers: { 'user-agent': 'TintinCutoverLiveAudit/1.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const body = await response.text();
  const type = response.headers.get('content-type') || '';
  results.push({ path, status: response.status, finalUrl: response.url, ms: Date.now() - started, type });
  if (!response.ok) throw new Error(`${path} respondió ${response.status}.`);
  if (expectedType && !type.includes(expectedType)) throw new Error(`${path} respondió ${type}, se esperaba ${expectedType}.`);
  return { response, body };
}

function strongCsp(response, route) {
  const csp = response.headers.get('content-security-policy') || '';
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) {
    if (!csp.includes(directive)) throw new Error(`${route}: CSP incompleta; falta ${directive}.`);
  }
}

const publicRoutes = [
  '/', '/catalogo', '/collections', '/about', '/contact', '/envios',
  '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'
];

for (const route of publicRoutes) {
  await check(`HTTPS/canonical ${route}`, async () => {
    const { response, body } = await fetchChecked(route, 'text/html');
    const expected = origin + route;
    if (response.url !== expected) throw new Error(`URL final inesperada: ${response.url}`);
    strongCsp(response, route);
    if (!body.includes(`<link rel="canonical" href="${expected}">`)) throw new Error(`canonical no apunta a ${expected}.`);
    if (body.includes('tintinaccesorios.pages.dev')) throw new Error('todavía expone el origen pages.dev en HTML público.');
  });
}

await check('robots del dominio definitivo', async () => {
  const { body } = await fetchChecked('/robots.txt', 'text/plain');
  if (!body.includes(`Sitemap: ${origin}/sitemap.xml`)) throw new Error('robots.txt no anuncia el sitemap definitivo.');
});

await check('sitemap index del dominio definitivo', async () => {
  const { body } = await fetchChecked('/sitemap.xml', 'xml');
  for (const route of ['/sitemap-pages.xml', '/sitemap-products.xml', '/sitemap-collections.xml']) {
    if (!body.includes(origin + route)) throw new Error(`falta ${route} en el sitemap index.`);
  }
});

let sampleProductId = '';
await check('/api/health', async () => {
  const { body } = await fetchChecked('/api/health', 'application/json');
  const data = JSON.parse(body || '{}');
  if (data?.ok !== true || data?.checks?.runtime !== true || data?.checks?.firebase !== true) {
    throw new Error('backend/Firestore no están saludables.');
  }
});

await check('/api/public-catalog', async () => {
  const { body } = await fetchChecked('/api/public-catalog?resource=products', 'application/json');
  const data = JSON.parse(body || '{}');
  if (data?.ok !== true || !Array.isArray(data?.items) || !data.items.length) throw new Error('catálogo público vacío o contrato inválido.');
  sampleProductId = String(data.items.find(item => item?.id)?.id || '');
  if (!sampleProductId) throw new Error('no se obtuvo un producto canary.');
});

await check('Producto server-side real', async () => {
  if (!sampleProductId) throw new Error('sin producto canary.');
  const path = `/product?id=${encodeURIComponent(sampleProductId)}`;
  const { response, body } = await fetchChecked(path, 'text/html');
  strongCsp(response, path);
  if (response.headers.get('x-tintin-product-meta') !== 'server') throw new Error('metadata no fue generada en servidor.');
  if (!body.includes(`href="${origin}/product?id=`)) throw new Error('canonical de producto no usa el dominio definitivo.');
  if (!body.includes('id="tt-product-jsonld-server"')) throw new Error('falta JSON-LD server-side.');
});

await check('Redirects históricos Shopify', async () => {
  execFileSync(process.execPath, ['scripts/auditar-shopify-redirects.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, TINTIN_MIGRATION_ORIGIN: origin }
  });
});

if (failures.length) {
  console.error(`\nCUTOVER NO APROBADO — ${failures.length} fallo(s).`);
  failures.forEach(item => console.error(`- ${item.name}: ${item.error}`));
  process.exit(1);
}

console.log('\nCUTOVER TÉCNICO NO DESTRUCTIVO APROBADO.');
console.log('Todavía faltan las verificaciones humanas/side-effect: login Google real, App Check en navegador, compra real completa, correo/notificaciones/stock y preservación DNS de correo.');
