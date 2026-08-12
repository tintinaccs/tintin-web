'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const frontend = read('js/orders/pedido-checkout-seguro.js');
const serverClient = read('js/create-order-client.js');
const cart = read('js/components/cart/sincronizacion-carrito.js');
const rules = read('firestore.rules');
const phase4 = read('apps-script/CrearPedido.gs');

check(
  'No depende de Cloud Functions',
  !frontend.includes('httpsCallable') &&
    !frontend.includes('firebase-functions.js') &&
    frontend.includes('runTransaction'),
  'El turno de compra (checkoutGuards) debe seguir usando una transacción de Firestore.'
);
check(
  'El checkout crea el pedido a través del endpoint server-side, sin tope de productos',
  frontend.includes('createOrderOnServer(draft)') &&
    frontend.includes('createOrderViaServer') &&
    !frontend.includes('MAX_DISTINCT_PRODUCTS'),
  'El checkout ya no debe imponer un límite artificial de productos distintos en el navegador.'
);
check(
  'El cliente del endpoint manda el idToken real, no un secreto público',
  serverClient.includes("action: 'createOrder'") &&
    serverClient.includes('idToken'),
  'El servidor debe poder verificar quién hace el pedido.'
);
check(
  'El servidor (Apps Script) vuelve a leer productos y precios reales',
  phase4.includes("docs['products/' + productId]") &&
    phase4.includes('phase4ParseMoney_(product.price)') &&
    phase4.includes('phase4ParseStock_(product.stock)'),
  'El servidor no debe confiar únicamente en precios guardados en el carrito.'
);
check(
  'El servidor crea el pedido y descuenta stock en una sola transacción, sin tope de ítems',
  phase4.includes('phase4BeginTransaction_') &&
    phase4.includes('phase4Commit_(writes, transactionId)') &&
    !/cartLines\.length\s*>\s*4\b/.test(phase4),
  'El pedido y el descuento de stock deben confirmarse juntos, sin un límite bajo de productos.'
);
check(
  'Reintentos con el mismo pedido no lo duplican',
  phase4.includes("docs['orders/' + orderId]") &&
    phase4.includes("existingOrder.inventoryState === 'pending' || existingOrder.inventoryState === 'reserved'"),
  'La misma solicitud (mismo requestId) debe devolver el pedido ya creado en vez de duplicarlo.'
);
check(
  'TINPED se asigna dentro de la misma transacción que crea el pedido',
  phase4.includes("'settings/orderSequence'") && phase4.includes("publicOrderNumber = 'TINPED'") && phase4.includes('orderNumber: publicOrderNumber') && phase4.includes('lastNumber: nextOrderSequence'),
  'El correlativo comercial debe ser atómico y no reutilizarse por borrar/cancelar.'
);
check(
  'El servidor exige tienda abierta, cuenta activa y turno de compra vigente',
  phase4.includes("settings.storeOpen !== true") &&
    phase4.includes("userData.blocked === true") &&
    phase4.includes('checkout_guard_missing') &&
    phase4.includes('checkout_guard_expired'),
  'Una tienda cerrada, cuenta bloqueada o turno de compra vencido debe rechazar el pedido.'
);
check(
  'Cambios de precio requieren nueva confirmación',
  phase4.includes("error: 'quote_changed'") &&
    frontend.includes("code === 'quote_changed'"),
  'No debe guardar silenciosamente un total distinto al mostrado.'
);
check(
  'Cambios de stock se explican al cliente',
  phase4.includes("error: 'insufficient_stock'") &&
    frontend.includes("code === 'insufficient_stock'"),
  'El checkout debe ajustar el carrito cuando cambia el stock.'
);
check(
  'El navegador solo puede crear pedidos manuales siendo Super Admin',
  /match \/orders\/\{orderId\}[\s\S]*?allow create: if isSuperAdmin\(\);/.test(rules) && !rules.includes('allow create: if sparkOrderCreateValid(orderId);'),
  'Clientes y staff deben seguir pasando por el endpoint server-side; solo Super Admin tiene CRUD manual.'
);
check(
  'El servidor valida tienda, cuenta y correo antes de crear el pedido',
  phase4.includes("settings.storeOpen !== true") &&
    phase4.includes("userData.blocked === true") &&
    phase4.includes('!auth.emailVerified'),
  'El endpoint debe rechazar tienda cerrada, cuenta bloqueada o correo no verificado.'
);
check(
  'El checkout seguro se carga solo donde corresponde',
  cart.includes("checkoutPath.endsWith('/checkout.html')") &&
    cart.includes("import('../../orders/pedido-checkout-seguro.js?v=tintin-20260811-phonefix-pedido-checkout-seguro-1"),
  'El módulo debe arrancar únicamente en checkout.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log('\nAuditoría de pedidos gratuitos completada correctamente.');
