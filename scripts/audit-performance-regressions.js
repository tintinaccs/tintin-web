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

const montserrat = read('css/montserrat.css');
const products = read('js/products-store.js');
const collections = read('js/collections-store.js');

check(
  'Montserrat mantiene swap sin FOIT',
  /font-display:\s*swap/.test(montserrat) && !/font-display:\s*block/.test(montserrat),
  'La fuente volvió a bloquear el texto.'
);
check(
  'La primera pintura sigue protegida por loader',
  read('js/color-scheme-instant.js').includes('tt-color-scheme-pending') &&
    /visibility:\s*hidden/.test(read('js/color-scheme-instant.js')),
  'El contenido podría aparecer antes de aplicar el esquema.'
);
check(
  'El loader conserva salida de emergencia',
  /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/page-loader.js')) &&
    /RELEASE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/color-scheme-instant.js')),
  'El loader podría quedar infinito.'
);
check(
  'Autenticación pública y administrativa siguen activas',
  read('js/store-gate.js').includes('onAuthStateChanged') &&
    read('js/admin-app.js').includes('onAuthStateChanged'),
  'La sesión real debe seguir controlando el acceso.'
);
check(
  'Super Admin conserva acceso total',
  read('js/admin-app.js').includes("currentRole === 'superadmin' || canDo(currentRole, moduleKey, actionKey)"),
  'El bypass del Super Admin no debe depender de la matriz editable.'
);
check(
  'El panel Admin mantiene su arranque protegido',
  read('admin.html').includes('js/admin-app.js') &&
    read('js/admin-app.js').includes("role === 'superadmin' && user.email === SUPER_ADMIN"),
  'El panel o el diagnóstico perdieron su gate.'
);
check(
  'Productos públicos se cargan bajo demanda y con caché',
  !products.includes('onSnapshot') &&
    products.includes('loadAllProducts') &&
    products.includes('loadProductPage') &&
    products.includes('readCached') &&
    products.includes('runSingleFlight'),
  'No debe regresar el listener global de todos los productos.'
);
check(
  'La ficha lee un producto y limita relacionados',
  /getDoc\(doc\(db, 'products', id\)\)/.test(products) &&
    /limit\(12\)/.test(products),
  'Producto no debe descargar todo el catálogo.'
);
check(
  'Colecciones públicas usan carga cacheada y Admin conserva tiempo real',
  collections.includes('loadCollections') &&
    collections.includes('readCached') &&
    collections.includes('startAdminListener') &&
    collections.includes('onSnapshot'),
  'La tienda pública y el panel deben usar estrategias distintas.'
);
check(
  'Pedidos del panel siguen en vivo y acotados',
  /onSnapshot\(query\(collection\(db, 'orders'\), limit\(/.test(read('js/admin-app.js')),
  'Pedidos debe conservar actualización en tiempo real con límite.'
);
check(
  'Usuarios del panel siguen en vivo y acotados',
  /onSnapshot\(query\(collection\(db, 'users'\), limit\(/.test(read('js/admin-app.js')),
  'Usuarios debe conservar actualización en tiempo real con límite.'
);
check(
  'Checkout conserva el canal Resend',
  read('checkout.html').includes('import { sendOrderNotification } from "./js/resend-order-notify.js') &&
    !read('checkout.html').includes('email-notify.js'),
  'El checkout no debe volver al webhook antiguo.'
);
check(
  'Checkout protege nuevos intentos después de agotar cuota',
  read('js/checkout-quota-guard.js').includes('resource-exhausted') &&
    read('js/checkout-quota-guard.js').includes('COOLDOWN_MS') &&
    read('js/page-maintenance-loader.js').includes('checkout-quota-guard.js'),
  'Un 429 no debe permitir clics repetidos inmediatos.'
);
check(
  'Clientas comunes no consultan la matriz administrativa',
  read('js/edit-badge.js').includes('if (!EDITABLE_ROLES.includes(role)) return false;') &&
    !read('js/edit-badge.js').includes('loadRolePermissions(true)'),
  'La web pública no debe leer rolePermissions/main para una cuenta client.'
);
check(
  'Perfil conserva el cálculo de estadísticas desde pedidos',
  read('js/order-stats.js').includes('export async function recalculateUserOrderStats') &&
    read('js/order-stats.js').includes("const validForSpent = clean.filter(o => !isCancelled(o))"),
  'No deben contarse pedidos cancelados.'
);
check(
  'Contacto sigue conectado a configuración',
  read('js/whatsapp.js').includes("doc(db, 'settings', 'general')"),
  'Los datos de contacto deben seguir siendo administrables.'
);
check(
  'Header y navegación siguen montándose',
  read('js/page-loader.js').includes('bootHeaderMode') &&
    read('js/page-loader.js').includes('bootPublicRuntime'),
  'El runtime público perdió su arranque.'
);
check(
  'Tienda cerrada conserva settings/storeGate',
  read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')") &&
    read('js/store-gate.js').includes("from './store-gate-core.js"),
  'El gate debe conservar su fuente mínima.'
);
check(
  'Correos siguen por servidor con Resend',
  read('functions/api/order-email.js').includes('if (isResend && !isSuperAdmin)'),
  'El canal de correo perdió su protección.'
);
check(
  'Imágenes conservan lazy y async',
  read('js/image-performance.js').includes("image.decoding = 'async'") &&
    read('js/image-performance.js').includes("image.loading = priority ? 'eager' : 'lazy'"),
  'La estrategia de imágenes se degradó.'
);
check(
  'Auditoría sigue inmutable',
  /match \/auditLog\/\{logId\}[\s\S]{0,260}allow update, delete: if false;/.test(read('firestore.rules')),
  'El registro de auditoría no debe poder editarse.'
);
check(
  'Respuestas obsoletas de estadísticas siguen protegidas',
  read('js/admin-app.js').includes('statisticsTrafficLoadToken'),
  'Una carga anterior podría pisar una nueva.'
);

const publicPages = ['index.html', 'catalogo.html', 'collections.html', 'product.html',
  'contact.html', 'about.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html', '404.html',
  'login.html', 'perfil.html', 'checkout.html'];
const adminOnPublic = publicPages.filter(page => exists(page) && read(page).includes('admin-app.js'));
check(
  'El bundle Admin sigue fuera de páginas públicas',
  adminOnPublic.length === 0,
  `Páginas afectadas: ${adminOnPublic.join(', ')}`
);
check(
  'No existe Service Worker con caché vieja',
  !exists('sw.js') && !exists('service-worker.js'),
  'Un Service Worker podría servir archivos anteriores.'
);
check(
  'La interfaz respeta reducción de movimiento',
  /prefers-reduced-motion/.test(read('css/ui-quality.css')),
  'Se perdió la preferencia de accesibilidad.'
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
