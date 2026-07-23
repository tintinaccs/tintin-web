'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const rules = read('firestore.rules');
const checkout = read('js/secure-checkout-order.js');
const admin = read('js/admin-app.js');
const activity = read('js/site-activity.js');
const loader = read('js/page-loader.js');
const products = read('js/products-store.js');
const collections = read('js/collections-store.js');
const inventory = read('js/admin-inventory-integrity.js');
const model = read('js/inventory-model.mjs');
const deleteFix = read('js/admin-order-delete-fix.js');

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

check(
  'La analítica pública reactivada exige freno de frecuencia, no escritura libre',
  // Reactivada tras el incidente de cuota (ver AUDITORIA-CRITICO.txt): ya no
  // queda cerrada con "if false" a secas, pero tampoco vuelve a la escritura
  // libre de antes del incidente — cada update exige que hayan pasado al
  // menos 20s desde el lastSeen anterior, y App Check bloquea scripts que no
  // sean el sitio real.
  rules.includes('function presenceUpdateNotTooFrequent()') &&
    rules.includes('presenceUpdateNotTooFrequent()') &&
    rules.includes("allow create: if isStoreOpenOrAllowed() && trafficSessionIsValid(dateKey, sessionId);\n      allow update: if false;"),
  'sitePresence debe limitar la frecuencia de escritura; siteTraffic no debe permitir update.'
);
check(
  'La actividad pública arranca sola en cada página (ya no depende de un interruptor apagado)',
  activity.includes('TINTIN_ENABLE_PUBLIC_ACTIVITY === true') &&
    activity.includes("ttActivityState = 'disabled-quota-protection'") &&
    loader.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY = true'),
  'site-activity.js no debe iniciar escrituras salvo habilitación explícita.'
);
check(
  'Checkout separa borrador y reserva final sin perder atomicidad del stock',
  checkout.includes('createPendingOrder(draft)') &&
    checkout.includes('reserveOrderInventory(orderId)') &&
    checkout.includes("status: 'inventory_pending'") &&
    checkout.includes("inventoryState: 'pending'") &&
    checkout.includes("inventoryState: 'reserved'"),
  'El pedido pendiente debe existir antes de la transacción que reserva stock y lo activa.'
);
check(
  'La activación final exige que todos los productos queden marcados por el pedido',
  rules.includes('sparkInventoryReserveValid(orderId)') &&
    rules.includes('sparkReservedItemAtValid(items, 0, orderId)') &&
    rules.includes('productAfter.lastStockOrderId == orderId'),
  'No se puede activar un pedido sin escribir el inventario correspondiente.'
);
check(
  'Cada baja de stock está ligada al producto y cantidad exacta',
  rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&
    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty') &&
    rules.includes('orderedQty > 0'),
  'La regla del producto debe calcular la baja exacta desde el pedido pendiente.'
);
check(
  'Checkout reserva el guard anti-pedidos repetidos antes del pedido',
  checkout.includes('reserveCheckoutGuard(draft)') &&
    checkout.includes('lastCheckoutOrderId: orderId') &&
    checkout.includes('checkout_cooldown'),
  'El guard de frecuencia debe ser transaccional y tener mensaje propio.'
);
check(
  'Las reglas exigen el guard de checkout y el intervalo mínimo',
  rules.includes('checkoutGuardWriteValid(userId)') &&
    rules.includes('match /checkoutGuards/{userId}') &&
    rules.includes("duration.value(90, 's')") &&
    rules.includes('guardData.lastCheckoutOrderId == orderId'),
  'No alcanza con un bloqueo visual en el botón.'
);
check(
  'El panel reconcilia inventario de forma transaccional',
  inventory.includes('runTransaction') &&
    inventory.includes('computeInventoryDeltas') &&
    admin.includes('TintinInventoryIntegrity.updateEditedOrder') &&
    admin.includes('TintinInventoryIntegrity.transitionStatus') &&
    admin.includes('TintinInventoryIntegrity.deleteOrder'),
  'Edición, estados y eliminación deben usar el reconciliador atómico.'
);
check(
  'Cancelar dos veces no devuelve stock dos veces',
  model.includes("if (state === 'released') return false") &&
    model.includes('reserveDelta !== 0'),
  'El modelo debe distinguir reserved de released.'
);
check(
  'Eliminar un pedido activo libera stock antes de hacerlo desaparecer',
  inventory.includes("lastInventoryAction: 'release'") &&
    !inventory.includes("lastInventoryAction: 'delete-release'") &&
    inventory.includes('const releaseResult = await runTransaction') &&
    inventory.includes("inventoryState: 'released'") &&
    inventory.includes('if (orderReservesInventory(orderSnapshot.data() || {}))') &&
    !rules.includes('(isSuperAdmin() && !orderExistsAfter)'),
  'La devolución debe confirmarse primero para que un fallo o reintento no duplique stock y no requiera reglas nuevas.'
);
check(
  'La eliminación masiva no recalcula toda la base ni oculta fallos parciales',
  !deleteFix.includes('recalculateAllUserOrderStats') &&
    deleteFix.includes('recalculateOrderOwnerStats') &&
    admin.includes('const deletedOrders = []') &&
    admin.includes('const failed = []') &&
    admin.includes('failed.forEach(item => _selectedOrders.add(item.id))'),
  'Solo deben recalcularse las cuentas afectadas y los pedidos fallidos deben quedar seleccionados.'
);
check(
  'Las consultas públicas tienen límites explícitos',
  products.includes('limit(1000)') && collections.includes('limit(200)') &&
    rules.includes('request.query.limit <= 1000') && rules.includes('request.query.limit <= 200'),
  'El catálogo público no debe permitir enumeraciones ilimitadas.'
);
check(
  'Las transacciones críticas limitan sus reintentos internos',
  (checkout.match(/maxAttempts: 2/g) || []).length >= 3,
  'Guard, pedido pendiente y reserva de stock deben limitar los reintentos automáticos.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.detail}`);
});

if (failed.length) {
  console.error(`\nAuditoría crítica fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría crítica completada (${checks.length} comprobaciones).`);
