'use strict';

/* =============================================================
   TINTIN — Auditoría de Correos y Mensajes (Super Admin + checkout + público)

   El módulo de Correos ya tenía auditorías previas (audit-email-phase3.js cubre
   la seguridad del Apps Script legacy y el registro de intentos). Esta auditoría
   fija las invariantes de la CONSOLIDACIÓN en un solo canal real y del resto de
   mensajería, que faltaban blindar de punta a punta:

   - Canal ÚNICO para el correo de pedidos: Resend vía Cloudflare Functions
     (js/resend-order-notify.js → /api/order-email). El checkout ya NO importa el
     webhook viejo de Apps Script (js/email-notify.js) para el correo automático,
     así no conviven dos sistemas contradictorios para el mismo tipo de correo.
   - Sin API keys ni secretos en el frontend: la clave de Resend solo vive en el
     entorno del servidor (env.RESEND_API_KEY). El navegador manda idToken +
     orderId; el servidor re-lee el pedido real desde Firestore.
   - Permisos y remitente: reenvío solo Super Admin (servidor), remitente fijo
     pedidos@tintinaccs.com con reply-to a la casilla de la dueña, lista blanca de
     acciones y validación de propiedad del pedido.
   - Prueba por Resend con cooldown anti-doble-clic; promociones desactivadas
     hasta su migración independiente (un solo canal activo, sin contradicción).
   - Logs/auditoría: cada envío queda registrado con separación real/prueba;
     emailLogs es inmutable y protegido por reglas.
   - Mensajes / WhatsApp: número y texto configurables en vivo, codificación
     segura del texto (encodeURIComponent) y enlaces sociales no hardcodeados.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const checkout       = read('checkout.html');
const resendNotify   = read('js/resend-order-notify.js');
const appsNotify     = read('js/email-notify.js');
const bridge         = read('js/checkout-email-bridge.js');
const orderEmailFn   = read('functions/api/order-email.js');
const testEmailFn    = read('functions/api/test-email.js');
const adminSync      = read('js/admin-email-gate-sync.js');
const functionOrigin = read('js/function-origin.js');
const adminApp       = read('js/admin-app.js');
const whatsapp       = read('js/whatsapp.js');
const rules          = read('firestore.rules');

// ===========================================================================
// 1. CANAL ÚNICO DE CORREO DE PEDIDOS (Resend) — sin dos sistemas contradictorios
// ===========================================================================
check(
  'El checkout envía la notificación del pedido por Resend (canal único)',
  checkout.includes('import { sendOrderNotification } from "./js/resend-order-notify.js?v=tintin-20260717-resend-1"'),
  'checkout.html debe importar el canal Resend (resend-order-notify.js) para el correo del pedido.'
);
check(
  'El checkout ya NO usa el webhook viejo de Apps Script (email-notify.js)',
  !checkout.includes('email-notify.js'),
  'checkout.html no debe importar el canal Apps Script: convivirían dos sistemas para el mismo correo.'
);
check(
  'El correo del pedido se dispara una sola vez tras crear el pedido',
  (checkout.match(/sendOrderNotification\(/g) || []).length === 1 &&
    checkout.includes('addDoc(collection(db, \'orders\'), orderDoc)'),
  'Debe existir un único punto de envío del correo del pedido en el checkout (sin duplicar el disparo).'
);
check(
  'El canal Resend llama al endpoint de Cloudflare con Bearer token',
  // El origen (relativo en Cloudflare, pages.dev en GitHub Pages/Netlify) lo
  // resuelve js/function-origin.js — ver "El fallback de host..." abajo.
  resendNotify.includes("const ORDER_EMAIL_API = apiUrl('order-email')") &&
    resendNotify.includes('Authorization: `Bearer ${idToken}`') &&
    resendNotify.includes("action: isResend ? 'resendOrderEmail' : 'sendOrderEmail'"),
  'El navegador debe hablar con /api/order-email con la sesión real, no con un webhook con secreto.'
);
check(
  'El fallback de host para /api NO se reinventa por archivo (bug ya visto)',
  // Antes resend-order-notify.js y admin-email-gate-sync.js usaban rutas
  // relativas "/api/..." sin el fallback a Cloudflare que sí tenían
  // media-library.js y site-activity.js — eso daba 404 en GitHub Pages y el
  // correo de "pedido nuevo" fallaba en silencio. Ahora los cuatro llamadores
  // comparten la misma resolución de origen.
  resendNotify.includes("import { apiUrl } from './function-origin.js") &&
    adminSync.includes("import { apiUrl } from './function-origin.js") &&
    functionOrigin.includes("CLOUDFLARE_FALLBACK_ORIGIN = 'https://tintinaccesorios.pages.dev'") &&
    functionOrigin.includes("hostname.endsWith('github.io')"),
  'Toda ruta /api/* del cliente debe resolverse con js/function-origin.js, no con una constante relativa suelta.'
);
check(
  'El puente del checkout, si se carga, usa el MISMO canal Resend',
  bridge.includes("from './resend-order-notify.js?v=tintin-20260717-resend-1'") &&
    !bridge.includes('email-notify.js'),
  'El puente no debe introducir un segundo backend de correo distinto al del checkout.'
);

// ===========================================================================
// 2. SIN API KEYS NI SECRETOS EN EL FRONTEND
// ===========================================================================
function frontendFiles() {
  const list = [];
  const jsDir = path.join(root, 'js');
  fs.readdirSync(jsDir).forEach(name => {
    if (name.endsWith('.js')) list.push(`js/${name}`);
  });
  fs.readdirSync(root).forEach(name => {
    if (name.endsWith('.html')) list.push(name);
  });
  return list;
}
const resendKeyLike = /re_[0-9a-zA-Z]{20,}/;
const leakedFiles = frontendFiles().filter(file => {
  const content = read(file);
  return content.includes('RESEND_API_KEY') || resendKeyLike.test(content);
});
check(
  'Ningún archivo del frontend contiene la clave de Resend',
  leakedFiles.length === 0,
  `El secreto de Resend no debe aparecer en js/ ni en HTML público. Archivos sospechosos: ${leakedFiles.join(', ')}`
);
check(
  'La clave de Resend solo se lee del entorno del servidor',
  orderEmailFn.includes('env.RESEND_API_KEY') &&
    testEmailFn.includes('env.RESEND_API_KEY'),
  'Las Functions de Cloudflare deben leer la clave desde env, nunca embebida en el código.'
);
check(
  'El servidor re-lee el pedido real desde Firestore (no confía en el navegador)',
  orderEmailFn.includes('const order = await fetchOrder(orderId, idToken)') &&
    orderEmailFn.includes('documents/orders/${encodeURIComponent(safeOrderId)}'),
  'El correo debe construirse con el pedido real leído por el servidor, no con datos del cliente.'
);

// ===========================================================================
// 3. PERMISOS, REMITENTE, REPLY-TO, LISTA BLANCA DE ACCIONES
// ===========================================================================
check(
  'El reenvío está restringido al Super Admin en el servidor',
  orderEmailFn.includes('if (isResend && !isSuperAdmin)') &&
    orderEmailFn.includes('Solo el Super Admin puede reenviar correos.'),
  'Ocultar el botón no basta: el servidor debe bloquear el reenvío a cualquier rol que no sea Super Admin.'
);
check(
  'El endpoint valida la propiedad del pedido salvo Super Admin',
  orderEmailFn.includes('!isSuperAdmin && clean(order.userId, 128) !== user.uid') &&
    orderEmailFn.includes('!isSuperAdmin && clean(order.userEmail, 254).toLowerCase() !== user.email'),
  'Una cuenta no debe poder disparar el correo de un pedido ajeno.'
);
check(
  'Solo se aceptan las acciones sendOrderEmail / resendOrderEmail',
  orderEmailFn.includes("!['sendOrderEmail', 'resendOrderEmail'].includes(action)"),
  'Una acción arbitraria no debe llegar al proveedor de correo.'
);
check(
  'Remitente fijo y reply-to a la casilla de la dueña',
  testEmailFn.includes("const FROM_EMAIL = 'Tintin Pedidos <pedidos@tintinaccs.com>'") &&
    testEmailFn.includes("const REPLY_TO = 'tintinaccs@gmail.com'") &&
    adminSync.includes("const SENDER_EMAIL = 'pedidos@tintinaccs.com'"),
  'La configuración del remitente/reply-to debe estar fijada por Resend, no editable a un valor inválido.'
);

// ===========================================================================
// 4. CORREO DE PRUEBA (Resend) — cooldown, doble clic, validación
// ===========================================================================
check(
  'La prueba se envía por Resend vía /api/test-email',
  adminSync.includes("const TEST_ENDPOINT = apiUrl('test-email')") &&
    adminSync.includes('fetch(TEST_ENDPOINT, {'),
  'El correo de prueba debe usar el canal Resend, no el webhook viejo.'
);
check(
  'El interceptor de prueba anula el envío viejo (Apps Script) del panel',
  adminSync.includes("event.target?.closest?.('#btn-test-email')") &&
    adminSync.includes('event.stopImmediatePropagation()') &&
    adminSync.includes('sendResendTest(button)'),
  'El botón de prueba debe enrutarse a Resend; el handler viejo no debe ejecutarse en paralelo.'
);
check(
  'El correo de prueba tiene cooldown anti-doble-clic (120s)',
  adminSync.includes("sessionStorage.getItem('tt_resend_test_last')") &&
    adminSync.includes('120000 - (Date.now() - lastAttempt)') &&
    adminSync.includes("sessionStorage.setItem('tt_resend_test_last'"),
  'Sin cooldown, un doble clic dispararía dos pruebas seguidas.'
);
check(
  'La prueba valida email, respeta el interruptor y bloquea el botón mientras envía',
  adminSync.includes('if (privateState.data?.testEmailsEnabled === false)') &&
    adminSync.includes('if (!validEmail(email))') &&
    adminSync.includes('button.disabled = true'),
  'La prueba debe validar destinatario/estado y evitar reenvíos por clics repetidos.'
);
check(
  'El endpoint de prueba exige Super Admin',
  testEmailFn.includes('await requireSuperAdmin(request)'),
  'Solo la dueña autenticada debe poder enviar correos de prueba.'
);

// ===========================================================================
// 5. PROMOCIONES DESACTIVADAS (sin segundo sistema activo)
// ===========================================================================
check(
  'Promociones queda desactivado desde el panel (toggles/botones deshabilitados)',
  adminSync.includes("const promoToggle = document.getElementById('promo-enabled-toggle')") &&
    adminSync.includes('promoToggle.disabled = true') &&
    adminSync.includes("'promo-open-confirm-btn'"),
  'Promoción masiva no migrada a Resend debe quedar bloqueada para no reactivar el canal viejo.'
);
check(
  'La configuración privada fuerza proveedor Resend y promo desactivada',
  adminSync.includes("if (data.emailProvider !== 'resend') patch.emailProvider = 'resend'") &&
    adminSync.includes('if (data.promoEnabled !== false) patch.promoEnabled = false'),
  'El proveedor real debe quedar fijado en Resend y las promos apagadas hasta su migración.'
);

// ===========================================================================
// 6. LOGS / AUDITORÍA / ESTADO REAL
// ===========================================================================
check(
  'Cada envío del pedido se registra en emailLogs con estado real',
  resendNotify.includes("collection(db, 'emailLogs')") &&
    resendNotify.includes("category: 'pedido'") &&
    resendNotify.includes('status: notificationStatusFromResult(result)'),
  'El intento del pedido debe quedar auditado con su resultado real.'
);
check(
  'La prueba se registra por separado (category prueba)',
  adminSync.includes("category: 'prueba'") &&
    adminSync.includes("collection(db, 'emailLogs')"),
  'Las pruebas deben distinguirse de los envíos reales en el historial.'
);
check(
  'El estado se traduce a sent/partial/failed (no queda pegado en pending)',
  resendNotify.includes('export function notificationStatusFromResult(result)') &&
    resendNotify.includes("if (result.adminSent && result.customerSent) return 'sent'") &&
    resendNotify.includes("if (result.adminSent || result.customerSent) return 'partial'") &&
    checkout.includes('notificationStatus: notificationStatusFromResult(result)'),
  'Un envío parcial o fallido debe reflejarse en notificationStatus, no dejarse en "pending".'
);
check(
  'emailLogs es inmutable y de lectura solo para Super Admin',
  /match \/emailLogs\/\{logId\}[\s\S]{0,400}allow read: if isSuperAdmin\(\)/.test(rules) &&
    /match \/emailLogs\/\{logId\}[\s\S]{0,900}allow update, delete: if false;/.test(rules),
  'Los registros de correo no deben poder editarse ni borrarse, y solo los lee la dueña.'
);
check(
  'La configuración y plantillas de correo son exclusivas del Super Admin',
  /match \/emailSettings\/\{docId\} \{\s*allow read, write: if isSuperAdmin\(\);/.test(rules) &&
    /match \/emailTemplates\/\{templateId\} \{\s*allow read, write: if isSuperAdmin\(\);/.test(rules),
  'Los ajustes y plantillas de correo no deben quedar expuestos a otros roles.'
);

// ===========================================================================
// 7. MENSAJES / WHATSAPP — número y texto configurables, codificación segura
// ===========================================================================
check(
  'El número de WhatsApp es configurable en vivo desde settings/general',
  whatsapp.includes("onSnapshot(doc(db, 'settings', 'general')") &&
    whatsapp.includes('applyWaNumber(cfg.whatsappNumber)'),
  'El número debe leerse de la configuración administrable, no quedar hardcodeado.'
);
check(
  'El número de WhatsApp se normaliza (solo dígitos) antes de armar el enlace',
  whatsapp.includes("String(rawNumber || '').replace(/\\D/g, '')") &&
    whatsapp.includes("'wa.me/' + digits") &&
    whatsapp.includes("'tel:+' + digits"),
  'Un número con espacios o símbolos rompería el enlace de WhatsApp/tel:.'
);
check(
  'El texto del mensaje de WhatsApp se codifica en todos los orígenes',
  adminApp.includes('encodeURIComponent(waConfirmMessageTemplate.replace(/\\{nombre\\}/g') &&
    read('script.js').includes('https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(') &&
    checkout.includes('https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(') &&
    read('js/contact-maintenance.js').includes('encodeURIComponent') &&
    read('js/blocked-modal.js').includes('encodeURIComponent'),
  'El texto configurable debe pasar por encodeURIComponent para no romper el enlace ni inyectar parámetros.'
);
check(
  'El mensaje de confirmación de WhatsApp del admin es configurable con fallback',
  adminApp.includes('let waConfirmMessageTemplate =') &&
    adminApp.includes('snap.data().waConfirmMessage'),
  'El texto del mensaje al cliente debe poder configurarse; el default es solo un respaldo.'
);
check(
  'Los enlaces sociales extra solo se agregan si Super Admin cargó la URL',
  whatsapp.includes('if (cfg.facebook && !ul.querySelector') &&
    whatsapp.includes('if (cfg.tiktok && !ul.querySelector'),
  'Facebook/TikTok no deben quedar hardcodeados; se muestran solo si están configurados.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de correos y mensajes fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de correos y mensajes completada correctamente (${checks.length} comprobaciones).`);
