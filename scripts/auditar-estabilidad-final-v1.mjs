import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const has = (source, pattern) => typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);

const publicEntry = read('js/components/navigation/entrada-navegacion-publica.js');
const stability = read('js/quality/estabilidad-final-publica.js');
const productStability = read('js/quality/estabilidad-producto.js');
const orderProfileState = read('js/pages/profile/estado-pedidos-perfil.js');
const product = read('product.html');
const cart = read('js/components/cart/sincronizacion-carrito.js');
const rules = read('firestore.rules');
const adminLoader = read('js/admin/users/gestion-usuarios-admin.js');
const adminProfile = read('js/admin/users/perfil-usuario-superadmin.js');
const adminFicha = read('js/admin/users/ficha-usuario-admin.js');
const avatarApi = read('functions/api/profile-avatar-upload.js');
const socialBackend = read('cloudflare/participacion-clientes.js');
const socialApi = read('functions/api/engagement.js');
const notificationApi = read('functions/api/notifications.js');
const notifications = read('cloudflare/notificaciones-sociales.js');
const pushService = read('cloudflare/servicio-push.js');
const sheetsSync = read('cloudflare/sincronizacion-participacion-sheets.js');
const appsScript = read('apps-script/Participacion.gs');
const systemHealthApi = read('functions/api/system-health.js');
const systemHealth = read('cloudflare/system-health.js');

// 1. Producto: contenido visible y sin acordeón obligatorio, sin observer recursivo.
ok(has(publicEntry, "estabilidad-producto.js?v=tintin-20260831-product-stability-2"), 'Producto no carga su estabilización acotada y segura.');
ok(has(publicEntry, "estabilidad-final-publica.js?v=tintin-20260829-final-stability-1"), 'El shell público no conserva la estabilización final para las demás superficies.');
ok(has(productStability, "document.body.dataset.ttProductStable"), 'Producto no activa el contrato estable.');
ok(has(productStability, "setDataIfChanged(specsBlock, 'collapsed', 'false')"), 'Características no se fuerzan abiertas de forma idempotente.');
ok(has(productStability, "setDataIfChanged(related, 'collapsed', 'false')"), 'Otros productos no se fuerzan abiertos de forma idempotente.');
ok(has(productStability, "document.getElementById('product-reviews')"), 'La comunidad no está incluida en la apertura permanente.');
ok(has(productStability, 'white-space:nowrap!important'), 'Los CTA de productos relacionados no protegen palabras completas.');
ok(!has(productStability, 'new MutationObserver(openAll)'), 'Producto volvió a conectar un MutationObserver directamente a la función que reescribe sus atributos.');
ok(!has(productStability, "attributeFilter: ['hidden', 'data-collapsed', 'style']"), 'Producto volvió a observar style mientras normaliza estilos, lo que puede bloquear el renderer.');
ok(has(productStability, 'records.some(needsNormalization)') && has(productStability, 'queueMicrotask'), 'El observer de Producto no filtra ni agrupa mutaciones antes de normalizar.');
ok(has(product, 'class="tt-related-section" data-collapsed="false"'), 'La fuente HTML de relacionados no parte abierta.');

// 2. Header mobile: jerarquía inequívoca halo -> indicador -> botón -> badge.
ok(has(productStability, '.tt-mobile-nav-halo{z-index:0!important'), 'El halo móvil de Producto no está fijado detrás de los iconos.');
ok(has(productStability, '.tt-mobile-nav-indicator{z-index:1!important'), 'El indicador móvil de Producto no tiene nivel independiente.');
ok(has(productStability, '.tt-tabbar-btn{position:relative!important;z-index:2!important'), 'Los botones móviles de Producto no están por encima de las capas decorativas.');
ok(has(productStability, '.tt-notification-badge,#tt-tabbar .tt-cart-badge{z-index:5!important'), 'Los badges móviles de Producto pueden quedar detrás de capas decorativas.');

// 3. Notificaciones / push: usa el núcleo social canónico actual, sin capa histórica paralela.
ok(has(notificationApi, 'notificaciones-sociales.js') && has(notificationApi, 'notifyUserIfAbsent') && has(notificationApi, 'markAllNotificationsRead'), 'La API de notificaciones no delega al núcleo social canónico.');
ok(has(notifications, /export\s+async\s+function\s+notifyUserIfAbsent|notifyUserIfAbsent/) && has(notifications, /notifyAdminIfAbsent/) && has(notifications, /markAllNotificationsRead/), 'El núcleo social no conserva destinatarios y lectura de notificaciones.');
ok(has(socialApi, 'dispatchSocialPushEvent') && has(pushService, /pushEnabled|dispatchSocialPushEvent/), 'Engagement no conserva el puente Web Push server-side.');

// 4. Sheets / Apps Script: sincronización server-to-server y diagnóstico operativo.
ok(has(sheetsSync, /SHEETS_ENGAGEMENT_SECRET|secret/i), 'La sincronización social con Sheets no conserva secreto servidor-a-servidor.');
ok(has(appsScript, /secret|SHEETS/i), 'Apps Script no conserva frontera de confianza por secreto.');
ok(has(systemHealthApi, 'runSystemHealth'), 'La API de diagnóstico no delega en la autoridad operativa canónica.');
ok(has(systemHealth, /SHEETS_ENGAGEMENT_SECRET/) && has(systemHealth, /probeAppsScript/) && has(systemHealth, /appsScript:\s*sheets/), 'Estado del ecosistema no comprueba de forma canónica Sheets/Apps Script.');

// 5. Carrito: múltiples líneas y autoridad única sincronizada.
ok(has(cart, 'MAX_CART_LINES = 100'), 'El carrito no admite un conjunto real de múltiples líneas.');
ok(has(cart, /lineIdFor\(/), 'El carrito no identifica líneas por producto/variante.');
ok(has(cart, /normalizeCart\(items\)/), 'El carrito no normaliza múltiples artículos.');
ok(has(cart, /users\/\{uid\}\/cart|users\/\$\{uid\}/) || has(cart, "collection(db, 'users'"), 'El carrito no conserva sincronización por cuenta.');
ok(has(rules, 'function cartItemValid'), 'Firestore no conserva validación server-side del carrito.');

// 6. Super Admin: ficha integral reutilizando autoridad canónica.
ok(has(adminLoader, 'perfil-usuario-superadmin.js?v=tintin-20260829-final-stability-1'), 'Usuarios no carga la ficha integral nueva.');
ok(!has(adminProfile, /onSnapshot\s*\(/), 'La ficha integral crea un listener paralelo de users.');
ok(!has(adminProfile, /setDoc\s*\(|updateDoc\s*\(|deleteDoc\s*\(/), 'La ficha integral crea mutaciones paralelas a admin-app.js.');
ok(has(adminProfile, 'Ir a gestión del usuario'), 'La ficha integral no devuelve a la gestión canónica CRUD.');
ok(has(adminFicha, "field('@username'"), 'La ficha Super Admin no muestra username.');
ok(has(adminFicha, "section(`Pedidos"), 'La ficha Super Admin no integra pedidos.');
ok(has(adminFicha, "section('Auditoría reciente')"), 'La ficha Super Admin no integra auditoría.');

// Perfil cliente completo y foto segura.
ok(has(stability, "{ id: 'resumen', label: 'Resumen'"), 'Perfil no tiene pestaña Resumen.');
ok(has(stability, "{ id: 'datos', label: 'Mis datos'"), 'Perfil no tiene pestaña Mis datos.');
ok(has(stability, "{ id: 'pedidos', label: 'Pedidos'"), 'Perfil no tiene pestaña Pedidos.');
ok(has(stability, "{ id: 'favoritos', label: 'Favoritos'"), 'Perfil no tiene pestaña Favoritos.');
ok(has(stability, "{ id: 'cuenta', label: 'Cuenta y seguridad'"), 'Perfil no tiene pestaña Cuenta y seguridad.');
ok(has(stability, "estado-pedidos-perfil.js?v=tintin-20260829-final-stability-1"), 'Perfil no carga el estado canónico de pedidos no vistos.');
ok(has(orderProfileState, 'tt_profile_orders_seen_v1_') && has(orderProfileState, 'numericCount() - seenCount()'), 'El badge de Pedidos no representa pedidos nuevos/no vistos.');
ok(has(orderProfileState, '[data-profile-tab="pedidos"]') && has(orderProfileState, 'localStorage.setItem'), 'Abrir Pedidos no marca el contador como visto.');
ok(has(stability, '/api/profile-avatar-upload'), 'Perfil no integra subida de foto.');
ok(has(stability, /photoURL,\s*updatedAt:/), 'Perfil no persiste la foto con el campo canónico photoURL.');
ok(has(avatarApi, 'requireFirebaseUser'), 'La subida de avatar no exige sesión Firebase.');
ok(has(avatarApi, '5 * 1024 * 1024'), 'La subida de avatar no limita tamaño.');
ok(has(avatarApi, "['image/jpeg', 'image/png', 'image/webp']"), 'La subida de avatar no limita formatos.');
ok(!has(avatarApi, 'requireSuperAdmin'), 'La subida de avatar depende indebidamente del Super Admin.');

// Social v4 debe permanecer conectado: no se permite regresión mientras se estabiliza UI.
ok(has(socialBackend, /REVIEW_RATE|RATE_LIMIT|30 \* 60|30\s*\*\s*60/i), 'Social v4 perdió el límite/cooldown de reseñas.');
ok(has(socialBackend, /replyLike|likeReply|REPLY_LIKE/i), 'Social v4 perdió likes de respuestas.');
ok(has(socialBackend, /alreadySelected|alreadyLiked|selected:\s*true/i), 'Social v4 perdió semántica idempotente/permanente de likes.');

if (failures.length) {
  console.error('\nAUDITORÍA ESTABILIDAD FINAL V1: FALLÓ');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log('AUDITORÍA ESTABILIDAD FINAL V1: OK');
console.log('Cobertura: Producto estable sin observer recursivo · header móvil · notificaciones/push · Sheets · carrito multi-línea · Super Admin · perfil cliente · pedidos no vistos · avatar seguro · Social v4.');
