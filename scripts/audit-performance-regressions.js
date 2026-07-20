'use strict';

/* =============================================================
   TINTIN — Tripwire de regresiones POSTERIOR a la optimización de rendimiento

   Verificación estática de estabilidad tras el mantenimiento de rendimiento y
   sincronización (PR #182). Ese PR tuvo UN solo cambio de runtime:
   css/montserrat.css → font-display: block → swap (el resto fue aditivo:
   auditorías, pruebas, docs). Este tripwire comprueba dos cosas:

   1) Que ese cambio de fuente sea COMPATIBLE con el loader/primera pintura
      (no introduce texto de respaldo visible antes de que el loader se retire).
   2) Que NO haya regresado ninguna invariante crítica de los dominios listados
      (auth, permisos, Super Admin, productos, colecciones, pedidos, usuarios,
      checkout, perfil, configuración, header/nav, tienda cerrada, correos,
      WhatsApp, imágenes, estadísticas, auditoría, sincronización en vivo).

   No reemplaza a las auditorías por dominio (siguen corriendo en audit:final):
   es un único comando que falla fuerte si la optimización rompió algo central.

   Limitación declarada: en este entorno el navegador headless no alcanza la red
   externa (proxy), así que las 7 resoluciones y los Web Vitals NO se prueban en
   navegador aquí. Ver maintenance/13-estabilidad-regresiones-rendimiento.txt.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

// ===========================================================================
// 1. EL CAMBIO DE RENDIMIENTO ESTÁ EN PIE Y ES COMPATIBLE CON EL LOADER
// ===========================================================================
const montserrat = read('css/montserrat.css');
check(
  'La optimización de fuente se mantiene (swap, sin block/FOIT)',
  /font-display:\s*swap/.test(montserrat) && !/font-display:\s*block/.test(montserrat),
  'La fuente volvió a font-display: block (texto invisible) — regresión de la optimización.'
);
check(
  'Montserrat sigue siendo la familia configurada (no quedó solo el fallback)',
  montserrat.includes('font-family: "Montserrat"'),
  'El cambio de font-display no debe alterar la familia tipográfica de la marca.'
);
check(
  'La primera pintura sigue tapando el contenido hasta estar lista (swap ocurre bajo el loader)',
  read('js/color-scheme-instant.js').includes('tt-color-scheme-pending') &&
    /visibility:\s*hidden/.test(read('js/color-scheme-instant.js')),
  'Sin el gate de primera pintura, el swap podría mostrar la fuente de respaldo antes de tiempo.'
);
check(
  'El loader conserva su salida de emergencia (no gira infinito)',
  /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/page-loader.js')) &&
    /RELEASE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/color-scheme-instant.js')),
  'El timeout de emergencia del loader debe seguir presente.'
);

// ===========================================================================
// 2. TRIPWIRES POR DOMINIO — la optimización no rompió el comportamiento central
// ===========================================================================
check(
  'Autenticación: el gate público reacciona a la sesión real (onAuthStateChanged)',
  read('js/store-gate.js').includes('onAuthStateChanged') &&
    read('js/admin-app.js').includes('onAuthStateChanged'),
  'La resolución de sesión no debe haberse alterado.'
);
check(
  'Permisos: el Super Admin real conserva el bypass total',
  read('js/admin-app.js').includes("currentRole === 'superadmin' || canDo(currentRole, moduleKey, actionKey)"),
  'roleCanDo debe seguir devolviendo true para el Super Admin antes de consultar la matriz.'
);
check(
  'Super Admin: admin.html carga el panel como módulo y el diagnóstico sigue gateado',
  read('admin.html').includes('js/admin-app.js') &&
    read('js/admin-app.js').includes("role === 'superadmin' && user.email === SUPER_ADMIN"),
  'El arranque del panel y el gate del diagnóstico deben mantenerse.'
);
check(
  'Productos: catálogo público en vivo (onSnapshot + limit)',
  /onSnapshot\(query\(collection\(db, 'products'\), limit\(/.test(read('js/products-store.js')),
  'El catálogo debe seguir sincronizándose en tiempo real con tope.'
);
check(
  'Colecciones: sincronización en vivo con tope',
  read('js/collections-store.js').includes('onSnapshot') &&
    read('js/collections-store.js').includes('limit('),
  'Las colecciones deben seguir en tiempo real con límite.'
);
check(
  'Pedidos: listener del panel en vivo y acotado',
  /onSnapshot\(query\(collection\(db, 'orders'\), limit\(/.test(read('js/admin-app.js')),
  'Pedidos del panel deben conservar el tiempo real con límite.'
);
check(
  'Usuarios: listener del panel en vivo y acotado',
  /onSnapshot\(query\(collection\(db, 'users'\), limit\(/.test(read('js/admin-app.js')),
  'Usuarios del panel deben conservar el tiempo real con límite.'
);
check(
  'Checkout: el correo del pedido sigue por el canal Resend (no el webhook viejo)',
  read('checkout.html').includes('import { sendOrderNotification } from "./js/resend-order-notify.js') &&
    !read('checkout.html').includes('email-notify.js'),
  'El checkout no debe volver al canal Apps Script.'
);
check(
  'Perfil: la recalculación de estadísticas por usuaria sigue disponible',
  read('js/order-stats.js').includes('export async function recalculateUserOrderStats') &&
    read('js/order-stats.js').includes("const validForSpent = clean.filter(o => !isCancelled(o))"),
  'El perfil debe seguir recalculando desde los pedidos, sin contar cancelados.'
);
check(
  'Configuración ↔ público: el contacto sigue leyéndose de settings/general',
  read('js/whatsapp.js').includes("doc(db, 'settings', 'general')"),
  'La sincronización de configuración al footer público debe mantenerse.'
);
check(
  'Header / navegación: el runtime público sigue montando el header',
  read('js/page-loader.js').includes('bootHeaderMode') &&
    read('js/page-loader.js').includes('bootPublicRuntime'),
  'El arranque del header/nav no debe haberse perdido.'
);
check(
  'Tienda cerrada: el público sigue leyendo settings/storeGate por el núcleo único',
  read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')") &&
    read('js/store-gate.js').includes("from './store-gate-core.js"),
  'El bloqueo de tienda debe conservar su fuente y su núcleo único.'
);
check(
  'Correos: canal único Resend en el servidor (reenvío solo Super Admin)',
  read('functions/api/order-email.js').includes('if (isResend && !isSuperAdmin)'),
  'La consolidación de correos en Resend no debe haberse deshecho.'
);
check(
  'WhatsApp: número normalizado y texto codificado',
  read('js/whatsapp.js').includes("String(rawNumber || '').replace(/\\D/g, '')") &&
    read('js/admin-app.js').includes('encodeURIComponent(waConfirmMessageTemplate.replace(/\\{nombre\\}/g'),
  'El armado de enlaces de WhatsApp debe seguir seguro.'
);
check(
  'Imágenes: estrategia lazy/async global intacta',
  read('js/image-performance.js').includes("image.decoding = 'async'") &&
    read('js/image-performance.js').includes("image.loading = priority ? 'eager' : 'lazy'"),
  'La estrategia de carga de imágenes no debe haberse alterado.'
);
check(
  'Estadísticas: banderas de disponibilidad (no "0" ante fallo) intactas',
  read('js/admin-app.js').includes('let adminRealtimeReady = { orders: false, users: false, products: false, traffic: false, presence: false }'),
  'La diferenciación vacío/error/cargando de estadísticas debe mantenerse.'
);
check(
  'Auditoría: registro inmutable en reglas (update/delete: false)',
  /match \/auditLog\/\{logId\}[\s\S]{0,260}allow update, delete: if false;/.test(read('firestore.rules')),
  'El log de auditoría debe seguir siendo inmutable.'
);
check(
  'Sincronización en vivo: guardia anti-respuesta-obsoleta intacta',
  read('js/admin-app.js').includes('statisticsTrafficLoadToken'),
  'Una respuesta lenta anterior no debe poder pisar datos más nuevos.'
);

// ===========================================================================
// 3. INVARIANTES DE RENDIMIENTO PRESERVADAS
// ===========================================================================
const PUBLIC_PAGES = ['index.html', 'catalogo.html', 'collections.html', 'product.html',
  'contact.html', 'about.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html', '404.html',
  'login.html', 'perfil.html', 'checkout.html'];
const adminOnPublic = PUBLIC_PAGES.filter(p => exists(p) && read(p).includes('admin-app.js'));
check(
  'El bundle del Super Admin sigue fuera de las páginas públicas',
  adminOnPublic.length === 0,
  `Páginas públicas que cargarían admin-app.js: ${adminOnPublic.join(', ')}`
);
check(
  'No apareció un Service Worker que pueda servir HTML/caché vieja tras un deploy',
  !exists('sw.js') && !exists('service-worker.js'),
  'Un Service Worker mal invalidado podría mostrar contenido anterior tras el deploy; no se introdujo ninguno.'
);
check(
  'Se respeta prefers-reduced-motion en el sistema de UI',
  /prefers-reduced-motion/.test(read('css/ui-quality.css')),
  'La reducción de movimiento no debe haberse perdido con los cambios de estilo.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nTripwire de regresiones post-optimización: ${failed.length} regresión(es) detectada(s).`);
  process.exit(1);
}

console.log(`\nTripwire de regresiones post-optimización: sin regresiones (${checks.length} comprobaciones).`);
