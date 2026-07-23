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

function sizeKB(file) {
  try {
    return Math.round(fs.statSync(path.join(root, file)).size / 1024);
  } catch {
    return 0;
  }
}

const failures = [];
const warnings = [];

function check(name, condition, problem) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} — ${name}`);
  if (!condition) {
    console.log(`       ${problem}`);
    failures.push(name);
  }
}

function budget(name, condition, detail) {
  console.log(`${condition ? 'OK  ' : 'WARN'} — ${name}`);
  if (!condition) {
    console.log(`       ${detail}`);
    warnings.push(name);
  }
}

const publicPages = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html',
  'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'
];

const productsStore = read('js/products-store.js');
const collectionsStore = read('js/collections-store.js');
const readCache = read('js/firestore-read-cache.js');

check(
  'Tipografía sin FOIT',
  !/font-display:\s*block/.test(read('css/montserrat.css')),
  'Montserrat no debe usar font-display:block.'
);

check(
  'El loader tiene salida garantizada',
  /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/page-loader.js')) &&
    /RELEASE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/color-scheme-instant.js')),
  'Los loaders deben tener tiempo máximo de espera.'
);

check(
  'El catálogo público no mantiene un listener sobre toda la colección',
  !productsStore.includes('onSnapshot') &&
    productsStore.includes('loadAllProducts') &&
    productsStore.includes('loadProductPage') &&
    productsStore.includes('readCached') &&
    productsStore.includes('runSingleFlight'),
  'Productos debe usar lectura bajo demanda, caché TTL y una sola solicitud concurrente.'
);

check(
  'Producto lee el documento solicitado y limita relacionados',
  /getDoc\(doc\(db, 'products', id\)\)/.test(productsStore) &&
    /where\('category', '==', product\.category\)/.test(productsStore) &&
    /limit\(12\)/.test(productsStore),
  'La ficha no debe descargar el catálogo completo.'
);

check(
  'Colecciones públicas usan caché y la suscripción en vivo queda reservada al Admin',
  collectionsStore.includes('loadCollections') &&
    collectionsStore.includes('readCached') &&
    collectionsStore.includes('startAdminListener') &&
    collectionsStore.includes('onSnapshot') &&
    collectionsStore.includes('adminSubscribers'),
  'El menú público no debe abrir un listener permanente; el Admin sí puede mantenerlo.'
);

check(
  'Existe caché compartida con TTL y single-flight',
  readCache.includes('readCached') &&
    readCache.includes('writeCached') &&
    readCache.includes('runSingleFlight') &&
    readCache.includes('recordFirestoreRead'),
  'Las lecturas repetidas entre módulos deben compartir caché y solicitud.'
);

check(
  'Los listeners de pedidos y usuarios del panel tienen límite',
  /onSnapshot\(query\(collection\(db, 'orders'\), limit\(/.test(read('js/admin-app.js')) &&
    /onSnapshot\(query\(collection\(db, 'users'\), limit\(/.test(read('js/admin-app.js')),
  'Los listados administrativos deben estar acotados.'
);

check(
  'Los timers del dashboard se limpian',
  read('js/admin-app.js').includes('clearInterval(dashboardActivityClock)') &&
    read('js/admin-app.js').includes('clearInterval(dashboardPresenceRestart)'),
  'Los temporizadores no deben acumularse al cambiar de sección.'
);

check(
  'El heartbeat se detiene al ocultar o cerrar la pestaña',
  read('js/site-activity.js').includes('clearInterval(heartbeatTimer)') &&
    read('js/site-activity.js').includes("addEventListener('pagehide'"),
  'La actividad no debe seguir ejecutándose después de cerrar la página.'
);

check(
  'Las imágenes usan decoding async y lazy salvo prioridad',
  read('js/image-performance.js').includes("image.decoding = 'async'") &&
    read('js/image-performance.js').includes("image.loading = priority ? 'eager' : 'lazy'"),
  'Las imágenes fuera de pantalla deben diferirse.'
);

const adminOnPublic = publicPages.filter(page => exists(page) && read(page).includes('admin-app.js'));
check(
  'El bundle Admin no se carga en páginas públicas',
  adminOnPublic.length === 0,
  `Páginas afectadas: ${adminOnPublic.join(', ')}`
);

check(
  'Cloudinary tiene preconnect y dns-prefetch',
  read('js/page-loader.js').includes("preconnect.href = 'https://res.cloudinary.com'") &&
    read('js/page-loader.js').includes("dnsPrefetch.rel = 'dns-prefetch'"),
  'La conexión al CDN debe adelantarse.'
);

check(
  'Las respuestas obsoletas de estadísticas están protegidas',
  read('js/admin-app.js').includes('statisticsTrafficLoadToken'),
  'Una respuesta antigua no debe pisar datos nuevos.'
);

const firebaseInitializers = [...fs.readdirSync(path.join(root, 'js')).map(file => `js/${file}`), ...publicPages]
  .filter(file => file.endsWith('.js') || file.endsWith('.html'))
  .filter(file => exists(file) && (/initializeApp\s*\(/.test(read(file)) || /apiKey:\s*["']/.test(read(file))));
check(
  'Firebase se inicializa en una sola fuente',
  firebaseInitializers.length === 1 && firebaseInitializers[0] === 'js/firebase.js',
  `Inicializadores encontrados: ${firebaseInitializers.join(', ')}`
);

const allowedBlocking = ['js/color-scheme-instant.js', 'js/page-loader.js'];
const blockingOffenders = [];
publicPages.forEach(page => {
  if (!exists(page)) return;
  const head = read(page).split(/<\/head>/i)[0] || '';
  [...head.matchAll(/<script\b([^>]*)\ssrc="([^"]+?)(?:\?[^"]*)?"([^>]*)>/g)].forEach(match => {
    const attributes = match[1] + match[3];
    const source = match[2];
    if (!/type="module"/.test(attributes) && !/\bdefer\b|\basync\b/.test(attributes) && !allowedBlocking.includes(source)) {
      blockingOffenders.push(`${page}:${source}`);
    }
  });
});
check(
  'Solo scripts imprescindibles bloquean el head público',
  blockingOffenders.length === 0,
  `Scripts bloqueantes: ${blockingOffenders.join(', ')}`
);

// A stylesheet can appear once as a preload and once as the real stylesheet.
// Browsers reuse that same response, so count each identical URL only once.
const homeCssUrls = new Set(
  [...read('index.html').matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)]
    .map(match => match[1])
    .filter(file => !/^https?:/.test(file))
);
const homeCssKB = [...homeCssUrls]
  .reduce((sum, url) => sum + sizeKB(url.split(/[?#]/)[0]), 0);
budget('Presupuesto CSS del inicio', homeCssKB <= 260, `${homeCssKB} KB sin comprimir.`);

const homeJsKB = [...read('index.html').matchAll(/src="([^"]+\.js)(?:\?[^"]*)?"/g)]
  .map(match => match[1]).filter(file => !/^https?:/.test(file)).reduce((sum, file) => sum + sizeKB(file), 0);
budget('Presupuesto JS directo del inicio', homeJsKB <= 260, `${homeJsKB} KB sin comprimir.`);

const nonLatinPreloads = [...read('index.html').matchAll(/rel="preload"[^>]*href="([^"]*\.woff2)"/g)]
  .map(match => match[1]).filter(file => /(cyrillic|vietnamese|latin-ext)/.test(file));
budget('Solo se precarga Montserrat latino', nonLatinPreloads.length === 0, nonLatinPreloads.join(', '));

console.log(`\nAdvertencias: ${warnings.length} | Fallos críticos: ${failures.length}`);
if (failures.length) process.exit(1);
console.log('\nAuditoría de rendimiento y sincronización completada.');
