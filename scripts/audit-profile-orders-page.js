const fs = require('fs');

const html = fs.readFileSync('perfil.html', 'utf8');
const runtime = fs.readFileSync('js/profile-maintenance.js', 'utf8');
const statsRuntime = fs.readFileSync('js/profile-order-stats-fix.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const store = fs.readFileSync('js/collections-store.js', 'utf8');

const checks = [
  ['perfil.html existe y contiene la estructura principal', /class="perfil-wrap"/.test(html)],
  ['perfil contiene datos, ubicación y pedidos', ['perfil-nombre', 'perfil-location-content', 'perfil-orders-list'].every(id => html.includes(id))],
  ['runtime se limita a perfil', /PROFILE_PATH_RE/.test(runtime) && /perfil/.test(runtime)],
  ['canonical se normaliza dinámicamente', /normalizeCanonical/.test(runtime)],
  ['labels se asocian a inputs', /improveFormSemantics/.test(runtime) && /htmlFor/.test(runtime)],
  ['pedidos usan listener en tiempo real', /onSnapshot/.test(runtime) && /where\('userId'/.test(runtime)],
  ['pedidos tienen estados loading empty error offline', ['Sincronizando pedidos', 'Todavía no tenés pedidos', 'No pudimos sincronizar', 'Sin conexión'].every(text => runtime.includes(text))],
  ['acciones remotas tienen bloqueo', /guardAsyncActions/.test(runtime) && /aria-busy/.test(runtime)],
  ['recuperación por conexión, visibilidad y bfcache', /addEventListener\('online'/.test(runtime) && /visibilitychange/.test(runtime) && /pageshow/.test(runtime)],
  ['superficies usan tokens configurables', /var\(--surface/.test(runtime) && /var\(--pink-dark/.test(runtime)],
  ['responsive cubre siete viewports', [1440, 1024, 769, 601, 600, 360].every(value => runtime.includes(String(value)))],
  ['runtime está cargado por el shell compartido', /profile-maintenance\.js/.test(store)],
  ['estadísticas visibles se calculan desde orders', /getOrdersForUserIdentity/.test(statsRuntime) && /calculateOrderStats/.test(statsRuntime)],
  ['el perfil no intenta escribir estadísticas protegidas', !/recalculateUserOrderStats/.test(statsRuntime) && !/setDoc\s*\(/.test(statsRuntime)],
  ['las reglas mantienen protegidos los campos de estadísticas', /protectedUserFieldsChanged/.test(rules) && /profileStatsUpdatedAt/.test(rules) && /orderStats/.test(rules)],
  ['Perfil no precarga fuentes que no son críticas', !/rel="preload"[^>]+montserrat-latin-wght-(?:normal|italic)\.woff2/.test(html)],
  ['registro técnico existe', fs.existsSync('docs/maintenance/07-profile-orders.txt')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (failed.length) {
  console.error(`\nFallaron ${failed.length} comprobaciones de Perfil y Pedidos.`);
  process.exit(1);
}
console.log('\nAuditoría de Perfil y Pedidos completada.');
