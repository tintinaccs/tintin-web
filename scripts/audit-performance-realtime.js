'use strict';

/* =============================================================
   TINTIN — Auditoría de Rendimiento y Sincronización en tiempo real

   Auditoría ESTÁTICA (sin navegador) que fija invariantes de rendimiento y de
   tiempo real ya conquistadas en mantenimientos previos, para que no regresen.
   Separa FALLOS CRÍTICOS (regresiones duras → salida 1) de ADVERTENCIAS
   (presupuestos con tolerancia → no rompen CI), tal como se pidió.

   Limitación declarada: en este entorno el navegador headless no alcanza la red
   externa (proxy) y la app depende de Firebase/gstatic, por lo que las métricas
   de laboratorio (FCP/LCP/INP/CLS) NO se miden aquí. Las pruebas Playwright de
   tests/performance/ quedan listas para ejecutarse donde haya un navegador con
   red. Ver maintenance/12-rendimiento-velocidad-sincronizacion.txt.
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
function sizeKB(rel) { try { return Math.round(fs.statSync(path.join(root, rel)).size / 1024); } catch { return 0; } }

const fails = [];
const warns = [];
function check(name, condition, problem) {
  if (condition) { console.log(`OK   — ${name}`); }
  else { console.log(`FAIL — ${name}\n       ${problem}`); fails.push(name); }
}
function budget(name, condition, detail) {
  if (condition) { console.log(`OK   — ${name}`); }
  else { console.log(`WARN — ${name}\n       ${detail}`); warns.push(name); }
}

const PUBLIC_PAGES = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html',
  'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'
];

// ===========================================================================
// FALLOS CRÍTICOS — regresiones de rendimiento / tiempo real
// ===========================================================================

// 1) Tipografía sin FOIT (texto invisible durante la carga).
check(
  'Tipografía sin FOIT: ningún @font-face usa font-display: block',
  !/font-display:\s*block/.test(read('css/montserrat.css')),
  'font-display: block deja el texto invisible hasta 3 s en conexiones lentas. Usar swap/optional.'
);

// 2) El loader SIEMPRE tiene una salida (timeout de emergencia), nunca infinito.
check(
  'El loader tiene salida garantizada (timeout de emergencia)',
  /STORE_GATE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/page-loader.js')) &&
    /RELEASE_TIMEOUT_MS\s*=\s*\d{3,}/.test(read('js/color-scheme-instant.js')),
  'Sin un timeout máximo el loader podría quedar girando para siempre si una consulta no responde.'
);

// 3) Stores públicos en tiempo real: onSnapshot con límite (no live sin tope).
check(
  'El catálogo y las colecciones se sincronizan en vivo con límite (onSnapshot + limit)',
  /onSnapshot\(query\(collection\(db, 'products'\), limit\(/.test(read('js/products-store.js')) &&
    /onSnapshot\(/.test(read('js/collections-store.js')) &&
    /limit\(/.test(read('js/collections-store.js')),
  'Los datos del catálogo deben llegar en tiempo real pero con un tope de seguridad de documentos.'
);

// 4) Listeners pesados del panel con límite.
check(
  'Los listeners de pedidos y usuarios del panel tienen límite',
  /onSnapshot\(query\(collection\(db, 'orders'\), limit\(/.test(read('js/admin-app.js')) &&
    /onSnapshot\(query\(collection\(db, 'users'\), limit\(/.test(read('js/admin-app.js')),
  'Un onSnapshot sin límite sobre colecciones grandes puede transferir un volumen peligroso.'
);

// 5) Timers de tiempo real que se limpian (no fugas de memoria).
check(
  'Los timers del dashboard se limpian al detener las métricas',
  read('js/admin-app.js').includes('clearInterval(dashboardActivityClock)') &&
    read('js/admin-app.js').includes('clearInterval(dashboardPresenceRestart)'),
  'Los setInterval del dashboard deben cancelarse para no acumularse al cambiar de sección.'
);
check(
  'El heartbeat de analítica se detiene al ocultar/cerrar la pestaña',
  read('js/site-activity.js').includes('clearInterval(heartbeatTimer)') &&
    read('js/site-activity.js').includes("addEventListener('pagehide'"),
  'El heartbeat de presencia no debe seguir corriendo con la pestaña oculta o cerrada.'
);

// 6) Estrategia global de imágenes (lazy + async) para no bloquear el hilo.
check(
  'Estrategia global de imágenes: decoding async + lazy salvo prioritarias',
  read('js/image-performance.js').includes("image.decoding = 'async'") &&
    read('js/image-performance.js').includes("image.loading = priority ? 'eager' : 'lazy'"),
  'Las imágenes fuera de pantalla deben diferirse; solo las críticas van con prioridad.'
);

// 7) El bundle pesado del Super Admin NO se carga en páginas públicas.
const adminOnPublic = PUBLIC_PAGES.filter(p => exists(p) && read(p).includes('admin-app.js'));
check(
  'El bundle del Super Admin no se descarga en páginas públicas',
  adminOnPublic.length === 0,
  `Estas páginas públicas cargarían admin-app.js sin necesidad: ${adminOnPublic.join(', ')}`
);

// 8) Preconnect/dns-prefetch a Cloudinary (imágenes) desde el arranque.
check(
  'Preconnect + dns-prefetch a Cloudinary desde page-loader',
  read('js/page-loader.js').includes("preconnect.href = 'https://res.cloudinary.com'") &&
    read('js/page-loader.js').includes("dnsPrefetch.rel = 'dns-prefetch'"),
  'Adelantar la conexión al CDN de imágenes acelera la primera imagen visible.'
);

// 9) Guardia anti-respuesta-obsoleta (una respuesta vieja no pisa datos nuevos).
check(
  'Guardia de respuestas obsoletas en la carga de tráfico de estadísticas',
  read('js/admin-app.js').includes('statisticsTrafficLoadToken'),
  'Sin un token de carga, una respuesta lenta anterior podría sobrescribir datos más nuevos.'
);

// 10) Firebase de una sola fuente (una sola conexión, sin listeners paralelos por config).
const fbInit = [...fs.readdirSync(path.join(root, 'js')).map(f => `js/${f}`), ...PUBLIC_PAGES]
  .filter(f => f.endsWith('.js') || f.endsWith('.html'))
  .filter(f => exists(f) && (/initializeApp\s*\(/.test(read(f)) || /apiKey:\s*["']/.test(read(f))));
check(
  'Firebase se inicializa en una sola fuente (una conexión compartida)',
  fbInit.length === 1 && fbInit[0] === 'js/firebase.js',
  `initializeApp debe estar solo en js/firebase.js. Encontrado en: ${fbInit.join(', ')}`
);

// 11) En <head> de páginas públicas solo los scripts imprescindibles corren sin defer.
const ALLOWED_BLOCKING = ['js/color-scheme-instant.js', 'js/page-loader.js'];
const blockingOffenders = [];
PUBLIC_PAGES.forEach(p => {
  if (!exists(p)) return;
  const head = read(p).split(/<\/head>/i)[0] || '';
  [...head.matchAll(/<script\b([^>]*)\ssrc="([^"]+?)(?:\?[^"]*)?"([^>]*)>/g)].forEach(m => {
    const attrs = m[1] + m[3];
    const src = m[2];
    const isModule = /type="module"/.test(attrs);
    const isDefer = /\bdefer\b/.test(attrs) || /\basync\b/.test(attrs);
    if (!isModule && !isDefer && !ALLOWED_BLOCKING.includes(src)) {
      blockingOffenders.push(`${p}:${src}`);
    }
  });
});
check(
  'En <head> público solo corren sin defer los scripts imprescindibles',
  blockingOffenders.length === 0,
  `Scripts bloqueantes no permitidos en <head>: ${blockingOffenders.join(', ')}`
);

// ===========================================================================
// ADVERTENCIAS — presupuestos con tolerancia (no rompen CI)
// ===========================================================================

// Presupuesto de CSS local del home (raw). ~50% menos comprimido.
const homeCssKB = [...read('index.html').matchAll(/href="([^"]+\.css)(?:\?[^"]*)?"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f)).reduce((s, f) => s + sizeKB(f), 0);
budget(
  `Presupuesto CSS del home (raw ${homeCssKB} KB ≤ 260 KB)`,
  homeCssKB <= 260,
  `El CSS local del home suma ${homeCssKB} KB sin comprimir; revisar hojas repetidas si crece.`
);

// Presupuesto de JS directo del home (raw).
const homeJsKB = [...read('index.html').matchAll(/src="([^"]+\.js)(?:\?[^"]*)?"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f)).reduce((s, f) => s + sizeKB(f), 0);
budget(
  `Presupuesto JS directo del home (raw ${homeJsKB} KB ≤ 260 KB)`,
  homeJsKB <= 260,
  `El JS referenciado directo por el home suma ${homeJsKB} KB sin comprimir.`
);

// Solo se precarga el subconjunto latino de la fuente (no cyrillic/vietnamese).
const nonLatinPreload = [...read('index.html').matchAll(/rel="preload"[^>]*href="([^"]*\.woff2)"/g)]
  .map(m => m[1]).filter(f => /(cyrillic|vietnamese|latin-ext)/.test(f));
budget(
  'Solo se precarga el subconjunto latino de Montserrat',
  nonLatinPreload.length === 0,
  `Se precargan subconjuntos no usados por contenido en español: ${nonLatinPreload.join(', ')}`
);

// Listener duplicado de settings/general en una misma página (advertencia).
const dupGeneral = PUBLIC_PAGES.filter(p => exists(p) &&
  (read(p).match(/onSnapshot\(doc\(db, 'settings', 'general'\)/g) || []).length >= 1 &&
  /js\/whatsapp\.js/.test(read(p)));
budget(
  'Sin doble listener a settings/general en la misma página',
  dupGeneral.length === 0,
  `Además de whatsapp.js (contacto), estas páginas abren otro listener propio a settings/general: ${dupGeneral.join(', ')}. Es 1 lectura extra; se puede unificar en el futuro.`
);

// ---------------------------------------------------------------------------
console.log('');
console.log(`Advertencias: ${warns.length} | Fallos críticos: ${fails.length}`);
if (fails.length) {
  console.error(`\nAuditoría de rendimiento/tiempo real: ${fails.length} fallo(s) crítico(s).`);
  process.exit(1);
}
console.log('\nAuditoría de rendimiento y tiempo real completada (sin fallos críticos).');
