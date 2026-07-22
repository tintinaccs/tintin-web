'use strict';

/* =============================================================
   TINTIN — Auditoría de Pedidos (Super Admin + checkout + perfil)

   La creación segura del pedido (transacción, re-lectura de precios, descuento
   de stock, dedup, quote_changed) ya está blindada en audit-secure-orders.js.
   Esta auditoría cubre el resto del ciclo de vida y la integridad:

   - Edición completa en el panel: permisos, validación (sin totales negativos,
     cantidades < 1 ni estados imposibles), preservación de precios históricos,
     total derivado, al menos un producto, anti-doble-guardado, registro de
     auditoría y concurrencia optimista entre administradores.
   - Cambios de estado / estado de pago / eliminación / acciones masivas:
     permisos por rol, registro de auditoría, confirmación destructiva y
     recuperación ante error.
   - Reenvío de correo con cooldown anti-spam.
   - Integridad del pedido: es autocontenido (guarda cliente, envío, ítems con
     precios, subtotal y total), así que sobrevive a que el producto se edite o
     borre; perfil y estadísticas leen esos datos guardados, no el producto en
     vivo, y nunca muestran totales negativos.
   - Reglas de Firestore: cantidad entera 1..99, precio >= 0, subtotal y total
     derivados, 1..4 ítems.

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

const adminApp   = read('js/admin-app.js');
const perfil     = read('perfil.html');
const orderStats = read('js/order-stats.js');
const rules      = read('firestore.rules');
const secureOrder = read('js/secure-checkout-order.js');
const inventoryIntegrity = read('js/admin-inventory-integrity.js');
const deleteFix = read('js/admin-order-delete-fix.js');

// ===========================================================================
// 1. EDICIÓN COMPLETA EN EL PANEL (saveOrderEdit)
// ===========================================================================
check(
  'Editar el pedido completo exige permiso manageOrdersFull + editarCompleto',
  /can\(currentRole, 'manageOrdersFull'\) \|\| !roleCanDo\('pedidos', 'editarCompleto'\)/.test(adminApp),
  'saveOrderEdit debe bloquear a quien no tenga el permiso de edición completa.'
);
check(
  'La edición valida nombre y teléfono del cliente',
  /El nombre del cliente es obligatorio/.test(adminApp) &&
    /El teléfono del cliente es obligatorio/.test(adminApp),
  'No se debe guardar un pedido sin nombre ni teléfono.'
);
check(
  'La edición rechaza cantidades menores a 1',
  /items\.some\(i => !i\.qty \|\| i\.qty < 1\)/.test(adminApp) &&
    /Las cantidades deben ser al menos 1/.test(adminApp),
  'Una cantidad inválida no debe poder guardarse.'
);
check(
  'La edición rechaza totales negativos',
  /if \(total < 0\)/.test(adminApp) &&
    /El total no puede ser negativo/.test(adminApp),
  'Un total negativo nunca debe guardarse.'
);
check(
  'La cantidad por ítem se clampa a un mínimo de 1',
  /Math\.max\(1, parseInt\(val\) \|\| 1\)/.test(adminApp),
  'El input de cantidad debe forzar un mínimo de 1.'
);
check(
  'El pedido no puede quedar sin productos',
  /El pedido debe tener al menos un producto/.test(adminApp),
  'removeOeItem debe impedir quitar el último producto.'
);
check(
  'El recálculo preserva el precio histórico de cada ítem',
  /reduce\(\(s, i\) => s \+ \(i\.price\|\|0\)\*\(i\.qty\|\|1\), 0\)/.test(adminApp) &&
    /const total = subtotal \+ shipCost/.test(adminApp),
  'El total debe derivar del precio guardado en el pedido, no de un producto en vivo.'
);
check(
  'La edición previene el doble guardado deshabilitando el botón',
  /oe-save-btn'\);[\s\S]{0,80}btn\.disabled = true/.test(adminApp),
  'El botón de guardar debe deshabilitarse mientras escribe.'
);
check(
  'La edición registra el cambio en Auditoría',
  /logAudit\('editar_pedido'/.test(adminApp) &&
    /editar_pedido:\s*'/.test(adminApp),
  'Editar un pedido debe dejar rastro con su etiqueta en el registro.'
);

// ===========================================================================
// 2. CONCURRENCIA ENTRE ADMINISTRADORES (optimistic locking)
// ===========================================================================
check(
  'Al abrir el editor se guarda la marca de tiempo base del pedido',
  /_orderEditBaselineMillis = toJsDate_\(o\.updatedAt\)\?\.getTime\(\)/.test(adminApp),
  'Se necesita el updatedAt original para detectar escrituras de otro administrador.'
);
check(
  'Guardar comprueba que nadie más haya escrito el pedido (fail-open)',
  /const freshSnap = await getDoc\(doc\(db, 'orders', orderId\)\)/.test(adminApp) &&
    /freshMillis > _orderEditBaselineMillis/.test(adminApp) &&
    /Otro administrador modificó este pedido/.test(adminApp),
  'saveOrderEdit debe abortar si el pedido cambió desde que se abrió el editor.'
);
check(
  'El editor también avisa si el pedido fue eliminado mientras se editaba',
  /if \(!freshSnap\.exists\(\)\)/.test(adminApp),
  'Guardar sobre un pedido borrado debe avisar en vez de recrearlo.'
);

// ===========================================================================
// 3. ESTADOS / PAGO / ELIMINACIÓN / MASIVAS
// ===========================================================================
check(
  'Cambiar estado de pedido: permiso + auditoría + recuperación',
  /window\.updateOrderStatus[\s\S]{0,120}roleCanDo\('pedidos', 'cambiarEstado'\)/.test(adminApp) &&
    /logAudit\('cambiar_estado_pedido'/.test(adminApp) &&
    /No se pudo guardar el estado\. Probá de nuevo\./.test(adminApp),
  'El cambio de estado debe validar permiso, auditar y reponer el valor si falla.'
);
check(
  'Cambiar estado de pago: permiso + auditoría + recuperación',
  /window\.updatePayStatus[\s\S]{0,120}roleCanDo\('pedidos', 'cambiarPago'\)/.test(adminApp) &&
    /logAudit\('cambiar_estado_pago'/.test(adminApp) &&
    /No se pudo guardar el estado de pago\. Probá de nuevo\./.test(adminApp),
  'El cambio de estado de pago debe validar permiso, auditar y reponer si falla.'
);
check(
  'Eliminar pedido: permiso + confirmación destructiva + auditoría',
  /roleCanDo\('pedidos', 'eliminar'\)/.test(adminApp) &&
    /confirm\('¿Eliminar este pedido\? Esta acción no se puede deshacer\.'\)/.test(adminApp) &&
    /logAudit\('eliminar_pedido'/.test(adminApp),
  'La eliminación debe pedir confirmación, respetar el permiso y auditar.'
);
check(
  'Eliminar pedido libera inventario antes de borrar y no depende de reglas nuevas',
  /lastInventoryAction:\s*'release'/.test(inventoryIntegrity) &&
    !/lastInventoryAction:\s*'delete-release'/.test(inventoryIntegrity) &&
    /const releaseResult = await runTransaction/.test(inventoryIntegrity) &&
    /inventoryState:\s*'released'/.test(inventoryIntegrity) &&
    /if \(orderReservesInventory\(orderSnapshot\.data\(\) \|\| \{\}\)\)/.test(inventoryIntegrity) &&
    !/isSuperAdmin\(\) && !orderExistsAfter/.test(rules),
  'La devolución debe quedar confirmada antes de borrar para funcionar con las reglas ya publicadas y soportar reintentos.'
);
check(
  'La eliminación individual informa el motivo real y expone el resultado al sincronizador',
  /function orderDeleteErrorMessage_/.test(adminApp) &&
    /return \{ \.\.\.result, orderBefore \}/.test(adminApp) &&
    /if \(result\?\.deleted\) await syncDeletedOrder/.test(deleteFix),
  'No debe ocultarse toda falla detrás de un mensaje genérico ni releerse el pedido solo para comprobar si se borró.'
);
check(
  'La eliminación masiva conserva los fallos y recalcula solo cuentas afectadas',
  /const deletedOrders = \[\]/.test(adminApp) &&
    /const failed = \[\]/.test(adminApp) &&
    /failed\.forEach\(item => _selectedOrders\.add\(item\.id\)\)/.test(adminApp) &&
    !/recalculateAllUserOrderStats/.test(deleteFix),
  'Un fallo intermedio no debe ocultar los pedidos ya eliminados ni disparar una lectura global de usuarios y pedidos.'
);
check(
  'El panel fuerza una versión nueva de los módulos corregidos',
  /admin-app\.js\?v=tintin-20260722-order-delete-2/.test(read('admin.html')) &&
    /admin-inventory-integrity\.js\?v=tintin-20260722-order-delete-2/.test(adminApp) &&
    /TT_CACHE_VERSION = 'tintin-20260722-order-delete-2'/.test(read('js/page-loader.js')),
  'El navegador no debe conservar en caché la versión que todavía fallaba al eliminar.'
);
check(
  'Las acciones masivas de pedidos exigen el permiso accionesMasivas',
  /roleCanDo\('pedidos', 'accionesMasivas'\)/.test(adminApp),
  'Los cambios masivos deben validar el permiso de acciones masivas.'
);
check(
  'El reenvío de correo tiene cooldown anti-spam y permiso',
  /RESEND_COOLDOWN_SECONDS = 60/.test(adminApp) &&
    /function resendCooldownRemaining_/.test(adminApp) &&
    /roleCanDo\('pedidos', 'reenviarCorreo'\)/.test(adminApp),
  'El reenvío debe respetar un cooldown y el permiso correspondiente.'
);

// ===========================================================================
// 4. INTEGRIDAD / CONSISTENCIA ENTRE SUPERFICIES
// ===========================================================================
check(
  'El pedido se crea autocontenido con ítems, precios, subtotal y total',
  /transaction\.set\(orderRef, orderData\)/.test(secureOrder) &&
    /subtotal/.test(secureOrder) &&
    /total/.test(secureOrder),
  'El pedido debe guardar su propia copia de líneas y montos para sobrevivir cambios de catálogo.'
);
check(
  'El perfil del cliente lee los datos guardados del pedido (no el producto en vivo)',
  /o\.total/.test(perfil) &&
    /o\.items/.test(perfil) &&
    /escapeHtmlPerfil\(/.test(perfil),
  'El historial del cliente debe mostrar el total e ítems guardados, escapados.'
);
check(
  'Las estadísticas nunca suman totales negativos',
  /Math\.max\(0, validForSpent\.reduce\(\(sum, o\) => sum \+ Number\(o\.total \|\| 0\), 0\)\)/.test(orderStats),
  'El gasto acumulado debe estar acotado a >= 0.'
);

// ===========================================================================
// 5. REGLAS DE FIRESTORE (integridad de creación)
// ===========================================================================
check(
  'Las reglas exigen cantidad entera entre 1 y 99',
  /item\.qty is int && item\.qty >= 1 && item\.qty <= 99/.test(rules),
  'Las reglas no deben aceptar cantidades 0, negativas o absurdas.'
);
check(
  'Las reglas exigen precio no negativo',
  /item\.price is number && item\.price >= 0/.test(rules),
  'Las reglas no deben aceptar precios negativos.'
);
check(
  'Las reglas derivan subtotal y total de las líneas validadas',
  /data\.subtotal ==/.test(rules) &&
    /data\.total == data\.subtotal \+ data\.shippingCost/.test(rules),
  'El total debe ser exactamente subtotal + envío, sin números inventados.'
);
check(
  'Las reglas acotan la cantidad de ítems distintos (1..4)',
  /items\.size\(\) >= 1 && items\.size\(\) <= 4/.test(rules),
  'El plan gratuito limita los ítems por pedido para no exceder lecturas.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de pedidos fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de pedidos completada correctamente (${checks.length} comprobaciones).`);
