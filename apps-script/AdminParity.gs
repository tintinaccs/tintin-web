// TINTIN — Paridad administrativa Google Sheets ↔ Firestore ↔ Superadmin.
//
// Esta capa NO duplica reglas de negocio. El spreadsheet actúa como otra
// superficie administrativa y envía las mutaciones al mismo dominio server-side
// que usa Superadmin. Productos reutiliza ProductosUnificados.gs; Auditoría e
// Historial sync continúan siendo solo lectura/append-only.

var TINTIN_PARITY_DISPATCHER = 'tintinDespacharEdicionParidad';
var TINTIN_PARITY_RECONCILER = 'tintinReconciliarAdminParidad';
var TINTIN_PARITY_ORDERS_WIDTH = 31;
var TINTIN_PARITY_ORDER_NOTES_COLUMN = 30;
var TINTIN_PARITY_ORDER_REFERENCE_COLUMN = 31;

function tintinParityCallWebhook_(path, payload) {
  var response = UrlFetchApp.fetch(tintinStoreOrigin_() + path, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'X-Tintin-Sheets-Secret': tintinWebhookSecret_() },
    payload: JSON.stringify(payload)
  });
  var body = tintinParseJsonResponse_(response);
  var status = response.getResponseCode();
  if (status < 200 || status >= 300 || body.ok !== true) {
    var error = new Error(body.error || 'La tienda rechazó la sincronización.');
    error.tintinHttpStatus = status;
    error.tintinCode = String(body.code || '');
    throw error;
  }
  return body;
}

function tintinParityOrderFieldsForColumns_(firstColumn, columnCount) {
  var byColumn = {
    7: 'contactEmail',
    8: 'userName',
    9: 'userPhone',
    10: 'ci',
    11: 'status',
    12: 'paymentMethod',
    13: 'paymentStatus',
    14: 'shippingMethod',
    15: 'shippingCity',
    16: 'departamento',
    17: 'address',
    19: 'shippingCost',
    30: 'notes',
    31: 'reference'
  };
  var fields = [];
  for (var column = firstColumn; column < firstColumn + columnCount; column += 1) {
    var field = byColumn[column];
    if (field && fields.indexOf(field) === -1) fields.push(field);
  }
  return fields;
}

function tintinParityOrderPayload_(sheet, rowNumber, fields) {
  var row = sheet.getRange(rowNumber, 1, 1, TINTIN_PARITY_ORDERS_WIDTH).getValues()[0];
  var payload = {
    entity: 'order',
    action: 'updateOrder',
    orderId: String(row[0] || '').trim(),
    changeId: 'sheet_' + Utilities.getUuid().replace(/-/g, ''),
    baseChangeId: String(row[28] || '').trim(),
    source: 'google-sheets:Pedidos web',
    schemaVersion: 5
  };
  var values = {
    contactEmail: row[6],
    userName: row[7],
    userPhone: row[8],
    ci: row[9],
    status: row[10],
    paymentMethod: row[11],
    paymentStatus: row[12],
    shippingMethod: row[13],
    shippingCity: row[14],
    departamento: row[15],
    address: row[16],
    shippingCost: row[18],
    notes: row[29],
    reference: row[30]
  };
  fields.forEach(function(field) { payload[field] = values[field]; });
  return payload;
}

function tintinHandleOrderParityEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 2) return;
  var sheet = e.range.getSheet();
  var fields = tintinParityOrderFieldsForColumns_(e.range.getColumn(), e.range.getNumColumns());
  if (!fields.length) {
    // Las columnas derivadas/identitarias son informativas. Si alguien intenta
    // cambiarlas, se restaura el snapshot canónico en vez de aceptar una
    // segunda autoridad local.
    tintinPullOrdersParity_();
    tintinRecordSyncSafely_('REJECTED', sheet.getName(), e.range.getA1Notation(), 'La columna es informativa; Firestore conserva la autoridad del dato.');
    return;
  }

  for (var rowNumber = e.range.getRow(); rowNumber < e.range.getRow() + e.range.getNumRows(); rowNumber += 1) {
    var orderId = String(sheet.getRange(rowNumber, 1).getValue() || '').trim();
    if (!orderId) continue;
    var cell = sheet.getRange(rowNumber, e.range.getColumn(), 1, e.range.getNumColumns()).getA1Notation();
    var payload = tintinParityOrderPayload_(sheet, rowNumber, fields);
    tintinRecordSyncSafely_('SYNCING', sheet.getName(), cell, 'Sincronizando pedido: ' + fields.join(', ') + '.');
    try {
      var response = tintinParityCallWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
      var result = response.result || {};
      sheet.getRange(rowNumber, 29).setValue(result.changeId || payload.changeId);
      tintinRecordSyncSafely_('SYNCED', sheet.getName(), cell, 'Pedido sincronizado por el mismo dominio de inventario que Superadmin.');
    } catch (error) {
      var httpStatus = Number(error && error.tintinHttpStatus || 0);
      var rejected = httpStatus === 400 || httpStatus === 409;
      tintinRecordSyncSafely_(rejected ? 'REJECTED' : 'ERROR', sheet.getName(), cell, String(error && error.message || error));
      // Ante rechazo/conflicto se restaura inmediatamente la versión canónica.
      // Ante indisponibilidad también se refresca para no dejar una celda que
      // parezca confirmada cuando Firestore todavía no la aceptó.
      tintinPullOrdersParity_();
      throw error;
    }
  }
  // Devuelve totales, inventoryState, updatedAt y cualquier normalización hecha
  // por el servidor, evitando que la planilla invente valores derivados.
  tintinPullOrdersParity_();
}

function tintinHandleUserParityEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 7) return;
  var column = e.range.getColumn();
  if ([6, 7, 10, 11].indexOf(column) === -1) {
    tintinPullUsersFromWeb_();
    tintinRecordSyncSafely_('REJECTED', e.range.getSheet().getName(), e.range.getA1Notation(), 'La columna de usuario es informativa.');
    return;
  }
  var sheet = e.range.getSheet();
  var row = sheet.getRange(e.range.getRow(), 2, 1, 18).getValues()[0];
  var uid = String(row[0] || '').trim();
  if (!uid) return;
  var actionValue = String(row[9] || '').trim().toUpperCase();
  var action = actionValue === 'ELIMINAR' ? 'softDeleteUser' : actionValue === 'REACTIVAR' ? 'reactivateUser' : 'updateUser';
  var changeId = 'sheet_' + Utilities.getUuid().replace(/-/g, '');
  var payload = {
    entity: 'user', action: action, uid: uid,
    role: String(row[4] || '').trim().toLowerCase(), blocked: tintinBool_(row[5]),
    internalNotes: String(row[8] || ''), changeId: changeId,
    baseChangeId: String(row[17] || '').trim(),
    source: 'google-sheets:Usuarios web', schemaVersion: 5
  };
  tintinRecordSyncSafely_('SYNCING', sheet.getName(), e.range.getA1Notation(), 'Sincronizando cuenta web.');
  try {
    var response = tintinParityCallWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    var result = response.result || {};
    sheet.getRange(e.range.getRow(), 19).setValue(result.changeId || changeId);
    if (action === 'softDeleteUser') sheet.getRange(e.range.getRow(), 7).setValue('Sí');
    if (action === 'reactivateUser') sheet.getRange(e.range.getRow(), 7).setValue('No');
    if (action !== 'updateUser') sheet.getRange(e.range.getRow(), 11).clearContent();
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Cuenta web sincronizada por lifecycle canónico.');
  } catch (error) {
    tintinPullUsersFromWeb_();
    var status = [400, 409].indexOf(Number(error && error.tintinHttpStatus || 0)) >= 0 ? 'REJECTED' : 'ERROR';
    tintinRecordSyncSafely_(status, sheet.getName(), e.range.getA1Notation(), String(error && error.message || error));
    throw error;
  }
}

function tintinPullOrdersParity_() {
  var rows = tintinSnapshot_('orders').map(function(order) {
    return [order.orderId, order.orderNumber, order.requestId, order.customerId, order.userId, order.userEmail,
      order.contactEmail, order.userName, order.userPhone, order.ci, order.status, order.paymentMethod,
      order.paymentStatus, order.shippingMethod, order.shippingCity, order.departamento, order.address,
      order.subtotal, order.shippingCost, order.total, order.invoiceWanted, order.razonSocial, order.ruc,
      JSON.stringify(order.itemsSnapshot || []), tintinDateFromIso_(order.createdAt), tintinDateFromIso_(order.updatedAt),
      order.inventoryState, order.notificationStatus, order.lastChangeId, order.notes || '', order.reference || ''];
  });
  return tintinReplaceTabRows_(TINTIN_ORDERS_SHEET, 2, TINTIN_PARITY_ORDERS_WIDTH, rows);
}

function tintinParityValidation_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function tintinPrepararHojasParidad_() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var orders = spreadsheet.getSheetByName(TINTIN_ORDERS_SHEET);
  if (!orders) throw new Error('No existe Pedidos web.');
  orders.getRange(1, 30, 1, 2).setValues([['notes', 'reference']]);
  orders.getRange('K2:K').setDataValidation(tintinParityValidation_(['pendiente','confirmado','preparando','listo_retiro','en_camino','entregado','cancelado','rechazado']));
  orders.getRange('L2:L').setDataValidation(tintinParityValidation_(['efectivo','transferencia','paypal']));
  orders.getRange('M2:M').setDataValidation(tintinParityValidation_(['pendiente','pagado','rechazado','cancelado','reembolsado']));
  orders.getRange('N2:N').setDataValidation(tintinParityValidation_(['delivery','encomienda','retiro']));
  orders.getRange('AD1').setNote('Notas internas administrativas. Editable desde Sheets y Superadmin.');
  orders.getRange('AE1').setNote('Referencia de entrega. Editable desde Sheets y Superadmin.');

  var users = spreadsheet.getSheetByName(TINTIN_USERS_SHEET);
  if (users) {
    users.getRange('F7:F').setDataValidation(tintinParityValidation_(['client','viewer','agent','admin']));
    users.getRange('G7:G').setDataValidation(tintinParityValidation_(['Sí','No']));
    users.getRange('K7:K').setDataValidation(tintinParityValidation_(['ELIMINAR','REACTIVAR']));
    users.getRange('K6').setNote('Acción administrativa segura: ELIMINAR crea tombstone; REACTIVAR restaura la cuenta. Nunca se destruye el UID histórico desde Sheets.');
  }
  return { ok: true, ordersWidth: TINTIN_PARITY_ORDERS_WIDTH, users: !!users };
}

function tintinDespacharEdicionParidad(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === TINTIN_PRODUCTS_SHEET) return tintinHandleProductEdit_(e);
  if (sheetName === TINTIN_USERS_SHEET) return tintinHandleUserParityEdit_(e);
  if (sheetName === TINTIN_ORDERS_SHEET) return tintinHandleOrderParityEdit_(e);
  if (sheetName === 'Resenas' && typeof tintinEngagementOnEdit === 'function') return tintinEngagementOnEdit(e);
  tintinRecordSyncSafely_('LOCAL', sheetName, e.range.getA1Notation(), 'Edición local; no requiere sincronización remota.');
}

function tintinReconciliarAdminParidad() {
  var summary = {};
  summary.users = tintinPullUsersFromWeb_();
  summary.orders = tintinPullOrdersParity_();
  summary.audit = tintinPullAuditFromWeb_();
  tintinRecordSyncSafely_('SYNCED', 'Sistema', 'web→sheets', 'Superficies administrativas actualizadas: usuarios ' + summary.users + ', pedidos ' + summary.orders + ', auditoría ' + summary.audit + '.');
  return summary;
}

function tintinInstalarParidadAdministrativa() {
  var spreadsheet = tintinProductsSpreadsheet_();
  tintinPrepararHojasParidad_();

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    var eventType = trigger.getEventType && trigger.getEventType();
    var sourceId = '';
    try { sourceId = trigger.getTriggerSourceId ? (trigger.getTriggerSourceId() || '') : ''; } catch (error) { sourceId = ''; }
    var sameSpreadsheet = !sourceId || sourceId === spreadsheet.getId();
    if (eventType === ScriptApp.EventType.ON_EDIT && sameSpreadsheet) ScriptApp.deleteTrigger(trigger);
    else if (handler === 'tintinReconciliarEspejosWeb' || handler === TINTIN_PARITY_RECONCILER) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger(TINTIN_PARITY_DISPATCHER).forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger(TINTIN_PARITY_RECONCILER).timeBased().everyMinutes(5).create();
  var summary = tintinReconciliarAdminParidad();
  return {
    ok: true,
    dispatcher: TINTIN_PARITY_DISPATCHER,
    reconciler: TINTIN_PARITY_RECONCILER,
    writableSheets: [TINTIN_PRODUCTS_SHEET, TINTIN_USERS_SHEET, TINTIN_ORDERS_SHEET],
    readOnlySheets: [TINTIN_AUDIT_SHEET, TINTIN_SYNC_HISTORY_SHEET],
    summary: summary
  };
}

function tintinDiagnosticarParidadAdministrativa() {
  var response = tintinParityCallWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, { action: 'diagnose', source: 'google-apps-script:parity' });
  var triggers = tintinDiagnosticarActivadores();
  var parityEdit = triggers.filter(function(item) { return item.handler === TINTIN_PARITY_DISPATCHER; }).length;
  var parityReconcile = triggers.filter(function(item) { return item.handler === TINTIN_PARITY_RECONCILER; }).length;
  return {
    ok: response.ok === true && parityEdit === 1 && parityReconcile === 1,
    revision: response.revision || '',
    writableEntities: response.writableEntities || [],
    readOnlyMirrors: response.readOnlyMirrors || [],
    orderMutationsUseInventoryDomain: response.orderMutationsUseInventoryDomain === true,
    dispatcherTriggers: parityEdit,
    reconciliationTriggers: parityReconcile
  };
}
