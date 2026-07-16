'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const notify = read('js/email-notify.js');
const bridge = read('js/checkout-email-bridge.js');
const adminSync = read('js/admin-email-gate-sync.js');
const adminStore = read('js/admin-store-control.js');
const checkout = read('checkout.html');
const appsScript = read('apps-script/Phase3Security.gs');
const docs = read('functions/EMAIL_PHASE3_DEPLOY.md');

check(
  'El checkout ya carga el sistema de correos',
  checkout.includes('import { sendOrderNotification } from "./js/email-notify.js"') &&
    notify.includes("import('./checkout-email-bridge.js?v=tintin-20260716-diagnostic-fixes-2')"),
  'El puente debe arrancar desde el módulo que checkout ya importa.'
);

check(
  'El correo original exige sesión real',
  notify.includes('const idToken = await getIdToken_(false)') &&
    notify.includes("action: isResend ? 'resendOrderEmail' : 'sendOrderEmail'") &&
    notify.includes('orderId: normalizedOrderId'),
  'El webhook debe recibir el ID del pedido y un idToken también en el envío original.'
);

check(
  'El puente se activa después del pedido Spark sin escribir el estado protegido',
  bridge.includes("document.getElementById('ck-success-head')") &&
    bridge.includes('sendOrderNotification(found.id, compatibilityOrder, false)') &&
    bridge.includes("new CustomEvent('tintin:order-email-result'") &&
    !bridge.includes("updateDoc(doc(db, 'orders'") &&
    !bridge.includes('notificationStatus: status'),
  'Apps Script debe guardar el estado real; el navegador solo informa el resultado.'
);

check(
  'El pedido se localiza sin índice compuesto',
  bridge.includes("getDoc(doc(db, 'orders', exactId))") &&
    !bridge.includes("where('requestId', '==', capturedRequestId)"),
  'El pedido determinístico debe leerse directamente para no requerir un índice nuevo.'
);

check(
  'Los reintentos del navegador no duplican el intento',
  bridge.includes('tt_order_email_attempted_') &&
    bridge.includes('processingKey === key') &&
    notify.includes('result.duplicate === true'),
  'La pantalla de éxito debe protegerse contra observadores y recargas repetidas.'
);

check(
  'Los interruptores públicos no exponen configuración privada',
  notify.includes("doc(db, 'settings', 'storeGate')") &&
    notify.includes('data.emailAccess') &&
    adminSync.includes("const PUBLIC_REF = doc(db, 'settings', 'storeGate')") &&
    adminSync.includes('emailAccess: desired()') &&
    adminSync.includes('{ merge: true }'),
  'Solo los tres booleanos mínimos deben sincronizarse dentro de storeGate.'
);

check(
  'Super Admin inicia la sincronización de correos',
  adminStore.includes("import('./admin-email-gate-sync.js?v=tintin-20260716-diagnostic-fixes-2')"),
  'El documento mínimo debe crearse al entrar al panel autorizado.'
);

check(
  'Apps Script vuelve a leer el pedido real',
  appsScript.includes("'orders/' + encodeURIComponent(normalizedId)") &&
    appsScript.includes('phase3FetchDocument_') &&
    appsScript.includes("originalOrder.source !== 'spark-checkout-v1'"),
  'El correo no debe construirse con precios ni destinatarios inventados en el navegador.'
);

check(
  'Apps Script comprueba identidad y propiedad',
  appsScript.includes('verifyFirebaseIdToken_(idToken)') &&
    appsScript.includes('originalOrder.userId !== authContext.uid') &&
    appsScript.includes('order_email_mismatch'),
  'Solo la dueña del pedido puede iniciar el correo original.'
);

check(
  'El reenvío exige rol y permiso',
  appsScript.includes("role !== 'admin' && role !== 'agent'") &&
    appsScript.includes('pedidos.reenviarCorreo === true') &&
    appsScript.includes('userData.blocked === true'),
  'Una sesión cualquiera no debe poder reenviar pedidos.'
);

check(
  'La fase 3 sigue siendo compatible con Spark',
  !notify.includes('firebase-functions') &&
    !bridge.includes('httpsCallable') &&
    docs.includes('No requiere Blaze'),
  'Los correos deben continuar usando Apps Script sin Cloud Functions.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de correos fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log('\nAuditoría de correos de la Fase 3 completada correctamente.');
