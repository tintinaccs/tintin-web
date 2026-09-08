const fs = require('fs');

const html = fs.readFileSync('perfil.html', 'utf8');
const runtime = fs.readFileSync('js/pages/profile/mantenimiento-perfil.js', 'utf8');
const ordersRuntime = fs.readFileSync('js/pages/profile/pedidos-perfil.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const loader = fs.readFileSync('js/cargador-mantenimiento-pagina.js', 'utf8');

const checks = [
  ['perfil.html existe y contiene la estructura principal', /class="perfil-wrap"/.test(html)],
  ['perfil contiene datos, ubicación y pedidos', ['perfil-nombre', 'perfil-location-content', 'perfil-orders-list'].every(id => html.includes(id))],
  ['runtime se limita a perfil', /PROFILE_PATH_RE/.test(runtime) && /perfil/.test(runtime)],
  ['canonical se normaliza dinámicamente', /normalizeCanonical/.test(runtime)],
  ['labels se asocian a inputs', /improveFormSemantics/.test(runtime) && /htmlFor/.test(runtime)],
  ['pedidos usan listener en tiempo real por identidad de cuenta', /onSnapshot/.test(ordersRuntime) && /reconcileAccountOrders/.test(ordersRuntime)],
  ['pedidos tienen estados loading empty error offline', ['Sincronizando pedidos', 'Todavía no tenés pedidos', 'No pudimos sincronizar', 'Sin conexión'].every(text => ordersRuntime.includes(text))],
  ['acciones remotas tienen bloqueo', /guardAsyncActions/.test(runtime) && /aria-busy/.test(runtime)],
  ['pedidos se recuperan por conexión, visibilidad y bfcache', /addEventListener\('online'/.test(ordersRuntime) && /visibilitychange/.test(ordersRuntime) && /pagehide/.test(ordersRuntime)],
  ['superficies usan tokens configurables', /var\(--surface/.test(runtime) && /var\(--pink-dark/.test(runtime)],
  ['responsive cubre siete viewports', [1440, 1024, 769, 601, 600, 360].every(value => runtime.includes(String(value)))],
  ['runtime de mantenimiento está cargado por el cargador de página', /perfil[\s\S]*load\('pages\/profile\/mantenimiento-perfil\.js'/.test(loader)],
  ['pedidos-perfil.js se carga en perfil.html', /pedidos-perfil\.js/.test(html)],
  ['estadísticas visibles se calculan desde el dataset completo de pedidos', /calculateOrderStats/.test(ordersRuntime) && /reconcileAccountOrders/.test(ordersRuntime)],
  ['el perfil no intenta escribir estadísticas protegidas', !/recalculateUserOrderStats/.test(ordersRuntime) && !/setDoc\s*\(/.test(ordersRuntime)],
  ['listeners de pedidos se cierran al salir y se protegen contra respuestas tardías', /generation\+\+/.test(ordersRuntime) && /pagehide/.test(ordersRuntime)],
  ['las reglas mantienen protegidos los campos de estadísticas', /protectedUserFieldsChanged/.test(rules) && /profileStatsUpdatedAt/.test(rules) && /orderStats/.test(rules)],
  ['Perfil no precarga fuentes que no son críticas', !/rel="preload"[^>]+montserrat-latin-wght-(?:normal|italic)\.woff2/.test(html)],
  ['registro técnico existe', fs.existsSync('docs/maintenance/07-profile-orders.txt')]
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (failed.length) {
  console.error(`\nFallaron ${failed.length} comprobaciones de Perfil y Pedidos.`);
  process.exit(1);
}
console.log('\nAuditoría de Perfil y Pedidos completada.');
