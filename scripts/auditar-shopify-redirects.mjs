const origin = String(process.env.TINTIN_MIGRATION_ORIGIN || '').replace(/\/$/, '');
const productCanary = String(process.env.TINTIN_SHOPIFY_PRODUCT_CANARY || 'anillo-liso-dorado').trim();
const timeoutMs = Number(process.env.TINTIN_MIGRATION_TIMEOUT_MS || 15000);

if (!/^https:\/\//i.test(origin)) throw new Error('TINTIN_MIGRATION_ORIGIN debe ser una URL HTTPS.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Igual que en auditar-cloudflare-entrega-real.mjs: el check-run "Cloudflare
// Pages" puede quedar en success antes de que el alias del preview esté
// propagado en todo el edge, y esa propagación puede tardar de forma
// desigual por ruta (un 404 transitorio en /collections/all mientras otras
// rutas ya resuelven bien). Se tolera esa ventana con el mismo patrón de
// reintento antes de declarar una redirección rota.
async function fetchRedirect(path) {
  const retryableStatuses = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
  const attempts = 6;
  let lastResponse;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(origin + path, {
      redirect: 'manual',
      headers: { 'user-agent': 'TintinShopifyMigrationGate/1.0' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.status === 301 || !retryableStatuses.has(response.status)) return response;
    lastResponse = response;
    console.log(`${path}: aún no propagado (${attempt}/${attempts}) — HTTP ${response.status}`);
    if (attempt < attempts) await sleep(Math.min(8000, attempt * 2000));
  }
  return lastResponse;
}

async function assertRedirect(path, expectedPath, expectedSearch = '') {
  const response = await fetchRedirect(path);
  if (response.status !== 301) throw new Error(`${path}: se esperaba 301 y respondió ${response.status}.`);
  const location = response.headers.get('location') || '';
  const target = new URL(location, origin);
  if (target.pathname !== expectedPath || (expectedSearch && target.search !== expectedSearch)) {
    throw new Error(`${path}: redirección incorrecta → ${target.pathname}${target.search}.`);
  }
  console.log(`OK — ${path} → ${target.pathname}${target.search}`);
}

await assertRedirect('/collections/all', '/catalogo');
await assertRedirect('/collections/relojes', '/catalogo', '?cat=relojes');
await assertRedirect('/pages/contact', '/contact');
await assertRedirect('/policies/privacy-policy', '/privacidad');
await assertRedirect('/policies/terms-of-service', '/terminos');
await assertRedirect('/policies/refund-policy', '/cambios-devoluciones');

const productResponse = await fetchRedirect(`/products/${encodeURIComponent(productCanary)}`);
if (productResponse.status !== 301) {
  throw new Error(`/products/${productCanary}: se esperaba 301 a la ficha migrada y respondió ${productResponse.status}.`);
}
const productTarget = new URL(productResponse.headers.get('location') || '', origin);
if (productTarget.pathname !== '/product' || !productTarget.searchParams.get('id')) {
  throw new Error(`/products/${productCanary}: destino no canónico → ${productTarget.pathname}${productTarget.search}.`);
}
console.log(`OK — /products/${productCanary} → /product?id=${productTarget.searchParams.get('id')}`);
console.log('\nMigración Shopify: redirects canónicos verificados en Cloudflare.');
