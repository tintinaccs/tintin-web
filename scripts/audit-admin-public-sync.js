'use strict';

/* =============================================================
   TINTIN — Auditoría de Configuración (Super Admin) ↔ sitio público

   Bloquea las invariantes que hacen que cada opción de
   Super Admin → Configuración produzca un cambio REAL en las páginas
   públicas. El problema histórico que esta auditoría previene es el de una
   opción que aparece en el panel pero no cambia nada en la tienda: eso pasa
   cuando el nombre del campo que ESCRIBE el admin y el que LEE el runtime
   público dejan de coincidir, cuando un consumidor deja de cargarse en las
   páginas, o cuando aparece una segunda fuente del header que duplica o pisa
   a la real.

   No abre navegador: son comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) {
    cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  }
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

// Coincidencia por nombre de campo COMPLETO, no por subcadena: así renombrar
// `headerMobileEnabled` a `headerMobileEnabledV2` rompe la auditoría en vez de
// pasar desapercibido porque la vieja cadena sigue contenida en la nueva.
function hasField(src, field) {
  return new RegExp('\\b' + field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(src);
}

const adminApp   = read('js/admin-app.js');
const headerMode = read('js/mobile-header-mode.js');
const whatsapp   = read('js/whatsapp.js');
const pageLoader = read('js/page-loader.js');
const publicShell = read('js/public-shell.js');
const checkout   = read('checkout.html');
const analytics  = read('js/analytics.js');
const secureOrder = read('js/secure-checkout-order.js');
const adminHtml  = read('admin.html');

// -------------------------------------------------------------------------
// 1. Fuente única de verdad: la Configuración general vive en settings/general
//    y el estado de apertura se escribe atómicamente también en el documento
//    público mínimo settings/storeGate, en el MISMO commit (writeBatch). Sin
//    esto existiría una ventana donde el panel dice "abierta" pero las reglas
//    todavía bloquean la tienda.
// -------------------------------------------------------------------------
check(
  'La Configuración general se guarda en settings/general',
  adminApp.includes("doc(db, 'settings', 'general')") &&
    /settingsBatch\.set\(\s*generalRef/.test(adminApp),
  'El formulario de Configuración debe escribir en settings/general.'
);
check(
  'El estado de la tienda se escribe atómico en general + storeGate',
  /const storeGateRef = doc\(db, 'settings', 'storeGate'\)/.test(adminApp) &&
    /writeBatch\(db\)/.test(adminApp) &&
    /settingsBatch\.set\(\s*storeGateRef/.test(adminApp) &&
    /settingsBatch\.commit\(\)/.test(adminApp),
  'storeOpen debe guardarse en el mismo commit para general y storeGate.'
);

// -------------------------------------------------------------------------
// 2. Contrato de nombres del header por dispositivo. Los tres lugares —lo que
//    ESCRIBE el admin, lo que RE-LEE el formulario, y lo que aplica el runtime
//    público— deben usar exactamente los mismos nombres de campo. Si uno se
//    renombra sin los otros, el toggle "aparece pero no hace nada".
// -------------------------------------------------------------------------
const HEADER_FIELDS = ['headerDesktopTabletEnabled', 'headerMobileEnabled'];
HEADER_FIELDS.forEach(field => {
  check(
    `El campo ${field} es coherente entre admin y runtime público`,
    hasField(adminApp, field) && hasField(headerMode, field),
    `Admin y mobile-header-mode.js deben leer/escribir ${field} con el mismo nombre.`
  );
});

// -------------------------------------------------------------------------
// 3. El runtime del header por dispositivo aplica en vivo y con defaults
//    seguros, y cada toggle está acotado a SU rango de ancho sin cruzarse con
//    el otro (nunca dos navegaciones visibles a la vez).
// -------------------------------------------------------------------------
check(
  'El header por dispositivo se actualiza en vivo (onSnapshot, no getDoc)',
  /onSnapshot\(/.test(headerMode) && !/getDoc\(/.test(headerMode),
  'mobile-header-mode.js debe usar onSnapshot para reflejar cambios sin recargar.'
);
check(
  'El header por dispositivo arranca con defaults seguros (visible)',
  /desktopTablet:\s*true/.test(headerMode) && /mobile:\s*true/.test(headerMode),
  'Si falta el dato, ambos elementos de navegación deben quedar visibles.'
);
check(
  'Cada toggle de navegación vive en su propio rango de ancho',
  headerMode.includes('min-width:769px') &&
    headerMode.includes('#tt-header-desktop-tablet') &&
    headerMode.includes('max-width:768px') &&
    headerMode.includes('.tt-tabbar'),
  'El header superior (>=769px) y la tabbar (<=768px) no deben solaparse.'
);

// -------------------------------------------------------------------------
// 4. El runtime del header se carga en TODAS las páginas públicas a través del
//    orquestador único (page-loader.js), tanto en el runtime liviano público
//    como en el completo — no depende de un <script> por página.
// -------------------------------------------------------------------------
check(
  'page-loader.js carga el header por dispositivo en todo el sitio',
  pageLoader.includes("importSibling('mobile-header-mode.js'") &&
    /function bootHeaderMode\(\)/.test(pageLoader) &&
    (pageLoader.match(/bootHeaderMode\(\);/g) || []).length >= 2,
  'bootHeaderMode debe ejecutarse tanto en bootPublicRuntime como en bootPageRuntime.'
);

// -------------------------------------------------------------------------
// 5. Datos de contacto/redes: whatsapp.js es la única fuente que reescribe en
//    vivo el WhatsApp, email, Instagram y dirección en las páginas públicas.
//    Debe leer los mismos campos que el admin guarda y usar las clases/marcas
//    que existen en el HTML.
// -------------------------------------------------------------------------
const CONTACT_FIELDS = ['whatsappNumber', 'contactEmail', 'instagram', 'storeAddress'];
CONTACT_FIELDS.forEach(field => {
  check(
    `whatsapp.js consume el campo ${field} de settings/general`,
    hasField(whatsapp, field),
    `whatsapp.js debe aplicar ${field} guardado en Configuración.`
  );
  check(
    `El admin guarda el campo ${field}`,
    hasField(adminApp, field),
    `Configuración debe seguir escribiendo ${field}.`
  );
});
check(
  'whatsapp.js usa las clases de contacto reales del HTML',
  whatsapp.includes('tt-contact-email') &&
    whatsapp.includes('tt-contact-addr') &&
    whatsapp.includes('wa.me/'),
  'El renderer debe apuntar a las marcas de contacto que existen en las páginas.'
);
check(
  'whatsapp.js lee settings/general en vivo',
  /onSnapshot\(\s*doc\(db, 'settings', 'general'\)/.test(whatsapp),
  'Los datos de contacto deben reflejarse sin recargar la página.'
);

// -------------------------------------------------------------------------
// 6. Las marcas de contacto existen en las páginas públicas: si el admin
//    cambia el dato pero ninguna página tiene el destino, no se vería nada.
// -------------------------------------------------------------------------
const PUBLIC_PAGES = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html',
  'about.html', 'contact.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html',
];
['tt-contact-email', 'tt-contact-addr'].forEach(cls => {
  const count = PUBLIC_PAGES.filter(p => {
    try { return read(p).includes(cls); } catch { return false; }
  }).length;
  check(
    `La marca ${cls} existe en las páginas públicas`,
    count >= 5,
    `Debe haber destinos reales para ${cls}; solo se encontraron ${count}.`
  );
});

// -------------------------------------------------------------------------
// 7. Un solo header activo: public-shell.js elimina cualquier header/nav
//    previo antes de inyectar el suyo y se monta una sola vez. Así nunca hay
//    dos headers (uno estático + uno de JS) al mismo tiempo.
// -------------------------------------------------------------------------
check(
  'public-shell.js evita headers duplicados y se monta una sola vez',
  publicShell.includes('TintinPublicShellBooted') &&
    publicShell.includes('tt-public-shell-mounted') &&
    publicShell.includes("'tt-header-desktop-tablet'") &&
    /\.forEach\(id => document\.getElementById\(id\)\?\.remove\(\)\)/.test(publicShell),
  'El shell debe quitar cualquier header previo y protegerse contra doble montaje.'
);

// -------------------------------------------------------------------------
// 8. El checkout consume la Configuración (pagos, envío, WhatsApp, apertura)
//    en vivo desde settings/general — es la página donde más opciones del
//    panel tienen efecto económico real.
// -------------------------------------------------------------------------
check(
  'El checkout lee la Configuración en vivo',
  /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(checkout),
  'checkout.html debe escuchar settings/general para pagos, envío y WhatsApp.'
);
['paymentMethods', 'bankAccounts', 'deliveryCities', 'encomiendaCities'].forEach(field => {
  check(
    `El checkout aplica ${field} desde la Configuración`,
    hasField(checkout, field),
    `El checkout debe respetar ${field} guardado en el panel.`
  );
});

// -------------------------------------------------------------------------
// 9. Sin controles muertos: el selector de moneda ofrece una sola opción real
//    (Guaraníes) y está deshabilitado a propósito, para no mostrar una opción
//    que no produce ningún cambio. Si algún día se habilita sin implementar el
//    formateo multi-moneda, esta comprobación obliga a revisarlo.
// -------------------------------------------------------------------------
check(
  'El selector de moneda no ofrece una opción que no hace nada',
  /id="cfg-currency"[^>]*\bdisabled\b/.test(adminHtml),
  'Mientras solo se maneje Guaraní, el selector de moneda debe seguir deshabilitado.'
);

// -------------------------------------------------------------------------
// 10. Cada campo que el admin guarda tiene al menos un consumidor real en el
//     runtime público. Cubre el caso "opción en el panel sin efecto".
// -------------------------------------------------------------------------
const CONSUMERS = [checkout, whatsapp, headerMode, analytics, secureOrder];
const FIELD_CONSUMERS = {
  whatsappNumber: CONSUMERS,
  contactEmail: [whatsapp],
  instagram: CONSUMERS,
  storeAddress: [whatsapp],
  facebook: [whatsapp],
  tiktok: [whatsapp],
  paymentMethods: [checkout, secureOrder],
  bankAccounts: [checkout],
  deliveryCities: [checkout, secureOrder],
  encomiendaCities: [checkout, secureOrder],
  deliveryCost: [checkout],
  encomiendaCost: [checkout],
  ga4MeasurementId: [analytics],
  headerDesktopTabletEnabled: [headerMode],
  headerMobileEnabled: [headerMode],
  storeOpen: [checkout, secureOrder],
};
Object.entries(FIELD_CONSUMERS).forEach(([field, sources]) => {
  const consumed = sources.some(src => hasField(src, field));
  check(
    `El campo guardado ${field} tiene un consumidor público`,
    hasField(adminApp, field) && consumed,
    `${field} se guarda en el panel pero ningún módulo público lo usa.`
  );
});

// -------------------------------------------------------------------------
// 11. analytics.js respeta el consentimiento antes de usar el ID de GA4 que
//     viene de Configuración (no se activa medición sin permiso opcional).
// -------------------------------------------------------------------------
check(
  'GA4 usa el ID de Configuración solo con consentimiento',
  analytics.includes('ga4MeasurementId') &&
    /hasStatisticsConsent\(\)/.test(analytics),
  'La medición no debe arrancar sin el permiso estadístico opcional.'
);

// -------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de sincronización fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log('\nAuditoría de Configuración ↔ sitio público completada correctamente.');
