'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

function listJsFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listJsFiles(relative);
    return entry.name.endsWith('.js') ? [relative] : [];
  });
}
const jsFiles = listJsFiles('js');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const firebaseInitFiles = [...jsFiles, ...htmlFiles].filter(file =>
  /initializeApp\s*\(/.test(read(file)) || /apiKey:\s*["']/.test(read(file))
);
check(
  'Firebase se inicializa únicamente en js/core/firebase/firebase.js',
  firebaseInitFiles.length === 1 && firebaseInitFiles[0] === 'js/core/firebase/firebase.js',
  `Inicializadores encontrados: ${firebaseInitFiles.join(', ')}`
);
check(
  'El control de tienda reutiliza store-gate-core',
  read('js/core/store-gate/control-tienda.js').includes("from './nucleo-control-tienda.js") &&
    read('js/core/store-gate/nucleo-control-tienda.js').includes("doc(db, 'settings', 'storeGate')") &&
    read('js/cargador-pagina.js').includes('store-gate'),
  'El gate público debe tener una sola implementación.'
);
check(
  'Configuración general pública tiene una sola suscripción compartida',
  read('js/core/store/configuracion-publica.js').includes("onSnapshot(doc(db, 'settings', 'general')") &&
    read('js/components/contact/whatsapp.js').includes('onPublicSettings') &&
    read('js/pages/checkout/checkout-metodos-pago.js').includes('onPublicSettings'),
  'WhatsApp y pagos deben compartir public-settings-store.'
);
check(
  'Tienda cerrada consume settings/storeGate',
  read('js/core/store-gate/nucleo-control-tienda.js').includes("doc(db, 'settings', 'storeGate')"),
  'La apertura de tienda debe usar el documento público mínimo.'
);
check(
  'Apariencia consume colorSchemes y settings/appearance',
  read('js/components/color/esquema-color.js').includes('colorSchemes') && read('js/components/color/esquema-color.js').includes('APPEARANCE_DOC'),
  'La apariencia debe seguir conectada al Super Admin.'
);
check(
  'Contenido consume site_content',
  read('js/core/store/contenido-sitio.js').includes('site_content'),
  'El contenido editable debe conservar Firestore como fuente.'
);

const robots = read('robots.txt');
const privateRoutes = ['/admin', '/admin-images', '/login', '/checkout', '/perfil'];
check(
  'robots bloquea páginas privadas limpias y legacy y declara sitemap',
  privateRoutes.every(route => robots.includes(`Disallow: ${route}`)) &&
    privateRoutes.every(route => robots.includes(`Disallow: ${route}.html`)) &&
    /Sitemap:\s*https?:\/\//.test(robots),
  'robots.txt no refleja todas las rutas privadas limpias y legacy.'
);

const sitemapIndex = read('sitemap.xml');
const sitemapPages = read('sitemap-pages.xml');
const publicOrigin = 'https://tintinaccesorios.pages.dev';
const publicRoutes = [
  '/', '/catalogo', '/collections', '/about', '/contact', '/envios',
  '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'
];
const childSitemaps = ['/sitemap-pages.xml', '/sitemap-products.xml', '/sitemap-collections.xml'];
check(
  'sitemap.xml es un índice completo',
  /<sitemapindex\b/i.test(sitemapIndex) && childSitemaps.every(route => sitemapIndex.includes(`<loc>${publicOrigin}${route}</loc>`)),
  'El índice debe enlazar páginas, productos y colecciones.'
);
check(
  'sitemap de páginas incluye las URLs públicas finales limpias',
  publicRoutes.every(route => sitemapPages.includes(`<loc>${publicOrigin}${route}</loc>`)),
  'Faltan páginas públicas limpias en sitemap-pages.xml.'
);
check(
  'sitemaps estáticos no publican aliases .html redirigidos',
  !/<loc>[^<]*\.html(?:[?#][^<]*)?<\/loc>/i.test(`${sitemapIndex}\n${sitemapPages}`),
  'Los destinos redirigidos .html no deben competir con sus URLs finales limpias.'
);
check(
  'sitemaps estáticos no exponen páginas privadas',
  ['admin', 'admin-images', 'login', 'checkout', 'perfil', '404', 'nosotros']
    .every(page => !new RegExp(`<loc>[^<]*/${page}(?:\\.html)?(?:[?#][^<]*)?</loc>`, 'i').test(`${sitemapIndex}\n${sitemapPages}`)),
  'Los sitemaps contienen rutas que no deben indexarse.'
);

let manifest = null;
try { manifest = JSON.parse(read('manifest.json')); } catch {}
check(
  'manifest es válido y sus iconos existen',
  manifest && manifest.name && manifest.start_url && manifest.scope && manifest.theme_color &&
    Array.isArray(manifest.icons) && manifest.icons.length > 0 && manifest.icons.every(icon => exists(icon.src)),
  'manifest.json o sus recursos son inválidos.'
);

const apiFunctions = fs.readdirSync(path.join(root, 'functions/api'))
  .filter(file => file.endsWith('.js')).map(file => `/api/${file.replace(/\.js$/, '')}`);
const htmlFunctionRoutes = htmlFiles.flatMap(file => {
  if (file === 'index.html') return ['/', '/index.html'];
  return [`/${path.basename(file, '.html')}`, `/${file}`];
});
const dynamicFunctionRoutes = [
  '/products/*', '/collections/*', '/pages/*', '/policies/*',
  '/sitemap-products.xml', '/sitemap-collections.xml'
];
const expectedRoutes = [...new Set([...apiFunctions, '/__/auth/*', ...htmlFunctionRoutes, ...dynamicFunctionRoutes])].sort();
const routeConfig = JSON.parse(read('_routes.json'));
const routes = [...new Set(routeConfig.include || [])].sort();
check(
  '_routes incluye exactamente APIs, Auth y documentos HTML protegidos por middleware',
  routeConfig.version === 1 && Array.isArray(routeConfig.exclude) && routeConfig.exclude.length === 0 &&
    JSON.stringify(expectedRoutes) === JSON.stringify(routes),
  `Rutas esperadas: ${expectedRoutes.join(', ')} | Rutas: ${routes.join(', ')}`
);

const cspRuntime = (() => { try { return JSON.parse(read('config/csp-runtime.json')); } catch { return null; } })();
const headerCspLines = read('_headers').split(/\r?\n/).filter(line => line.includes('Content-Security-Policy:'));
const staticFallbackCsp = headerCspLines[0] || '';
check(
  'CSP completa de HTML se entrega por Pages Functions y _headers conserva solo un fallback corto',
  exists('functions/_middleware.js') &&
    exists('config/csp-runtime.js') &&
    read('functions/_middleware.js').includes("headers.set('Content-Security-Policy', policy)") &&
    headerCspLines.length === 1 &&
    staticFallbackCsp.length <= 2000 &&
    staticFallbackCsp.includes("script-src-attr 'none'") &&
    !staticFallbackCsp.includes('https://api.cloudinary.com') &&
    !staticFallbackCsp.includes("script-src 'self' 'unsafe-inline'") &&
    cspRuntime?.generatedBy === 'scripts/generar-csp-cloudflare.js',
  'Ejecutá npm run build:csp; la CSP completa vive en middleware y el fallback estático debe permanecer corto y restringido.'
);
check(
  'Firebase Auth queda fuera del middleware CSP de la tienda',
  read('functions/_middleware.js').includes("pathname.startsWith('/__/auth/')") &&
    read('functions/_middleware.js').includes('return context.next()'),
  'El helper /__/auth/* debe conservar su proxy transparente.'
);
check(
  '_headers respeta el límite de 2000 caracteres por línea',
  read('_headers').split(/\r?\n/).every(line => line.length <= 2000),
  'Una línea sobredimensionada bloquea el deploy de Cloudflare Pages.'
);

check(
  'firebase.json solo despliega reglas',
  (() => {
    const config = JSON.parse(read('firebase.json'));
    return config.firestore && config.firestore.rules === 'firestore.rules' && !config.hosting;
  })(),
  'El hosting no debe administrarse desde firebase.json.'
);

check('No queda tintin-code-sh', !exists('tintin-code-sh'), 'Quedan fragmentos obsoletos.');
check(
  'No quedan PNG obsoletos del header',
  !exists('images/Mi cuenta.png') && !exists('images/Busqueda.png') && !exists('images/Carrito.png'),
  'Quedan imágenes reemplazadas por SVG.'
);
const liquid = [...jsFiles, ...htmlFiles, 'styles.css', 'tienda.js']
  .filter(file => exists(file) && /\{%[- ]*(liquid|section|schema|render|assign)\b/.test(read(file)));
check('No quedan plantillas Liquid', liquid.length === 0, `Archivos: ${liquid.join(', ')}`);

const packageScripts = Object.values(JSON.parse(read('package.json')).scripts).join(' ');
const packageMissing = [...packageScripts.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)]
  .map(match => match[1]).filter((value, index, values) => values.indexOf(value) === index).filter(file => !exists(file));
check('Todos los scripts de package.json existen', packageMissing.length === 0, packageMissing.join(', '));
const workflowDirectory = path.join(root, '.github/workflows');
const currentWorkflowRef = String(process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '');
const branchScopedWorkflows = new Map([
  ['aplicar-logica-tienda-unificada.yml', 'audit/unified-store-logic'],
  ['validar-tienda-unificada-final.yml', 'audit/unified-store-logic']
]);
const workflowMissing = [];
for (const file of fs.readdirSync(workflowDirectory).filter(file => /\.ya?ml$/.test(file))) {
  const requiredRef = branchScopedWorkflows.get(file) || '';
  if (requiredRef && currentWorkflowRef !== requiredRef) continue;
  const text = fs.readFileSync(path.join(workflowDirectory, file), 'utf8');
  for (const match of text.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)) {
    if (!exists(match[1]) && !workflowMissing.includes(match[1])) workflowMissing.push(match[1]);
  }
}
check('Todos los scripts de CI aplicables existen', workflowMissing.length === 0, workflowMissing.join(', '));

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nAuditoría final fallida: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nAuditoría final completada (${checks.length} comprobaciones).`);
