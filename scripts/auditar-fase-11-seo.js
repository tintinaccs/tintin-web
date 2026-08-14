'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const originConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/origenes-tintin.json'), 'utf8'));
const origin = String(originConfig.publicOrigin || '').replace(/\/$/, '');
const indexed = ["index.html","catalogo.html","collections.html","product.html","about.html","contact.html","envios.html","cambios-devoluciones.html","preguntas-frecuentes.html","terminos.html","privacidad.html"];
const noindex = ["404.html","admin.html","admin-images.html","checkout.html","login.html","perfil.html","nosotros.html"];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routeFor = file => file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
const checks = [];
const check = (name, ok, problem) => checks.push({ name, ok: Boolean(ok), problem });
const count = (text, regex) => (text.match(regex) || []).length;

check('Origen público central válido', /^https:\/\/[a-z0-9.-]+$/i.test(origin), 'config/origenes-tintin.json debe definir publicOrigin HTTPS.');

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
check('Producto genera canonical limpio en runtime', script.includes("new URL('/product', window.location.origin)") && script.includes("productUrl.searchParams.set('id', String(product.id))"), 'El canonical del navegador debe usar /product?id=.');
check('Producto genera JSON-LD con origen público estable', script.includes("new URL('/product', '" + origin + "')") && script.includes("canonicalProductUrl.searchParams.set('id', String(product.id))"), 'El JSON-LD debe fijar el origen público configurado.');
check('Producto publica JSON-LD vigente', /'@type': 'Product'/.test(script) && /priceCurrency: 'PYG'/.test(script) && /schema.org\/InStock/.test(script) && /schema.org\/OutOfStock/.test(script) && /canonicalProductUrl.href/.test(script), 'Los datos estructurados deben reflejar precio, moneda, URL y stock.');
check('Producto tiene metadatos SEO en edge', fs.existsSync(path.join(root, 'functions/product.js')) && read('functions/product.js').includes('x-tintin-product-meta') && read('functions/product.js').includes('tt-product-jsonld'), 'Los crawlers sin JavaScript deben recibir metadatos específicos.');

const sitemapText = read('sitemap.xml');
const locations = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const expectedLocations = indexed.filter(file => file !== 'product.html').map(file => origin + routeFor(file));
check('Sitemap contiene solo URLs finales indexables', JSON.stringify(locations) === JSON.stringify(expectedLocations), 'El sitemap debe coincidir exactamente con las URLs limpias públicas.');
check('Sitemap no publica URLs .html', !locations.some(url => /\.html(?:$|[?#])/.test(url)), 'Cloudflare redirige .html; el sitemap no debe publicar destinos intermedios.');
const robots = read('robots.txt');
check('robots enlaza sitemap estático', robots.includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt debe enlazar el sitemap estructural.');
check('robots enlaza sitemap de productos', robots.includes('Sitemap: ' + origin + '/sitemap-products.xml'), 'robots.txt debe enlazar el sitemap dinámico.');
check('Existe sitemap dinámico de productos', fs.existsSync(path.join(root, 'functions/sitemap-products.xml.js')) && read('functions/sitemap-products.xml.js').includes('/product?id='), 'Los productos reales deben ser descubribles por buscadores.');

const manifestData = JSON.parse(read('manifest.json'));
check('Manifest tiene identidad, scope e iconos válidos', manifestData.id === '/' && manifestData.start_url === '/' && manifestData.scope === '/' && manifestData.icons?.some(icon => icon.sizes === '192x192') && manifestData.icons?.some(icon => icon.sizes === '512x512'), 'La PWA debe instalarse desde la URL raíz final.');
check('Inicio publica Store JSON-LD', /id="tt-store-jsonld"/.test(read('index.html')) && /"@type":"Store"/.test(read('index.html')) && read('index.html').includes('"url":"' + origin + '/"'), 'La organización debe usar la URL raíz canónica.');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  for (const match of html.matchAll(/(?:^|\s)(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(raw) || raw.includes('${')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\//, '');
    if (!clean) continue;
    // Rutas públicas limpias son atendidas por Cloudflare y no necesitan un archivo físico con ese nombre.
    if (/^(?:about|catalogo|collections|product|contact|envios|cambios-devoluciones|preguntas-frecuentes|terminos|privacidad|checkout|login|perfil|admin|admin-images|404)$/.test(clean)) continue;
    const resolved = path.normalize(path.join(path.dirname(file), clean));
    check(file + ': recurso local ' + raw, fs.existsSync(path.join(root, resolved)), 'Enlace o recurso local roto.');
  }
}

const pkg = JSON.parse(read('package.json'));
check('Fase 11 forma parte del cierre', pkg.scripts['audit:phase11'] === 'node scripts/auditar-fase-11-seo.js' && pkg.scripts['test:phase11-seo'] === 'playwright test tests/seo/phase11-seo.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase11'), 'Las verificaciones SEO deben quedar permanentes.');
check('Origen y rutas forman parte del cierre', pkg.scripts['audit:final'].includes('verify:public-origin') && pkg.scripts['audit:final'].includes('audit:public-routes'), 'El cierre debe impedir drift de dominio y URLs.');
check('Existe monitor de producción', fs.existsSync(path.join(root, 'scripts/auditar-produccion-salud.mjs')) && fs.existsSync(path.join(root, '.github/workflows/seo-produccion-fase-11.yml')), 'La disponibilidad pública debe revisarse de forma recurrente.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\nAuditoría Fase 11 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\nAuditoría Fase 11: SEO y publicación correctos (' + checks.length + ' comprobaciones).');
