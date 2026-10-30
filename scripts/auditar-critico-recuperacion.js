'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');

const rules = read('firestore.rules');
const checkout = read('js/orders/pedido-checkout-seguro.js');
const admin = read('js/admin/admin-app.js');
const orderCrud = read('js/admin/orders/pedidos-superadmin-crud.js');
const trashControl = read('cloudflare/order-trash-controls.js');
const activity = read('js/analytics/actividad-sitio.js');
const activityApi = read('functions/api/site-activity.js');
const loader = read('js/cargador-pagina.js');
const products = read('js/core/store/estado-productos.js');
const publicCatalogApi = read('functions/api/public-catalog.js');
const firestoreAdmin = read('cloudflare/firebase-admin-ligero.js');
const collections = (read('js/pages/collections/estado-colecciones.js') + '\n' + read('js/pages/collections/datos-publicos-colecciones.js'));
const inventory = read('js/admin/products/integridad-inventario-admin.js');
const orderDomain = read('cloudflare/order-admin-domain.js');
const model = read('js/core/store/modelo-inventario.mjs');
const deleteFix = read('js/admin/orders/eliminacion-pedidos-admin.js');
const phase4 = read('apps-script/CrearPedido.gs');

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

check(
  'La analítica pública reactivada exige freno de frecuencia, no escritura libre',
  /match \/sitePresence[^]*?allow create, update: if false;/.test(rules) &&
    /match \/siteTraffic[^]*?allow create, update: if false;/.test(rules) &&
    activityApi.includes('site-activity-budget') &&
    activityApi.includes("kind === 'session' || date.getTime() - Date.parse") &&
    activityApi.includes('< 20_000'),
  'El SDK no escribe métricas; el servidor exige cuota compartida, deduplicación y frecuencia mínima.'
);
check(
  'La actividad pública arranca sola en cada página (ya no depende de un interruptor apagado)',
  activity.includes('TINTIN_ENABLE_PUBLIC_ACTIVITY === true') &&
    activity.includes("ttActivityState = 'disabled-quota-protection'") &&
    loader.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY = true') &&
    activity.includes("const cloudflarePreview = /.+\\.tintinaccesorios\\.pages\\.dev$/i.test(hostname);") &&
    !activity.includes("hostname === 'tintinaccesorios.pages.dev'"),
  'La actividad debe arrancar sólo con habilitación explícita y nunca confundir producción con una vista previa de Pages.'
);
check(
  'El servidor crea el pedido y descuenta stock sin perder atomicidad',
  checkout.includes('async function createOrderOnServer(draft)') &&
    phase4.includes('phase4BeginTransaction_()') &&
    phase4.includes("inventoryState: 'reserved'") &&
    phase4.includes("status: 'pendiente'") &&
    phase4.includes('phase4Commit_(writes, transactionId)'),
  'El pedido y el descuento de stock deben confirmarse juntos en una sola transacción.'
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
  (inventory.includes("fetch('/api/admin-order-mutation'") || inventory.includes("authenticatedFetch('/api/admin-order-mutation'")) &&
    inventory.includes('async function updateEditedOrder') &&
    inventory.includes('async function transitionStatus') &&
    orderDomain.includes('computeInventoryDeltas') &&
    orderDomain.includes('firestoreAdminBatchCommit') &&
    orderDomain.includes('currentDocument: precondition') &&
    orderDomain.includes('auditLog') &&
    orderCrud.includes('TintinInventoryIntegrity.updateEditedOrder') &&
    admin.includes('TintinInventoryIntegrity.transitionStatus') &&
    admin.includes('TintinOrderAdmin.trashOrder') &&
    orderCrud.includes("(before.lastChangeId || '') !== options.baseChangeId") &&
    orderCrud.includes('returnItems: options.returnItems, baseChangeId: options.baseChangeId') &&
    trashControl.includes("actor?.role !== 'superadmin'") &&
    trashControl.includes('version !== baseChangeId') &&
    trashControl.includes('selectedReturns(order, input.returnItems)') &&
    trashControl.includes('row.qty > bought') &&
    trashControl.includes('!orderReservesInventory(order)') &&
    trashControl.includes('order.trashMeta?.returnedItems || []') &&
    trashControl.includes('restore ? -quantity : quantity') &&
    trashControl.includes('currentDocument: condition(source)') &&
    trashControl.includes('await commit(env, writes)') &&
    trashControl.includes('originalStatus: order.status') &&
    !trashControl.includes("after.status = 'cancelado'"),
  'Edición y estados deben pasar por el dominio server-side atómico; la papelera valida versión y devolución elegida, restaura la decisión exacta y conserva estado e historial.'
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
    inventory.includes('const releaseResult = await withAdminSiteChange(async () => runTransaction(db, async transaction => {') &&
    inventory.includes("inventoryState: 'released'") &&
    inventory.includes('if (orderReservesInventory(orderSnapshot.data() || {}))') &&
    !rules.includes('(isSuperAdmin() && !orderExistsAfter)'),
  'La devolución debe confirmarse primero para que un fallo o reintento no duplique stock y no requiera reglas nuevas.'
);
check(
  'La papelera masiva no recalcula toda la base ni oculta fallos parciales',
  !deleteFix.includes('recalculateAllUserOrderStats') &&
    admin.includes('movedOrders = []') &&
    admin.includes('failed = []') &&
    admin.includes('failed.forEach(item => _selectedOrders.add(item.id))') &&
    admin.includes('TintinOrderAdmin.trashOrder'),
  'Cada pedido se procesa de forma acotada y los fallidos deben quedar seleccionados.'
);
check(
  'Las consultas públicas tienen límites explícitos',
  products.includes("fetchPublicCatalogResource('products')") && /firestoreAdminListAll\(env,\s*resource,\s*resource === 'products' \? 5000 : 300,\s*\{failOnTruncation:true\}\)/.test(publicCatalogApi) &&
    firestoreAdmin.includes('Math.min(5000, Number(maxDocuments)') &&
    firestoreAdmin.includes('if (pageToken && failOnTruncation) throw') &&
    !/getDocs\(query\(collection\(db,\s*['"]products['"]\)/.test(products) && collections.includes('limit(200)') &&
    rules.includes('request.query.limit <= 1000') && rules.includes('request.query.limit <= 200'),
  'El servidor mantiene un presupuesto paginado y rechaza truncamientos; los límites públicos de Rules permanecen intactos.'
);
check(
  'El guard de checkout limita sus reintentos internos',
  (checkout.match(/maxAttempts: 2/g) || []).length >= 1,
  'reserveCheckoutGuard debe limitar los reintentos automáticos de Firestore.'
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
