/* =============================================================
   TINTIN — SINCRONIZACIÓN CANÓNICA DE CUENTAS / PEDIDOS / AUDITORÍA

   Firestore sigue siendo la fuente operativa. Esta hoja es un espejo
   administrativo y nunca puede otorgar acceso, cambiar customerId, email,
   teléfono, CI, username, rol ni bloqueo.

   Spreadsheet real preparado: "Tintin — Sync"
   ID: 1_6yZX6WZgDnh_Berz7F7dnn4vbWbaTbUIv5Cx5DBZPw

   Pestañas:
   - Users
   - Orders
   - AuditLog
   - SyncMeta

   Funciones manuales/trigger:
   - tintinSyncAllToSheets_(): reconstruye el espejo desde Firestore.
   - tintinInstallSyncTrigger_(): instala un trigger onEdit autorizado.
   - tintinSyncEditedRow_(e): propaga desde Sheets únicamente campos
     explícitamente permitidos y genera changeId para evitar bucles.
   ============================================================= */

var TINTIN_SYNC_SPREADSHEET_ID_ = '1_6yZX6WZgDnh_Berz7F7dnn4vbWbaTbUIv5Cx5DBZPw';
var TINTIN_SYNC_MAX_DOCS_ = 5000;
var TINTIN_SYNC_SHEETS_ = {
  users: 'Users',
  orders: 'Orders',
  audit: 'AuditLog',
  meta: 'SyncMeta'
};

var TINTIN_SYNC_HEADERS_ = {
  Users: [
    'customerId','uid','email','username','phone','ci','name','firstName','lastName','dob','address',
    'profileStatus','role','blocked','authMethods','lastAuthMethod','createdAt','updatedAt','lastLogin',
    'usernameChangeCount','deleted','deletedAt','source','lastChangeId'
  ],
  Orders: [
    'orderId','orderNumber','requestId','customerId','userId','userEmail','contactEmail','userName','userPhone','ci',
    'status','paymentMethod','paymentStatus','shippingMethod','shippingCity','departamento','address','subtotal',
    'shippingCost','total','invoiceWanted','razonSocial','ruc','itemsSnapshot','createdAt','updatedAt','inventoryState',
    'notificationStatus','lastChangeId'
  ],
  AuditLog: [
    'eventId','timestamp','customerId','actorId','actorEmail','actorRole','action','entityType','entityId','before','after',
    'origin','result','changeId'
  ],
  SyncMeta: ['entityType','entityId','firestoreUpdatedAt','sheetsUpdatedAt','lastChangeId','syncState','lastError','sourceOfTruth']
};

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

function tintinSyncChangeId_(prefix) {
  return (prefix || 'SYNC') + '_' + Utilities.getUuid().replace(/-/g, '');
}

function tintinSyncEnsureHeaders_(sheet, expected) {
  var actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  var matches = expected.every(function (header, index) { return actual[index] === header; });
  if (!matches) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
  }
}

function tintinSyncFirestoreList_(collectionId, maxDocs) {
  var all = [];
  var pageToken = '';
  var max = Math.max(1, Math.min(TINTIN_SYNC_MAX_DOCS_, Number(maxDocs || TINTIN_SYNC_MAX_DOCS_)));
  do {
    var query = '?pageSize=' + Math.min(300, max - all.length);
    if (pageToken) query += '&pageToken=' + encodeURIComponent(pageToken);
    var response = UrlFetchApp.fetch(FIRESTORE_DOCUMENTS_URL_ + collectionId + query, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code === 404) return all;
    if (code < 200 || code >= 300) throw new Error('Firestore list ' + collectionId + ' falló HTTP ' + code);
    var body = JSON.parse(response.getContentText() || '{}');
    (body.documents || []).forEach(function (doc) {
      var relativeName = String(doc.name || '').split('/documents/')[1] || '';
      var id = relativeName.split('/').pop();
      all.push({ id: id, data: phase3DecodeFields_(doc.fields || {}) });
    });
    pageToken = body.nextPageToken || '';
  } while (pageToken && all.length < max);
  return all;
}

function tintinSyncFirestorePatch_(collectionId, documentId, patch) {
  var keys = Object.keys(patch || {});
  if (!keys.length) return;
  var masks = keys.map(function (key) { return 'updateMask.fieldPaths=' + encodeURIComponent(key); }).join('&');
  var response = UrlFetchApp.fetch(
    FIRESTORE_DOCUMENTS_URL_ + collectionId + '/' + encodeURIComponent(documentId) + '?' + masks,
    {
      method: 'patch',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ fields: phase4EncodeFields_(patch) }),
      muteHttpExceptions: true
    }
  );
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Firestore patch ' + collectionId + '/' + documentId + ' falló HTTP ' + code);
}

function tintinSyncUserRow_(id, data) {
  var customerId = tintinSyncClean_(data.customerId, 180) || ('CUS_' + id);
  return [
    customerId,
    id,
    tintinSyncClean_(data.email, 254),
    tintinSyncClean_(data.username, 40),
    tintinSyncClean_(data.phone, 40),
    tintinSyncClean_(data.ci, 20),
    tintinSyncClean_(data.name, 160),
    tintinSyncClean_(data.firstName, 100),
    tintinSyncClean_(data.lastName, 100),
    tintinSyncDate_(data.dob),
    tintinSyncClean_(data.address || (data.savedLocation && (data.savedLocation.address || data.savedLocation.name)), 500),
    tintinSyncClean_(data.profileStatus, 40),
    tintinSyncClean_(data.role, 40),
    data.blocked === true,
    tintinSyncJson_(data.authMethods || []),
    tintinSyncClean_(data.lastAuthMethod || data.provider, 40),
    tintinSyncDate_(data.createdAt),
    tintinSyncDate_(data.updatedAt),
    tintinSyncDate_(data.lastLogin),
    Number(data.usernameChangeCount || 0),
    data.deleted === true,
    tintinSyncDate_(data.deletedAt),
    'firestore',
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

function tintinSyncReplaceSheet_(sheetName, headers, rows) {
  var sheet = tintinSyncSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Falta la pestaña ' + sheetName);
  tintinSyncEnsureHeaders_(sheet, headers);
  var oldRows = Math.max(0, sheet.getLastRow() - 1);
  if (oldRows) sheet.getRange(2, 1, oldRows, Math.max(headers.length, sheet.getLastColumn())).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function tintinSyncWriteMeta_(entityType, entityId, firestoreUpdatedAt, changeId, state, error) {
  var sheet = tintinSyncSpreadsheet_().getSheetByName(TINTIN_SYNC_SHEETS_.meta);
  if (!sheet) return;
  tintinSyncEnsureHeaders_(sheet, TINTIN_SYNC_HEADERS_.SyncMeta);
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(entityType) && String(values[i][1]) === String(entityId)) {
      rowIndex = i + 1;
      break;
    }
  }
  var row = [
    entityType,
    entityId,
    tintinSyncDate_(firestoreUpdatedAt),
    new Date().toISOString(),
    changeId || '',
    state || 'synced',
    error || '',
    'firestore'
  ];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function tintinSyncAllToSheets_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var users = tintinSyncFirestoreList_('users').map(function (doc) { return tintinSyncUserRow_(doc.id, doc.data); });
    var orders = tintinSyncFirestoreList_('orders').map(function (doc) { return tintinSyncOrderRow_(doc.id, doc.data); });
    var audits = tintinSyncFirestoreList_('auditLog').map(function (doc) { return tintinSyncAuditRow_(doc.id, doc.data); });

    tintinSyncReplaceSheet_(TINTIN_SYNC_SHEETS_.users, TINTIN_SYNC_HEADERS_.Users, users);
    tintinSyncReplaceSheet_(TINTIN_SYNC_SHEETS_.orders, TINTIN_SYNC_HEADERS_.Orders, orders);
    tintinSyncReplaceSheet_(TINTIN_SYNC_SHEETS_.audit, TINTIN_SYNC_HEADERS_.AuditLog, audits);

    var meta = tintinSyncSpreadsheet_().getSheetByName(TINTIN_SYNC_SHEETS_.meta);
    tintinSyncEnsureHeaders_(meta, TINTIN_SYNC_HEADERS_.SyncMeta);
    meta.getRange('A2:H2').setValues([['system','full-sync',new Date().toISOString(),new Date().toISOString(),tintinSyncChangeId_('FULL'),'synced','', 'firestore']]);
    return { ok: true, users: users.length, orders: orders.length, auditLog: audits.length };
  } finally {
    lock.releaseLock();
  }
}

function tintinSyncHeaderMap_(sheet) {
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var map = {};
  headers.forEach(function (header, index) { map[String(header)] = index; });
  return map;
}

function tintinSyncEditedUserRow_(sheet, row) {
  var map = tintinSyncHeaderMap_(sheet);
  var values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var uid = tintinSyncClean_(values[map.uid], 180);
  if (!uid) return;
  // Sheets nunca puede modificar identificadores, permisos ni acceso.
  var patch = {
    name: tintinSyncClean_(values[map.name], 160),
    address: tintinSyncClean_(values[map.address], 500),
    updatedAt: new Date().toISOString(),
    lastChangeId: tintinSyncChangeId_('SHEET_USER')
  };
  tintinSyncFirestorePatch_('users', uid, patch);
  sheet.getRange(row, map.lastChangeId + 1).setValue(patch.lastChangeId);
  tintinSyncWriteMeta_('user', uid, patch.updatedAt, patch.lastChangeId, 'synced', '');
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
  var patch = {
    status: status,
    paymentStatus: paymentStatus,
    updatedAt: new Date().toISOString(),
    lastChangeId: changeId
  };
  tintinSyncFirestorePatch_('orders', orderId, patch);
  sheet.getRange(row, map.lastChangeId + 1).setValue(changeId);
  tintinSyncWriteMeta_('order', orderId, patch.updatedAt, changeId, 'synced', '');
}

function tintinSyncEditedRow_(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  if (row <= 1) return;
  var name = sheet.getName();
  try {
    if (name === TINTIN_SYNC_SHEETS_.users) tintinSyncEditedUserRow_(sheet, row);
    else if (name === TINTIN_SYNC_SHEETS_.orders) tintinSyncEditedOrderRow_(sheet, row);
    // AuditLog y SyncMeta son espejo/telemetría: nunca escriben de vuelta.
  } catch (error) {
    console.error('[TintinSync] onEdit falló:', error);
    try {
      tintinSyncWriteMeta_(name, 'row-' + row, '', '', 'error', String(error && error.message || error));
    } catch (_) {}
    throw error;
  }
}

function tintinInstallSyncTrigger_() {
  var spreadsheet = tintinSyncSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'tintinSyncEditedRow_') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('tintinSyncEditedRow_').forSpreadsheet(spreadsheet).onEdit().create();
  return { ok: true };
}
