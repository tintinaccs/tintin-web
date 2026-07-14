const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failures = 0;
function check(label, ok) {
  if (ok) console.log('OK — ' + label);
  else { failures += 1; console.error('FAIL — ' + label); }
}
const products = read('js/products-store.js');
const script = read('script.js');
const cart = read('js/cart-sync.js');
const roles = read('js/roles.js');
const rules = read('firestore.rules');
const emailConfig = read('js/email-config.js');
const emailNotify = read('js/email-notify.js');
const bridge = read('js/checkout-email-bridge.js');
const apps = read('apps-script/Phase3Security.gs');
check('Productos se normalizan como texto plano', products.includes('cleanMultilineText') && products.includes('sanitizeVariantData'));
check('Carrito local se limpia antes de renderizar', script.includes('normalizeClassicCart') && cart.includes('replace(/[<>]/g'));
check('Descripción de producto no ejecuta HTML', !script.includes('descEl.innerHTML = product.desc'));
check('Super Admin depende de Firebase Auth', roles.includes("auth.currentUser?.email") && !roles.includes('if (data.email === SUPER_ADMIN)'));
check('Email del perfil es campo protegido', rules.includes("'email', 'createdAt', 'provider', 'role'"));
check('Creación de usuario obliga estadísticas en cero', rules.includes('function userCreateValid(userId)') && rules.includes("data.get('totalSpent', 0) == 0"));
check('Cliente no puede escribir notificationStatus', !rules.includes("hasOnly(['notificationStatus', 'updatedAt'])"));
check('Secreto público eliminado', !emailConfig.includes('EMAIL_SECRET') && !emailNotify.includes('secret:'));
check('Apps Script escribe estado autorizado', apps.includes('phase3UpdateOrderNotificationStatus_') && apps.includes('ScriptApp.getOAuthToken()'));
check('Checkout ya no actualiza estado desde cliente', !bridge.includes("await updateDoc(doc(db, 'orders'"));
if (failures) process.exit(1);
console.log('\nAuditoría post-fases completada correctamente.');
