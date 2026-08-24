// TINTIN — Integración canónica Google Sheets <-> Firestore.
// Este archivo NO reemplaza ProductosUnificados.gs: lo coordina y elimina
// activadores duplicados para que una edición tenga un único escritor.
var TINTIN_MIRROR_ENDPOINT_PATH = '/api/sheets-admin-export';
var TINTIN_MIRROR_REVISION = 'sheets-admin-export-v1';
var TINTIN_CANONICAL_EDIT_HANDLER = 'tintinDespacharEdicionConTrazabilidad';
var TINTIN_MIRROR_HANDLER = 'tintinSincronizarEspejosWeb';
var TINTIN_ORDERS_SHEET = 'Pedidos web';
var TINTIN_AUDIT_SHEET = 'Auditoría web';

function tintinMirrorSecret_() {
  var secret = String(PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET') || '');
  if (!secret) throw new Error('Falta SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  return secret;
}

function tintinFetchMirror_(entity, limit) {
  var response = UrlFetchApp.fetch(tintinStoreOrigin_() + TINTIN_MIRROR_ENDPOINT_PATH, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Tintin-Sheets-Secret': tintinMirrorSecret_() },
    payload: JSON.stringify({ action: 'export', entity: entity, limit: limit || 2000 }),
    followRedirects: false,
    muteHttpExceptions: true
  });
  var body = tintinParseJsonResponse_(response);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || body.ok !== true) {
    throw new Error(body.error || ('No se pudo exportar ' + entity + ' (HTTP ' + response.getResponseCode() + ').'));
  }
  return Array.isArray(body.rows) ? body.rows : [];
}

function tintinSheetDate_(value) {
  if (!value) return '';
  var date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date;
}

function tintinJsonCell_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch (error) { return String(value); }
}

function tintinEnsureRows_(sheet, neededLastRow) {
  if (sheet.getMaxRows() < neededLastRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), neededLastRow - sheet.getMaxRows());
  }
}

function tintinClearMirrorBody_(sheet, firstRow, width) {
  var rows = Math.max(sheet.getMaxRows() - firstRow + 1, 1);
  sheet.getRange(firstRow, 1, rows, width).clearContent();
}

function tintinSincronizarUsuariosWeb_() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(TINTIN_USERS_SHEET);
  if (!sheet) throw new Error('No existe la hoja Usuarios web.');
  var rows = tintinFetchMirror_('users', 2000);
  tintinEnsureRows_(sheet, Math.max(7 + rows.length, 20));
  // A queda reservada para estructura visual. B:R es el contrato de cuentas.
  sheet.getRange(7, 2, Math.max(sheet.getMaxRows() - 6, 1), 17).clearContent();
  if (rows.length) {
    var values = rows.map(function(user) {
      return [
        user.uid || '',
        user.name || '',
        user.email || '',
        tintinSheetDate_(user.createdAt),
        user.role || 'client',
        user.blocked === true ? 'Sí' : 'No',
        Number(user.orderCount || 0),
        Number(user.totalSpent || 0),
        user.internalNotes || '',
        '',
        user.customerId || '',
        user.username ? '@' + String(user.username).replace(/^@/, '') : '',
        user.phone || '',
        user.ci || '',
        user.profileStatus || '',
        tintinSheetDate_(user.lastAccess),
        user.usernameChanged === true ? 'Sí' : 'No'
      ];
    });
    sheet.getRange(7, 2, values.length, 17).setValues(values);
    // Conserva dropdowns administrativos aun cuando crezca la tabla.
    var template = sheet.getRange(7, 2, 1, 17);
    template.copyTo(sheet.getRange(7, 2, values.length, 17), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  return rows.length;
}

function tintinSincronizarPedidosWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_ORDERS_SHEET);
  if (!sheet) throw new Error('No existe la hoja Pedidos web.');
  var rows = tintinFetchMirror_('orders', 2000);
  tintinEnsureRows_(sheet, Math.max(2 + rows.length, 20));
  tintinClearMirrorBody_(sheet, 2, 29);
  if (rows.length) {
    var values = rows.map(function(order) {
      return [
        order.orderId || '', order.orderNumber || '', order.requestId || '', order.customerId || '',
        order.userId || '', order.userEmail || '', order.contactEmail || '', order.userName || '',
        order.userPhone || '', order.ci || '', order.status || '', order.paymentMethod || '',
        order.paymentStatus || '', order.shippingMethod || '', order.shippingCity || '', order.departamento || '',
        order.address || '', Number(order.subtotal || 0), Number(order.shippingCost || 0), Number(order.total || 0),
        order.invoiceWanted === true ? 'Sí' : 'No', order.razonSocial || '', order.ruc || '',
        tintinJsonCell_(order.itemsSnapshot), tintinSheetDate_(order.createdAt), tintinSheetDate_(order.updatedAt),
        order.inventoryState || '', order.notificationStatus || '', order.lastChangeId || ''
      ];
    });
    sheet.getRange(2, 1, values.length, 29).setValues(values);
  }
  return rows.length;
}

function tintinSincronizarAuditoriaWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_AUDIT_SHEET);
  if (!sheet) throw new Error('No existe la hoja Auditoría web.');
  var rows = tintinFetchMirror_('audit', 2000);
  tintinEnsureRows_(sheet, Math.max(2 + rows.length, 20));
  tintinClearMirrorBody_(sheet, 2, 14);
  if (rows.length) {
    var values = rows.map(function(log) {
      return [
        log.eventId || '', tintinSheetDate_(log.timestamp), log.customerId || '', log.actorId || '',
        log.actorEmail || '', log.actorRole || '', log.action || '', log.entityType || '', log.entityId || '',
        tintinJsonCell_(log.before), tintinJsonCell_(log.after), log.origin || '', log.result || '', log.changeId || ''
      ];
    });
    sheet.getRange(2, 1, values.length, 14).setValues(values);
  }
  return rows.length;
}

function tintinSincronizarEspejosWeb() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, skipped: true, reason: 'sync-already-running' };
  var changeId = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  try {
    tintinRecordSyncSafely_('SYNCING', 'Sistema', 'Firestore', 'Actualizando Usuarios web, Pedidos web y Auditoría web.');
    var users = tintinSincronizarUsuariosWeb_();
    var orders = tintinSincronizarPedidosWeb_();
    var audit = tintinSincronizarAuditoriaWeb_();
    tintinEnriquecerUltimoHistorial_('Sistema', 'Firestore', 'Espejos web', '', users + '/' + orders + '/' + audit, 'Usuarios: ' + users + ' · Pedidos: ' + orders + ' · Auditoría: ' + audit, changeId);
    tintinRecordSyncSafely_('SYNCED', 'Sistema', 'Firestore', 'Espejos web sincronizados.');
    tintinEnriquecerUltimoHistorial_('Sistema', 'Firestore', 'Espejos web', '', users + '/' + orders + '/' + audit, 'Sincronizado', changeId);
    return { ok: true, users: users, orders: orders, audit: audit, changeId: changeId };
  } catch (error) {
    tintinRecordSyncSafely_('ERROR', 'Sistema', 'Firestore', String(error && error.message || error));
    tintinEnriquecerUltimoHistorial_('Sistema', 'Firestore', 'Espejos web', '', '', String(error && error.message || error), changeId);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function tintinEditFieldName_(e) {
  if (!e || !e.range) return '';
  var sheet = e.range.getSheet();
  var headerRow = sheet.getName() === TINTIN_PRODUCTS_SHEET || sheet.getName() === TINTIN_USERS_SHEET ? 6 : 1;
  if (e.range.getRow() <= headerRow) return 'Encabezado';
  var value = sheet.getRange(headerRow, e.range.getColumn()).getDisplayValue();
  return value || ('Columna ' + e.range.getColumn());
}

function tintinEditNewValue_(e) {
  if (!e || !e.range) return '';
  if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1) {
    return Object.prototype.hasOwnProperty.call(e, 'value') ? String(e.value || '') : e.range.getDisplayValue();
  }
  return '[' + e.range.getNumRows() + 'x' + e.range.getNumColumns() + ']';
}

function tintinEnriquecerUltimoHistorial_(sheetName, cell, field, oldValue, newValue, result, changeId) {
  var history = tintinProductsSpreadsheet_().getSheetByName(TINTIN_SYNC_HISTORY_SHEET);
  if (!history || history.getLastRow() < TINTIN_SYNC_HISTORY_FIRST_ROW) return;
  var row = TINTIN_SYNC_HISTORY_FIRST_ROW;
  var current = history.getRange(row, 2, 1, 4).getDisplayValues()[0];
  if (sheetName && current[2] && current[2] !== sheetName) return;
  if (cell && current[3] && current[3] !== cell) return;
  history.getRange(row, 6, 1, 5).setValues([[
    String(field || '').slice(0, 120),
    String(oldValue == null ? '' : oldValue).slice(0, 500),
    String(newValue == null ? '' : newValue).slice(0, 500),
    String(result || '').slice(0, 500),
    String(changeId || '').slice(0, 80)
  ]]);
}

// Este es el único activador Al editar que debe existir después de ejecutar
// tintinRepararSistemaSheets(). El lock evita carreras aun con ediciones rápidas.
function tintinDespacharEdicionConTrazabilidad(e) {
  if (!e || !e.range) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Otra sincronización está procesando una edición. Intentá nuevamente.');
  var sheetName = e.range.getSheet().getName();
  var cell = e.range.getA1Notation();
  var field = tintinEditFieldName_(e);
  var oldValue = Object.prototype.hasOwnProperty.call(e, 'oldValue') ? e.oldValue : '';
  var newValue = tintinEditNewValue_(e);
  var changeId = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  try {
    tintinDespacharEdicionInstalable(e);
    tintinEnriquecerUltimoHistorial_(sheetName, cell, field, oldValue, newValue, 'Sincronizado', changeId);
  } catch (error) {
    tintinEnriquecerUltimoHistorial_(sheetName, cell, field, oldValue, newValue, String(error && error.message || error), changeId);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function tintinEliminarActivadoresDuplicados_() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var removed = [];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    var eventType = trigger.getEventType && trigger.getEventType();
    var sourceId = '';
    try { sourceId = trigger.getTriggerSourceId ? (trigger.getTriggerSourceId() || '') : ''; } catch (error) {}
    var sameSpreadsheet = !sourceId || sourceId === spreadsheet.getId();
    var isEdit = eventType === ScriptApp.EventType.ON_EDIT;
    var isMirror = handler === TINTIN_MIRROR_HANDLER;
    if ((isEdit && sameSpreadsheet) || isMirror || handler === 'tintinProductosOnEdit' || handler === 'tintinDespacharEdicionInstalable' || handler === TINTIN_CANONICAL_EDIT_HANDLER) {
      removed.push(handler);
      ScriptApp.deleteTrigger(trigger);
    }
  });
  return removed;
}

// Ejecutar UNA sola vez después de copiar/desplegar estos archivos en el
// proyecto Apps Script vinculado a TINTIN INVENTARIO 2026.
function tintinRepararSistemaSheets() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var removed = tintinEliminarActivadoresDuplicados_();
  ScriptApp.newTrigger(TINTIN_CANONICAL_EDIT_HANDLER).forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger(TINTIN_MIRROR_HANDLER).timeBased().everyMinutes(10).create();
  var mirror = tintinSincronizarEspejosWeb();
  return {
    ok: true,
    removedTriggers: removed,
    editHandler: TINTIN_CANONICAL_EDIT_HANDLER,
    mirrorHandler: TINTIN_MIRROR_HANDLER,
    mirror: mirror,
    diagnosis: tintinDiagnosticarSistemaSheets()
  };
}

function tintinDiagnosticarSistemaSheets() {
  var triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return { handler: trigger.getHandlerFunction(), eventType: String(trigger.getEventType()) };
  });
  var editTriggers = triggers.filter(function(item) { return item.eventType.indexOf('ON_EDIT') !== -1; });
  var mirrorTriggers = triggers.filter(function(item) { return item.handler === TINTIN_MIRROR_HANDLER; });
  var spreadsheet = tintinProductsSpreadsheet_();
  return {
    ok: editTriggers.length === 1 && editTriggers[0].handler === TINTIN_CANONICAL_EDIT_HANDLER && mirrorTriggers.length === 1,
    editTriggers: editTriggers,
    mirrorTriggers: mirrorTriggers,
    products: !!spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET),
    users: !!spreadsheet.getSheetByName(TINTIN_USERS_SHEET),
    orders: !!spreadsheet.getSheetByName(TINTIN_ORDERS_SHEET),
    audit: !!spreadsheet.getSheetByName(TINTIN_AUDIT_SHEET),
    history: !!spreadsheet.getSheetByName(TINTIN_SYNC_HISTORY_SHEET)
  };
}
