'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
let failures = 0;

function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

const cart = read('js/cart-sync.js');
const checkout = read('js/secure-checkout-order.js');
const inventory = read('js/admin-inventory-integrity.js');
const deleteFix = read('js/admin-order-delete-fix.js');
const admin = read('js/admin-app.js');
const emailClient = read('js/resend-order-notify.js');
const emailBridge = read('js/checkout-email-bridge.js');
const emailServer = read('functions/api/order-email.js');
const rules = read('firestore.rules');
const contracts = read('docs/COMMERCE_CONTRACTS.md');
const maintenance = read('maintenance/11-3-pedidos-checkout.txt');

// Carrito
check(
  'La línea del carrito se identifica por producto y variante',
  cart.includes('function lineIdFor') && cart.includes('`${id}\u241f${variant}`') && cart.includes('lineId: lineIdFor({ id, variant })')
);
check(
  'Las cantidades del carrito se acotan a 1..99',
  cart.includes('const MAX_QTY = 99') && cart.includes('Math.max(1, Math.min(MAX_QTY, Math.floor(parsedQty)))')
);
check(
  'El carrito remoto no pisa una mutación local pendiente',
  cart.includes('pendingRemoteWrite') && cart.includes('mutationChain') && cart.includes('writeChain')
);
check(
  'El propio carrito declara que sus precios son solo visuales',
  cart.includes('Precio/nombre/imagen son solo datos visuales; checkout vuelve a validarlos')
);

// Checkout e idempotencia
check(
  'El checkout conserva un requestId estable por sesión',
  checkout.includes("const REQUEST_KEY = 'tt_spark_checkout_request_id'") &&
    checkout.includes('sessionStorage.getItem(REQUEST_KEY)') &&
    checkout.includes('sessionStorage.setItem(REQUEST_KEY, value)')
);
check(
  'El pedido usa UID + requestId como identidad idempotente',
  checkout.includes('const orderId = `${uid}_${draft.requestId}`')
);
check(
  'Reintentar reanuda el pedido existente',
  checkout.includes('const existing = await transaction.get(orderRef)') &&
    checkout.includes("data.inventoryState === 'pending'") &&
    checkout.includes("data.inventoryState === 'reserved'")
);
check(
  'La guarda de checkout permite reanudar el mismo pedido',
  checkout.includes('const sameOrder = text(guardData.lastCheckoutOrderId) === orderId') &&
    checkout.includes('!sameOrder')
);
check(
  'El checkout vuelve a leer configuración, usuario y productos',
  checkout.includes("const settingsRef = doc(db, 'settings', 'general')") &&
    checkout.includes("const userRef = doc(db, 'users', uid)") &&
    checkout.includes("draft.cartLines.map(line => doc(db, 'products', line.id))")
);
check(
  'Cambios de precio o envío exigen nueva confirmación',
  checkout.includes("throw appError('quote_changed'") &&
    checkout.includes('draft.expectedSubtotal !== subtotal') &&
    checkout.includes('draft.expectedTotal !== total')
);
check(
  'El pedido guarda una fotografía histórica autocontenida',
  checkout.includes('items: resolvedItems') && checkout.includes('subtotal,') &&
    checkout.includes('shippingCost,') && checkout.includes('payment: { method: draft.paymentMethod') &&
    checkout.includes('transaction.set(orderRef, orderData)')
);
check(
  'Reserva de inventario y activación ocurren en una transacción',
  checkout.includes('async function reserveOrderInventory(orderId)') &&
    checkout.includes('transaction.update(productRefs[index]') &&
    checkout.includes("inventoryState: 'reserved'") &&
    checkout.includes("status: 'pendiente'")
);

// Reglas e integridad
check(
  'Firestore valida cantidades, precio, subtotal y total',
  rules.includes('item.qty is int && item.qty >= 1 && item.qty <= 99') &&
    rules.includes('item.price is number && item.price >= 0') &&
    rules.includes('data.total == data.subtotal + data.shippingCost')
);
check(
  'Firestore vuelve a vincular la reserva con el pedido',
  rules.includes('productAfter.lastStockOrderId == orderId') &&
    rules.includes('sparkInventoryReserveValid(orderId)')
);
check(
  'La eliminación libera inventario antes de borrar',
  inventory.includes('const releaseResult = await runTransaction') &&
    inventory.includes("inventoryState: 'released'") &&
    inventory.indexOf("inventoryState: 'released'") < inventory.indexOf('transaction.delete(orderRef)')
);
check(
  'Un reintento no puede liberar inventario dos veces',
  inventory.includes('const shouldRestore = orderReservesInventory(order)') &&
    inventory.includes('if (orderReservesInventory(orderSnapshot.data() || {}))')
);
check(
  'Los productos históricos faltantes no bloquean todo el borrado',
  inventory.includes('missingProducts.push(id)') && inventory.includes('continue;')
);
check(
  'El borrado masivo conserva fallos y solo sincroniza pedidos eliminados',
  admin.includes('const deletedOrders = []') && admin.includes('const failed = []') &&
    admin.includes('failed.forEach(item => _selectedOrders.add(item.id))') &&
    deleteFix.includes('if (result?.deleted) await syncDeletedOrder')
);

// Administración
check(
  'Los estados de pedido y pago tienen una fuente administrativa única',
  admin.includes('const ORDER_STATUS_LABELS = {') && admin.includes('const PAY_STATUS_LABELS = {') &&
    admin.includes('function orderStatusOptions(current)') && admin.includes('function payStatusOptions(current)')
);
check(
  'La edición mantiene precios históricos y total derivado',
  admin.includes('reduce((s, i) => s + (i.price||0)*(i.qty||1), 0)') &&
    admin.includes('const total = subtotal + shipCost')
);
check(
  'La edición administrativa detecta cambios concurrentes',
  admin.includes("const freshSnap = await getDoc(doc(db, 'orders', orderId))") &&
    admin.includes('freshMillis > _orderEditBaselineMillis')
);
check(
  'Cambiar estado y pago exige permiso y auditoría',
  admin.includes("roleCanDo('pedidos', 'cambiarEstado')") &&
    admin.includes("logAudit('cambiar_estado_pedido'") &&
    admin.includes("roleCanDo('pedidos', 'cambiarPago')") &&
    admin.includes("logAudit('cambiar_estado_pago'")
);

// Correo: servidor confiable + reintento automático acotado
check(
  'El cliente de correo tiene timeout y reintentos acotados',
  emailClient.includes('const MAX_DELIVERY_ATTEMPTS = 3') &&
    emailClient.includes('const REQUEST_TIMEOUT_MS = 15000') &&
    emailClient.includes('for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1)')
);
check(
  'Solo se reintentan fallos transitorios o resultados parciales',
  emailClient.includes('[408, 425, 429].includes(response.status) || response.status >= 500') &&
    emailClient.includes("notificationStatusFromResult(parsed) === 'partial'")
);
check(
  'Una sesión vencida renueva el token una sola vez',
  emailClient.includes('shouldRefreshToken(response, parsed, refreshedToken)') &&
    emailClient.includes('getIdToken(true)') && emailClient.includes('refreshedToken = true')
);
check(
  'El historial registra una sola vez el resultado final y la cantidad de intentos',
  (emailClient.match(/await logOrderEmailAttempt\(/g) || []).length === 2 &&
    emailClient.includes('attempts: Math.max(1, Number(result?.attempts || 1))') &&
    emailClient.lastIndexOf('await logOrderEmailAttempt') > emailClient.lastIndexOf('for (let attempt')
);
check(
  'El endpoint usa claves idempotentes estables para correos automáticos',
  emailServer.includes("const suffix = isResend ? `resend-${Date.now()}` : 'new-v1'") &&
    emailServer.includes("`order-${orderId}-admin-${suffix}`") &&
    emailServer.includes("`order-${orderId}-customer-${suffix}`")
);
check(
  'El endpoint vuelve a leer el pedido y valida propiedad',
  emailServer.includes('const order = await fetchOrder(orderId, idToken)') &&
    emailServer.includes('clean(order.userId, 128) !== user.uid') &&
    emailServer.includes('clean(order.userEmail, 254).toLowerCase() !== user.email')
);
check(
  'El puente de checkout localiza el pedido por requestId y no por datos inventados',
  emailBridge.includes('const exactId = `${user.uid}_${capturedRequestId}`') &&
    emailBridge.includes('data.requestId === capturedRequestId')
);

// Promociones y documentación operativa
check(
  'El contrato prohíbe descuentos decididos solo por el navegador',
  contracts.includes('No existe un motor independiente que permita al navegador inventar descuentos') &&
    contracts.includes('el servidor o las reglas validan el descuento aplicado')
);
check(
  'El contrato futuro de promociones exige coherencia en todas las superficies',
  contracts.includes('producto, carrito, checkout, pedido, correo, panel y analítica')
);
check(
  'La documentación antigua ya no afirma que eliminar nunca restaura stock',
  maintenance.includes('ACTUALIZACIÓN POSTERIOR — INVENTARIO AL ELIMINAR') &&
    maintenance.includes("inventoryState='released'") &&
    !maintenance.includes('eliminar/cancelar NO lo repone')
);

if (failures > 0) {
  console.error(`\nNivel 2: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nNivel 2: contratos comerciales, inventario, pedidos y correos correctos.');
