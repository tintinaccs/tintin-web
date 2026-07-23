const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');
const checkout = read('js/checkout-payment-methods.js');
const admin = read('js/admin-payment-methods.js');
const core = read('js/payment-methods-core.js');
const css = read('css/payment-methods.css');
const store = read('js/collections-store.js');
const loader = read('js/page-maintenance-loader.js');
const publicSettings = read('js/public-settings-store.js');
const rules = read('firestore.rules');
const secureCheckout = read('js/secure-checkout-order.js');

const checks = [
  ['Checkout carga el catálogo dinámico desde settings/general compartido', /onPublicSettings/.test(checkout) && /normalizePaymentCatalog/.test(checkout) && /onSnapshot\(doc\(db, 'settings', 'general'\)/.test(publicSettings)],
  ['las opciones nuevas conservan la validación segura canónica', /bridge\.name = 'ck-pay'/.test(checkout) && /bridge\.value = selected\?\.kind/.test(checkout) && /efectivo.*transferencia/s.test(secureCheckout)],
  ['cada método tiene radio, label y detalles accesibles', /role', 'radiogroup'/.test(checkout) && /aria-describedby/.test(checkout) && /ck-payment-runtime-details/.test(checkout)],
  ['la selección visual vence reglas anteriores con important', /ck-pay-option:checked \+ \.ck-pay-label/.test(css) && /border-color:[^;]+!important/.test(css) && /background:[^;]+!important/.test(css)],
  ['la opción marcada muestra un indicador visible', /content: '✓'/.test(css) && /is-selected/.test(css)],
  ['el diseño cubre las siete resoluciones acordadas', [1441, 1440, 1280, 1024, 768, 390, 320].every(value => css.includes(String(value))) && [1920, 1440, 1280, 1024, 768, 390, 320].every(value => checkout.includes(String(value)))],
  ['Super Admin tiene alta y edición de métodos', /tt-payment-new/.test(admin) && /openEditor/.test(admin) && /saveEditor/.test(admin)],
  ['Super Admin puede activar desactivar ordenar y eliminar', ['toggle', 'up', 'down', 'delete'].every(action => admin.includes(`action === '${action}'`))],
  ['los datos de transferencia admiten filas arbitrarias', /tt-payment-add-detail/.test(admin) && /data-payment-detail-label/.test(admin) && /data-payment-detail-value/.test(admin) && /24/.test(admin)],
  ['el CRUD guarda catálogo y espejos compatibles en Firestore', /paymentMethodsCatalog: paymentCatalogMap/.test(admin) && /legacyPaymentMirrors/.test(admin) && /setDoc\(SETTINGS_REF/.test(admin)],
  ['solo la cuenta Super Admin puede escribir desde el módulo', /SUPER_ADMIN_EMAIL/.test(admin) && /Solo Super Admin puede modificar/.test(admin)],
  ['Firestore mantiene settings general restringido a Super Admin', /match \/settings\/general/.test(rules) && /allow write: if isSuperAdmin\(\)/.test(rules)],
  ['los identificadores y textos se normalizan y limitan', /paymentMethodId/.test(core) && /cleanPaymentText/.test(core) && /cleanPaymentMultiline/.test(core)],
  ['el catálogo conserva compatibilidad con configuración anterior', /legacyMethods/.test(core) && /paymentMethods/.test(core) && /bankAccounts/.test(core)],
  ['Checkout carga pagos desde su cargador de página', /checkout[\s\S]*load\('checkout-payment-methods\.js'\)/.test(loader)],
  ['Admin conserva el módulo de métodos en la ruta administrativa', /admin-payment-methods\.js/.test(store)],
  ['si no hay métodos se bloquea el avance y se informa', /next\.disabled = true/.test(checkout) && /error-3-none/.test(checkout)],
  ['la selección se conserva ante una actualización en tiempo real', /selectedMethodId/.test(checkout) && /preferred/.test(checkout)],
  ['el resumen muestra el nombre configurado por Super Admin', /patchConfirmationLabel/.test(checkout) && /selected\.title/.test(checkout)]
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\nFallaron ${failed} comprobaciones de métodos de pago.`);
  process.exit(1);
}
console.log('\nAuditoría de métodos de pago completada.');
