// Transporte aislado para probar los monitores originales sin consultar producción.
const canonical = process.env.TINTIN_MONITOR_FIXTURE_CANONICAL;
const operational = process.env.TINTIN_MONITOR_FIXTURE_OPERATIONAL;
const publicPages = ['/', '/catalogo', '/collections', '/about', '/contact', '/envios', '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'];
const csp = "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const locations = urls => '<urlset>' + urls.map(url => `<loc>${url}</loc>`).join('') + '</urlset>';

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
    headers['x-tintin-product-meta'] = 'server';
  } else if (route === '/robots.txt') {
    headers['content-type'] = 'text/plain';
    body = ['/admin', '/admin-images', '/checkout', '/login', '/perfil'].map(path => `Disallow: ${path}\n`).join('');
  } else if (route.startsWith('/sitemap')) {
    headers['content-type'] = 'application/xml';
    if (route === '/sitemap.xml') {
      body = '<sitemapindex>' + ['/sitemap-pages.xml', '/sitemap-products.xml', '/sitemap-collections.xml'].map(path => `<loc>${canonical}${path}</loc>`).join('') + '</sitemapindex>';
    } else if (route === '/sitemap-pages.xml') body = locations(publicPages.map(path => canonical + path));
    else if (route === '/sitemap-products.xml') body = locations([canonical + '/product?id=canary']);
    else body = locations([canonical + '/catalogo?cat=canary']);
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
  const response = new Response(body, { status, headers });
  Object.defineProperty(response, 'url', { value: url.href });
  return response;
};
