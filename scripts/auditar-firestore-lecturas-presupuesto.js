'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, condition, problem) => checks.push({ name, ok: Boolean(condition), problem });

const products = read('js/core/store/estado-productos.js');
const collections = read('js/pages/collections/estado-colecciones.js');
const navCollectionsAdapter = read('js/components/navigation/compatibilidad/colecciones.js');
const navCollectionsRuntime = read('js/components/navigation/compartido/carga-colecciones.js');
const pageLoader = read('js/cargador-mantenimiento-pagina.js');
const editBadge = read('js/core/auth/insignia-edicion.js');
const quotaGuard = read('js/pages/checkout/checkout-control-cuota.js');
const firebase = read('js/core/firebase/firebase.js');
const settingsStore = read('js/core/store/configuracion-publica.js');
const whatsapp = read('js/components/contact/whatsapp.js');
const paymentMethods = read('js/pages/checkout/checkout-metodos-pago.js');
const readCache = read('js/core/firebase/cache-lecturas-firestore.js');
const publicCatalogApi = read('functions/api/public-catalog.js');
const publicCatalogClient = read('js/core/firebase/catalogo-publico-api.js');
const routesConfig = read('_routes.json');

check(
  'Catálogo público evita un listener completo por visitante',
  products.includes('startPublicProductsRealtime') &&
    products.includes('return loadAllProducts();') &&
    !/catalogo\|collections[\s\S]{0,160}return startPublicProductsRealtime\(\)/.test(products),
  'Catálogo y colecciones deben usar carga cacheada; el listener completo no puede abrirse automáticamente.'
);
check(
  'Catálogo público usa caché edge con fallback seguro',
  publicCatalogApi.includes('caches.default') &&
    publicCatalogApi.includes("s-maxage=60") &&
    publicCatalogApi.includes('PRODUCT_FIELDS') &&
    publicCatalogClient.includes("/api/public-catalog") &&
    products.includes("fetchPublicCatalogResource('products')") &&
    collections.includes("fetchPublicCatalogResource('collections')") &&
    routesConfig.includes('"/api/public-catalog"'),
  'La lectura masiva debe concentrarse en Cloudflare y publicar únicamente campos permitidos.'
);
check('Catálogo usa caché TTL compacta', products.includes("ALL_CACHE_KEY = 'products:cards'") && products.includes('compactProduct') && products.includes('readCached(ALL_CACHE_KEY') && products.includes('writeCached(ALL_CACHE_KEY'), 'La caché debe guardar solo datos de tarjetas.');
check('Solicitudes simultáneas se deduplican', products.includes("runSingleFlight('products:all'") && readCache.includes('const flights = new Map()'), 'Dos módulos no deben repetir la misma consulta.');
check('Producto consulta su documento y limita relacionados', /getDoc\(doc\(db, 'products', id\)\)/.test(products) && /limit\(12\)/.test(products), 'La ficha no debe descargar el catálogo completo.');
check(
  'Producto no usa la caché compacta como ficha completa',
  !/fullCache/.test(products) &&
    /readCached\(`product:\$\{(?:id|normalizedId)\}`/.test(products),
  'La ficha necesita descripción y variantes completas.'
);
check('Páginas sin catálogo no cargan productos', /(?:index\|catalogo\|collections)/.test(products) && /return Array\.isArray\(window\.PRODUCTS\)/.test(products), 'Perfil, login, contacto, legales y checkout deben quedar sin lectura de productos.');
check('La búsqueda carga productos solo al abrirse', products.includes("['btn-search', 'tabbar-search']") && products.includes('ensureProductsForSearch') && products.includes("control.addEventListener('click', load, { once: true })"), 'La lupa no debe consultar antes de usarse.');
check('Colecciones públicas usan edge y conservan fallback acotado', collections.includes("fetchPublicCatalogResource('collections')") && collections.includes('getDocs') && collections.includes('loadCollections') && collections.includes('CACHE_TTL'), 'El menú público debe preferir edge y conservar Firestore solo como respaldo.');
check('Colecciones en vivo quedan reservadas al Admin', collections.includes('startAdminListener') && collections.includes('adminSubscribers') && collections.includes('onSnapshot'), 'El CRUD Admin debe conservar tiempo real.');
check(
  'Menú Tienda carga colecciones por demanda',
  navCollectionsAdapter.includes('components/navigation/compartido/carga-colecciones.js') &&
    navCollectionsRuntime.includes('function attachDemandLoading()') &&
    navCollectionsRuntime.includes("['btn-tienda', 'btn-tablet-tienda', 'tabbar-tienda', 'btn-menu-tablet']") &&
    navCollectionsRuntime.includes("control.addEventListener('pointerenter'") &&
    navCollectionsRuntime.includes("control.addEventListener('focus'") &&
    navCollectionsRuntime.includes("control.addEventListener('click'") &&
    navCollectionsRuntime.includes('if (isCollectionPage()) initNavCollections();') &&
    navCollectionsRuntime.includes('else attachDemandLoading();'),
  'Páginas que no abren Tienda no deben leer colecciones y el adaptador debe apuntar a la fuente modular.'
);
check('Mantenimientos se cargan por página', pageLoader.includes('loadPageMaintenance') && !collections.includes("import './mantenimiento-catalogo.js") && !collections.includes("import './mantenimiento-producto.js"), 'Un store compartido no debe ejecutar todos los runtimes.');
check('Clientas no leen rolePermissions/main', editBadge.includes('if (!EDITABLE_ROLES.includes(role)) return false;') && !editBadge.includes('loadRolePermissions(true)'), 'Solo roles administrativos deben consultar la matriz.');
check('Checkout bloquea clics repetidos tras 429', quotaGuard.includes('resource-exhausted') && quotaGuard.includes('COOLDOWN_MS') && quotaGuard.includes('stopImmediatePropagation'), 'Un 429 no debe generar nuevos intentos inmediatos.');
check('Protección de cuota se carga solo en Checkout', pageLoader.includes("load('pages/checkout/checkout-control-cuota.js')"), 'El guard no debe formar parte de otras páginas.');
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
