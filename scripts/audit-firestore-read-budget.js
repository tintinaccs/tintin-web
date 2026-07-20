'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const products = read('js/products-store.js');
const collections = read('js/collections-store.js');
const navCollections = read('js/nav-collections.js');
const pageLoader = read('js/page-maintenance-loader.js');
const editBadge = read('js/edit-badge.js');
const quotaGuard = read('js/checkout-quota-guard.js');
const firebase = read('js/firebase.js');

check(
  'Productos no abre onSnapshot global',
  !products.includes('onSnapshot'),
  'Cada visitante volvería a leer todos los productos y cada cambio posterior.'
);
check(
  'Catálogo completo usa caché TTL',
  products.includes('ALL_CACHE_TTL') && products.includes('readCached(ALL_CACHE_KEY') && products.includes('writeCached(ALL_CACHE_KEY'),
  'La navegación entre páginas no debe repetir el catálogo mientras la caché sea válida.'
);
check(
  'Solicitudes simultáneas de catálogo se deduplican',
  products.includes("runSingleFlight('products:all'") && read('js/firestore-read-cache.js').includes('const flights = new Map()'),
  'Dos módulos no deben iniciar la misma consulta en paralelo.'
);
check(
  'Producto consulta solo su documento antes de relacionados',
  /getDoc\(doc\(db, 'products', id\)\)/.test(products) && /limit\(12\)/.test(products),
  'Abrir una ficha no debe descargar la colección completa.'
);
check(
  'Páginas sin catálogo no cargan productos automáticamente',
  /(?:index\|catalogo\|collections)/.test(products) &&
    /return Array\.isArray\(window\.PRODUCTS\)/.test(products),
  'Perfil, login, contacto, legales y checkout deben quedar en cero lecturas de productos.'
);
check(
  'La búsqueda solicita productos únicamente al usarse',
  products.includes("['btn-search', 'tabbar-search']") &&
    products.includes('ensureProductsForSearch') &&
    products.includes("control.addEventListener('click', load, { once: true })"),
  'La lupa no debe forzar el catálogo hasta abrirse.'
);
check(
  'Colecciones públicas no mantienen listener',
  collections.includes('getDocs') && collections.includes('loadCollections') && collections.includes('CACHE_TTL'),
  'Las colecciones públicas deben ser lectura cacheada.'
);
check(
  'Tiempo real de colecciones queda limitado al Admin',
  collections.includes('startAdminListener') && collections.includes('adminSubscribers') && collections.includes('onSnapshot'),
  'El CRUD administrativo debe seguir recibiendo cambios en vivo.'
);
check(
  'Menú Tienda carga colecciones por demanda fuera del catálogo',
  navCollections.includes('attachDemandLoading') &&
    navCollections.includes("['btn-tienda', 'btn-mobile-tienda', 'tabbar-tienda', 'btn-menu']"),
  'Contacto, perfil y legales no deben consultar colecciones si el menú no se abre.'
);
check(
  'Mantenimiento se carga por página',
  pageLoader.includes('loadPageMaintenance') &&
    !collections.includes("import './catalog-maintenance.js") &&
    !collections.includes("import './product-maintenance.js"),
  'Un store compartido no debe ejecutar todos los módulos de todas las páginas.'
);
check(
  'Clientas no leen rolePermissions/main',
  editBadge.includes('if (!EDITABLE_ROLES.includes(role)) return false;') &&
    !editBadge.includes('loadRolePermissions(true)'),
  'Solo roles administrativos deben consultar la matriz de permisos.'
);
check(
  'Checkout bloquea clics repetidos tras resource-exhausted',
  quotaGuard.includes('resource-exhausted') &&
    quotaGuard.includes('COOLDOWN_MS') &&
    quotaGuard.includes('stopImmediatePropagation'),
  'Un 429 no debe generar intentos manuales consecutivos.'
);
check(
  'La protección de cuota se carga solo en Checkout',
  pageLoader.includes("load('checkout-quota-guard.js')") &&
    pageLoader.indexOf("load('checkout-quota-guard.js')") < pageLoader.indexOf("if (/\\/login"),
  'El guard no debe descargarse en otras páginas.'
);
check(
  'La caché persistente de Firestore sigue desactivada',
  firebase.includes('getFirestore(app)') &&
    !firebase.includes('persistentLocalCache') &&
    !firebase.includes('enableIndexedDbPersistence'),
  'No debe volver la caché IndexedDB que dejaba el loader bloqueado en navegadores restrictivos.'
);
check(
  'Existe contador diagnóstico de lecturas',
  read('js/firestore-read-cache.js').includes('recordFirestoreRead') &&
    read('js/firestore-read-cache.js').includes('TintinReadBudget'),
  'Debe poder auditarse qué fuente produjo lecturas del lado cliente.'
);

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
