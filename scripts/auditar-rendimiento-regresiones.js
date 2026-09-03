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

const montserrat = read('css/core/montserrat.css');
const products = read('js/core/store/estado-productos.js');
const collections = read('js/pages/collections/estado-colecciones.js');
const instantColor = read('js/components/color/esquema-color-instantaneo.js');
const liveColor = read('js/components/color/esquema-color.js');
const fastReleaseMs = Number(instantColor.match(/RELEASE_TIMEOUT_MS\s*=\s*(\d+)/)?.[1] || Infinity);
const fastRevealMs = Number(instantColor.match(/FAST_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/)?.[1] || Infinity);

check('Montserrat mantiene swap sin FOIT', /font-display:\s*swap/.test(montserrat) && !/font-display:\s*block/.test(montserrat), 'La fuente volvió a bloquear el texto.');
check(
  'La primera pintura es inmediata, estable y segura',
  instantColor.includes('function isSafeColorValue(value)') &&
    instantColor.includes("release(usedCachedScheme ? 'cache-first-paint' : 'fallback-first-paint')") &&
    fastReleaseMs <= 250 &&
    fastRevealMs <= 250 &&
    instantColor.includes('tt-fast-navigation.tt-store-gate-pending') &&
    instantColor.includes('visibility:visible!important') &&
    liveColor.includes('onSnapshot') &&
    liveColor.includes("markColorSchemeReady('firestore')") &&
    liveColor.includes("markColorSchemeReady('scheme-read-error')"),
  `La primera pintura debe usar caché/fallback validado en <=250 ms y luego hidratar el esquema remoto. release=${fastReleaseMs} ms; reveal=${fastRevealMs} ms.`
);
check(
  'La espera remota de color no vuelve a ocultar toda la página',
  !instantColor.includes('tt-color-scheme-pending body>*:not(#tt-loader):not(#tt-store-closed-overlay){visibility:hidden!important}') &&
    !instantColor.includes('tt-color-scheme-pending body>*:not(#tt-loader):not(#tt-store-closed-overlay) { visibility: hidden') &&
    instantColor.includes('tt-fast-navigation'),
  'Una lectura de Firestore/App Check volvió a convertirse en bloqueo visual global.'
);
check('El loader conserva salida de emergencia', /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/cargador-pagina.js')) && /RELEASE_TIMEOUT_MS\s*=\s*\d{2,}/.test(instantColor), 'El loader puede quedar infinito.');
check('Autenticación pública y administrativa siguen activas', read('js/core/store-gate/control-tienda.js').includes('onAuthStateChanged') && read('js/admin/admin-app.js').includes('onAuthStateChanged'), 'La sesión dejó de controlar el acceso.');
check('Super Admin conserva acceso total', read('js/admin/admin-app.js').includes("currentRole === 'superadmin' || canDo(currentRole, moduleKey, actionKey)"), 'El bypass total se perdió.');
check('Panel Admin mantiene arranque protegido', read('admin.html').includes('js/admin/admin-app.js') && read('js/admin/admin-app.js').includes("role === 'superadmin' && user.email === SUPER_ADMIN"), 'El panel perdió su gate.');
check(
  'Catálogo público combina canal en vivo acotado y caché de respaldo',
  products.includes('onSnapshot') &&
    products.includes('startPublicProductsRealtime') &&
    /query\(collection\(db,\s*['"]products['"]\),\s*limit\(1000\)\)/.test(products) &&
    products.includes('loadAllProducts') &&
    products.includes('readCached') &&
    products.includes('runSingleFlight'),
  'El catálogo perdió el canal en vivo acotado o su respaldo de caché.'
);
check(
  'Un catálogo vacío nunca queda cacheado como actualizado',
  /if\s*\(cards\.length\)\s*writeCached\(ALL_CACHE_KEY,\s*cards\)/.test(products) &&
    /Array\.isArray\(cached\)\s*&&\s*cached\.length/.test(products),
  'Una lectura vacía puede dejar el catálogo en 0 productos durante todo el TTL.'
);
check(
  'El catálogo público no oculta cambios de stock por más de un minuto',
  /const\s+ALL_CACHE_TTL\s*=\s*60\s*\*\s*1000/.test(products),
  'La caché pública puede conservar precio o stock obsoleto más de un minuto.'
);
check('La ficha lee un producto y limita relacionados', /getDoc\(doc\(db, 'products', id\)\)/.test(products) && /limit\(12\)/.test(products), 'Producto descarga demasiado.');
check('Colecciones públicas usan caché y Admin tiempo real', collections.includes('loadCollections') && collections.includes('readCached') && collections.includes('startAdminListener') && collections.includes('onSnapshot'), 'Las estrategias pública y administrativa se mezclaron.');
check('Pedidos Admin siguen en vivo y acotados', /onSnapshot\(query\(collection\(db, 'orders'\),[\s\S]*?limit\(/.test(read('js/admin/admin-app.js')), 'Pedidos perdió su listener limitado.');
check('Usuarios Admin siguen en vivo y acotados', /onSnapshot\(query\(collection\(db, 'users'\),[\s\S]*?limit\(/.test(read('js/admin/admin-app.js')), 'Usuarios perdió su listener limitado.');
check('Checkout conserva Resend', read('js/pages/checkout/checkout-puente-correo.js').includes("from '../../email/notificacion-pedido-resend.js") && !read('checkout.html').includes('notificaciones-correo.js') && !read('checkout.html').includes('notificacion-pedido-resend.js'), 'Checkout volvió al canal antiguo.');
check('Checkout protege reintentos después de agotar cuota', read('js/pages/checkout/checkout-control-cuota.js').includes('resource-exhausted') && read('js/pages/checkout/checkout-control-cuota.js').includes('COOLDOWN_MS') && read('js/cargador-mantenimiento-pagina.js').includes('checkout-control-cuota.js'), 'Un 429 permite clics repetidos.');
check('Clientas no consultan permisos administrativos', read('js/core/auth/insignia-edicion.js').includes('if (!EDITABLE_ROLES.includes(role)) return false;') && !read('js/core/auth/insignia-edicion.js').includes('loadRolePermissions(true)'), 'Una cuenta client lee rolePermissions/main.');
check('Perfil conserva cálculo desde pedidos', read('js/core/store/estadisticas-pedidos.js').includes('export async function recalculateUserOrderStats') && read('js/core/store/estadisticas-pedidos.js').includes("const validForSpent = clean.filter(o => !isCancelled(o))"), 'Se alteró el cálculo de estadísticas.');
check('Contacto usa configuración pública compartida', read('js/components/contact/whatsapp.js').includes('onPublicSettings') && read('js/core/store/configuracion-publica.js').includes("doc(db, 'settings', 'general')"), 'Contacto dejó de ser administrable o duplicó su fuente.');
check('Header y navegación siguen montándose', read('js/cargador-pagina.js').includes('bootHeaderMode') && read('js/cargador-pagina.js').includes('bootPublicRuntime'), 'El header perdió su arranque.');
check('Tienda cerrada conserva storeGate', read('js/core/store-gate/nucleo-control-tienda.js').includes("doc(db, 'settings', 'storeGate')") && read('js/core/store-gate/control-tienda.js').includes("from './nucleo-control-tienda.js"), 'El gate perdió su fuente mínima.');
check('Correos siguen por servidor con Resend', read('functions/api/order-email.js').includes('if (isResend && !isSuperAdmin)'), 'El canal de correo perdió protección.');
check('Imágenes conservan lazy y async', read('js/components/images/rendimiento-imagenes.js').includes("image.decoding = 'async'") && read('js/components/images/rendimiento-imagenes.js').includes("image.loading = priority ? 'eager' : 'lazy'"), 'La estrategia de imágenes se degradó.');
check('Auditoría sigue inmutable', /match \/auditLog\/\{logId\}[\s\S]{0,260}allow update, delete: if false;/.test(read('firestore.rules')), 'AuditLog quedó editable.');
check('Respuestas obsoletas siguen protegidas', read('js/admin/admin-app.js').includes('statisticsTrafficLoadToken'), 'Una carga vieja puede pisar otra nueva.');

const publicPages = ['index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html', 'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'];
const adminOnPublic = publicPages.filter(page => exists(page) && read(page).includes('admin-app.js'));
check('Bundle Admin fuera de páginas públicas', adminOnPublic.length === 0, `Páginas afectadas: ${adminOnPublic.join(', ')}`);
check('No existe Service Worker con caché vieja', !exists('sw.js') && !exists('service-worker.js'), 'Un Service Worker puede servir archivos anteriores.');
check('La interfaz respeta reducción de movimiento', /prefers-reduced-motion/.test(read('css/quality/calidad-interfaz.css')), 'Se perdió prefers-reduced-motion.');
check(
  'El presupuesto de estilos no cuenta dos veces un archivo preparado',
  read('scripts/auditar-rendimiento-tiempo-real.js').includes('const homeCssLinks =') &&
    read('scripts/auditar-rendimiento-tiempo-real.js').includes('new Set(homeCssLinks'),
  'La medición volvió a sumar por separado el preload y la hoja de estilos de una misma URL.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nTripwire de regresiones: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nTripwire de regresiones: sin fallos (${checks.length} comprobaciones).`);
