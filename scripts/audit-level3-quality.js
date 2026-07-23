'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
let failures = 0;

function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

const manifest = JSON.parse(read('diagnostic-manifest.json'));
const packageJson = JSON.parse(read('package.json'));
const contracts = read('docs/QUALITY_CONTRACTS.md');
const responsiveAudit = read('scripts/audit-global-responsive-final.mjs');
const canonicalAudit = read('scripts/audit-canonical-viewports.mjs');
const responsiveRetry = read('scripts/run-responsive-audit-with-retry.mjs');
const performanceAudit = read('scripts/audit-performance-realtime.js');
const regressionAudit = read('scripts/audit-performance-regressions.js');
const finalIntegration = read('scripts/audit-final-integration.js');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');

const canonicalViewports = [
  ['desktop-large', 1920, 1080],
  ['desktop', 1440, 900],
  ['laptop', 1280, 720],
  ['tablet-landscape', 1024, 768],
  ['tablet-portrait', 768, 1024],
  ['mobile', 390, 844],
  ['mini-mobile', 320, 568]
];

const manifestViewports = new Map((manifest.viewports || []).map(viewport => [viewport.id, viewport]));
for (const [id, width, height] of canonicalViewports) {
  const viewport = manifestViewports.get(id);
  check(
    `Viewport canónico ${id} (${width}×${height})`,
    viewport?.width === width && viewport?.height === height
  );
  check(
    `La auditoría de navegador incluye ${width}×${height}`,
    canonicalAudit.includes(`width: ${width}, height: ${height}`)
  );
  check(
    `El contrato documenta ${width} × ${height}`,
    contracts.includes(`${width} × ${height}`)
  );
}

const expectedRoles = ['guest', 'client', 'viewer', 'agent', 'admin', 'superadmin'];
check(
  'El manifiesto cubre todos los roles obligatorios',
  expectedRoles.every(role => (manifest.roles || []).includes(role)),
  `Roles encontrados: ${(manifest.roles || []).join(', ')}`
);

check(
  'Todas las páginas del manifiesto se prueban en los viewports canónicos',
  canonicalAudit.includes("const pages = (manifest.pages || [])") &&
    canonicalAudit.includes(".filter(page => page.path && fs.existsSync(path.join(root, page.path)))")
);
check(
  'La auditoría canónica detecta página vacía, overflow y navegación duplicada',
  canonicalAudit.includes('la página quedó visualmente vacía') &&
    canonicalAudit.includes('overflow horizontal raíz') &&
    canonicalAudit.includes('header desktop visible en mobile') &&
    canonicalAudit.includes('tabbar mobile visible en desktop/tablet')
);
check(
  'La auditoría global cubre superficies compartidas y límites de breakpoint',
  responsiveAudit.includes('inspectSharedSurfaces') &&
    responsiveAudit.includes('boundaryViewports') &&
    responsiveAudit.includes('inspectPrivacy') &&
    responsiveAudit.includes('inspectMobileBottom')
);

check(
  'El reintento responsive es automático y está limitado a dos intentos',
  responsiveRetry.includes('const maximumAttempts = 2') &&
    responsiveRetry.includes('attempt <= maximumAttempts') &&
    responsiveRetry.includes('process.exit(1)') &&
    !responsiveRetry.includes('while (true)')
);
check(
  'El comando responsive usa el wrapper de reintento',
  packageJson.scripts?.['audit:global-responsive-geometry'] === 'node scripts/run-responsive-audit-with-retry.mjs'
);
check(
  'Existe comando para los siete viewports canónicos',
  packageJson.scripts?.['audit:canonical-viewports'] === 'node scripts/audit-canonical-viewports.mjs'
);

const pages = manifest.pages || [];
check(
  'No existen IDs duplicados en las páginas inventariadas',
  pages.every(page => Array.isArray(page.duplicateIds) && page.duplicateIds.length === 0),
  pages.filter(page => page.duplicateIds?.length).map(page => page.path).join(', ')
);
check(
  'Todas las páginas declaran viewport e idioma español',
  pages.every(page => page.metadata?.hasViewport === true && page.metadata?.htmlLang === 'es'),
  pages.filter(page => !page.metadata?.hasViewport || page.metadata?.htmlLang !== 'es').map(page => page.path).join(', ')
);

const seoPublicPages = [
  'index.html',
  'catalogo.html',
  'collections.html',
  'product.html',
  'about.html',
  'contact.html',
  'envios.html',
  'cambios-devoluciones.html',
  'preguntas-frecuentes.html',
  'terminos.html',
  'privacidad.html'
];

for (const file of seoPublicPages) {
  check(`Existe página SEO ${file}`, exists(file));
  if (!exists(file)) continue;
  const html = read(file);
  check(`${file} tiene title`, /<title>[^<]{3,}<\/title>/i.test(html));
  check(`${file} tiene description`, /<meta\s+name=["']description["'][^>]+content=["'][^"']{20,}["']/i.test(html) || /<meta\s+content=["'][^"']{20,}["'][^>]+name=["']description["']/i.test(html));
  check(`${file} tiene canonical`, /<link\s+rel=["']canonical["'][^>]+href=["']https?:\/\//i.test(html));
  check(`${file} tiene Open Graph`, /property=["']og:title["']/i.test(html) && /property=["']og:description["']/i.test(html));
}

const noindexPages = ['admin.html', 'admin-images.html', 'login.html', 'checkout.html', 'perfil.html', '404.html'];
for (const file of noindexPages) {
  check(`${file} está excluida en HTML`, exists(file) && /<meta\s+name=["']robots["'][^>]+noindex/i.test(read(file)));
}
for (const route of ['/admin.html', '/admin-images.html', '/login.html', '/checkout.html', '/perfil.html']) {
  check(`robots.txt excluye ${route}`, robots.includes(`Disallow: ${route}`));
}
check('robots.txt enlaza sitemap', /Sitemap:\s*https?:\/\/.+\/sitemap\.xml/i.test(robots));
for (const file of ['index.html', 'catalogo.html', 'collections.html', 'about.html', 'contact.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html']) {
  check(`sitemap incluye ${file}`, sitemap.includes(`/${file}</loc>`));
}
check('Existe manifest PWA', exists('manifest.json'));

const recoveryFiles = [
  'js/home-maintenance.js',
  'js/catalog-maintenance.js',
  'js/collections-maintenance.js',
  'js/product-maintenance.js',
  'js/login-maintenance.js',
  'js/profile-maintenance.js',
  'js/checkout-maintenance.js',
  'js/checkout-reliability.js',
  'js/contact-maintenance.js',
  'js/cart-sync.js'
];
for (const file of recoveryFiles) {
  check(`${file} contempla recuperación online`, exists(file) && /addEventListener\(['"]online['"]/.test(read(file)));
}

const accessibilityCss = [
  'styles.css',
  'css/ui-quality.css',
  'css/home-maintenance.css',
  'css/catalog-maintenance.css',
  'css/collections-maintenance.css',
  'css/product-maintenance.css'
].filter(exists);
check(
  'Las capas principales respetan movimiento reducido',
  accessibilityCss.every(file => /prefers-reduced-motion/.test(read(file))),
  accessibilityCss.filter(file => !/prefers-reduced-motion/.test(read(file))).join(', ')
);
check(
  'El sistema define foco visible y tamaño táctil',
  /focus-visible/.test(read('css/ui-quality.css')) && /44px/.test(`${read('styles.css')}\n${read('css/ui-quality.css')}`)
);
check(
  'Las páginas tienen exactamente un H1 cuando el manifiesto lo exige',
  pages.filter(page => page.path !== 'nosotros.html').every(page => page.metadata?.redirectsTo || page.metadata?.h1Count === 1),
  pages.filter(page => !page.metadata?.redirectsTo && page.path !== 'nosotros.html' && page.metadata?.h1Count !== 1).map(page => `${page.path}:${page.metadata?.h1Count}`).join(', ')
);

check(
  'La auditoría de rendimiento protege fuentes, loaders, caché, listeners e imágenes',
  performanceAudit.includes('Tipografía sin FOIT') &&
    performanceAudit.includes('El loader tiene salida garantizada') &&
    performanceAudit.includes('Existe caché compartida con TTL y single-flight') &&
    performanceAudit.includes('Los timers del dashboard se limpian') &&
    performanceAudit.includes('Las imágenes usan decoding async y lazy salvo prioridad')
);
check(
  'Existe tripwire de regresión posterior a optimizaciones',
  regressionAudit.includes('Tripwire de regresiones') && regressionAudit.includes('audit-performance-realtime.js')
);
check(
  'La integración final verifica SEO, PWA y fuentes únicas',
  finalIntegration.includes('robots bloquea páginas privadas y declara sitemap') &&
    finalIntegration.includes('manifest es válido y sus iconos existen') &&
    finalIntegration.includes('Firebase se inicializa únicamente en js/firebase.js') &&
    finalIntegration.includes('Configuración general pública tiene una sola suscripción compartida')
);

check(
  'El contrato prohíbe loaders para ocultar esperas evitables',
  contracts.includes('No se usan para esconder consultas innecesarias')
);
check(
  'El contrato exige reintentos sin duplicar operaciones',
  contracts.includes('Los reintentos no duplican pedidos, correos, eventos analíticos ni escrituras')
);

if (failures > 0) {
  console.error(`\nNivel 3: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nNivel 3: responsive, estados, accesibilidad, rendimiento y SEO correctos.');
