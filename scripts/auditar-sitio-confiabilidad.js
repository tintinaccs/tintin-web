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

const loader = read('js/cargador-pagina.js');
const solidSurfaces = read('css/theme/superficies-solidas-interfaz.css');
const parity = read('css/theme/paridad-segura-tintin.css');
const accountFix = read('js/components/navigation/compartido/compatibilidad-cuenta-movil.js');
const activity = read('js/analytics/actividad-sitio.js');
const functionOrigin = read('js/core/firebase/origen-funciones.js');
const privacyConsent = read('js/analytics/consentimiento-privacidad.js');
const analytics = read('js/analytics/analitica.js');
const geoFunction = read('functions/api/visitor-geo.js');
const rules = read('firestore.rules');
const admin = `${read('admin.html')}\n${read('js/admin/admin-app.js')}`;
const welcomeAdmin = read('js/admin/content/control-bienvenida-admin.js');
const welcomeConfig = read('js/components/welcome/configuracion-bienvenida.js');
const welcomeRuntime = read('js/components/welcome/tutorial-bienvenida.js');
// La creación del perfil vive en js/core/store/perfil-usuario.js, compartida entre el
// login con Google y el de código por correo; login.html sólo la invoca. Las
// comprobaciones del alta miran los dos archivos como una sola unidad.
const login = `${read('login.html')}\n${read('js/core/store/perfil-usuario.js')}`;
const profile = read('perfil.html');
const privacy = read('privacidad.html');
const styles = read('styles.css');
const theme = read('css/core/tema-unificado-tintin.css');
const main = read('tienda.js');
const scrollReveal = read('js/quality/revelado-desplazamiento-global.js');
const imagePerformance = read('js/components/images/rendimiento-imagenes.js');
const home = read('index.html');
const publicShell = read('js/inicio-navegacion-publica.js');
const surfaceController = read('js/components/navigation/compatibilidad/inicio-control-paneles.js');
const contentSchema = read('js/core/store/esquema-contenido.js');
const siteContent = read('js/core/store/contenido-sitio.js');
const productsStore = read('js/core/store/estado-productos.js');
const phase7CatalogPolicy = read('js/pages/catalog/politica-visibilidad-catalogo.js');
const catalog = read('catalogo.html');
const loadImagesInit = read('js/components/images/inicio-carga-imagenes.js');
const collectionsPhase4 = read('js/pages/collections/presentacion-colecciones.js');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check('El menú de cuenta arranca también en el runtime público',
  loader.includes('bootHeaderAccountFix();'));
check('La capa visual oculta el panel según el contenedor y permite abrirlo',
  parity.includes('#account-dropdown:not(.open):not(.tt-account-open)>.tt-account-panel') &&
  !parity.includes('.tt-account-panel:not(.open):not(.tt-account-open)'));
check('El click de cuenta no se duplica con el manejador antiguo',
  accountFix.includes('stopImmediatePropagation()'));
check('Los dropdowns del header son blancos en desktop, tablet y mobile',
  solidSurfaces.indexOf('html body .tt-dropdown,') >= 0 &&
  solidSurfaces.indexOf('html body .tt-dropdown,') < solidSurfaces.indexOf('@media (min-width: 769px)') &&
  [
    'html body .tt-search-panel,',
    'html body .tt-search-results,',
    'html body .tt-account-panel,',
    'html body .tt-cart-drawer,',
    'html body .tt-collections-sheet,',
    'html body .tt-mobile-menu,',
    'html body .tt-mobile-menu-header,',
    'html body .tt-mobile-nav,',
    'html body .tt-mobile-cats,',
    'html body .tt-mobile-cats-grid,',
    'html body .tt-mobile-user {'
  ].every(selector => solidSurfaces.includes(selector)) &&
  /html body \.tt-dropdown,[\s\S]*?background:\s*#FFFFFF\s*!important;[\s\S]*?background-color:\s*#FFFFFF\s*!important;/.test(solidSurfaces));

// Antes, css/theme/fondo-solido-cargador.css traía estas dos hojas con @import y
// acá se comprobaba su cadena de versión. Los @import encadenados bloqueaban
// el render en serie, así que ahora van como <link> en cada página. Se
// verifica lo que de verdad garantiza el fondo blanco: que toda página que
// carga el loader cargue también las superficies sólidas, y ANTES que él,
// para conservar el orden de cascada que tenía el @import.
check('Las superficies sólidas del header se cargan antes del loader en cada página',
  htmlFiles
    .map(name => ({ name, source: read(name) }))
    .filter(page => page.source.includes('css/theme/fondo-solido-cargador.css'))
    .every(({ source }) => {
      const loaderAt = source.indexOf('css/theme/fondo-solido-cargador.css');
      const surfacesAt = source.indexOf('css/theme/superficies-solidas-interfaz.css');
      const headerAt = source.indexOf('css/components/navigation/movil/fondos-solidos-movil.css');
      return surfacesAt !== -1 && headerAt !== -1 && surfacesAt < loaderAt && headerAt < loaderAt;
    }));

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
  /width\s*:\s*min\(400px,\s*calc\(100vw\s*-\s*36px\)\)/.test(styles) &&
  !/\.tt-privacy-consent\s*\{[^}]*\binset\s*:\s*0/i.test(styles));
check('La actividad propia y Google Analytics esperan el permiso opcional',
  activity.includes("from './consentimiento-privacidad.js?v=tintin-20260716-cloudinary-fix-1'") &&
  activity.includes('if (hasConsent() && analyticsWritable) startActivity()') &&
  analytics.includes("from './consentimiento-privacidad.js?v=tintin-20260716-cloudinary-fix-1'") &&
  analytics.includes('!isTrackablePage() || !hasStatisticsConsent()') &&
  analytics.includes("analytics_storage: 'denied'"));
check('La ubicación aproximada se obtiene sin guardar IP ni coordenadas',
  geoFunction.includes('const cf = request.cf || {}') &&
  geoFunction.includes("source: countryCode || cf.city ? 'cloudflare'") &&
  !/\b(?:ip|latitude|longitude|postalCode|asn)\s*:/.test(geoFunction) &&
  !rules.includes("'ip'") && !rules.includes("'latitude'") && !rules.includes("'longitude'"));
check('GitHub Pages usa el servicio geográfico de Cloudflare',
  activity.includes("import { apiUrl } from '../core/firebase/origen-funciones.js") &&
  activity.includes('function geoEndpoint() {\n    return apiUrl(') &&
  functionOrigin.includes("CLOUDFLARE_FALLBACK_ORIGIN = 'https://tintinaccesorios.pages.dev'") &&
  functionOrigin.includes("hostname.endsWith('github.io')") &&
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
  admin.includes("adminOrdersUnsubscribe = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ADMIN_REALTIME_LIMIT))") &&
  admin.includes("adminUsersUnsubscribe = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(ADMIN_REALTIME_LIMIT))") &&
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
  welcomeConfig.includes("export const WELCOME_VERSION = 'home-welcome-v5-media'") &&
  welcomeRuntime.includes("from './configuracion-bienvenida.js?v=tintin-20260812-welcome-media-1'") &&
  welcomeAdmin.includes("from '../../components/welcome/configuracion-bienvenida.js?v=tintin-20260812-welcome-media-1'") &&
  !fs.existsSync(path.join(root, 'js', 'onboarding.js')) &&
  !fs.existsSync(path.join(root, 'js', 'welcome-tutorial-init.js')) &&
  !profile.includes('./js/onboarding.js'));
check('Super Admin puede probar y reactivar la bienvenida en lotes seguros',
  welcomeRuntime.includes('config.previewEnabled') &&
  welcomeAdmin.includes('resetWelcomeForClients()') &&
  welcomeAdmin.includes('offset += 450') &&
  welcomeAdmin.includes("String(user.email || '').toLowerCase() !== SUPER_ADMIN"));
check('Las reglas aceptan solo geografía aproximada y campos conocidos',
  rules.includes('activityGeoIsValid(data)') &&
  rules.includes("'city', 'region', 'country', 'countryCode', 'geoSource'"));

check('El rosa principal cumple contraste AA sobre blanco',
  theme.includes('--tt-accent:var(--color-brand-primary)') &&
  theme.includes('--tt-accent-hover:var(--color-brand-primary-hover)') &&
  read('css/core/tokens-color.css').includes('--color-brand-primary: #AD3F67') &&
  read('css/core/tokens-color.css').includes('--color-brand-primary-hover: #8B2642'));
check('Los renderers principales escapan texto almacenado',
  main.includes('function escapeHtml(value)') &&
  admin.includes('function escapeHtmlAdmin(value)'));
check('El reveal se repite al volver al viewport, es liviano y procesa solo nodos agregados',
  scrollReveal.includes('function hideForRepeat(element)') &&
  scrollReveal.includes('else hideForRepeat(entry.target)') &&
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
check('El loader de la portada espera a que la foto del hero cargue antes de ocultarse',
  home.includes('function heroReady()') &&
  home.includes("return !media.classList.contains('tt-hero-pending');") &&
  home.includes('function waitForHeroImageThenRelease()') &&
  home.includes('HERO_WAIT_CEILING_MS = 4500'));
check('El loader pasa de un punto a otro sin un cross-fade visible',
  loader.includes("transition:opacity .01s linear,visibility .01s linear") &&
  !loader.includes('.38s ease'));
check('La colección Bolsos conserva su portada real después de sincronizar',
  collectionsPhase4.includes("const SLUG_FILE_MAP = { bolsos: 'bags' }") &&
  collectionsPhase4.includes('col-${file}.webp') &&
  collectionsPhase4.includes('label.textContent = (clean(collection.name) || clean(collection.slug)).toUpperCase()'));
check('Buscador, carrito, menú y colecciones comunican apertura y cierre',
  publicShell.includes('id="search-panel" role="dialog"') &&
  publicShell.includes('id="cart-drawer" role="dialog"') &&
  publicShell.includes('id="collections-sheet" role="dialog"') &&
  publicShell.includes('id="tt-tablet-menu" role="dialog"') &&
  surfaceController.includes("config.element.setAttribute('aria-hidden', 'false')") &&
  surfaceController.includes("config.element.setAttribute('aria-hidden', 'true')") &&
  main.includes("register('search'") &&
  main.includes("register('cart'") &&
  main.includes("register('mobile-shop'") &&
  main.includes("register('tablet-menu'"));
check('Las recargas asíncronas conservan agotados visibles y bloquean su compra',
  productsStore.includes('window.TintinCatalogPolicy?.isCatalogVisible') &&
  phase7CatalogPolicy.includes('export function isCatalogVisible') &&
  phase7CatalogPolicy.includes('export function isPurchasable') &&
  phase7CatalogPolicy.includes('return isCatalogVisible(p) && (p.stock == null || p.stock > 0)') &&
  phase7CatalogPolicy.includes('p.active !== false') &&
  catalog.includes("inStock ? 'Disponible' : 'Agotado'") &&
  catalog.includes('disabled aria-disabled="true">Agotado</button>') &&
  productsStore.includes('featuredProducts.slice(0, 5)') &&
  loadImagesInit.includes('featuredProducts.slice(0, 5)') &&
  main.includes('window.isFeaturable = isFeaturable'));

const forbiddenTerms = [
  [99, 104, 97, 116, 103, 112, 116],
  [111, 112, 101, 110, 97, 105],
  [99, 111, 100, 101, 120],
  [103, 101, 109, 105, 110, 105],
  [99, 108, 97, 117, 100, 101],
  [99, 111, 112, 105, 108, 111, 116]
].map(characters => String.fromCharCode(...characters));
const forbiddenPhrase = [
  105, 110, 116, 101, 108, 105, 103, 101, 110, 99, 105, 97, 92, 115, 43,
  97, 114, 116, 105, 102, 105, 99, 105, 97, 108
].map(character => String.fromCharCode(character)).join('');
const forbiddenAuthorship = new RegExp(`\\b(?:${forbiddenTerms.join('|')})\\b|${forbiddenPhrase}|(?:generad[oa]|cread[oa]|asistid[oa])\\s+(?:por|con)\\s+(?:una\\s+)?ia\\b`, 'i');
const technicalProviderFiles = new Set([
  '.env.example',
  'diagnostic-manifest.json'
]);
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    // Este control protege el producto publicado, no la documentación ni las
    // herramientas de ingeniería. AGENTS.md, skills y workflows deben poder
    // nombrar proveedores explícitamente para configurar y auditar su uso.
    if (entry.isDirectory() && entry.name === 'vendor') return [];
    if (dir === root && ['.git', 'node_modules', '.github', '.claude', '.codex', '.cloudflare-functions', 'artifacts', 'docs', 'public', 'scripts', 'test-results', 'tests'].includes(entry.name)) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (!/\.(?:html|css|js|mjs|md|json|rules)$/i.test(entry.name)) return [];
    if (absolute === __filename || (dir === root && entry.name === 'AGENTS.md')) return [];
    const repositoryPath = path.relative(root, absolute).replaceAll('\\', '/');
    if (technicalProviderFiles.has(repositoryPath)) return [];
    return [absolute];
  });
}
const forbiddenAuthorshipFiles = sourceFiles(root)
  .filter(file => forbiddenAuthorship.test(fs.readFileSync(file, 'utf8')))
  .map(file => path.relative(root, file).replaceAll('\\', '/'));
check('El repositorio no contiene marcas explícitas de autoría externa', forbiddenAuthorshipFiles.length === 0);
if (forbiddenAuthorshipFiles.length) {
  console.error(`Archivos con marcas externas: ${forbiddenAuthorshipFiles.join(', ')}`);
}

const staleVersions = [];
for (const file of htmlFiles.concat(['tienda.js', 'js/cargador-pagina.js'])) {
  if (/tintin-20260715-(?:[2-9]|1[01])(?!\d)/.test(read(file))) staleVersions.push(file);
}
check('Los recursos críticos usan la versión vigente de caché',
  staleVersions.length === 0 && loader.includes("const TT_CACHE_VERSION = 'tintin-20260830-store-gate-api-2'"));

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
