'use strict';

// Auditoría estática del sistema de notificaciones push (Web Push / FCM).
// No envía ninguna notificación: la prueba real se hace con el botón del
// panel después de desplegar.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const GSTATIC_ORIGIN_MARKER = ['https:', '', 'www.gstatic.com'].join('/');
const FCM_V1_MARKER = ['https:', '', 'fcm.googleapis.com', 'v1', 'projects'].join('/') + '/';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const headers = read('_headers');
const routes = read('_routes.json');
const adminHtml = read('admin.html');
const adminManifest = JSON.parse(read('admin-manifest.json'));
const publicManifest = JSON.parse(read('manifest.json'));
const serviceWorker = read('firebase-messaging-sw.js');
const pushCore = read('cloudflare/nucleo-push.js');
const pushService = read('cloudflare/servicio-push.js');
const clientModule = read('js/admin/notifications/notificaciones-push.js');
const masterModule = read('js/admin/notifications/notificaciones-push-maestro.js');
const deepLink = read('js/admin/notifications/enlace-pedido-push.js');
const appsScript = read('apps-script/CrearPedido.gs');
const orderEmail = read('functions/api/order-email.js');
const firestoreRules = read('firestore.rules');
const envExample = read('.env.example');
const gitignore = read('.gitignore');

const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    return;
  }
  failures.push(label);
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n== Aplicación instalable del panel ==');
check('Existe admin-manifest.json', exists('admin-manifest.json'));
check('La aplicación se llama Tintin Pedidos', adminManifest.name === 'Tintin Pedidos');
check('El nombre corto es Tintin', adminManifest.short_name === 'Tintin');
check('start_url abre el panel', String(adminManifest.start_url || '').startsWith('/admin.html'));
check('Tiene id propio y distinto del de la tienda', Boolean(adminManifest.id) && adminManifest.id !== publicManifest.id);
check('display standalone', adminManifest.display === 'standalone');
check('Idioma es-PY', adminManifest.lang === 'es-PY');
check('Colores de marca', adminManifest.theme_color === publicManifest.theme_color);
check('Íconos 192 y 512', ['192x192', '512x512'].every(size => adminManifest.icons.some(icon => icon.sizes === size)));
check('Orientación compatible con celular y tablet', adminManifest.orientation === 'any');
check('admin.html enlaza el manifiesto administrativo', /<link[^>]+rel="manifest"[^>]+admin-manifest\.json/.test(adminHtml));
check('admin.html no usa el manifiesto público', !/<link[^>]+rel="manifest"[^>]+["/ ]manifest\.json/.test(adminHtml));
check('Metadatos de instalación en iPhone', adminHtml.includes('apple-mobile-web-app-capable') && adminHtml.includes('apple-mobile-web-app-title'));
check('La tienda pública conserva su manifiesto', ['/','/index.html'].includes(publicManifest.start_url) && publicManifest.name.includes('Tintin'));

console.log('\n== Service worker ==');
check('firebase-messaging-sw.js está en la raíz', exists('firebase-messaging-sw.js'));
check('Usa Firebase 10.12.0', serviceWorker.includes('firebasejs/10.12.0/firebase-app-compat.js') && serviceWorker.includes('firebasejs/10.12.0/firebase-messaging-compat.js'));
check('Usa la configuración pública del proyecto', serviceWorker.includes("projectId: 'tintin-accesorios'") && serviceWorker.includes("messagingSenderId: '207918562502'"));
check('Maneja mensajes en segundo plano', serviceWorker.includes('onBackgroundMessage'));
check('Maneja el clic de la notificación', serviceWorker.includes("addEventListener('notificationclick'"));
check('Reutiliza una ventana abierta antes de abrir otra', serviceWorker.includes('matchAll') && serviceWorker.includes('openWindow'));
check('Sólo abre URLs internas del panel', serviceWorker.includes('safeInternalLink') && serviceWorker.includes('self.location.origin') && serviceWorker.includes('DEFAULT_LINK'));
check('Usa tag estable contra avisos duplicados', serviceWorker.includes('tag'));
check('Tiene control de versión y actualización', serviceWorker.includes('TINTIN_SW_VERSION') && serviceWorker.includes('skipWaiting') && serviceWorker.includes('clients.claim'));
check('No incluye credenciales de servidor', !/private_key|SERVICE_ACCOUNT|WEBHOOK_SECRET/i.test(serviceWorker));

console.log('\n== Cabeceras y rutas ==');
const swHeaderBlock = headers.split('/firebase-messaging-sw.js')[1] || '';
check('Regla no-cache para el service worker', swHeaderBlock.includes('no-cache, no-store, must-revalidate'));
check('La regla del service worker va después de la genérica /*.js', headers.indexOf('/firebase-messaging-sw.js') > headers.indexOf('/*.js'));
check('Regla para admin-manifest.json', headers.includes('/admin-manifest.json'));
check('La CSP existente se conserva', /frame-ancestors '(?:none|self)'/.test(headers) && headers.includes('upgrade-insecure-requests'));
check('La CSP ya permite gstatic y googleapis', (headers.includes(GSTATIC_ORIGIN_MARKER) || headers.includes('https://*.gstatic.com')) && headers.includes('https://*.googleapis.com'));
for (const route of ['/api/push-config', '/api/push-subscription', '/api/push-test', '/api/push-order-event', '/api/push-admin']) {
  check(`Ruta declarada: ${route}`, routes.includes(`"${route}"`));
}

console.log('\n== Funciones de Cloudflare ==');
for (const file of ['push-config.js', 'push-subscription.js', 'push-test.js', 'push-order-event.js', 'push-admin.js']) {
  check(`Existe functions/api/${file}`, exists(`functions/api/${file}`));
}
check('El envío usa la API HTTP v1 de FCM', pushService.includes(FCM_V1_MARKER));
check('No se usa la API heredada de FCM', !pushService.includes('fcm/send') && !/legacy|server_key|serverKey/i.test(pushService));
check('El token OAuth se reutiliza mientras siga vigente', read('cloudflare/firebase-admin-ligero.js').includes('accessTokenCache'));
check('Scopes mínimos (messaging + datastore)', pushService.includes('auth/firebase.messaging') && pushService.includes('auth/datastore'));
check('La cuenta de servicio sale de una variable de Cloudflare', read('cloudflare/firebase-admin-ligero.js').includes('FIREBASE_SERVICE_ACCOUNT_JSON'));
check('No se agregó firebase-admin como dependencia', !JSON.parse(read('package.json')).devDependencies['firebase-admin']);
check('Un documento por dispositivo', pushService.includes('PUSH_DEVICES_COLLECTION') && pushService.includes('deviceDocumentId'));
check('Los tokens inválidos se desactivan con motivo y fecha', pushService.includes('disabledReason') && pushService.includes('disabledAt'));
check('Idempotencia por evento', pushService.includes('claimEvent') && pushService.includes('createDocumentIfAbsent') && pushCore.includes('eventDocumentId'));
check('Estados de evento previstos', ['processing', 'sent', 'partial', 'failed', 'no_devices'].every(state => pushService.includes(`'${state}'`)));
check('Dispatcher reutilizable documentado', pushService.includes('export async function dispatchOrderPushEvent'));
check('El interruptor TINTIN_PUSH_ENABLED se respeta', pushService.includes('TINTIN_PUSH_ENABLED'));

console.log('\n== Fuente confiable del evento ==');
check('El webhook verifica firma HMAC en tiempo constante', pushCore.includes('constantTimeEqual') && pushCore.includes('HMAC'));
check('El webhook rechaza timestamps vencidos', pushCore.includes('WEBHOOK_MAX_SKEW_MS'));
check('El pedido se relee desde Firestore', read('functions/api/push-order-event.js').includes('dispatchOrderPushEvent') && pushService.includes('readOrder'));
check('Apps Script avisa después del commit', appsScript.lastIndexOf('phase4NotifyOrderCreated_(orderId)') > appsScript.indexOf('var commit = phase4Commit_'));
check('Apps Script lee las propiedades del script', appsScript.includes('TINTIN_PUSH_WEBHOOK_URL') && appsScript.includes('PropertiesService.getScriptProperties'));
check('Apps Script no declara el secreto en el archivo', !/TINTIN_PUSH_WEBHOOK_SECRET\s*=\s*['"][^'"]+['"]/.test(appsScript));
check('Apps Script reintenta como máximo tres veces', appsScript.includes('PHASE4_PUSH_MAX_ATTEMPTS_ = 3') && appsScript.includes('muteHttpExceptions: true'));
check('La rama created:false también reintenta el aviso', /created: false/.test(appsScript) && appsScript.split('created: false')[0].includes('phase4NotifyOrderCreated_'));
check('El correo actúa como respaldo con el mismo eventId', orderEmail.includes('order.created:${orderId}') && orderEmail.includes('dispatchOrderPushEvent'));
check('El reenvío manual de correo no vuelve a notificar', orderEmail.includes('!isResend && pushEnabled(env)'));
check('El push no rompe el correo', orderEmail.includes(".catch(() => ({ ok: false, error: 'push_failed' }))"));

console.log('\n== Panel administrativo ==');
check('Existe el módulo del cliente', exists('js/admin/notifications/notificaciones-push.js'));
check('admin.html carga el módulo', adminHtml.includes('js/admin/notifications/notificaciones-push.js'));
check('admin.html carga el enlace directo al pedido', adminHtml.includes('js/admin/notifications/enlace-pedido-push.js'));
check('La tarjeta se llama Notificaciones de pedidos', adminHtml.includes('Notificaciones de pedidos'));
check('Están los tres controles pedidos', ['btn-push-enable', 'btn-push-test', 'btn-push-disable'].every(id => adminHtml.includes(id)));
check('Hay campo para nombrar el dispositivo', adminHtml.includes('push-device-label'));
check('Se muestra la fecha del último registro', adminHtml.includes('push-last-register'));
check('Se aclara que no se ven datos privados en la pantalla bloqueada', adminHtml.includes('pantalla bloqueada'));
check('La tarjeta arranca oculta hasta confirmar Super Admin', /id="push-card"[^>]*display:none/.test(adminHtml));
check('Existe el centro maestro de push', exists('js/admin/notifications/notificaciones-push-maestro.js') && adminHtml.includes('id="push-master-card"'));
check('El centro maestro carga sus controles', ['push-master-enabled', 'push-master-sound', 'btn-push-master-save', 'btn-push-master-revoke-all', 'push-master-devices'].every(id => adminHtml.includes(id)));
check('El centro maestro exige Super Admin', masterModule.includes('SUPER_ADMIN') && masterModule.includes("user?.email === SUPER_ADMIN") && masterModule.includes("apiUrl('push-admin')"));
check('Permite revocar un dispositivo o todos', masterModule.includes("action: 'revoke'") && masterModule.includes("action: 'revoke-all'"));
check('Permite pausar el despacho global', masterModule.includes("action: 'save-settings'") && pushService.includes('paused_by_superadmin'));
check('Expone sonido configurable con limitación de foreground', masterModule.includes('TintinPushPlayForegroundSound') && masterModule.includes('foregroundSoundUrl'));
check('El módulo la muestra sólo al Super Admin', clientModule.includes('SUPER_ADMIN') && clientModule.includes("user?.email === SUPER_ADMIN"));
check('Todos los estados visibles están definidos', ['No configuradas', 'Listas para activar', 'Activas en este dispositivo', 'Permiso bloqueado', 'Navegador no compatible', 'Instalación requerida en iPhone', 'Error de configuración'].every(label => clientModule.includes(label)));
check('Comprueba isSupported() antes de ofrecer nada', clientModule.includes('isSupported()'));
check('Registra el service worker con alcance raíz', clientModule.includes("register(SW_PATH, { scope: '/' })"));
check('No inicializa una segunda aplicación Firebase', clientModule.includes('getApp()') && !clientModule.includes('initializeApp('));
check('Pide permiso sólo desde el botón', clientModule.includes('Notification.requestPermission()') && clientModule.split('Notification.requestPermission()').length === 2);
check('Mensaje específico para iPhone sin instalar', clientModule.includes('tocá Compartir y elegí Agregar a inicio'));
check('No escribe el token en Firestore desde el navegador', !/setDoc|updateDoc|addDoc/.test(clientModule));
check('No imprime el token en consola', !/console\.(log|info|warn|error)\([^)]*token/i.test(clientModule));
check('Maneja mensajes en primer plano', clientModule.includes('onMessage'));
check('Usa la API de Badging sin volverla obligatoria', clientModule.includes("'setAppBadge' in navigator"));
check('Genera un identificador local estable del dispositivo', clientModule.includes('DEVICE_ID_KEY'));
check('El deep link abre la sección Pedidos', deepLink.includes('openOrderEdit') && pushCore.includes('/admin.html?section=pedidos'));
check('El deep link conserva el destino si falta la sesión', deepLink.includes('sessionStorage') && deepLink.includes('PENDING_KEY'));
check('El deep link no espera para siempre', deepLink.includes('MAX_POLLS'));
check('El panel expone sólo lectura de estado de pedidos', read('js/admin/admin-app.js').includes('window.TintinAdminOrders'));

console.log('\n== Privacidad y secretos ==');
const publicSurfaces = ['admin.html', 'firebase-messaging-sw.js', 'admin-manifest.json',
  'js/admin/notifications/notificaciones-push.js', 'js/admin/notifications/notificaciones-push-maestro.js', 'js/admin/notifications/enlace-pedido-push.js']
  .map(read).join('\n');
check('Ningún secreto de push en archivos públicos', !/FIREBASE_SERVICE_ACCOUNT|TINTIN_PUSH_WEBHOOK_SECRET|private_key/i.test(publicSurfaces));
check('La clave VAPID no está pegada en el código', !/FIREBASE_WEB_PUSH_VAPID_KEY\s*=\s*['"][A-Za-z0-9_-]{20,}/.test(publicSurfaces + pushCore + pushService));
check('El payload no incluye campos de PII', ['userName', 'userPhone', 'userEmail', 'referencia', 'mapLocation', 'notes'].every(field => !pushCore.includes(`order?.${field}`) && !pushCore.includes(`order.${field}`)));
check('.env.example documenta las cuatro variables', ['FIREBASE_WEB_PUSH_VAPID_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'TINTIN_PUSH_WEBHOOK_SECRET', 'TINTIN_PUSH_ENABLED'].every(name => envExample.includes(`${name}=`)));
check('.env.example no tiene valores reales', !/FIREBASE_SERVICE_ACCOUNT_JSON=.+/.test(envExample) && !/FIREBASE_WEB_PUSH_VAPID_KEY=.+/.test(envExample));
check('.gitignore ignora .env, .dev.vars y cuentas de servicio', ['.env', '.env.*', '.dev.vars', '.dev.vars.*', '*service-account*.json'].every(pattern => gitignore.includes(pattern)));
check('.gitignore no ignora .env.example', gitignore.includes('!.env.example'));
check('Las reglas niegan el acceso directo a las colecciones de push', firestoreRules.includes('match /adminPushDevices/{deviceId}') && firestoreRules.includes('match /pushEvents/{eventId}') && firestoreRules.includes('match /pushSettings/{settingId}'));
check('La regla general de denegación sigue al final', firestoreRules.trimEnd().endsWith('}') && firestoreRules.includes('match /{document=**}'));
check('No se usa eval en el código nuevo', ![pushCore, pushService, clientModule, deepLink, serviceWorker].some(source => /\beval\s*\(/.test(source)));

console.log('\n== Documentación ==');
check('Existe docs/configuracion-push-web-firebase.md', exists('docs/configuracion-push-web-firebase.md'));
if (exists('docs/configuracion-push-web-firebase.md')) {
  const doc = read('docs/configuracion-push-web-firebase.md');
  check('Documenta Firebase, Cloudflare, Apps Script y el celular', ['Firebase', 'Cloudflare', 'Apps Script', 'iPhone', 'Android'].every(section => doc.includes(section)));
  check('Incluye solución de problemas', doc.includes('Solución de problemas'));
  check('Incluye la matriz de pruebas manuales', doc.includes('Pruebas manuales'));
  check('Aclara que la clave VAPID es pública', doc.toLowerCase().includes('vapid') && doc.includes('pública'));
}

console.log('');
if (failures.length) {
  console.error(`❌ Auditoría Web Push: ${failures.length} verificación(es) fallida(s).`);
  failures.forEach(item => console.error(`   · ${item}`));
  process.exit(1);
}
console.log('✅ Auditoría Web Push: todas las verificaciones pasaron.\n');
