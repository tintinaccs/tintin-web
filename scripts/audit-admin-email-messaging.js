'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, condition, problem) => checks.push({ name, ok: Boolean(condition), problem });

const checkout       = read('checkout.html');
const resendNotify   = read('js/resend-order-notify.js');
const bridge         = read('js/checkout-email-bridge.js');
const orderEmailFn   = read('functions/api/order-email.js');
const testEmailFn    = read('functions/api/test-email.js');
const adminSync      = read('js/admin-email-gate-sync.js');
const functionOrigin = read('js/function-origin.js');
const adminApp       = read('js/admin-app.js');
const whatsapp       = read('js/whatsapp.js');
const settingsStore  = read('js/public-settings-store.js');
const rules          = read('firestore.rules');

check(
  'Checkout usa un solo canal Resend',
  checkout.includes('import { sendOrderNotification } from "./js/resend-order-notify.js?v=tintin-20260717-resend-1"') &&
    !checkout.includes('email-notify.js') &&
    (checkout.match(/sendOrderNotification\(/g) || []).length === 1,
  'El pedido no debe disparar dos proveedores de correo.'
);
check(
  'El canal Resend llama al endpoint de Cloudflare con Bearer token',
  // El origen (relativo en Cloudflare, pages.dev en GitHub Pages/Netlify) lo
  // resuelve js/function-origin.js — ver "El fallback de host..." abajo.
  resendNotify.includes("const ORDER_EMAIL_API = apiUrl('order-email')") &&
    resendNotify.includes('Authorization: `Bearer ${idToken}`') &&
    resendNotify.includes("action: isResend ? 'resendOrderEmail' : 'sendOrderEmail'"),
  'El frontend debe usar /api/order-email con Bearer token.'
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

const frontendFiles = [
  ...fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).map(name => `js/${name}`),
  ...fs.readdirSync(root).filter(name => name.endsWith('.html'))
];
const resendKeyLike = /re_[0-9a-zA-Z]{20,}/;
const leakedFiles = frontendFiles.filter(file => {
  const content = read(file);
  return content.includes('RESEND_API_KEY') || resendKeyLike.test(content);
});
check('No hay claves de Resend en frontend', leakedFiles.length === 0, leakedFiles.join(', '));
check(
  'La clave se lee solo del entorno servidor',
  orderEmailFn.includes('env.RESEND_API_KEY') && testEmailFn.includes('env.RESEND_API_KEY'),
  'Las Functions deben leer env.RESEND_API_KEY.'
);
check(
  'El servidor vuelve a leer el pedido real',
  orderEmailFn.includes('const order = await fetchOrder(orderId, idToken)') &&
    orderEmailFn.includes('documents/orders/${encodeURIComponent(safeOrderId)}'),
  'El correo no debe confiar en datos del navegador.'
);
check(
  'Reenvío reservado al Super Admin',
  orderEmailFn.includes('if (isResend && !isSuperAdmin)') &&
    orderEmailFn.includes('Solo el Super Admin puede reenviar correos.'),
  'La protección debe existir en servidor.'
);
check(
  'Propiedad del pedido validada',
  orderEmailFn.includes('!isSuperAdmin && clean(order.userId, 128) !== user.uid') &&
    orderEmailFn.includes('!isSuperAdmin && clean(order.userEmail, 254).toLowerCase() !== user.email'),
  'Una cuenta no debe enviar correos de pedidos ajenos.'
);
check(
  'Acciones del endpoint están en lista blanca',
  orderEmailFn.includes("!['sendOrderEmail', 'resendOrderEmail'].includes(action)"),
  'El endpoint no debe aceptar acciones arbitrarias.'
);
check(
  'Remitente y reply-to son fijos',
  testEmailFn.includes("const FROM_EMAIL = 'Tintin Pedidos <pedidos@tintinaccs.com>'") &&
    testEmailFn.includes("const REPLY_TO = SUPERADMIN_EMAIL") &&
    adminSync.includes("const SENDER_EMAIL = 'pedidos@tintinaccs.com'"),
  'El proveedor real no debe quedar editable a valores inválidos.'
);
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
    adminSync.includes('event.stopImmediatePropagation()'),
  'La prueba debe evitar dobles envíos.'
);
check('Endpoint de prueba exige Super Admin', testEmailFn.includes('await requireSuperAdmin(request)'), 'La prueba debe validarse en servidor.');
check(
  'Promociones no migradas siguen desactivadas',
  adminSync.includes('promoToggle.disabled = true') &&
    adminSync.includes("if (data.promoEnabled !== false) patch.promoEnabled = false"),
  'No debe reactivarse un segundo canal.'
);
check(
  'Los envíos se registran con resultado real',
  resendNotify.includes("collection(db, 'emailLogs')") &&
    resendNotify.includes("category: 'pedido'") &&
    resendNotify.includes('status: notificationStatusFromResult(result)'),
  'El historial debe registrar éxito, parcial o fallo.'
);
check(
  'emailLogs es inmutable y privado',
  /match \/emailLogs\/\{logId\}[\s\S]{0,400}allow read: if isSuperAdmin\(\)/.test(rules) &&
    /match \/emailLogs\/\{logId\}[\s\S]{0,900}allow update, delete: if false;/.test(rules),
  'Los registros no deben editarse ni exponerse.'
);
check(
  'WhatsApp usa una sola configuración pública compartida',
  whatsapp.includes('onPublicSettings') &&
    /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(settingsStore) &&
    settingsStore.includes('subscribers') && settingsStore.includes('unsubscribe'),
  'WhatsApp no debe abrir un listener separado.'
);
check(
  'Número de WhatsApp se normaliza',
  whatsapp.includes("String(rawNumber || '').replace(/\\D/g, '')") &&
    whatsapp.includes('wa.me/${digits}') &&
    whatsapp.includes('tel:+${digits}'),
  'El enlace debe recibir solo dígitos.'
);
check(
  'Mensajes de WhatsApp se codifican',
  adminApp.includes('encodeURIComponent(waConfirmMessageTemplate.replace(/\\{nombre\\}/g') &&
    read('script.js').includes('encodeURIComponent(') &&
    checkout.includes('encodeURIComponent(') &&
    read('js/contact-maintenance.js').includes('encodeURIComponent') &&
    read('js/blocked-modal.js').includes('encodeURIComponent'),
  'Los mensajes configurables deben codificarse.'
);
check(
  'Redes sociales se validan antes de insertarse',
  whatsapp.includes('safeUrl') && whatsapp.includes("['https:', 'http:'].includes(url.protocol)") &&
    whatsapp.includes('ensureSocialLink'),
  'Facebook y TikTok no deben aceptar protocolos peligrosos.'
);

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
