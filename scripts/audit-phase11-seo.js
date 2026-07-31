'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const origin = 'https://tintinaccesorios.pages.dev';
const indexed = ["index.html","catalogo.html","collections.html","product.html","about.html","contact.html","envios.html","cambios-devoluciones.html","preguntas-frecuentes.html","terminos.html","privacidad.html"];
const noindex = ["404.html","admin.html","admin-images.html","checkout.html","login.html","perfil.html","nosotros.html"];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, ok, problem) => checks.push({ name, ok: Boolean(ok), problem });
const count = (text, regex) => (text.match(regex) || []).length;

for (const file of indexed) {
  const html = read(file);
  const expected = origin + '/' + file;
  check(file + ': título único', count(html, /<title>/gi) === 1 && /<title>[^<]{8,}<\/title>/i.test(html), 'Cada página indexable necesita un título descriptivo.');
  check(file + ': descripción única', count(html, /<meta\b[^>]*name=["']description["']/gi) === 1, 'Debe existir una sola descripción.');
  check(file + ': canonical único', count(html, /<link\b[^>]*rel=["']canonical["']/gi) === 1 && html.includes('href="' + expected), 'El canonical debe apuntar al dominio público vigente.');
  check(file + ': Open Graph completo', /property="og:title"/.test(html) && /property="og:description"/.test(html) && /property="og:image"/.test(html) && html.includes('property="og:url" content="' + expected), 'Faltan etiquetas sociales absolutas.');
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

const script = read('script.js');
check('Producto genera canonical absoluto y estable', script.includes("new URL('/product.html', '" + origin + "')") && script.includes("canonicalProductUrl.searchParams.set('id', String(product.id))"), 'El producto no debe canonicalizar previews, localhost ni URLs sin id.');
check('Producto publica JSON-LD vigente', /'@type': 'Product'/.test(script) && /priceCurrency: 'PYG'/.test(script) && /schema.org\/InStock/.test(script) && /schema.org\/OutOfStock/.test(script) && /canonicalProductUrl.href/.test(script), 'Los datos estructurados deben reflejar precio, moneda, URL y stock.');

const sitemap = read('sitemap.xml');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const expectedLocations = indexed.filter(file => file !== 'product.html').map(file => origin + '/' + file);
check('Sitemap contiene solo páginas indexables', JSON.stringify(locations) === JSON.stringify(expectedLocations), 'El sitemap debe coincidir exactamente con páginas públicas estáticas.');
check('robots enlaza el sitemap vigente', read('robots.txt').includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt debe enlazar el sitemap de producción.');

const manifest = JSON.parse(read('manifest.json'));
check('Manifest tiene identidad, scope e iconos válidos', manifest.id === '/' && manifest.start_url === '/index.html' && manifest.scope === '/' && manifest.icons?.some(icon => icon.sizes === '192x192') && manifest.icons?.some(icon => icon.sizes === '512x512'), 'La PWA debe instalarse desde una identidad estable.');
check('Inicio publica Store JSON-LD', /id="tt-store-jsonld"/.test(read('index.html')) && /"@type":"Store"/.test(read('index.html')), 'La organización debe tener datos estructurados básicos.');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  for (const match of html.matchAll(/(?:^|\s)(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(raw) || raw.includes('${')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\//, '');
    if (!clean) continue;
    const resolved = path.normalize(path.join(path.dirname(file), clean));
    check(file + ': recurso local ' + raw, fs.existsSync(path.join(root, resolved)), 'Enlace o recurso local roto.');
  }
}

const pkg = JSON.parse(read('package.json'));
check('Fase 11 forma parte del cierre', pkg.scripts['audit:phase11'] === 'node scripts/audit-phase11-seo.js' && pkg.scripts['test:phase11-seo'] === 'playwright test tests/seo/phase11-seo.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase11'), 'Las verificaciones SEO deben quedar permanentes.');
check('Existe monitor de producción', fs.existsSync(path.join(root, 'scripts/audit-production-health.mjs')) && fs.existsSync(path.join(root, '.github/workflows/phase11-seo-production.yml')), 'La disponibilidad pública debe revisarse de forma recurrente.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\nAuditoría Fase 11 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\nAuditoría Fase 11: SEO y publicación correctos (' + checks.length + ' comprobaciones).');
