/* =============================================================
   TINTIN — SINCRONIZACIÓN CANÓNICA DE CUENTAS / PEDIDOS / AUDITORÍA

   Fuente operativa: Firestore.
   Vista administrativa: TINTIN INVENTARIO 2026 — Google Sheets.

   No crea una segunda tabla de usuarios: reutiliza `Usuarios web`, que el
   proyecto ya declara como única vista administrativa de cuentas. Añade
   solamente las columnas canónicas que faltaban. `Pedidos web` y
   `Auditoría web` son espejos operativos; `Historial sync` conserva la
   trazabilidad compartida con el motor de productos.

   El trigger propio ignora `Usuarios web`: sus ediciones existentes siguen
   pasando por `alEditarClientas` y el dispatcher canónico ya desplegado.
   ============================================================= */

var TINTIN_SYNC_SPREADSHEET_ID_ = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
var TINTIN_SYNC_MAX_DOCS_ = 5000;
var TINTIN_SYNC_SHEETS_ = {
  users: 'Usuarios web',
  orders: 'Pedidos web',
  audit: 'Auditoría web',
  meta: 'Historial sync'
};
var TINTIN_SYNC_USERS_HEADER_ROW_ = 6;
var TINTIN_SYNC_USERS_FIRST_ROW_ = 7;

var TINTIN_SYNC_ORDER_HEADERS_ = [
  'orderId','orderNumber','requestId','customerId','userId','userEmail','contactEmail','userName','userPhone','ci',
  'status','paymentMethod','paymentStatus','shippingMethod','shippingCity','departamento','address','subtotal',
  'shippingCost','total','invoiceWanted','razonSocial','ruc','itemsSnapshot','createdAt','updatedAt','inventoryState',
  'notificationStatus','lastChangeId'
];
var TINTIN_SYNC_AUDIT_HEADERS_ = [
  'eventId','timestamp','customerId','actorId','actorEmail','actorRole','action','entityType','entityId','before','after',
  'origin','result','changeId'
];
var TINTIN_SYNC_USER_HEADERS_B_S_ = [
  'UID (oculto)','Nombre','Correo','Fecha de registro','Rol','Bloqueada','Pedidos','Total gastado (Gs.)','Notas internas',
  'Eliminar (solo Super Admin web)','Customer ID','@Username','Teléfono','Cédula','Estado perfil','Último acceso',
  'Cambio @ usado','ID último cambio'
];

function tintinSyncSpreadsheet_() {
  return SpreadsheetApp.openById(TINTIN_SYNC_SPREADSHEET_ID_);
}

function tintinSyncClean_(value, maxLength) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength || 5000);
}

function tintinSyncJson_(value) {
  try {
    return JSON.stringify(value == null ? null : value);
  } catch (error) {
    return JSON.stringify({ error: 'non_serializable' });
  }
}

function tintinSyncDate_(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  var raw = String(value);
  var parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw.slice(0, 80) : parsed.toISOString();
}

function tintinSyncDateDisplay_(value) {
  if (!value) return '';
  var parsed = value instanceof Date ? value : new Date(String(value));
  if (isNaN(parsed.getTime())) return tintinSyncClean_(value, 80);
  return Utilities.formatDate(parsed, 'America/Asuncion', 'dd/MM/yyyy HH:mm:ss');
}

function tintinSyncChangeId_(prefix) {
  return (prefix || 'SYNC') + '_' + Utilities.getUuid().replace(/-/g, '');
}

function tintinSyncEnsureHeaders_(sheet, row, column, expected) {
  var actual = sheet.getRange(row, column, 1, expected.length).getDisplayValues()[0];
  var matches = expected.every(function (header, index) { return actual[index] === header; });
  if (!matches) sheet.getRange(row, column, 1, expected.length).setValues([expected]);
}

function tintinSyncFirestoreList_(collectionId, maxDocs) {
  var all = [];
  var pageToken = '';
  var max = Math.max(1, Math.min(TINTIN_SYNC_MAX_DOCS_, Number(maxDocs || TINTIN_SYNC_MAX_DOCS_)));
  do {
    var queryString = '?pageSize=' + Math.min(300, max - all.length);
    if (pageToken) queryString += '&pageToken=' + encodeURIComponent(pageToken);
    var response = UrlFetchApp.fetch(FIRESTORE_DOCUMENTS_URL_ + collectionId + queryString, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code === 404) return all;
    if (code < 200 || code >= 300) throw new Error('Firestore list ' + collectionId + ' falló HTTP ' + code);
    var body = JSON.parse(response.getContentText() || '{}');
    (body.documents || []).forEach(function (document) {
      var relativeName = String(document.name || '').split('/documents/')[1] || '';
      all.push({ id: relativeName.split('/').pop(), data: phase3DecodeFields_(document.fields || {}) });
    });
    pageToken = body.nextPageToken || '';
  } while (pageToken && all.length < max);
  return all;
}

function tintinSyncFirestoreGet_(collectionId, documentId) {
  var result = phase3FetchDocument_(collectionId + '/' + encodeURIComponent(documentId), ScriptApp.getOAuthToken());
  return result && result.ok ? result.data || {} : null;
}

function tintinSyncFirestorePatch_(collectionId, documentId, patch) {
  var keys = Object.keys(patch || {});
  if (!keys.length) return;
  var masks = keys.map(function (key) { return 'updateMask.fieldPaths=' + encodeURIComponent(key); }).join('&');
  var response = UrlFetchApp.fetch(FIRESTORE_DOCUMENTS_URL_ + collectionId + '/' + encodeURIComponent(documentId) + '?' + masks, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ fields: phase4EncodeFields_(patch) }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Firestore patch ' + collectionId + '/' + documentId + ' falló HTTP ' + code);
}

function tintinSyncUserRow_(id, data, preserved) {
  preserved = preserved || {};
  var customerId = tintinSyncClean_(data.customerId, 180) || ('CUS_' + id);
  var orderCount = Number(data.orderCount || data.totalOrders || data.purchaseCount || 0);
  var totalSpent = Number(data.totalSpent || 0);
  return [
    id,
    tintinSyncClean_(data.name, 160),
    tintinSyncClean_(data.email, 254),
    tintinSyncDateDisplay_(data.createdAt),
    tintinSyncClean_(data.role || 'client', 40),
    data.blocked === true ? 'Sí' : 'No',
    orderCount,
    totalSpent,
    tintinSyncClean_(preserved.notes, 1000),
    '',
    customerId,
    data.username ? '@' + tintinSyncClean_(data.username, 40) : '',
    tintinSyncClean_(data.phone, 40),
    tintinSyncClean_(data.ci, 20),
    tintinSyncClean_(data.profileStatus || 'legacy', 40),
    tintinSyncDateDisplay_(data.lastLogin),
    Number(data.usernameChangeCount || 0) >= 1 ? 'Sí' : 'No',
    tintinSyncClean_(data.lastChangeId, 180)
  ];
}

function tintinSyncOrderRow_(id, data) {
  var shipping = data.shipping || {};
  var payment = data.payment || {};
  var invoice = data.invoice || {};
  var snapshot = data.checkoutSnapshot || data.immutableSnapshot || data.items || [];
  return [
    id,
    tintinSyncClean_(data.orderNumber || data.shortId, 80),
    tintinSyncClean_(data.requestId, 140),
    tintinSyncClean_(data.customerId, 180),
    tintinSyncClean_(data.userId, 180),
    tintinSyncClean_(data.userEmail, 254),
    tintinSyncClean_(data.contactEmail, 254),
    tintinSyncClean_(data.userName, 160),
    tintinSyncClean_(data.userPhone, 50),
    tintinSyncClean_(data.ci, 20),
    tintinSyncClean_(data.status, 50),
    tintinSyncClean_(payment.method, 50),
    tintinSyncClean_(data.paymentStatus || payment.status, 50),
    tintinSyncClean_(shipping.method, 50),
    tintinSyncClean_(shipping.city, 160),
    tintinSyncClean_(shipping.departamento, 100),
    tintinSyncClean_(shipping.address, 500),
    Number(data.subtotal || 0),
    Number(data.shippingCost || 0),
    Number(data.total || 0),
    invoice.wanted === true,
    tintinSyncClean_(invoice.razonSocial, 220),
    tintinSyncClean_(invoice.ruc, 30),
    tintinSyncJson_(snapshot),
    tintinSyncDate_(data.createdAt),
    tintinSyncDate_(data.updatedAt),
    tintinSyncClean_(data.inventoryState, 50),
    tintinSyncClean_(data.notificationStatus, 50),
    tintinSyncClean_(data.lastChangeId, 180)
  ];
}

function tintinSyncAuditRow_(id, data) {
  return [
    tintinSyncClean_(data.eventId || id, 180),
    tintinSyncDate_(data.timestamp || data.createdAt),
    tintinSyncClean_(data.customerId, 180),
    tintinSyncClean_(data.actorId, 180),
    tintinSyncClean_(data.actorEmail, 254),
    tintinSyncClean_(data.actorRole, 50),
    tintinSyncClean_(data.action, 120),
    tintinSyncClean_(data.entityType || data.targetType, 100),
    tintinSyncClean_(data.entityId || data.targetId, 180),
    tintinSyncJson_(data.before || null),
    tintinSyncJson_(data.after || null),
    tintinSyncClean_(data.origin, 120),
    tintinSyncClean_(data.result, 80),
    tintinSyncClean_(data.changeId || data.eventId || id, 180)
  ];
}

function tintinSyncExistingUserNotes_(sheet) {
  var last = sheet.getLastRow();
  var map = {};
  if (last < TINTIN_SYNC_USERS_FIRST_ROW_) return map;
  var rows = sheet.getRange(TINTIN_SYNC_USERS_FIRST_ROW_, 2, last - TINTIN_SYNC_USERS_FIRST_ROW_ + 1, 9).getValues();
  rows.forEach(function (row) {
    var uid = tintinSyncClean_(row[0], 180);
    if (uid) map[uid] = { notes: row[8] };
  });
  return map;
}

function tintinSyncReplaceUsers_(records) {
  var sheet = tintinSyncSpreadsheet_().getSheetByName(TINTIN_SYNC_SHEETS_.users);
  if (!sheet) throw new Error('Falta Usuarios web');
  tintinSyncEnsureHeaders_(sheet, TINTIN_SYNC_USERS_HEADER_ROW_, 2, TINTIN_SYNC_USER_HEADERS_B_S_);
  var preserved = tintinSyncExistingUserNotes_(sheet);
  var last = sheet.getLastRow();
  if (last >= TINTIN_SYNC_USERS_FIRST_ROW_) {
    sheet.getRange(TINTIN_SYNC_USERS_FIRST_ROW_, 2, last - TINTIN_SYNC_USERS_FIRST_ROW_ + 1, TINTIN_SYNC_USER_HEADERS_B_S_.length).clearContent();
  }
  var rows = records.map(function (record) { return tintinSyncUserRow_(record.id, record.data || {}, preserved[record.id]); });
  if (rows.length) sheet.getRange(TINTIN_SYNC_USERS_FIRST_ROW_, 2, rows.length, TINTIN_SYNC_USER_HEADERS_B_S_.length).setValues(rows);
}

function tintinSyncReplaceSimpleSheet_(sheetName, headers, rows) {
  var sheet = tintinSyncSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Falta la pestaña ' + sheetName);
  tintinSyncEnsureHeaders_(sheet, 1, 1, headers);
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, Math.max(headers.length, sheet.getLastColumn())).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function tintinSyncWriteMeta_(entityType, entityId, firestoreUpdatedAt, changeId, state, message) {
  var sheet = tintinSyncSpreadsheet_().getSheetByName(TINTIN_SYNC_SHEETS_.meta);
  if (!sheet) return;
  var next = Math.max(8, sheet.getLastRow() + 1);
  sheet.getRange(next, 1, 1, 10).setValues([[
    new Date(),
    String(state || 'SYNCED').toUpperCase(),
    'Cuentas web',
    entityType,
    entityId,
    'Cambio canónico',
    '',
    '',
    tintinSyncClean_(message || 'Sincronizado', 1000),
    changeId || ''
  ]]);
}

function tintinSyncAllToSheets_() {
  if (typeof tintinEnsureOrderSnapshots_ === 'function') tintinEnsureOrderSnapshots_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var users = tintinSyncFirestoreList_('users');
    var orders = tintinSyncFirestoreList_('orders');
    var audits = tintinSyncFirestoreList_('auditLog');
    tintinSyncReplaceUsers_(users);
    tintinSyncReplaceSimpleSheet_(TINTIN_SYNC_SHEETS_.orders, TINTIN_SYNC_ORDER_HEADERS_, orders.map(function (doc) { return tintinSyncOrderRow_(doc.id, doc.data); }));
    tintinSyncReplaceSimpleSheet_(TINTIN_SYNC_SHEETS_.audit, TINTIN_SYNC_AUDIT_HEADERS_, audits.map(function (doc) { return tintinSyncAuditRow_(doc.id, doc.data); }));
    var changeId = tintinSyncChangeId_('FULL');
    tintinSyncWriteMeta_('Firestore → Sheets', 'Usuarios web / Pedidos web / Auditoría web', new Date().toISOString(), changeId, 'SYNCED', users.length + ' usuario(s), ' + orders.length + ' pedido(s), ' + audits.length + ' evento(s).');
    return { ok: true, users: users.length, orders: orders.length, auditLog: audits.length, changeId: changeId };
  } finally {
    lock.releaseLock();
  }
}

function tintinSyncHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var map = {};
  headers.forEach(function (header, index) { map[String(header)] = index; });
  return map;
}

function tintinSyncRefreshOrderRow_(sheet, row, orderId) {
  var data = tintinSyncFirestoreGet_('orders', orderId);
  if (!data) throw new Error('No se pudo recargar el pedido desde Firestore');
  sheet.getRange(row, 1, 1, TINTIN_SYNC_ORDER_HEADERS_.length).setValues([tintinSyncOrderRow_(orderId, data)]);
}

function tintinSyncEditedOrderRow_(sheet, row) {
  var map = tintinSyncHeaderMap_(sheet);
  var values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var orderId = tintinSyncClean_(values[map.orderId], 220);
  if (!orderId) return;
  var allowedStatus = ['pendiente','confirmado','preparando','listo_retiro','en_camino','entregado','cancelado','rechazado'];
  var allowedPayment = ['pendiente','pagado','rechazado','cancelado','reembolsado'];
  var status = tintinSyncClean_(values[map.status], 50);
  var paymentStatus = tintinSyncClean_(values[map.paymentStatus], 50);
  if (allowedStatus.indexOf(status) === -1) throw new Error('Estado de pedido inválido en Sheets');
  if (allowedPayment.indexOf(paymentStatus) === -1) throw new Error('Estado de pago inválido en Sheets');
  var changeId = tintinSyncChangeId_('SHEET_ORDER');
  tintinSyncFirestorePatch_('orders', orderId, {
    status: status,
    paymentStatus: paymentStatus,
    updatedAt: new Date().toISOString(),
    lastChangeId: changeId
  });
  sheet.getRange(row, map.lastChangeId + 1).setValue(changeId);
  tintinSyncWriteMeta_('Google Sheets', 'Pedidos web!' + row, '', changeId, 'SYNCED', 'Estado operativo sincronizado a Firestore.');
}

function tintinSyncEditedRow_(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_SYNC_SHEETS_.orders || e.range.getRow() <= 1) return;
  var row = e.range.getRow();
  var map = tintinSyncHeaderMap_(sheet);
  var start = e.range.getColumn() - 1;
  var width = e.range.getNumColumns();
  var changed = Object.keys(map).filter(function (header) { return map[header] >= start && map[header] < start + width; });
  var allowed = ['status', 'paymentStatus'];
  var orderId = tintinSyncClean_(sheet.getRange(row, 1).getValue(), 220);
  try {
    if (changed.some(function (header) { return allowed.indexOf(header) === -1; })) {
      if (orderId) tintinSyncRefreshOrderRow_(sheet, row, orderId);
      tintinSyncWriteMeta_('Google Sheets', 'Pedidos web!' + row, '', '', 'REJECTED', 'Sólo status y paymentStatus pueden editarse desde Sheets; snapshot, identidad e importes fueron restaurados desde Firestore.');
      return;
    }
    tintinSyncEditedOrderRow_(sheet, row);
  } catch (error) {
    console.error('[TintinSync] onEdit falló:', error);
    if (orderId) {
      try { tintinSyncRefreshOrderRow_(sheet, row, orderId); } catch (_) {}
    }
    tintinSyncWriteMeta_('Google Sheets', 'Pedidos web!' + row, '', '', 'ERROR', String(error && error.message || error));
    throw error;
  }
}

function tintinPeriodicReconcile_() {
  return tintinSyncAllToSheets_();
}

function tintinInstallSyncTrigger_() {
  var spreadsheet = tintinSyncSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'tintinSyncEditedRow_' || handler === 'tintinPeriodicReconcile_') ScriptApp.deleteTrigger(trigger);
  });
  // Se suma al dispatcher existente. Ignora Usuarios web y Productos.
  ScriptApp.newTrigger('tintinSyncEditedRow_').forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger('tintinPeriodicReconcile_').timeBased().everyMinutes(5).create();
  return { ok: true, initial: tintinSyncAllToSheets_(), intervalMinutes: 5 };
}
