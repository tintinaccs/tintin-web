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

check('Montserrat mantiene swap sin FOIT', /font-display:\s*swap/.test(montserrat) && !/font-display:\s*block/.test(montserrat), 'La fuente volvió a bloquear el texto.');
check('La primera pintura sigue protegida', read('js/color-scheme-instant.js').includes('tt-color-scheme-pending') && /visibility:\s*hidden/.test(read('js/color-scheme-instant.js')), 'El contenido puede aparecer antes del esquema.');
check('El loader conserva salida de emergencia', /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/page-loader.js')) && /RELEASE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/color-scheme-instant.js')), 'El loader puede quedar infinito.');
check('Autenticación pública y administrativa siguen activas', read('js/store-gate.js').includes('onAuthStateChanged') && read('js/admin-app.js').includes('onAuthStateChanged'), 'La sesión dejó de controlar el acceso.');
check('Super Admin conserva acceso total', read('js/admin-app.js').includes("currentRole === 'superadmin' || canDo(currentRole, moduleKey, actionKey)"), 'El bypass total se perdió.');
check('Panel Admin mantiene arranque protegido', read('admin.html').includes('js/admin-app.js') && read('js/admin-app.js').includes("role === 'superadmin' && user.email === SUPER_ADMIN"), 'El panel perdió su gate.');
check('Productos se cargan bajo demanda y con caché', !products.includes('onSnapshot') && products.includes('loadAllProducts') && products.includes('loadProductPage') && products.includes('readCached') && products.includes('runSingleFlight'), 'Regresó el listener global de productos.');
check('La ficha lee un producto y limita relacionados', /getDoc\(doc\(db, 'products', id\)\)/.test(products) && /limit\(12\)/.test(products), 'Producto descarga demasiado.');
check('Colecciones públicas usan caché y Admin tiempo real', collections.includes('loadCollections') && collections.includes('readCached') && collections.includes('startAdminListener') && collections.includes('onSnapshot'), 'Las estrategias pública y administrativa se mezclaron.');
check('Pedidos Admin siguen en vivo y acotados', /onSnapshot\(query\(collection\(db, 'orders'\), limit\(/.test(read('js/admin-app.js')), 'Pedidos perdió su listener limitado.');
check('Usuarios Admin siguen en vivo y acotados', /onSnapshot\(query\(collection\(db, 'users'\), limit\(/.test(read('js/admin-app.js')), 'Usuarios perdió su listener limitado.');
check('Checkout conserva Resend', read('checkout.html').includes('import { sendOrderNotification } from "./js/resend-order-notify.js') && !read('checkout.html').includes('email-notify.js'), 'Checkout volvió al canal antiguo.');
check('Checkout protege reintentos después de agotar cuota', read('js/checkout-quota-guard.js').includes('resource-exhausted') && read('js/checkout-quota-guard.js').includes('COOLDOWN_MS') && read('js/page-maintenance-loader.js').includes('checkout-quota-guard.js'), 'Un 429 permite clics repetidos.');
check('Clientas no consultan permisos administrativos', read('js/edit-badge.js').includes('if (!EDITABLE_ROLES.includes(role)) return false;') && !read('js/edit-badge.js').includes('loadRolePermissions(true)'), 'Una cuenta client lee rolePermissions/main.');
check('Perfil conserva cálculo desde pedidos', read('js/order-stats.js').includes('export async function recalculateUserOrderStats') && read('js/order-stats.js').includes("const validForSpent = clean.filter(o => !isCancelled(o))"), 'Se alteró el cálculo de estadísticas.');
check('Contacto usa configuración pública compartida', read('js/whatsapp.js').includes('onPublicSettings') && read('js/public-settings-store.js').includes("doc(db, 'settings', 'general')"), 'Contacto dejó de ser administrable o duplicó su fuente.');
check('Header y navegación siguen montándose', read('js/page-loader.js').includes('bootHeaderMode') && read('js/page-loader.js').includes('bootPublicRuntime'), 'El header perdió su arranque.');
check('Tienda cerrada conserva storeGate', read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')") && read('js/store-gate.js').includes("from './store-gate-core.js"), 'El gate perdió su fuente mínima.');
check('Correos siguen por servidor con Resend', read('functions/api/order-email.js').includes('if (isResend && !isSuperAdmin)'), 'El canal de correo perdió protección.');
check('Imágenes conservan lazy y async', read('js/image-performance.js').includes("image.decoding = 'async'") && read('js/image-performance.js').includes("image.loading = priority ? 'eager' : 'lazy'"), 'La estrategia de imágenes se degradó.');
check('Auditoría sigue inmutable', /match \/auditLog\/\{logId\}[\s\S]{0,260}allow update, delete: if false;/.test(read('firestore.rules')), 'AuditLog quedó editable.');
check('Respuestas obsoletas siguen protegidas', read('js/admin-app.js').includes('statisticsTrafficLoadToken'), 'Una carga vieja puede pisar otra nueva.');

const publicPages = ['index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html', 'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'];
const adminOnPublic = publicPages.filter(page => exists(page) && read(page).includes('admin-app.js'));
check('Bundle Admin fuera de páginas públicas', adminOnPublic.length === 0, `Páginas afectadas: ${adminOnPublic.join(', ')}`);
check('No existe Service Worker con caché vieja', !exists('sw.js') && !exists('service-worker.js'), 'Un Service Worker puede servir archivos anteriores.');
check('La interfaz respeta reducción de movimiento', /prefers-reduced-motion/.test(read('css/ui-quality.css')), 'Se perdió prefers-reduced-motion.');
check(
  'El presupuesto de estilos no cuenta dos veces un archivo preparado',
  read('scripts/audit-performance-realtime.js').includes('const homeCssUrls = new Set('),
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
