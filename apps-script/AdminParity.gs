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
var TINTIN_PARITY_NEW_ORDER_SHEET = 'Nuevo pedido web';
var TINTIN_PARITY_NEW_ORDER_ACTION_CELL = 'B17';
var TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW = 21;
var TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW = 40;

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

function tintinParityOrderRow_(orderId, order) {
  order = order && typeof order === 'object' ? order : {};
  var shipping = order.shipping && typeof order.shipping === 'object' ? order.shipping : {};
  var payment = order.payment && typeof order.payment === 'object' ? order.payment : {};
  var invoice = order.invoice && typeof order.invoice === 'object' ? order.invoice : {};
  var items = Array.isArray(order.itemsSnapshot) ? order.itemsSnapshot : (Array.isArray(order.items) ? order.items : []);
  return [
    orderId || order.orderId || '',
    order.orderNumber || order.shortId || '',
    order.requestId || '',
    order.customerId || '',
    order.userId || '',
    order.userEmail || '',
    order.contactEmail || '',
    order.userName || '',
    order.userPhone || '',
    order.ci || '',
    order.status || '',
    order.paymentMethod || payment.method || '',
    order.paymentStatus || payment.status || '',
    order.shippingMethod || shipping.method || '',
    order.shippingCity || shipping.city || '',
    order.departamento || shipping.departamento || '',
    order.address || shipping.address || '',
    order.subtotal == null ? '' : order.subtotal,
    order.shippingCost == null ? '' : order.shippingCost,
    order.total == null ? '' : order.total,
    order.invoiceWanted === true || invoice.wanted === true,
    order.razonSocial || invoice.razonSocial || '',
    order.ruc || invoice.ruc || '',
    JSON.stringify(items),
    tintinDateFromIso_(order.createdAt),
    tintinDateFromIso_(order.updatedAt),
    order.inventoryState || '',
    order.notificationStatus || '',
    order.lastChangeId || '',
    order.notes || '',
    order.reference || shipping.referencia || shipping.reference || ''
  ];
}

function tintinParityUpsertOrder_(orderId, order) {
  var safeId = String(orderId || (order && order.orderId) || '').trim();
  if (!safeId) throw new Error('Pedido inválido para reflejar en Sheets.');
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_ORDERS_SHEET);
  if (!sheet) throw new Error('No existe Pedidos web.');
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var found = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(safeId).matchEntireCell(true).findNext()
    : null;
  var rowNumber = found ? found.getRow() : Math.max(2, lastRow + 1);
  sheet.getRange(rowNumber, 1, 1, TINTIN_PARITY_ORDERS_WIDTH).setValues([
    tintinParityOrderRow_(safeId, order || {})
  ]);
  return rowNumber;
}

// Se llama desde CrearPedido.gs DESPUÉS del commit de Firestore. Si Sheets
// falla, el checkout no se revierte: el reconciliador de un minuto recupera el
// pedido desde Firestore en el siguiente ciclo.
function tintinParityUpsertCheckoutOrder_(orderId, orderData) {
  try {
    var row = tintinParityUpsertOrder_(orderId, orderData);
    tintinRecordSyncSafely_('SYNCED', TINTIN_ORDERS_SHEET, 'A' + row, 'Pedido de checkout reflejado inmediatamente desde Firestore.');
    return { ok: true, row: row };
  } catch (error) {
    tintinRecordSyncSafely_('ERROR', TINTIN_ORDERS_SHEET, 'checkout→sheets', String(error && error.message || error));
    return { ok: false, error: String(error && error.message || error) };
  }
}

function tintinParitySecretMatches_(provided) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET') || '');
  var value = String(provided || '');
  if (!expected || value.length !== expected.length) return false;
  var difference = 0;
  for (var i = 0; i < value.length; i += 1) difference |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

// Helper para el router doPost: Cloudflare puede empujar el pedido confirmado
// inmediatamente. El secreto viaja server-to-server en el body porque Apps
// Script no expone headers arbitrarios de forma fiable en el evento doPost.
function tintinParityHandleServerOrderSync_(body) {
  if (!body || body.action !== 'syncOrder') return null;
  if (!tintinParitySecretMatches_(body.secret)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No autorizado' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var row = tintinParityUpsertOrder_(String(body.orderId || ''), body.order || {});
    return ContentService.createTextOutput(JSON.stringify({ ok: true, row: row }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error && error.message || error).slice(0, 300) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
    schemaVersion: 6
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
      if (result.order) tintinParityUpsertOrder_(orderId, result.order);
      tintinRecordSyncSafely_('SYNCED', sheet.getName(), cell, 'Pedido sincronizado por el mismo dominio de inventario que Superadmin.');
    } catch (error) {
      var httpStatus = Number(error && error.tintinHttpStatus || 0);
      var rejected = httpStatus === 400 || httpStatus === 409;
      tintinRecordSyncSafely_(rejected ? 'REJECTED' : 'ERROR', sheet.getName(), cell, String(error && error.message || error));
      tintinPullOrdersParity_();
      throw error;
    }
  }
  tintinPullOrdersParity_();
}

function tintinHandleUserParityEdit_(e) {
  if (!e || !e.range || e.range.getRow() < TINTIN_USERS_FIRST_ROW) return;
  var column = e.range.getColumn();
  if ([TINTIN_USERS_COL.role, TINTIN_USERS_COL.blocked, TINTIN_USERS_COL.internalNotes, TINTIN_USERS_COL.action].indexOf(column) === -1) {
    tintinPullUsersFromWeb_();
    tintinRecordSyncSafely_('REJECTED', e.range.getSheet().getName(), e.range.getA1Notation(), 'La columna de usuario es informativa.');
    return;
  }
  var sheet = e.range.getSheet();
  var row = sheet.getRange(e.range.getRow(), 2, 1, TINTIN_USERS_COL.lastChangeId - 1).getValues()[0];
  var at = function(col) { return row[col - 2]; };
  var uid = String(at(TINTIN_USERS_COL.uid) || '').trim();
  if (!uid) return;
  var actionValue = String(at(TINTIN_USERS_COL.action) || '').trim().toUpperCase();
  var action = actionValue === 'ELIMINAR' ? 'softDeleteUser' : actionValue === 'REACTIVAR' ? 'reactivateUser' : 'updateUser';
  var changeId = 'sheet_' + Utilities.getUuid().replace(/-/g, '');
  var payload = {
    entity: 'user', action: action, uid: uid,
    role: String(at(TINTIN_USERS_COL.role) || '').trim().toLowerCase(), blocked: tintinBool_(at(TINTIN_USERS_COL.blocked)),
    internalNotes: String(at(TINTIN_USERS_COL.internalNotes) || ''), changeId: changeId,
    baseChangeId: String(at(TINTIN_USERS_COL.lastChangeId) || '').trim(),
    source: 'google-sheets:Usuarios web', schemaVersion: 6
  };
  tintinRecordSyncSafely_('SYNCING', sheet.getName(), e.range.getA1Notation(), 'Sincronizando cuenta web.');
  try {
    var response = tintinParityCallWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    var result = response.result || {};
    sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.lastChangeId).setValue(result.changeId || changeId);
    if (action === 'softDeleteUser') sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.blocked).setValue('Sí');
    if (action === 'reactivateUser') sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.blocked).setValue('No');
    if (action !== 'updateUser') sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.action).clearContent();
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
    return tintinParityOrderRow_(order.orderId, order);
  });
  return tintinReplaceTabRows_(TINTIN_ORDERS_SHEET, 2, TINTIN_PARITY_ORDERS_WIDTH, rows);
}

function tintinParityValidation_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function tintinParityPrepareNewOrderSheet_() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(TINTIN_PARITY_NEW_ORDER_SHEET);
  var created = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(TINTIN_PARITY_NEW_ORDER_SHEET);
    created = true;
  }
  if (created || String(sheet.getRange('A1').getValue() || '') !== '🧾 Nuevo pedido web') {
    sheet.clear();
    sheet.getRange('A1:E1').merge().setValue('🧾 Nuevo pedido web');
    sheet.getRange('A2:E2').merge().setValue('Completá el pedido y elegí CREAR. TINPED, precios, total y stock se calculan en Firestore; la planilla no puede inventarlos.');
    sheet.getRange('A3:A17').setValues([
      ['Nombre'], ['Teléfono'], ['Email'], ['Cédula'], ['Estado'], ['Método de pago'], ['Estado de pago'],
      ['Método de entrega'], ['Ciudad'], ['Departamento'], ['Dirección'], ['Referencia'], ['Costo envío (Gs.)'], ['Notas'], ['Acción']
    ]);
    sheet.getRange('A20:E20').setValues([['ID producto', 'Producto', 'Variante', 'Cantidad', 'Precio canónico (Gs.)']]);
    sheet.setFrozenRows(2);
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 250);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 180);
  }

  sheet.getRange('B7').setDataValidation(tintinParityValidation_(['pendiente','confirmado','preparando','listo_retiro','en_camino','entregado','cancelado','rechazado']));
  sheet.getRange('B8').setDataValidation(tintinParityValidation_(['efectivo','transferencia','paypal']));
  sheet.getRange('B9').setDataValidation(tintinParityValidation_(['pendiente','pagado','rechazado','cancelado','reembolsado']));
  sheet.getRange('B10').setDataValidation(tintinParityValidation_(['delivery','encomienda','retiro']));
  sheet.getRange(TINTIN_PARITY_NEW_ORDER_ACTION_CELL).setDataValidation(tintinParityValidation_(['CREAR']));

  if (!String(sheet.getRange('B7').getValue() || '')) sheet.getRange('B7').setValue('pendiente');
  if (!String(sheet.getRange('B8').getValue() || '')) sheet.getRange('B8').setValue('efectivo');
  if (!String(sheet.getRange('B9').getValue() || '')) sheet.getRange('B9').setValue('pendiente');
  if (!String(sheet.getRange('B10').getValue() || '')) sheet.getRange('B10').setValue('delivery');
  if (sheet.getRange('B15').getValue() === '') sheet.getRange('B15').setValue(0);

  var products = spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (products) {
    var productRange = products.getRange(TINTIN_PRODUCTS_FIRST_ROW, 1, Math.max(1, products.getMaxRows() - TINTIN_PRODUCTS_FIRST_ROW + 1), 1);
    sheet.getRange(TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW, 1, TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW - TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW + 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(productRange, true).setAllowInvalid(false).build());
  }

  for (var row = TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW; row <= TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW; row += 1) {
    sheet.getRange(row, 2).setFormula('=IFERROR(VLOOKUP(A' + row + ',Productos!$A$7:$F$1000,2,FALSE),"")');
    sheet.getRange(row, 5).setFormula('=IFERROR(VLOOKUP(A' + row + ',Productos!$A$7:$F$1000,6,FALSE),"")');
  }
  sheet.getRange('B20').setNote('Nombre informativo tomado de Productos. El servidor vuelve a leer el producto al crear.');
  sheet.getRange('E20').setNote('Precio informativo. El servidor ignora cualquier precio local y usa Firestore.');
  return sheet;
}

function tintinParityResetNewOrderSheet_(sheet) {
  sheet.getRange('B3:B6').clearContent();
  sheet.getRange('B11:B16').clearContent();
  sheet.getRange('B7').setValue('pendiente');
  sheet.getRange('B8').setValue('efectivo');
  sheet.getRange('B9').setValue('pendiente');
  sheet.getRange('B10').setValue('delivery');
  sheet.getRange('B15').setValue(0);
  sheet.getRange(TINTIN_PARITY_NEW_ORDER_ACTION_CELL).clearContent();
  sheet.getRange(TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW, 1, TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW - TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW + 1, 1).clearContent();
  sheet.getRange(TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW, 3, TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW - TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW + 1, 2).clearContent();
  tintinParityPrepareNewOrderSheet_();
}

function tintinParityCreateOrderPayload_(sheet) {
  var form = sheet.getRange('B3:B16').getValues().map(function(row) { return row[0]; });
  var shippingCost = Number(form[12] || 0);
  if (!isFinite(shippingCost) || shippingCost < 0) throw new Error('Costo de envío inválido.');
  var itemRows = sheet.getRange(
    TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW,
    1,
    TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW - TINTIN_PARITY_NEW_ORDER_FIRST_ITEM_ROW + 1,
    4
  ).getValues();
  var items = itemRows.filter(function(row) { return String(row[0] || '').trim(); }).map(function(row) {
    var qty = Number(row[3] || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error('Cada cantidad debe ser un entero entre 1 y 99.');
    return { id: String(row[0] || '').trim(), variant: String(row[2] || '').trim(), qty: qty };
  });
  if (!items.length) throw new Error('Agregá al menos un producto.');
  return {
    entity: 'order',
    action: 'createOrder',
    userName: String(form[0] || '').trim(),
    userPhone: String(form[1] || '').trim(),
    contactEmail: String(form[2] || '').trim(),
    ci: String(form[3] || '').trim(),
    status: String(form[4] || 'pendiente').trim(),
    paymentMethod: String(form[5] || 'efectivo').trim(),
    paymentStatus: String(form[6] || 'pendiente').trim(),
    shippingMethod: String(form[7] || 'delivery').trim(),
    shippingCity: String(form[8] || '').trim(),
    departamento: String(form[9] || '').trim(),
    address: String(form[10] || '').trim(),
    reference: String(form[11] || '').trim(),
    shippingCost: shippingCost,
    notes: String(form[13] || '').trim(),
    items: items,
    changeId: 'sheet_create_' + Utilities.getUuid().replace(/-/g, ''),
    source: 'google-sheets:Nuevo pedido web',
    schemaVersion: 6
  };
}

function tintinHandleNewOrderParityEdit_(e) {
  if (!e || !e.range) return;
  var rowStart = e.range.getRow();
  var rowEnd = rowStart + e.range.getNumRows() - 1;
  var colStart = e.range.getColumn();
  var colEnd = colStart + e.range.getNumColumns() - 1;
  if (!(rowStart <= 17 && rowEnd >= 17 && colStart <= 2 && colEnd >= 2)) return;
  var sheet = e.range.getSheet();
  if (String(sheet.getRange(TINTIN_PARITY_NEW_ORDER_ACTION_CELL).getValue() || '').trim().toUpperCase() !== 'CREAR') return;

  tintinRecordSyncSafely_('SYNCING', sheet.getName(), TINTIN_PARITY_NEW_ORDER_ACTION_CELL, 'Creando pedido canónico desde Sheets.');
  try {
    var payload = tintinParityCreateOrderPayload_(sheet);
    var response = tintinParityCallWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    var result = response.result || {};
    if (!result.orderId || !result.order) throw new Error('La tienda no devolvió el pedido confirmado.');
    var row = tintinParityUpsertOrder_(result.orderId, result.order);
    tintinRecordSyncSafely_('SYNCED', TINTIN_ORDERS_SHEET, 'A' + row, 'Pedido ' + (result.orderNumber || result.orderId) + ' creado desde Sheets con TINPED, total y stock canónicos.');
    tintinParityResetNewOrderSheet_(sheet);
  } catch (error) {
    sheet.getRange(TINTIN_PARITY_NEW_ORDER_ACTION_CELL).clearContent();
    var status = [400, 409].indexOf(Number(error && error.tintinHttpStatus || 0)) >= 0 ? 'REJECTED' : 'ERROR';
    tintinRecordSyncSafely_(status, sheet.getName(), TINTIN_PARITY_NEW_ORDER_ACTION_CELL, String(error && error.message || error));
    throw error;
  }
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
    var roleCol = tintinColumnLetter_(TINTIN_USERS_COL.role);
    var blockedCol = tintinColumnLetter_(TINTIN_USERS_COL.blocked);
    var actionCol = tintinColumnLetter_(TINTIN_USERS_COL.action);
    users.getRange(roleCol + TINTIN_USERS_FIRST_ROW + ':' + roleCol).setDataValidation(tintinParityValidation_(['client','viewer','agent','admin']));
    users.getRange(blockedCol + TINTIN_USERS_FIRST_ROW + ':' + blockedCol).setDataValidation(tintinParityValidation_(['Sí','No']));
    users.getRange(actionCol + TINTIN_USERS_FIRST_ROW + ':' + actionCol).setDataValidation(tintinParityValidation_(['ELIMINAR','REACTIVAR']));
    users.getRange(actionCol + TINTIN_USERS_HEADER_ROW).setNote('Acción administrativa segura: ELIMINAR crea tombstone; REACTIVAR restaura la cuenta. Nunca se destruye el UID histórico desde Sheets.');
  }
  tintinParityPrepareNewOrderSheet_();
  return { ok: true, ordersWidth: TINTIN_PARITY_ORDERS_WIDTH, users: !!users, newOrderSheet: true };
}

function tintinDespacharEdicionParidad(e) {
  if (!e || !e.range) return;
  if (tintinIsRowPushInProgress_(e.range.getSheet(), e.range.getRow()) || tintinIsSheetPushInProgress_(e.range.getSheet())) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === TINTIN_PRODUCTS_SHEET) return tintinHandleProductEdit_(e);
  if (sheetName === TINTIN_USERS_SHEET) return tintinHandleUserParityEdit_(e);
  if (sheetName === TINTIN_ORDERS_SHEET) return tintinHandleOrderParityEdit_(e);
  if (sheetName === TINTIN_PARITY_NEW_ORDER_SHEET) return tintinHandleNewOrderParityEdit_(e);
  if (sheetName === 'Resenas' && typeof tintinEngagementOnEdit === 'function') return tintinEngagementOnEdit(e);
  tintinRecordSyncSafely_('LOCAL', sheetName, e.range.getA1Notation(), 'Edición local; no requiere sincronización remota.');
}

function tintinReconciliarAdminParidad() {
  var summary = {};
  summary.users = tintinPullUsersFromWeb_();
  summary.orders = tintinPullOrdersParity_();
  summary.audit = tintinPullAuditFromWeb_();
  // El resumen de reconciliación no se registra en Historial sync: esa pestaña
  // conserva metadatos legacy que provocan un fallo de lectura en Apps Script.
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
  ScriptApp.newTrigger(TINTIN_PARITY_RECONCILER).timeBased().everyMinutes(1).create();
  var summary = tintinReconciliarAdminParidad();
  return {
    ok: true,
    dispatcher: TINTIN_PARITY_DISPATCHER,
    reconciler: TINTIN_PARITY_RECONCILER,
    writableSheets: [TINTIN_PRODUCTS_SHEET, TINTIN_USERS_SHEET, TINTIN_ORDERS_SHEET, TINTIN_PARITY_NEW_ORDER_SHEET],
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
    orderCreationUsesCanonicalSequence: response.orderCreationUsesCanonicalSequence === true,
    dispatcherTriggers: parityEdit,
    reconciliationTriggers: parityReconcile,
    reconciliationMinutes: 1
  };
}
