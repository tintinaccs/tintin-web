'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const publicSite = JSON.parse(read('config/public-site.json'));
const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || publicSite.origin || '').replace(/\/$/, '');
const indexed = ["index.html","catalogo.html","collections.html","product.html","about.html","contact.html","envios.html","cambios-devoluciones.html","preguntas-frecuentes.html","terminos.html","privacidad.html"];
const noindex = ["404.html","admin.html","admin-images.html","checkout.html","login.html","perfil.html","nosotros.html"];
const routeFor = file => file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
const checks = [];
const check = (name, ok, problem) => checks.push({ name, ok: Boolean(ok), problem });
const count = (text, regex) => (text.match(regex) || []).length;
const xmlLocations = text => [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

check('Origen público central válido', /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin), 'config/public-site.json debe ser la fuente única del origen público HTTPS.');
check('Firebase Auth centralizado', typeof publicSite.firebaseAuthDomain === 'string' && publicSite.firebaseAuthDomain.length > 3, 'El dominio de Firebase Auth debe quedar declarado junto al origen público.');

for (const file of indexed) {
  const html = read(file);
  const expected = origin + routeFor(file);
  check(file + ': título único', count(html, /<title>/gi) === 1 && /<title>[^<]{8,}<\/title>/i.test(html), 'Cada página indexable necesita un título descriptivo.');
  check(file + ': descripción única', count(html, /<meta\b[^>]*name=["']description["']/gi) === 1, 'Debe existir una sola descripción.');
  check(file + ': canonical único', count(html, /<link\b[^>]*rel=["']canonical["']/gi) === 1 && html.includes('href="' + expected), 'El canonical debe usar la URL limpia que Cloudflare sirve finalmente.');
  check(file + ': Open Graph completo', /property="og:title"/.test(html) && /property="og:description"/.test(html) && /property="og:image"/.test(html) && html.includes('property="og:url" content="' + expected), 'Faltan etiquetas sociales absolutas o usan una URL redirigida.');
  check(file + ': Twitter completo', /name="twitter:card" content="summary_large_image"/.test(html) && /name="twitter:title"/.test(html) && /name="twitter:description"/.test(html) && /name="twitter:image"/.test(html), 'Faltan etiquetas para compartir.');
  check(file + ': PWA e iconos', /rel="manifest" href="manifest.json"/.test(html) && /apple-touch-icon/.test(html) && /favicon-32x32/.test(html), 'La publicación debe conservar manifest e iconos.');
  check(file + ': indexable', /name="robots" content="index, follow, max-image-preview:large"/.test(html), 'La página pública debe declarar indexación coherente.');
}
for (const file of noindex) {
  const html = read(file);
  check(file + ': noindex', /<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*\bnoindex\b)[^>]*>/i.test(html), 'Las superficies privadas, auxiliares o duplicadas no deben indexarse.');
}

const activeFiles = [
  ...fs.readdirSync(root).filter(file => file !== 'diagnostic-manifest.json' && /\.(?:html|js|json|xml|txt)$/.test(file)),
  ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => 'js/' + file),
  ...fs.readdirSync(path.join(root, 'functions/api')).filter(file => file.endsWith('.js')).map(file => 'functions/api/' + file)
];
const oldRefs = activeFiles.filter(file => read(file).includes('tintinaccs.github.io/tintin-web'));
check('No quedan URLs activas de GitHub Pages', oldRefs.length === 0, 'Referencias antiguas: ' + oldRefs.join(', '));

const script = read('tienda.js');
check('Producto genera canonical absoluto y estable', script.includes("new URL('/product', '" + origin + "')") && script.includes("canonicalProductUrl.searchParams.set('id', String(product.id))"), 'El producto no debe canonicalizar una URL .html que Cloudflare redirige.');
check('Producto publica JSON-LD vigente', /'@type': 'Product'/.test(script) && /priceCurrency: 'PYG'/.test(script) && /schema.org\/InStock/.test(script) && /schema.org\/OutOfStock/.test(script) && /canonicalProductUrl.href/.test(script), 'Los datos estructurados deben reflejar precio, moneda, URL y stock.');

const productFunction = read('functions/product.js');
check('Producto publica metadata social desde Cloudflare', productFunction.includes('env.ASSETS.fetch(request)') && productFunction.includes('firestoreAdminGet') && productFunction.includes('x-tintin-product-meta') && productFunction.includes("'@type': 'Product'"), 'La ficha debe entregar título, OG/Twitter y JSON-LD específicos antes de ejecutar JavaScript del navegador.');

const sitemapIndexLocations = xmlLocations(read('sitemap.xml'));
const expectedSitemapIndex = [
  origin + '/sitemap-pages.xml',
  origin + '/sitemap-products.xml',
  origin + '/sitemap-collections.xml'
];
check('Sitemap principal es un índice completo', JSON.stringify(sitemapIndexLocations) === JSON.stringify(expectedSitemapIndex), 'El índice debe enlazar páginas, productos y colecciones.');

const pageLocations = xmlLocations(read('sitemap-pages.xml'));
const expectedPageLocations = indexed.filter(file => file !== 'product.html').map(file => origin + routeFor(file));
check('Sitemap de páginas contiene solo URLs finales indexables', JSON.stringify(pageLocations) === JSON.stringify(expectedPageLocations), 'El sitemap estático debe coincidir exactamente con las URLs públicas limpias.');
check('Sitemaps estáticos no publican URLs .html', ![...sitemapIndexLocations, ...pageLocations].some(url => /\.html(?:$|[?#])/.test(url)), 'Cloudflare redirige .html; los sitemaps no deben publicar destinos intermedios.');
check('Existen generadores dinámicos de catálogo', fs.existsSync(path.join(root, 'functions/sitemap-products.xml.js')) && fs.existsSync(path.join(root, 'functions/sitemap-collections.xml.js')), 'Productos y colecciones deben generarse desde Firestore.');

const routes = JSON.parse(read('_routes.json'));
check('Pages Functions sirve SEO y sitemaps dinámicos', ['/product', '/sitemap-products.xml', '/sitemap-collections.xml'].every(route => routes.include?.includes(route)), '_routes.json debe enviar Producto y sitemaps dinámicos al runtime de Cloudflare.');
check('robots enlaza el sitemap vigente', read('robots.txt').includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt debe enlazar el sitemap de producción.');
check('robots contempla rutas privadas limpias', ['/admin','/admin-images','/checkout','/login','/perfil'].every(route => read('robots.txt').includes('Disallow: ' + route + '\n')), 'robots.txt debe reflejar la arquitectura limpia real.');

const manifestData = JSON.parse(read('manifest.json'));
check('Manifest tiene identidad, scope e iconos válidos', manifestData.id === '/' && manifestData.start_url === '/' && manifestData.scope === '/' && manifestData.icons?.some(icon => icon.sizes === '192x192') && manifestData.icons?.some(icon => icon.sizes === '512x512'), 'La PWA debe instalarse desde la URL raíz final.');
check('Inicio publica Store JSON-LD', /id="tt-store-jsonld"/.test(read('index.html')) && /"@type":"Store"/.test(read('index.html')) && read('index.html').includes('"url":"' + origin + '/"'), 'La organización debe usar la URL raíz canónica.');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  for (const match of html.matchAll(/(?:^|\s)(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(raw) || raw.includes('${')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\//, '');
    if (!clean || !/\.[A-Za-z0-9]+$/.test(clean)) continue;
    const resolved = path.normalize(path.join(path.dirname(file), clean));
    check(file + ': recurso local ' + raw, fs.existsSync(path.join(root, resolved)), 'Enlace o recurso local roto.');
  }
}

const pkg = JSON.parse(read('package.json'));
check('Fase 11 forma parte del cierre', pkg.scripts['audit:phase11'] === 'node scripts/auditar-fase-11-seo.js' && pkg.scripts['test:phase11-seo'] === 'playwright test tests/seo/phase11-seo.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase11'), 'Las verificaciones SEO deben quedar permanentes.');
check('Existe monitor de producción', fs.existsSync(path.join(root, 'scripts/auditar-produccion-salud.mjs')) && fs.existsSync(path.join(root, '.github/workflows/seo-produccion-fase-11.yml')), 'La disponibilidad pública debe revisarse de forma recurrente.');
check('Origen se sincroniza antes de CSP', read('scripts/generar-csp-cloudflare.js').includes('scripts/sincronizar-origen-publico.js') && read('scripts/generar-csp-cloudflare.js').includes('config/public-site.json'), 'El build debe aplicar una sola fuente de dominio antes de generar hashes y CSP.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\nAuditoría Fase 11 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\nAuditoría Fase 11: SEO y publicación correctos (' + checks.length + ' comprobaciones).');
