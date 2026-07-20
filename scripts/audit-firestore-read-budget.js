'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, condition, problem) => checks.push({ name, ok: Boolean(condition), problem });

const products = read('js/products-store.js');
const collections = read('js/collections-store.js');
const navCollections = read('js/nav-collections.js');
const pageLoader = read('js/page-maintenance-loader.js');
const editBadge = read('js/edit-badge.js');
const quotaGuard = read('js/checkout-quota-guard.js');
const firebase = read('js/firebase.js');
const settingsStore = read('js/public-settings-store.js');
const whatsapp = read('js/whatsapp.js');
const paymentMethods = read('js/checkout-payment-methods.js');
const readCache = read('js/firestore-read-cache.js');

check('Productos no abre onSnapshot global', !products.includes('onSnapshot'), 'Cada visitante volvería a leer todos los productos.');
check('Catálogo usa caché TTL compacta', products.includes("ALL_CACHE_KEY = 'products:cards'") && products.includes('compactProduct') && products.includes('readCached(ALL_CACHE_KEY') && products.includes('writeCached(ALL_CACHE_KEY'), 'La caché debe guardar solo datos de tarjetas.');
check('Solicitudes simultáneas se deduplican', products.includes("runSingleFlight('products:all'") && readCache.includes('const flights = new Map()'), 'Dos módulos no deben repetir la misma consulta.');
check('Producto consulta su documento y limita relacionados', /getDoc\(doc\(db, 'products', id\)\)/.test(products) && /limit\(12\)/.test(products), 'La ficha no debe descargar el catálogo completo.');
check('Producto no usa la caché compacta como ficha completa', !/fullCache/.test(products) && products.includes("readCached(`product:${id}`"), 'La ficha necesita descripción y variantes completas.');
check('Páginas sin catálogo no cargan productos', /(?:index\|catalogo\|collections)/.test(products) && /return Array\.isArray\(window\.PRODUCTS\)/.test(products), 'Perfil, login, contacto, legales y checkout deben quedar sin lectura de productos.');
check('La búsqueda carga productos solo al abrirse', products.includes("['btn-search', 'tabbar-search']") && products.includes('ensureProductsForSearch') && products.includes("control.addEventListener('click', load, { once: true })"), 'La lupa no debe consultar antes de usarse.');
check('Colecciones públicas usan getDocs y caché', collections.includes('getDocs') && collections.includes('loadCollections') && collections.includes('CACHE_TTL'), 'El menú público no debe mantener un listener.');
check('Colecciones en vivo quedan reservadas al Admin', collections.includes('startAdminListener') && collections.includes('adminSubscribers') && collections.includes('onSnapshot'), 'El CRUD Admin debe conservar tiempo real.');
check('Menú Tienda carga colecciones por demanda', navCollections.includes('attachDemandLoading') && navCollections.includes("['btn-tienda', 'btn-mobile-tienda', 'tabbar-tienda', 'btn-menu']"), 'Páginas que no abren Tienda no deben leer colecciones.');
check('Mantenimientos se cargan por página', pageLoader.includes('loadPageMaintenance') && !collections.includes("import './catalog-maintenance.js") && !collections.includes("import './product-maintenance.js"), 'Un store compartido no debe ejecutar todos los runtimes.');
check('Clientas no leen rolePermissions/main', editBadge.includes('if (!EDITABLE_ROLES.includes(role)) return false;') && !editBadge.includes('loadRolePermissions(true)'), 'Solo roles administrativos deben consultar la matriz.');
check('Checkout bloquea clics repetidos tras 429', quotaGuard.includes('resource-exhausted') && quotaGuard.includes('COOLDOWN_MS') && quotaGuard.includes('stopImmediatePropagation'), 'Un 429 no debe generar nuevos intentos inmediatos.');
check('Protección de cuota se carga solo en Checkout', pageLoader.includes("load('checkout-quota-guard.js')"), 'El guard no debe formar parte de otras páginas.');
check('Settings general usa una suscripción compartida', /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(settingsStore) && whatsapp.includes('onPublicSettings') && paymentMethods.includes('onPublicSettings'), 'WhatsApp y pagos no deben abrir listeners paralelos.');
check('Páginas con configuración propia evitan el listener global', whatsapp.includes('pageOwnsSettings') && ['contact.html', 'terminos.html', 'privacidad.html', 'envios.html'].every(page => whatsapp.includes(page)), 'Las páginas con runtime propio duplicarían settings/general.');
check('Firestore continúa sin persistencia IndexedDB', firebase.includes('getFirestore(app)') && !/initializeFirestore\s*\(/.test(firebase) && !/enableIndexedDbPersistence\s*\(/.test(firebase), 'No debe volver la persistencia que bloqueaba navegadores restrictivos.');
check('Existe contador diagnóstico de lecturas', readCache.includes('recordFirestoreRead') && readCache.includes('TintinReadBudget'), 'Debe poder revisarse qué fuente produjo lecturas.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nPresupuesto Firestore: ${failed.length} regresión(es).`);
  process.exit(1);
}
console.log(`\nPresupuesto Firestore protegido (${checks.length} comprobaciones).`);
