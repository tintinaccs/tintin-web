'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

function hasField(source, field) {
  return new RegExp(`\\b${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(source);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const adminApp = read('js/admin-app.js');
const headerMode = read('js/mobile-header-mode.js');
const whatsapp = read('js/whatsapp.js');
const publicSettings = read('js/public-settings-store.js');
const pageLoader = read('js/page-loader.js');
const publicShell = read('js/public-shell.js');
const checkout = read('checkout.html');
const checkoutPayments = read('js/checkout-payment-methods.js');
const secureOrder = read('js/secure-checkout-order.js');
const adminHtml = read('admin.html');

check(
  'Configuración general se guarda en settings/general',
  adminApp.includes("doc(db, 'settings', 'general')") && /settingsBatch\.set\(\s*generalRef/.test(adminApp),
  'El formulario debe escribir settings/general.'
);
check(
  'Estado de tienda se guarda atómicamente en general y storeGate',
  /const storeGateRef = doc\(db, 'settings', 'storeGate'\)/.test(adminApp) &&
    /writeBatch\(db\)/.test(adminApp) &&
    /settingsBatch\.set\(\s*storeGateRef/.test(adminApp) &&
    /settingsBatch\.commit\(\)/.test(adminApp),
  'No debe existir una ventana con estados contradictorios.'
);

['headerDesktopTabletEnabled', 'headerMobileEnabled'].forEach(field => {
  check(
    `${field} coincide entre Admin y público`,
    hasField(adminApp, field) && hasField(headerMode, field),
    `Falta ${field} en uno de los extremos.`
  );
});
check(
  'Header se actualiza en vivo con defaults seguros',
  /onSnapshot\(/.test(headerMode) && !/getDoc\(/.test(headerMode) &&
    /desktopTablet:\s*true/.test(headerMode) && /mobile:\s*true/.test(headerMode),
  'El header perdió sincronización o defaults.'
);
check(
  'Desktop/tablet y mobile usan rangos separados',
  headerMode.includes('min-width:769px') && headerMode.includes('#tt-header-desktop-tablet') &&
    headerMode.includes('max-width:768px') && headerMode.includes('.tt-tabbar'),
  'Las dos navegaciones podrían solaparse.'
);
check(
  'page-loader monta el header en todos los arranques',
  pageLoader.includes("importSibling('mobile-header-mode.js'") &&
    /function bootHeaderMode\(\)/.test(pageLoader) &&
    (pageLoader.match(/bootHeaderMode\(\);/g) || []).length >= 2,
  'El header no se carga en todos los modos.'
);

['whatsappNumber', 'contactEmail', 'instagram', 'storeAddress'].forEach(field => {
  check(
    `El público consume ${field}`,
    hasField(whatsapp, field),
    `whatsapp.js no aplica ${field}.`
  );
  check(
    `El Admin guarda ${field}`,
    hasField(adminApp, field),
    `Configuración no escribe ${field}.`
  );
});
check(
  'Configuración pública usa un listener compartido',
  /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(publicSettings) &&
    whatsapp.includes('onPublicSettings') &&
    checkoutPayments.includes('onPublicSettings'),
  'WhatsApp y pagos deben compartir la misma suscripción.'
);
check(
  'Páginas con configuración propia evitan el listener global duplicado',
  whatsapp.includes('pageOwnsSettings') &&
    ['contact.html', 'terminos.html', 'privacidad.html', 'envios.html'].every(page => whatsapp.includes(page)),
  'Las páginas que ya leen settings/general abrirían otra lectura global.'
);
check(
  'Marcas de contacto reales siguen presentes',
  whatsapp.includes('tt-contact-email') && whatsapp.includes('tt-contact-addr') && whatsapp.includes('wa.me/'),
  'El renderer no apunta a los elementos del HTML.'
);

const publicPages = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html',
  'about.html', 'contact.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html'
];
['tt-contact-email', 'tt-contact-addr'].forEach(className => {
  const count = publicPages.filter(page => read(page).includes(className)).length;
  check(`La marca ${className} existe en páginas públicas`, count >= 5, `Solo aparece en ${count} páginas.`);
});

check(
  'El shell evita headers duplicados',
  publicShell.includes('TintinPublicShellBooted') &&
    publicShell.includes('tt-public-shell-mounted') &&
    publicShell.includes("'tt-header-desktop-tablet'") &&
    /\.forEach\(id => document\.getElementById\(id\)\?\.remove\(\)\)/.test(publicShell),
  'El shell no protege el montaje único.'
);
check(
  'Checkout mantiene configuración de envío en vivo',
  /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(checkout),
  'Checkout debe actualizar ciudades y costos sin recargar.'
);
['paymentMethods', 'bankAccounts', 'deliveryCities', 'encomiendaCities'].forEach(field => {
  check(
    `Checkout aplica ${field}`,
    hasField(checkout, field) || hasField(checkoutPayments, field) || hasField(secureOrder, field),
    `Checkout no respeta ${field}.`
  );
});
check(
  'Selector de moneda no muestra una opción sin implementar',
  /id="cfg-currency"[^>]*\bdisabled\b/.test(adminHtml),
  'La moneda debe permanecer fija mientras no haya soporte multimoneda.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nSincronización Admin ↔ público: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nSincronización Admin ↔ público verificada (${checks.length} comprobaciones).`);
