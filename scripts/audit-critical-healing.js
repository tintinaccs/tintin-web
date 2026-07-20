'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const rules = read('firestore.rules');
const checkout = read('js/secure-checkout-order.js');
const admin = read('js/admin-app.js');
const activity = read('js/site-activity.js');
const products = read('js/products-store.js');
const collections = read('js/collections-store.js');
const inventory = read('js/admin-inventory-integrity.js');
const model = read('js/inventory-model.mjs');

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

check(
  'La analítica pública no puede escribir directamente en Firestore',
  /match \/sitePresence\/{visitorId}[\s\S]{0,160}allow create, update: if false;/.test(rules) &&
    /match \/siteTraffic\/{dateKey}\/sessions\/{sessionId}[\s\S]{0,180}allow create: if false;/.test(rules),
  'sitePresence y siteTraffic deben quedar cerrados a escrituras del navegador.'
);
check(
  'La actividad pública queda desactivada por defecto en el runtime',
  activity.includes('TINTIN_ENABLE_PUBLIC_ACTIVITY === true') &&
    activity.includes("ttActivityState = 'disabled-quota-protection'"),
  'site-activity.js no debe iniciar escrituras salvo habilitación explícita.'
);
check(
  'Cada ítem del pedido obliga el stock posterior exacto',
  rules.includes('productAfter.stock == product.stock - item.qty') &&
    rules.includes('productAfter.lastStockOrderId == orderId'),
  'sparkItemValid debe comprobar el estado posterior exacto del producto.'
);
check(
  'Cada baja de stock está ligada al producto y cantidad del pedido',
  rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&
    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty'),
  'sparkStockUpdateValid debe leer el pedido creado y exigir la cantidad exacta.'
);
check(
  'Checkout actualiza el guard anti-pedidos repetidos en la misma transacción',
  checkout.includes('lastCheckoutOrderId: orderId') &&
    checkout.includes('lastCheckoutAt: serverTimestamp()') &&
    checkout.includes('checkout_cooldown'),
  'El guard de frecuencia debe ser atómico y tener mensaje propio.'
);
check(
  'Las reglas exigen el guard de checkout y el intervalo mínimo',
  rules.includes('checkoutGuardOnlyUpdate(userId)') &&
    rules.includes("duration.value(90, 's')") &&
    rules.includes('userData.lastCheckoutOrderId == orderId'),
  'No alcanza con un bloqueo visual en el botón.'
);
check(
  'Los pedidos nuevos registran estado de inventario',
  checkout.includes("inventoryState: 'reserved'") &&
    checkout.includes('inventoryRevision: 1') &&
    rules.includes("data.inventoryState == 'reserved'"),
  'Todo pedido nuevo debe indicar que su stock está reservado.'
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
  'Las consultas públicas tienen límites explícitos',
  products.includes("limit(1000)") && collections.includes("limit(200)") &&
    rules.includes('request.query.limit <= 1000') && rules.includes('request.query.limit <= 200'),
  'El catálogo público no debe permitir enumeraciones ilimitadas.'
);
check(
  'La transacción de checkout limita los reintentos internos',
  /runTransaction\(db,[\s\S]*\}, \{ maxAttempts: 2 \}\);/.test(checkout),
  'Un clic no debe multiplicar hasta cinco veces las lecturas cuando Firestore está saturado.'
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
