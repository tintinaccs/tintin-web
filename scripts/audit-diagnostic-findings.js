#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }
  failures.push(label);
  console.error(`FAIL — ${label}`);
}

function sha256(source) {
  const canonical = String(source).replace(/\r\n?/g, '\n');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function contrastRatio(hexA, hexB) {
  const luminance = hex => {
    const rgb = hex.replace('#', '').match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = rgb.map(value => value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4);
    return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
  };
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const manifest = JSON.parse(read('diagnostic-manifest.json'));
const adminHtml = read('admin.html');
const adminApp = read('js/admin-app.js');
const diagnostics = read('js/admin-site-diagnostics.js');
const manifestBuilder = read('scripts/build-diagnostic-manifest.js');
const rules = read('firestore.rules');
const sitemap = read('sitemap.xml');
const nosotros = read('nosotros.html');
const productExtras = read('css/product-extras.css');

check('El inventario contiene las 18 rutas requeridas', manifest.pages.length === 18);
check('El inventario contiene las siete resoluciones requeridas', manifest.viewports.length === 7);
check(
  'El inventario contiene los seis roles requeridos',
  ['guest', 'client', 'viewer', 'agent', 'admin', 'superadmin']
    .every(role => manifest.roles.includes(role))
);
check(
  'Las 18 huellas HTML coinciden con los archivos actuales',
  manifest.pages.every(page => exists(page.path) && sha256(read(page.path)) === page.sha256)
);
check(
  'Las huellas de texto son independientes de CRLF o LF',
  manifestBuilder.includes("replace(/\\r\\n?/g, '\\n')") &&
    manifestBuilder.includes('const buffer = canonicalBuffer(file)')
);
check(
  'No quedan lecturas directas sin límite detectadas',
  Array.isArray(manifest.firestore?.unboundedReads) &&
    manifest.firestore.unboundedReads.length === 0
);

check('admin.html pesa menos de 200 KB', Buffer.byteLength(adminHtml, 'utf8') < 200 * 1024);
check(
  'La aplicación administrativa fue extraída a un módulo cargado de forma diferida',
  exists('js/admin-app.js') &&
    /<script[^>]+type=["']module["'][^>]+src=["']js\/admin-app\.js\?v=/.test(adminHtml)
);
check('El panel administrativo conserva exactamente un H1', (adminHtml.match(/<h1\b/gi) || []).length === 1);
check(
  'Las escuchas en tiempo real de pedidos, usuarios y plantillas están limitadas',
  /onSnapshot\(query\(collection\(db,\s*['"]orders['"]\),\s*limit\(20000\)\)/.test(adminApp) &&
    /onSnapshot\(query\(collection\(db,\s*['"]users['"]\),\s*limit\(20000\)\)/.test(adminApp) &&
    /onSnapshot\(query\(collection\(db,\s*['"]emailTemplates['"]\),\s*limit\(500\)\)/.test(adminApp)
);
check(
  'El listado de esquemas de apariencia también está limitado',
  /query\(collection\(db,\s*['"]colorSchemes['"]\),\s*where\(['"]scope['"],\s*['"]==['"],\s*scope\),\s*limit\(100\)\)/.test(adminApp)
);
check(
  'Las escuchas públicas y administrativas restantes también están limitadas',
  /onSnapshot\(query\(collection\(db,\s*['"]users['"]\),\s*limit\(20000\)\)/.test(read('js/admin-users-phase8.js')) &&
    (read('js/collections-store.js').match(/onSnapshot\(query\(collection\(db,\s*['"]collections['"]\),\s*limit\(5000\)\)/g) || []).length === 2 &&
    /onSnapshot\(query\(collection\(db,\s*['"]products['"]\),\s*limit\(20000\)\)/.test(read('js/products-store.js'))
);

check(
  'El diagnóstico evalúa el recorte horizontal y vertical por separado',
  diagnostics.includes("style.overflowX") &&
    diagnostics.includes("element.scrollWidth > element.clientWidth + 3") &&
    diagnostics.includes("style.overflowY") &&
    diagnostics.includes("element.scrollHeight > element.clientHeight + 3")
);
check(
  'El diagnóstico excluye contenido oculto destinado a lectores de pantalla',
  diagnostics.includes("element.closest('.tt-sr-only,[data-diagnostic-ignore-visual=\"true\"]')")
);
check(
  'Los enlaces de texto en línea y las etiquetas de checkbox se miden correctamente',
  diagnostics.includes('function isInlineTextLink') &&
    diagnostics.includes('function effectiveTouchRect') &&
    diagnostics.includes("input[type=\"checkbox\"],input[type=\"radio\"]")
);
check(
  'siteTraffic se consulta en la subcolección diaria correcta',
  /collection\(db,\s*['"]siteTraffic['"],[\s\S]{0,260}['"]sessions['"]\)/.test(diagnostics)
);
check(
  'Las reglas mantienen siteTraffic privado para Super Admin',
  /match \/siteTraffic\/\{dateKey\}\/sessions\/\{sessionId\}[\s\S]{0,120}allow read, delete: if isSuperAdmin\(\);/.test(rules)
);

check(
  'nosotros.html es un alias no indexable con canonical absoluto',
  /name=["']robots["'][^>]+content=["']noindex,\s*follow["']/i.test(nosotros) &&
    /rel=["']canonical["'][^>]+href=["']https:\/\/tintinaccs\.github\.io\/tintin-web\/about\.html["']/i.test(nosotros) &&
    /http-equiv=["']refresh["'][^>]+about\.html/i.test(nosotros)
);
check('nosotros.html no aparece en sitemap.xml', !/nosotros\.html/i.test(sitemap));
const nosotrosPage = manifest.pages.find(page => page.path === 'nosotros.html');
check(
  'El manifiesto marca el alias nosotros como oculto y redirigido',
  nosotrosPage?.visibility === 'hidden' &&
    nosotrosPage?.metadata?.noindex === true &&
    nosotrosPage?.metadata?.redirectsTo === 'about.html'
);

const checkoutColor = /#tinsel-checkout-btn\s*\{[\s\S]*?background:\s*(#[0-9a-f]{6})/i.exec(productExtras)?.[1];
check(
  'El botón de checkout supera 4.5:1 contra texto blanco',
  Boolean(checkoutColor) && contrastRatio(checkoutColor, '#ffffff') >= 4.5
);

const touchAssertions = [
  ['404.html', /\.tt-404-cat-link\s*\{[\s\S]*?min-height:\s*32px/],
  ['admin-images.html', /\.adm-hamburger\s*\{[\s\S]*?min-(?:width|height):\s*44px/],
  ['admin-images.html', /\.adm-nav-btn\s*\{[\s\S]*?min-height:\s*44px/],
  ['admin-images.html', /\.adm-mobile-tab\s*\{[\s\S]*?min-height:\s*44px/],
  ['css/checkout.css', /\.ck-header-back\s*\{[\s\S]*?min-height:\s*32px/],
  ['css/login.css', /\.login-email-resend\s*\{[\s\S]*?min-height:\s*32px/],
  ['perfil.html', /\.perfil-back\s*\{[\s\S]*?min-height:\s*32px/],
  ['perfil.html', /\.perfil-btn\s*\{[\s\S]*?min-height:\s*44px/]
];
check(
  'Los controles táctiles independientes corregidos conservan su tamaño mínimo',
  touchAssertions.every(([file, pattern]) => pattern.test(read(file)))
);

check(
  'Las exportaciones y tareas globales usan paginación acotada',
  [
    'js/admin-app.js',
    'js/admin-import-phase9.js',
    'js/admin-welcome-control.js',
    'js/order-stats.js'
  ].every(file => read(file).includes('getDocsPaginated')) &&
    exists('js/firestore-pagination.js')
);

if (failures.length) {
  console.error(`\nAuditoría de hallazgos: ${failures.length} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría de hallazgos: todas las correcciones verificables quedaron protegidas.');
