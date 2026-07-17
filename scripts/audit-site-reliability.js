#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];

function check(label, ok) {
  console.log(`${ok ? 'OK' : 'FALTA'} — ${label}`);
  if (!ok) failures.push(label);
}

const loader = read('js/page-loader.js');
const parity = read('css/tintin-parity-safe.css');
const accountFix = read('js/header-account-mobile-fix.js');
const activity = read('js/site-activity.js');
const privacyConsent = read('js/privacy-consent.js');
const analytics = read('js/analytics.js');
const geoFunction = read('functions/api/visitor-geo.js');
const rules = read('firestore.rules');
const admin = `${read('admin.html')}\n${read('js/admin-app.js')}`;
const welcomeAdmin = read('js/admin-welcome-control.js');
const welcomeConfig = read('js/welcome-config.js');
const welcomeRuntime = read('js/welcome-tutorial-runtime.js');
const login = read('login.html');
const profile = read('perfil.html');
const privacy = read('privacidad.html');
const styles = read('styles.css');
const theme = read('css/tintin-unified-theme.css');
const main = read('script.js');
const scrollReveal = read('js/scroll-reveal-global.js');
const imagePerformance = read('js/image-performance.js');
const home = read('index.html');
const publicShell = read('js/public-shell.js');
const contentSchema = read('js/content-schema.js');
const siteContent = read('js/site-content.js');
const productsStore = read('js/products-store.js');
const loadImagesInit = read('js/load-images-init.js');
const collectionsPhase4 = read('js/collections-phase4.js');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check('El menú de cuenta arranca también en el runtime público',
  loader.includes('bootHeaderAccountFix();'));
check('La capa visual oculta el panel según el contenedor y permite abrirlo',
  parity.includes('#account-dropdown:not(.open):not(.tt-account-open)>.tt-account-panel') &&
  !parity.includes('.tt-account-panel:not(.open):not(.tt-account-open)'));
check('El click de cuenta no se duplica con el manejador antiguo',
  accountFix.includes('stopImmediatePropagation()'));

check('La actividad cuenta una sola sesión por pestaña y día',
  activity.includes('SESSION_RECORDED_PREFIX') &&
  activity.includes('storageSet(window.sessionStorage, recordedKey, sessionId)'));
check('La presencia usa latidos espaciados y solo mientras la página es visible',
  activity.includes('const HEARTBEAT_MS = 60000') && activity.includes("document.visibilityState === 'hidden'"));
check('Cookies y estadísticas comparten una sola elección revocable',
  privacyConsent.includes("const COOKIE_NAME = 'tt_privacy_choice'") &&
  privacyConsent.includes("const LEGACY_CONSENT_KEY = 'tt_activity_consent_v1'") &&
  privacyConsent.includes('export function openPrivacyPreferences()') &&
  privacy.includes('id="tt-open-privacy-settings"'));
check('La tarjeta de privacidad no bloquea ni cubre toda la página',
  styles.includes('.tt-privacy-consent') &&
  styles.includes('width: min(430px, calc(100vw - 36px))') &&
  !/\.tt-privacy-consent\s*\{[^}]*\binset\s*:\s*0/i.test(styles));
check('La actividad propia y Google Analytics esperan el permiso opcional',
  activity.includes("from './privacy-consent.js?v=tintin-20260716-cloudinary-fix-1'") &&
  activity.includes('if (hasConsent() && analyticsWritable) startActivity()') &&
  analytics.includes("from './privacy-consent.js?v=tintin-20260716-cloudinary-fix-1'") &&
  analytics.includes('if (!hasStatisticsConsent()) return;') &&
  analytics.includes("analytics_storage: 'denied'"));
check('La ubicación aproximada se obtiene sin guardar IP ni coordenadas',
  geoFunction.includes('const cf = request.cf || {}') &&
  geoFunction.includes("source: countryCode || cf.city ? 'cloudflare'") &&
  !/\b(?:ip|latitude|longitude|postalCode|asn)\s*:/.test(geoFunction) &&
  !rules.includes("'ip'") && !rules.includes("'latitude'") && !rules.includes("'longitude'"));
check('GitHub Pages usa el servicio geográfico de Cloudflare',
  activity.includes("const GEO_SERVICE_URL = 'https://tintinaccesorios.pages.dev/api/visitor-geo'") &&
  activity.includes("return '/api/visitor-geo';") &&
  activity.includes("hostname.endsWith('github.io')") &&
  !activity.includes('/.netlify/functions/'));
check('Los previews de Cloudflare no escriben estadísticas',
  activity.includes("const cloudflarePreview = /\\.tintinaccesorios\\.pages\\.dev$/i.test(hostname)") &&
  activity.includes('!netlifyPreview && !cloudflarePreview'));
check('Las reglas limitan la escritura de sesiones y presencia',
  rules.includes('presenceIsValid(visitorId)') &&
  rules.includes('trafficSessionIsValid(dateKey, sessionId)') &&
  rules.includes('allow update: if false;'));
check('Solamente Super Admin puede leer las métricas',
  /match \/sitePresence\/\{visitorId\}[\s\S]*?allow read, delete: if isSuperAdmin\(\)/.test(rules) &&
  /match \/siteTraffic\/\{dateKey\}\/sessions\/\{sessionId\}[\s\S]*?allow read, delete: if isSuperAdmin\(\)/.test(rules));
check('El dashboard muestra sesiones de hoy y personas en línea',
  admin.includes('id="stat-visits-today"') &&
  admin.includes('id="stat-online-now"') &&
  admin.includes('id="dashboard-online-locations"') &&
  admin.includes('id="dashboard-today-locations"'));
check('El dashboard recibe sesiones y presencia en tiempo real',
  admin.includes('dashboardSessionUnsubscribe = onSnapshot') &&
  admin.includes('dashboardPresenceUnsubscribe = onSnapshot'));
check('El centro estadístico general está reservado a Super Admin',
  admin.includes('id="section-estadisticas"') &&
  admin.includes("target === 'estadisticas' && currentRole !== 'superadmin'") &&
  admin.includes('id="statistics-revenue-trend"') &&
  admin.includes('id="statistics-visit-locations"'));
check('Pedidos, usuarios, auditoría y correos se actualizan sin F5',
  admin.includes("adminOrdersUnsubscribe = onSnapshot(query(collection(db, 'orders'), limit(10000))") &&
  admin.includes("adminUsersUnsubscribe = onSnapshot(query(collection(db, 'users'), limit(10000))") &&
  admin.includes('_auditUnsubscribe = onSnapshot(') &&
  admin.includes('function startCorreosRealtimeListeners()'));
check('Las estadísticas combinan pedidos, usuarios, catálogo, visitas y páginas',
  admin.includes('function renderGeneralStatistics()') &&
  admin.includes('statistics-top-products') &&
  admin.includes('statistics-order-locations') &&
  admin.includes('statistics-entry-pages') &&
  admin.includes('statistics-live-pages'));
check('La primera sesión de una clienta llega a inicio con bienvenida pendiente',
  login.includes('explicitLoginInProgress = true') &&
  login.includes("'index.html?welcome=1'") &&
  login.includes('welcomeTutorialPending: welcomePending') &&
  welcomeRuntime.includes('data?.welcomeTutorialPending === true'));
check('Bienvenida pública y Super Admin usan una sola configuración',
  welcomeConfig.includes("export const WELCOME_VERSION = 'home-welcome-v4-unified'") &&
  welcomeRuntime.includes("from './welcome-config.js?v=tintin-20260716-cloudinary-fix-1'") &&
  welcomeAdmin.includes("from './welcome-config.js?v=tintin-20260716-cloudinary-fix-1'") &&
  !fs.existsSync(path.join(root, 'js', 'onboarding.js')) &&
  !fs.existsSync(path.join(root, 'js', 'welcome-tutorial-init.js')) &&
  !profile.includes('./js/onboarding.js'));
check('Super Admin puede probar y reactivar la bienvenida en lotes seguros',
  welcomeRuntime.includes('config.previewEnabled') &&
  welcomeAdmin.includes('resetWelcomeForClients()') &&
  welcomeAdmin.includes('offset += 450') &&
  welcomeAdmin.includes('user.email !== SUPER_ADMIN'));
check('Las reglas aceptan solo geografía aproximada y campos conocidos',
  rules.includes('activityGeoIsValid(data)') &&
  rules.includes("'city', 'region', 'country', 'countryCode', 'geoSource'"));

check('El rosa principal cumple contraste AA sobre blanco',
  theme.includes('--tt-accent:var(--color-brand-primary)') &&
  theme.includes('--tt-accent-hover:var(--color-brand-primary-hover)') &&
  read('css/color-tokens.css').includes('--color-brand-primary: #AD3F67') &&
  read('css/color-tokens.css').includes('--color-brand-primary-hover: #8B2642'));
check('Los renderers principales escapan texto almacenado',
  main.includes('function escapeHtml(value)') &&
  admin.includes('function escapeHtmlAdmin(value)'));
check('El reveal es irreversible, liviano y procesa solo nodos agregados',
  scrollReveal.includes('observer?.unobserve(element)') &&
  scrollReveal.includes("element.classList.add('tt-visible')") &&
  scrollReveal.includes('scheduleScan(node)') &&
  !scrollReveal.includes('filter:blur'));
check('Las imágenes dinámicas reciben carga diferida y prioridad automática',
  imagePerformance.includes("image.loading = priority ? 'eager' : 'lazy'") &&
  imagePerformance.includes("image.decoding = 'async'") &&
  loader.includes('bootImagePerformance();'));
check('Todas las páginas declaran el tipo de sus botones estáticos',
  htmlFiles.every(file => !/<button\b(?![^>]*\btype\s*=)[^>]*>/i.test(
    read(file).replace(/<script\b[\s\S]*?<\/script>/gi, '')
  )));
check('Todos los controles de la barra móvil tienen nombre accesible',
  htmlFiles.every(file => {
    const html = read(file);
    return ['tabbar-tienda', 'tabbar-search', 'tabbar-cart', 'tabbar-cuenta']
      .every(id => !html.includes(`id="${id}"`) || new RegExp(`id="${id}"[^>]*aria-label=`).test(html));
  }));
check('La portada usa la forma correcta TU ESTILO incluso con contenido histórico',
  home.includes('TU ESTILO</h1>') &&
  !home.includes('TÚ ESTILO</h1>') &&
  contentSchema.includes("return text.replace(/\\bTÚ ESTILO\\b/g, 'TU ESTILO')") &&
  siteContent.includes('normalizeContentValue(pageId, sectionId, item.key, raw)'));
check('La colección Bolsos conserva su portada real después de sincronizar',
  collectionsPhase4.includes("const SLUG_FILE_MAP = { bolsos: 'bags' }") &&
  collectionsPhase4.includes('col-${file}.webp') &&
  collectionsPhase4.includes('label.textContent = (clean(collection.name) || clean(collection.slug)).toUpperCase()'));
check('Buscador, carrito, menú y colecciones comunican apertura y cierre',
  publicShell.includes('id="search-panel" role="search"') &&
  publicShell.includes('id="cart-drawer" role="dialog"') &&
  publicShell.includes('id="collections-sheet" role="dialog"') &&
  main.includes("drawer.setAttribute('aria-hidden', 'false')") &&
  main.includes("panel.setAttribute('aria-hidden', 'false')") &&
  main.includes("sheet.setAttribute('aria-hidden', 'false')") &&
  main.includes("menu.setAttribute('aria-hidden', 'false')"));
check('Las recargas asíncronas no reinsertan productos agotados o sin nombre',
  productsStore.includes('.filter(p => p.active !== false && Boolean(p.name))') &&
  productsStore.includes('featuredProducts.slice(0, 5)') &&
  loadImagesInit.includes('featuredProducts.slice(0, 5)') &&
  main.includes('window.isFeaturable = isFeaturable'));

const forbiddenAuthorship = /\b(?:chatgpt|openai|codex|gemini|claude|copilot)\b|inteligencia\s+artificial|(?:generad[oa]|cread[oa]|asistid[oa])\s+(?:por|con)\s+(?:una\s+)?ia\b/i;
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (!/\.(?:html|css|js|mjs|md|json|rules)$/i.test(entry.name)) return [];
    if (absolute === __filename) return [];
    return [absolute];
  });
}
check('El repositorio no contiene marcas explícitas de autoría automatizada',
  sourceFiles(root).every(file => !forbiddenAuthorship.test(fs.readFileSync(file, 'utf8'))));

const staleVersions = [];
for (const file of htmlFiles.concat(['script.js', 'js/page-loader.js'])) {
  if (/tintin-20260715-(?:[2-9]|1[01])(?!\d)/.test(read(file))) staleVersions.push(file);
}
check('Los recursos críticos usan una sola versión de caché',
  staleVersions.length === 0 && loader.includes("const TT_CACHE_VERSION = 'tintin-20260716-cloudinary-fix-1'"));

check(
  'El runtime público liviano carga imágenes, colecciones, carrito, colores y el fix de auditoría de página (no solo admin-images)',
  loader.includes('function bootImagesPhase5Public()') &&
    loader.includes('function bootCollectionsPhase4Public()') &&
    loader.includes('function bootCartSyncPublic()') &&
    loader.includes('function bootThemeColorSanitizerPublic()') &&
    loader.includes('function bootPageAuditFixPublic()') &&
    /function bootPublicRuntime\(\) \{[\s\S]*?bootImagesPhase5Public\(\);[\s\S]*?bootCollectionsPhase4Public\(\);[\s\S]*?bootCartSyncPublic\(\);[\s\S]*?bootThemeColorSanitizerPublic\(\);[\s\S]*?bootPageAuditFixPublic\(\);[\s\S]*?\n  \}/.test(loader)
);

if (failures.length) {
  console.error(`\nAuditoría de confiabilidad: ${failures.length} falla(s).`);
  process.exit(1);
}

console.log('\nAuditoría de confiabilidad completada correctamente.');
