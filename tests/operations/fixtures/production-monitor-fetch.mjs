import { createHash } from 'node:crypto';
// Transporte aislado para probar los monitores originales sin consultar producción.
const canonical = process.env.TINTIN_MONITOR_FIXTURE_CANONICAL;
const operational = process.env.TINTIN_MONITOR_FIXTURE_OPERATIONAL;
const publicPages = ['/', '/catalogo', '/collections', '/about', '/contact', '/envios', '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'];
const baseCsp = "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const inlineMode = process.env.TINTIN_MONITOR_FIXTURE_INLINE || '';
const executable = 'window.fixtureReady=true;';
const scriptHash = `'sha256-${createHash('sha256').update(executable).digest('base64')}'`;
const policies = {
  authorized: `; script-src 'self' ${scriptHash}`,
  'style-only': `; style-src 'self' ${scriptHash}`,
  'element-blocked': `; script-src 'self' ${scriptHash}; script-src-elem 'self'`,
  'element-authorized': `; script-src 'self'; script-src-elem 'self' ${scriptHash}`,
};
const csp = baseCsp + (policies[inlineMode] || '');
const locations = urls => '<urlset>' + urls.map(url => `<loc>${url.replaceAll('&', '&amp;')}</loc>`).join('') + '</urlset>';

globalThis.fetch = async value => {
  const url = new URL(value);
  if (url.origin !== operational) throw new Error('La sonda salió del host operacional configurado.');
  const route = url.pathname;
  const headers = {
    'content-type': 'text/html', 'content-security-policy': csp,
    'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin',
    'cache-control': 'no-cache, must-revalidate', 'x-robots-tag': 'noindex',
  };
  let status = 200;
  let body = `<title>Control de origen</title><link rel="canonical" href="${canonical}${route}"><meta property="og:type" content="product"><div id="tt-product-jsonld-server"></div><meta name="robots" content="noindex">`;
  if (route === '/product') {
    body = body.replace(`${canonical}/product`, `${canonical}/product?id=canary`);
    if (!url.searchParams.get('id')) {
      status = Number(process.env.TINTIN_MONITOR_FIXTURE_EMPTY_PRODUCT_STATUS || 404);
      if (process.env.TINTIN_MONITOR_FIXTURE_EMPTY_PRODUCT_INDEXED) { delete headers['x-robots-tag']; body=body.replace('<meta name="robots" content="noindex">',''); }
    } else {
      headers['x-tintin-product-meta'] = 'server';
      body += '<script type="application/ld+json">{"@type":"Product","name":"Fixture"}</script>';
    }
  } else if (route === '/robots.txt') {
    headers['content-type'] = 'text/plain';
    body = ['/admin', '/admin-images', '/checkout', '/login', '/perfil'].map(path => `Disallow: ${path}\n`).join('');
  } else if (route.startsWith('/sitemap')) {
    headers['content-type'] = 'application/xml';
    if (route === '/sitemap.xml') {
      body = '<sitemapindex>' + ['/sitemap-pages.xml', '/sitemap-products.xml', '/sitemap-collections.xml'].map(path => `<loc>${canonical}${path}</loc>`).join('') + '</sitemapindex>';
    } else if (route === '/sitemap-pages.xml') body = locations(publicPages.map(path => canonical + path));
    else if (route === '/sitemap-products.xml') body = locations([canonical + '/product?id=canary']);
    else {
      const custom = process.env.TINTIN_MONITOR_FIXTURE_COLLECTION_URL;
      body = locations(custom ? [custom.startsWith('https://') ? custom : canonical + custom] : [canonical + '/catalogo', canonical + '/catalogo?page=2', canonical + '/catalogo?cat=canary&page=2']);
    }
  } else if (route.startsWith('/api/') || route === '/manifest.json') {
    headers['content-type'] = 'application/json';
    let data = {};
    if (route === '/api/health') {
      data = { ok: true, checks: { runtime: true, firebase: true, adminRuntime: true, visualBuilder: true }, admin: Object.fromEntries(['products', 'collections', 'orders', 'users', 'reviews', 'likes', 'emailLogs', 'siteContent', 'visualBuilder'].map(name => [name, true])) };
    } else if (route === '/api/paypal-config') data = { enabled: false, environment: 'sandbox', currency: 'USD', clientId: '', rateSource: 'manual', rateSourceDate: '', unavailableReasons: ['disabled'] };
    else if (route === '/api/admin-runtime-health') { status = 401; data = { ok: false, code: 'authentication_required', requestId: 'admin-health-fixture' }; }
    else if (route === '/api/public-catalog') { const resource = url.searchParams.get('resource'); data = { ok: true, resource, items: resource === 'products' ? [{ id: 'canary' }] : [] }; }
    else if (route === '/api/visual-builder-public') data = { ok: true, pageId: url.searchParams.get('page'), config: {} };
    else if (route === '/api/visual-studio-global-public') data = { ok: true, config: {} };
    else if (route === '/manifest.json') data = { name: 'Tintin', short_name: 'Tintin', start_url: '/', scope: '/', icons: [{}, {}] };
    body = JSON.stringify(data);
  }
  if (route === '/catalogo') {
    if (inlineMode === 'jsonld') body += '<script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","name":"Fixture"}</script>';
    if (inlineMode === 'invalid-jsonld') body += '<script type="application/ld+json">window.fixtureReady=true;</script>';
    if (inlineMode === 'executable') body += `<script>${executable}</script>`;
    if (inlineMode === 'module') body += `<script type="module">${executable}</script>`;
    if (inlineMode === 'fake-type') body += `<script data-type="application/ld+json">${executable}</script>`;
    if (['authorized','style-only','element-blocked','element-authorized'].includes(inlineMode)) body += `<script type="module">${executable}</script>`;
  }
  const response = new Response(body, { status, headers });
  Object.defineProperty(response, 'url', { value: url.href });
  return response;
};
