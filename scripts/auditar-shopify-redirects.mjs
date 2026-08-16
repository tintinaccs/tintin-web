const origin = String(process.env.TINTIN_MIGRATION_ORIGIN || '').replace(/\/$/, '');
const productCanary = String(process.env.TINTIN_SHOPIFY_PRODUCT_CANARY || 'anillo-liso-dorado').trim();
const timeoutMs = Number(process.env.TINTIN_MIGRATION_TIMEOUT_MS || 15000);

if (!/^https:\/\//i.test(origin)) throw new Error('TINTIN_MIGRATION_ORIGIN debe ser una URL HTTPS.');

async function assertRedirect(path, expectedPath, expectedSearch = '') {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    headers: { 'user-agent': 'TintinShopifyMigrationGate/1.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
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

const productResponse = await fetch(`${origin}/products/${encodeURIComponent(productCanary)}`, {
  redirect: 'manual',
  headers: { 'user-agent': 'TintinShopifyMigrationGate/1.0' },
  signal: AbortSignal.timeout(timeoutMs)
});
if (productResponse.status !== 301) {
  throw new Error(`/products/${productCanary}: se esperaba 301 a la ficha migrada y respondió ${productResponse.status}.`);
}
const productTarget = new URL(productResponse.headers.get('location') || '', origin);
if (productTarget.pathname !== '/product' || !productTarget.searchParams.get('id')) {
  throw new Error(`/products/${productCanary}: destino no canónico → ${productTarget.pathname}${productTarget.search}.`);
}
console.log(`OK — /products/${productCanary} → /product?id=${productTarget.searchParams.get('id')}`);
console.log('\nMigración Shopify: redirects canónicos verificados en Cloudflare.');
