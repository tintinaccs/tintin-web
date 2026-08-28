// Hoja canonica de inventario y catalogo web.
var TINTIN_PRODUCTS_SHEET = 'Productos';
var TINTIN_PRODUCTS_HEADER_ROW = 6;
var TINTIN_PRODUCTS_FIRST_ROW = 7;
var TINTIN_PRODUCTS_SPREADSHEET_ID = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
var TINTIN_USERS_SHEET = 'Usuarios web';
var TINTIN_USERS_HEADER_ROW = 6;
var TINTIN_USERS_FIRST_ROW = 7;
// Fuente única de verdad del layout de Usuarios web. Bloques: identidad (2-5),
// contacto (6-8), comercial (9-10), estado (11-14), administración (15-16),
// sincronización/técnico (17-19). Cualquier reorganización de columnas debe
// actualizarse solo acá; el resto del código lee por nombre de campo.
var TINTIN_USERS_COL = {
  uid: 2, name: 3, username: 4, customerId: 5,
  email: 6, phone: 7, ci: 8,
  orders: 9, totalSpent: 10,
  role: 11, blocked: 12, profileStatus: 13, usernameChangeUsed: 14,
  internalNotes: 15, action: 16,
  createdAt: 17, lastAccess: 18, lastChangeId: 19
};
var TINTIN_USERS_HEADERS = (function() {
  var labels = {
    uid: 'UID', name: 'Nombre', username: 'Username', customerId: 'ID cliente',
    email: 'Correo', phone: 'Teléfono', ci: 'Cédula',
    orders: 'Pedidos', totalSpent: 'Total gastado (Gs.)',
    role: 'Rol', blocked: 'Bloqueado', profileStatus: 'Estado de perfil', usernameChangeUsed: 'Cambió username',
    internalNotes: 'Notas internas', action: 'Acción',
    createdAt: 'Creado', lastAccess: 'Último acceso', lastChangeId: 'Último changeId'
  };
  var headerRow = new Array(TINTIN_USERS_COL.lastChangeId).fill('');
  Object.keys(TINTIN_USERS_COL).forEach(function(key) { headerRow[TINTIN_USERS_COL[key] - 1] = labels[key]; });
  return headerRow;
})();
var TINTIN_SYNC_HISTORY_SHEET = 'Historial sync';
var TINTIN_PRODUCTS_WEBHOOK_PATH = '/api/sheets-products-webhook';
var TINTIN_PRODUCTS_WEBHOOK_REVISION = 'products-canonical-v3';
var TINTIN_ON_EDIT_DISPATCHER = 'tintinDespacharEdicionInstalable';
var TINTIN_SYNC_HISTORY_HEADER_ROW = 7;
var TINTIN_SYNC_HISTORY_FIRST_ROW = 8;
var TINTIN_SYNC_HISTORY_MAX_ROWS = 500;
var TINTIN_SYNC_GUARD_TTL_SECONDS = 30;
var TINTIN_SNAPSHOT_PATH = '/api/sheets-sync-snapshot';
var TINTIN_ADMIN_WEBHOOK_PATH = '/api/sheets-admin-webhook';
var TINTIN_ORDERS_SHEET = 'Pedidos web';
var TINTIN_AUDIT_SHEET = 'Auditoría web';

// Este proyecto sí está vinculado al spreadsheet canónico. El menú debe vivir
// aquí; tintin-guardian es un proyecto auxiliar separado y no recibe onOpen de
// esta hoja.
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Tintin Sync')
    .addItem('📊 Revisar estado y configuración', 'tintinRevisarConfiguracionTintin')
    .addItem('📋 Abrir Historial sync', 'tintinAbrirHistorialSync')
    .addToUi();
}

function tintinAbrirHistorialSync() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(TINTIN_SYNC_HISTORY_SHEET);
  if (!sheet) throw new Error('No existe la hoja Historial sync.');
  spreadsheet.setActiveSheet(sheet);
  sheet.showSheet();
  sheet.setActiveRange(sheet.getRange('A1:J20'));
}

function tintinInstalarMenuPrincipal() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'onOpen' &&
      trigger.getEventType() === ScriptApp.EventType.ON_OPEN;
  });
  if (!exists) ScriptApp.newTrigger('onOpen').forSpreadsheet(spreadsheet).onOpen().create();
  return { ok: true, menu: 'Tintin Sync', openTrigger: true };
}

function tintinProductsSpreadsheet_() {
  return SpreadsheetApp.openById(TINTIN_PRODUCTS_SPREADSHEET_ID);
}

function tintinBool_(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'si' || String(value || '').trim().toLowerCase() === 'sí';
}

function tintinOptionalNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  var number = Number(value);
  if (!isFinite(number) || number < 0) throw new Error('Valor numerico invalido.');
  return number;
}

function tintinStoreOrigin_() {
  var configured = String(PropertiesService.getScriptProperties().getProperty('TINTIN_STORE_URL') || '').trim();
  var value = configured || 'https://tintinaccesorios.pages.dev';
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?$/.test(value)) {
    throw new Error('TINTIN_STORE_URL debe ser un origen HTTPS sin ruta, query ni fragmento.');
  }
  return value.replace(/\/$/, '');
}

function tintinParseJsonResponse_(response) {
  var raw = response.getContentText() || '';
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return { ok: false, error: 'El endpoint no devolvio JSON.', rawStatus: response.getResponseCode() };
  }
}

function tintinSyncHeaderKey_(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function tintinAppendSyncHistory_(status, sheetName, cell, detail) {
  var allowed = { SYNCED: true, SYNCING: true, ERROR: true, REJECTED: true, LOCAL: true };
  if (!allowed[status]) throw new Error('Estado de sincronizacion invalido.');
  var history = tintinProductsSpreadsheet_().getSheetByName(TINTIN_SYNC_HISTORY_SHEET);
  if (!history) return false;
  var width = Math.max(history.getLastColumn(), 1);
  var headers = history.getRange(TINTIN_SYNC_HISTORY_HEADER_ROW, 1, 1, width).getDisplayValues()[0];
  var values = new Array(width).fill('');
  var matched = 0;
  headers.forEach(function(header, index) {
    var key = tintinSyncHeaderKey_(header);
    if (/^(fecha|fecha hora|timestamp|hora)$/.test(key)) { values[index] = new Date(); matched += 1; }
    else if (/^(estado|status)$/.test(key)) { values[index] = status; matched += 1; }
    else if (/^(origen|source)$/.test(key)) { values[index] = 'Google Sheets'; matched += 1; }
    else if (/^(hoja|sheet)$/.test(key)) { values[index] = sheetName; matched += 1; }
    else if (/^(celda|rango|cell)$/.test(key)) { values[index] = cell; matched += 1; }
    else if (/^(detalle|mensaje|descripcion|resultado|error)$/.test(key)) { values[index] = String(detail || '').slice(0, 500); matched += 1; }
  });
  if (!headers.some(function(header) { return /^(estado|status)$/.test(tintinSyncHeaderKey_(header)); })) return false;
  history.insertRowBefore(TINTIN_SYNC_HISTORY_FIRST_ROW);
  history.getRange(TINTIN_SYNC_HISTORY_FIRST_ROW, 1, 1, width).setValues([values]);
  var firstExcessRow = TINTIN_SYNC_HISTORY_FIRST_ROW + TINTIN_SYNC_HISTORY_MAX_ROWS;
  if (history.getLastRow() >= firstExcessRow) {
    history.deleteRows(firstExcessRow, history.getLastRow() - firstExcessRow + 1);
  }
  return matched > 0;
}

// Un push Firestore->Sheet escribe la fila en varios tramos (id/nombre,
// categoria/costo/precio, vendidos, stock minimo, resto de columnas). Varias
// de esas escrituras caen en columnas que el dispatcher de onEdit trata como
// ediciones manuales, y sin este freno reenviaban la fila de vuelta a
// Firestore (Sheet->Firestore) a mitad del push, con columnas que todavia no
// habian terminado de actualizarse: la carrera resultante podia devolver a
// Firestore una version parcial/vieja de la fila. Este freno bloquea ese
// reenvio mientras la fila tiene un push Firestore->Sheet en curso.
function tintinSyncGuardKey_(sheet, rowNumber) {
  return 'tintin_push_' + sheet.getParent().getId() + '_' + sheet.getSheetId() + '_' + rowNumber;
}

function tintinMarkRowPushInProgress_(sheet, rowNumber) {
  CacheService.getScriptCache().put(tintinSyncGuardKey_(sheet, rowNumber), '1', TINTIN_SYNC_GUARD_TTL_SECONDS);
}

function tintinIsRowPushInProgress_(sheet, rowNumber) {
  return CacheService.getScriptCache().get(tintinSyncGuardKey_(sheet, rowNumber)) === '1';
}

/** Verifica el token Firebase del usuario que solicita un cambio desde la web. */
function verifyFirebaseIdToken_(idToken) {
  if (!idToken) return { ok: false, error: 'missing_id_token' };

  var apiKey = String(PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_API_KEY') || '').trim();
  if (!apiKey) return { ok: false, error: 'missing_firebase_api_key' };

  try {
    var response = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true
      }
    );
    if (response.getResponseCode() !== 200) return { ok: false, error: 'invalid_id_token' };

    var user = (JSON.parse(response.getContentText() || '{}').users || [])[0];
    if (!user) return { ok: false, error: 'invalid_id_token' };
    return {
      ok: true,
      email: String(user.email || ''),
      emailVerified: user.emailVerified === true,
      uid: String(user.localId || '')
    };
  } catch (error) {
    return { ok: false, error: 'token_verify_failed' };
  }
}

// Dos activadores instalables heredados pueden recibir el mismo onEdit. Sin
// esta llave, uno puede confirmar Firestore y otro restaurar una versión vieja
// de Sheets, dejando ambos lados con nombres distintos.
function tintinProductEditEventKey_(event) {
  var range = event.range;
  var sheet = range.getSheet();
  return 'tintin_edit_' + sheet.getParent().getId() + '_' + sheet.getSheetId() + '_' +
    range.getA1Notation() + '_' + String(event.value || '').slice(0, 240);
}

function tintinClaimProductEdit_(event) {
  var cache = CacheService.getScriptCache();
  var key = tintinProductEditEventKey_(event);
  if (cache.get(key)) return false;
  cache.put(key, '1', TINTIN_SYNC_GUARD_TTL_SECONDS);
  return true;
}

function tintinRecordSyncSafely_(status, sheetName, cell, detail) {
  try { tintinAppendSyncHistory_(status, sheetName, cell, detail); }
  catch (historyError) { console.error('No se pudo registrar Historial sync: ' + historyError.message); }
}

function tintinCallProductsWebhook_(payload) {
  var secret = String(PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET') || '');
  if (!secret) throw new Error('Falta SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  var response = UrlFetchApp.fetch(tintinStoreOrigin_() + TINTIN_PRODUCTS_WEBHOOK_PATH, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Tintin-Sheets-Secret': secret },
    payload: JSON.stringify(payload),
    followRedirects: false,
    muteHttpExceptions: true
  });
  return { response: response, body: tintinParseJsonResponse_(response) };
}

function tintinProductPayload_(row, changedFields) {
  var requestedAction = String(row[34] || '').trim().toLowerCase();
  return {
    action: requestedAction === 'eliminar' ? 'deleteProduct' : 'saveProduct',
    productId: String(row[0] || '').trim(),
    name: row[1],
    category: row[3],
    costUnit: tintinOptionalNumber_(row[4]),
    price: tintinOptionalNumber_(row[5]),
    purchased: tintinOptionalNumber_(row[8]),
    stock: tintinOptionalNumber_(row[10]),
    stockMinimum: tintinOptionalNumber_(row[11]),
    internalNotes: row[13],
    active: requestedAction === 'desactivar' ? false : tintinBool_(row[14]),
    oferta: tintinBool_(row[15]),
    destacado: tintinBool_(row[16]),
    priceBefore: tintinOptionalNumber_(row[17]),
    badge: row[18],
    imageUrl: row[19],
    description: row[20],
    material: row[22],
    measurements: row[23],
    colorFinish: row[24],
    care: row[25],
    waterResistance: row[26],
    warranty: row[27],
    sizeFit: row[28],
    packageContents: row[29],
    imagesExtra: row[30],
    collection: row[31],
    tags: row[32],
    variants: row[33],
    // En una edición de una celda sólo se envían esos campos. Así un JSON de
    // variantes pendiente de corregir no puede bloquear, por ejemplo, el
    // cambio de nombre de un producto ya existente.
    changedFields: Array.isArray(changedFields) ? changedFields : []
  };
}

function tintinProductFieldsForColumns_(firstColumn, columnCount) {
  var byColumn = {
    2: ['name'], 4: ['category'], 5: ['costUnit'], 6: ['price'],
    // Stock actual (K) es una fórmula: al cambiar comprado (I) se actualizan
    // juntos inventario.purchased y products.stock.
    9: ['purchased', 'stock'], 12: ['stockMinimum'], 14: ['internalNotes'],
    15: ['active'], 16: ['oferta'], 17: ['destacado'], 18: ['priceBefore'],
    19: ['badge'], 20: ['imageUrl'], 21: ['description'], 23: ['material'],
    24: ['measurements'], 25: ['colorFinish'], 26: ['care'],
    27: ['waterResistance'], 28: ['warranty'], 29: ['sizeFit'],
    30: ['packageContents'], 31: ['imagesExtra'], 32: ['collection'],
    33: ['tags'], 34: ['variants']
  };
  var fields = [];
  for (var column = firstColumn; column < firstColumn + columnCount; column += 1) {
    (byColumn[column] || []).forEach(function(field) {
      if (fields.indexOf(field) === -1) fields.push(field);
    });
  }
  return fields;
}

function tintinSendProductRow_(sheet, rowNumber, changedFields) {
  var row = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  if (!row[1]) return;
  var requestedAction = String(row[34] || '').trim().toLowerCase();
  var payload = tintinProductPayload_(row, changedFields);
  payload.schemaVersion = 3;
  payload.source = 'google-sheets:Productos';
  var requestResult = tintinCallProductsWebhook_(payload);
  var response = requestResult.response;
  var result = requestResult.body;
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.ok !== true) {
    var authState = String(response.getHeaders()['X-Tintin-Auth-State'] || response.getHeaders()['x-tintin-auth-state'] || '');
    var detail = result.error || 'La tienda rechazo la sincronizacion.';
    if (response.getResponseCode() === 401 && authState) detail += ' [' + authState + ']';
    var webhookError = new Error(detail);
    webhookError.tintinHttpStatus = response.getResponseCode();
    webhookError.tintinAuthState = authState;
    throw webhookError;
  }
  if (requestedAction === 'eliminar') {
    sheet.deleteRow(rowNumber);
    return;
  }
  if (!row[0] && result.productId) sheet.getRange(rowNumber, 1).setValue(result.productId);
  if (requestedAction === 'desactivar') sheet.getRange(rowNumber, 15).setValue('No');
  sheet.getRange(rowNumber, 22).setValue(new Date());
  sheet.getRange(rowNumber, 35).clearContent();
}

// Un 409/502 es recuperable (conflicto o indisponibilidad transitoria del
// servicio). Reintenta una vez antes de informar el fallo, sin duplicar una
// escritura que el endpoint ya confirmó.
function tintinSendProductRowWithRetry_(sheet, rowNumber, changedFields) {
  try {
    return tintinSendProductRow_(sheet, rowNumber, changedFields);
  } catch (firstError) {
    var status = Number(firstError && firstError.tintinHttpStatus || 0);
    if (status !== 409 && status !== 502) throw firstError;
    Utilities.sleep(750);
    return tintinSendProductRow_(sheet, rowNumber, changedFields);
  }
}

// Crear como activador instalable "Al editar". Un activador simple no tiene
// permiso para UrlFetchApp.
function tintinProductosOnEdit(e) {
  tintinHandleProductEdit_(e);
}

function tintinHandleProductEdit_(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_PRODUCTS_SHEET || e.range.getRow() < TINTIN_PRODUCTS_FIRST_ROW) return;
  if (tintinIsRowPushInProgress_(sheet, e.range.getRow())) return;
  var changedFields = tintinProductFieldsForColumns_(e.range.getColumn(), e.range.getNumColumns());
  var actionColumnTouched = e.range.getColumn() <= 35 && e.range.getColumn() + e.range.getNumColumns() - 1 >= 35;
  if (actionColumnTouched && changedFields.indexOf('active') === -1) changedFields.push('active');
  if (changedFields.length || actionColumnTouched) {
    if (!tintinClaimProductEdit_(e)) return;
    for (var rowNumber = e.range.getRow(); rowNumber < e.range.getRow() + e.range.getNumRows(); rowNumber += 1) {
      var cell = sheet.getRange(rowNumber, e.range.getColumn(), 1, e.range.getNumColumns()).getA1Notation();
      // Marca la edición local antes del envío. Una actualización web más
      // antigua nunca debe restaurar un nombre que la operadora acaba de editar.
      sheet.getRange(rowNumber, 22).setValue(new Date());
      tintinRecordSyncSafely_('SYNCING', sheet.getName(), cell, 'Sincronizando campos: ' + (changedFields.join(', ') || 'acción') + '.');
      try {
        tintinSendProductRowWithRetry_(sheet, rowNumber, changedFields);
        tintinRecordSyncSafely_('SYNCED', sheet.getName(), cell, 'Producto sincronizado: ' + (changedFields.join(', ') || 'acción') + '.');
      } catch (error) {
        var isRejected = error && error.tintinHttpStatus === 400 || /valor numerico invalido/i.test(String(error && error.message || error));
        // Sólo se revierte la celda editada si ese valor concreto fue rechazado.
        if (isRejected && e.range.getNumRows() === 1 && e.range.getNumColumns() === 1) {
          if (Object.prototype.hasOwnProperty.call(e, 'oldValue')) e.range.setValue(e.oldValue);
          else e.range.clearContent();
        }
        var status = isRejected ? 'REJECTED' : 'ERROR';
        tintinRecordSyncSafely_(status, sheet.getName(), cell, String(error && error.message || error));
        if (isRejected) throw error;
        console.error('La edición quedó guardada en Sheets, pero falta reintentar la sincronización: ' + String(error && error.message || error));
      }
    }
  }
}

function tintinInstalarProductosUnificados() {
  return tintinInstalarDispatcherUnificado();
}

function tintinInstalarDispatcherUnificado() {
  var spreadsheet = tintinProductsSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    var isEdit = trigger.getEventType && trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
    var sourceId = '';
    if (isEdit && trigger.getTriggerSourceId) {
      try { sourceId = trigger.getTriggerSourceId() || ''; } catch (sourceError) { sourceId = ''; }
    }
    var sameSource = !sourceId || sourceId === spreadsheet.getId();
    if (isEdit && sameSource) ScriptApp.deleteTrigger(trigger);
    else if (handler === 'tintinProductosOnEdit' || handler === TINTIN_ON_EDIT_DISPATCHER) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(TINTIN_ON_EDIT_DISPATCHER).forSpreadsheet(spreadsheet).onEdit().create();
  return tintinDiagnosticarActivadores();
}

function tintinDespacharEdicionInstalable(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === TINTIN_PRODUCTS_SHEET) {
    tintinHandleProductEdit_(e);
    return;
  }
  if (sheetName === TINTIN_USERS_SHEET && typeof alEditarClientas === 'function') {
    try {
      alEditarClientas(e);
    } catch (userError) {
      var userStatus = /super.?admin|valor|rol|rechaz|invalid/i.test(String(userError && userError.message || userError)) ? 'REJECTED' : 'ERROR';
      tintinRecordSyncSafely_(userStatus, sheetName, e.range.getA1Notation(), String(userError && userError.message || userError));
      throw userError;
    }
    return;
  }
  if (sheetName === TINTIN_USERS_SHEET) {
    tintinHandleUserEdit_(e);
    return;
  }
  if (sheetName === TINTIN_ORDERS_SHEET) {
    tintinHandleOrderEdit_(e);
    return;
  }
  if (sheetName === 'Resenas' && typeof tintinEngagementOnEdit === 'function') {
    tintinEngagementOnEdit(e);
    return;
  }
  tintinRecordSyncSafely_('LOCAL', sheetName, e.range.getA1Notation(), 'Edicion local; no requiere sincronizacion remota.');
}

function tintinDiagnosticarActivadores() {
  return ScriptApp.getProjectTriggers().map(function(trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource()),
      sourceId: trigger.getTriggerSourceId ? trigger.getTriggerSourceId() : ''
    };
  });
}

function tintinFindProductRow_(sheet, productId) {
  var lastRow = Math.max(sheet.getLastRow(), TINTIN_PRODUCTS_FIRST_ROW);
  var ids = sheet.getRange(TINTIN_PRODUCTS_FIRST_ROW, 1, lastRow - TINTIN_PRODUCTS_FIRST_ROW + 1, 1).getDisplayValues();
  for (var index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0] || '').trim() === productId) return TINTIN_PRODUCTS_FIRST_ROW + index;
  }
  return sheet.getLastRow() + 1;
}

function tintinYesNo_(value) {
  return value === true ? 'Sí' : 'No';
}

// Firestore conserva el rol técnico de superadministración; la hoja expone
// solamente los cuatro roles operativos que admite su validación de datos.
function tintinSheetUserRole_(value) {
  var role = String(value || '').trim().toLowerCase();
  if (role === 'superadmin' || role === 'super_admin' || role === 'super admin') return 'admin';
  return ['client', 'viewer', 'agent', 'admin'].indexOf(role) >= 0 ? role : 'client';
}

function tintinPrepareNewProductRow_(sheet, rowNumber) {
  var templateRow = TINTIN_PRODUCTS_FIRST_ROW;
  if (sheet.getLastRow() < templateRow || rowNumber <= sheet.getLastRow()) return;
  var template = sheet.getRange(templateRow, 1, 1, 35);
  var target = sheet.getRange(rowNumber, 1, 1, 35);
  template.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  template.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  [7, 8, 10, 11, 13].forEach(function(column) {
    var formula = sheet.getRange(templateRow, column).getFormulaR1C1();
    if (formula) sheet.getRange(rowNumber, column).setFormulaR1C1(formula);
  });
}

function tintinSyncProductsFromFirestore_(body) {
  var auth = verifyFirebaseIdToken_(body && body.idToken);
  if (!auth || auth.ok !== true || !phase3EmailMatches_(auth.email, SUPER_ADMIN_EMAIL)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No autorizado' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ids = Array.isArray(body.productIds) ? body.productIds.slice(0, 100) : [];
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (!sheet) throw new Error('No existe la hoja Productos.');

  ids.forEach(function(rawId) {
    var id = String(rawId || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
    var productResult = phase3FetchDocument_('products/' + encodeURIComponent(id), body.idToken);
    var rowNumber = tintinFindProductRow_(sheet, id);
    if (!productResult.ok) {
      if (rowNumber <= sheet.getLastRow()) sheet.deleteRow(rowNumber);
      return;
    }
    var product = productResult.data || {};
    var inventoryResult = phase3FetchDocument_('productInventory/' + encodeURIComponent(id), body.idToken);
    var inventory = inventoryResult.ok ? inventoryResult.data || {} : {};
    tintinPrepareNewProductRow_(sheet, rowNumber);
    tintinMarkRowPushInProgress_(sheet, rowNumber);
    var current = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
    var sold = Number(current[9] || 0);
    var purchased = inventory.purchased == null
      ? (product.stock == null ? current[8] : Number(product.stock) + sold)
      : inventory.purchased;

    sheet.getRange(rowNumber, 1, 1, 2).setValues([[id, product.name || '']]);
    sheet.getRange(rowNumber, 4, 1, 3).setValues([[
      product.category || '',
      inventory.costUnit == null ? '' : inventory.costUnit,
      product.price == null ? '' : product.price
    ]]);
    sheet.getRange(rowNumber, 9).setValue(purchased == null ? '' : purchased);
    sheet.getRange(rowNumber, 12).setValue(inventory.stockMinimum == null ? '' : inventory.stockMinimum);
    sheet.getRange(rowNumber, 14, 1, 21).setValues([[
      inventory.internalNotes || '',
      tintinYesNo_(product.active !== false),
      tintinYesNo_(product.oferta === true),
      tintinYesNo_(product.destacado === true),
      product.priceBefore == null ? '' : product.priceBefore,
      product.badge || '',
      product.imageUrl || '',
      product.description || '',
      new Date(),
      product.material || '',
      product.measurements || '',
      product.colorFinish || '',
      product.care || '',
      product.waterResistance || '',
      product.warranty || '',
      product.sizeFit || '',
      product.packageContents || '',
      Array.isArray(product.imagesExtra) ? product.imagesExtra.join('\n') : '',
      product.collection || '',
      Array.isArray(product.tags) ? product.tags.join(', ') : '',
      product.variants ? JSON.stringify(product.variants) : ''
    ]]);
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true, sheetName: TINTIN_PRODUCTS_SHEET, synced: ids.length }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Llamar desde el doPost existente. Devuelve null cuando la solicitud no
// pertenece al sincronizador de productos y permite continuar las demás rutas.
function tintinHandleUnifiedProductsPost_(body) {
  if (!body || body.action !== 'syncProducts') return null;
  return tintinSyncProductsFromFirestore_(body);
}

function tintinDiagnosticarWebhookProductos() {
  var properties = PropertiesService.getScriptProperties();
  var result = {
    ok: false,
    destructive: false,
    storeUrlConfigured: !!String(properties.getProperty('TINTIN_STORE_URL') || '').trim(),
    secretConfigured: !!String(properties.getProperty('SHEETS_ENGAGEMENT_SECRET') || ''),
    expectedRevision: TINTIN_PRODUCTS_WEBHOOK_REVISION
  };
  if (!result.secretConfigured) {
    result.error = 'secret-missing-in-apps-script';
    return result;
  }
  try {
    result.storeOrigin = tintinStoreOrigin_();
    var requestResult = tintinCallProductsWebhook_({
      action: 'diagnose',
      source: 'google-apps-script',
      expectedRevision: TINTIN_PRODUCTS_WEBHOOK_REVISION
    });
    var response = requestResult.response;
    var body = requestResult.body;
    var headers = response.getHeaders();
    result.httpStatus = response.getResponseCode();
    result.authState = String(headers['X-Tintin-Auth-State'] || headers['x-tintin-auth-state'] || 'unknown');
    result.deployedRevision = String(headers['X-Tintin-Products-Webhook'] || headers['x-tintin-products-webhook'] || body.revision || 'legacy-or-wrong-endpoint');
    result.hostname = body.hostname || '';
    result.endpoint = body.endpoint || '';
    result.ok = response.getResponseCode() === 200 && body.ok === true && body.authenticated === true &&
      result.deployedRevision === TINTIN_PRODUCTS_WEBHOOK_REVISION;
    if (!result.ok) result.error = body.error || 'webhook-diagnostic-failed';
    return result;
  } catch (error) {
    result.error = String(error && error.message || error).slice(0, 300);
    return result;
  }
}

function tintinRevisarProductosUnificados() {
  var spreadsheet = tintinProductsSpreadsheet_();
  var properties = PropertiesService.getScriptProperties();
  var triggers = tintinDiagnosticarActivadores();
  return {
    ok: !!spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET),
    spreadsheetId: spreadsheet.getId(),
    productsSheet: !!spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET),
    usersSheet: !!spreadsheet.getSheetByName(TINTIN_USERS_SHEET),
    historySheet: !!spreadsheet.getSheetByName(TINTIN_SYNC_HISTORY_SHEET),
    legacyCatalogSheetPresent: !!spreadsheet.getSheetByName('Catálogo web'),
    sheetsSecretConfigured: !!String(properties.getProperty('SHEETS_ENGAGEMENT_SECRET') || ''),
    storeUrlConfigured: !!String(properties.getProperty('TINTIN_STORE_URL') || '').trim(),
    dispatcherTriggers: triggers.filter(function(item) { return item.handler === TINTIN_ON_EDIT_DISPATCHER; }).length,
    editTriggers: triggers.filter(function(item) { return item.eventType.indexOf('ON_EDIT') !== -1; }),
    triggers: triggers
  };
}

function tintinRevisarConfiguracionTintin() {
  var products = tintinRevisarProductosUnificados();
  var webhook = tintinDiagnosticarWebhookProductos();
  return {
    ok: products.ok && products.usersSheet && products.historySheet && products.dispatcherTriggers === 1 && webhook.ok,
    products: products,
    webhook: webhook,
    superAdminProtected: String(PropertiesService.getScriptProperties().getProperty('SUPER_ADMIN_EMAIL') || '').trim().toLowerCase() === 'tintinaccs@gmail.com'
  };
}

function tintinProbarConfiguracionCompleta() {
  return tintinRevisarConfiguracionTintin();
}

function tintinProbarEdicionCatalogo() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (!sheet || sheet.getLastRow() < TINTIN_PRODUCTS_FIRST_ROW) {
    throw new Error('Productos no tiene una fila existente para la prueba segura.');
  }
  var rowNumber = 0;
  var names = sheet.getRange(TINTIN_PRODUCTS_FIRST_ROW, 2, sheet.getLastRow() - TINTIN_PRODUCTS_FIRST_ROW + 1, 1).getDisplayValues();
  for (var index = 0; index < names.length; index += 1) {
    if (String(names[index][0] || '').trim()) {
      rowNumber = TINTIN_PRODUCTS_FIRST_ROW + index;
      break;
    }
  }
  if (!rowNumber) throw new Error('No existe un producto válido para la prueba segura.');
  var before = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  if (String(before[34] || '').trim()) throw new Error('La fila de prueba tiene una acción pendiente; elegí otra fila.');
  tintinSendProductRow_(sheet, rowNumber);
  var after = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  return {
    ok: true,
    productId: String(after[0] || ''),
    row: rowNumber,
    sameName: String(before[1] || '') === String(after[1] || ''),
    samePrice: Number(before[5] || 0) === Number(after[5] || 0),
    sameStock: Number(before[10] || 0) === Number(after[10] || 0),
    actionCleared: String(after[34] || '') === ''
  };
}

function tintinWebhookSecret_() {
  var secret = String(PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET') || '');
  if (!secret) throw new Error('Falta SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  return secret;
}

function tintinCallInternalWebhook_(path, payload) {
  var response = UrlFetchApp.fetch(tintinStoreOrigin_() + path, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Tintin-Sheets-Secret': tintinWebhookSecret_() },
    payload: JSON.stringify(payload)
  });
  var body = tintinParseJsonResponse_(response);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || body.ok !== true) {
    throw new Error(body.error || 'La tienda rechazó la sincronización.');
  }
  return body;
}

function tintinHandleUserEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 7) return;
  var column = e.range.getColumn();
  if ([TINTIN_USERS_COL.role, TINTIN_USERS_COL.blocked, TINTIN_USERS_COL.internalNotes, TINTIN_USERS_COL.action].indexOf(column) === -1) return;
  var sheet = e.range.getSheet();
  var row = sheet.getRange(e.range.getRow(), 2, 1, TINTIN_USERS_COL.lastChangeId - 1).getValues()[0];
  var at = function(col) { return row[col - 2]; };
  var uid = String(at(TINTIN_USERS_COL.uid) || '').trim();
  if (!uid) return;
  var changeId = Utilities.getUuid();
  var payload = {
    entity: 'user', action: String(at(TINTIN_USERS_COL.action) || '').trim() === 'ELIMINAR' ? 'softDeleteUser' : 'updateUser',
    uid: uid, role: String(at(TINTIN_USERS_COL.role) || '').trim().toLowerCase(), blocked: tintinBool_(at(TINTIN_USERS_COL.blocked)),
    internalNotes: String(at(TINTIN_USERS_COL.internalNotes) || ''), changeId: changeId,
    baseChangeId: String(sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.lastChangeId).getValue() || '').trim(),
    source: 'google-sheets:Usuarios web', schemaVersion: 4
  };
  tintinRecordSyncSafely_('SYNCING', sheet.getName(), e.range.getA1Notation(), 'Sincronizando cuenta web.');
  try {
    tintinCallInternalWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    if (payload.action === 'softDeleteUser') {
      sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.blocked).setValue('Sí');
      sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.action).clearContent();
    }
    sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.lastChangeId).setValue(changeId);
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Cuenta web sincronizada sin eliminar su identidad histórica.');
  } catch (error) {
    tintinRecordSyncSafely_('ERROR', sheet.getName(), e.range.getA1Notation(), String(error && error.message || error));
    throw error;
  }
}

function tintinHandleOrderEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 2 || [11, 13].indexOf(e.range.getColumn()) === -1) return;
  var message = 'Pedidos web es un espejo de solo lectura. Cambiá estados desde Superadmin para conservar la integridad de stock.';
  if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1 && Object.prototype.hasOwnProperty.call(e, 'oldValue')) {
    e.range.setValue(e.oldValue);
  } else {
    tintinPullOrdersFromWeb_();
  }
  tintinRecordSyncSafely_('REJECTED', e.range.getSheet().getName(), e.range.getA1Notation(), message);
}

function tintinSnapshot_(entity) {
  return tintinCallInternalWebhook_(TINTIN_SNAPSHOT_PATH, { action: 'snapshot', entity: entity }).records || [];
}

// Convierte un índice de columna 1-based a su letra A1 (1 → 'A', 27 → 'AA').
// Usado para derivar rangos de validación a partir de TINTIN_*_COL en vez de
// hardcodear letras que quedarían desincronizadas ante una reorganización.
function tintinColumnLetter_(column) {
  var letters = '';
  var n = column;
  while (n > 0) {
    var remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function tintinDateFromIso_(value) {
  var date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date : '';
}

function tintinReplaceTabRows_(sheetName, firstRow, width, rows) {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return 0;
  // Algunas pestañas de producción tienen una estructura combinada que hace
  // fallar getLastRow() con un mensaje de validación ajeno a la hoja. El
  // snapshot ya conoce el tamaño exacto a reconciliar; usarlo evita consultar
  // metadatos defectuosos y conserva el layout existente.
  // Las pestañas espejo pueden conservar filas de sincronizaciones anteriores
  // por debajo del snapshot actual. Esas filas ya no tienen entidad remota,
  // pero sus valores sí siguen participando en validaciones estrictas (por
  // ejemplo, roles legacy como `superadmin`). Limpiar hasta el final de la
  // grilla de datos elimina residuos sin alterar encabezados, formatos,
  // fórmulas de otras hojas ni validaciones de la pestaña.
  var existing = Math.max(rows.length, sheet.getMaxRows() - firstRow + 1, 1);
  sheet.getRange(firstRow, 1, existing, width).clearContent();
  if (rows.length) sheet.getRange(firstRow, 1, rows.length, width).setValues(rows);
  return rows.length;
}

function tintinPullUsersFromWeb_() {
  var rows = tintinSnapshot_('users').map(function(user) {
    var row = new Array(TINTIN_USERS_COL.lastChangeId).fill('');
    row[TINTIN_USERS_COL.uid - 1] = user.uid;
    row[TINTIN_USERS_COL.name - 1] = user.name;
    row[TINTIN_USERS_COL.username - 1] = user.username;
    row[TINTIN_USERS_COL.customerId - 1] = user.customerId;
    row[TINTIN_USERS_COL.email - 1] = user.email;
    row[TINTIN_USERS_COL.phone - 1] = user.phone;
    row[TINTIN_USERS_COL.ci - 1] = user.ci;
    row[TINTIN_USERS_COL.orders - 1] = user.orders;
    row[TINTIN_USERS_COL.totalSpent - 1] = user.totalSpent;
    row[TINTIN_USERS_COL.role - 1] = tintinSheetUserRole_(user.role);
    row[TINTIN_USERS_COL.blocked - 1] = tintinYesNo_(user.blocked);
    row[TINTIN_USERS_COL.profileStatus - 1] = user.profileStatus;
    row[TINTIN_USERS_COL.usernameChangeUsed - 1] = tintinYesNo_(user.usernameChangeUsed);
    row[TINTIN_USERS_COL.internalNotes - 1] = user.internalNotes;
    row[TINTIN_USERS_COL.createdAt - 1] = tintinDateFromIso_(user.createdAt);
    row[TINTIN_USERS_COL.lastAccess - 1] = tintinDateFromIso_(user.lastAccess);
    row[TINTIN_USERS_COL.lastChangeId - 1] = user.lastChangeId;
    return row;
  });
  return tintinReplaceTabRows_(TINTIN_USERS_SHEET, TINTIN_USERS_FIRST_ROW, TINTIN_USERS_COL.lastChangeId, rows);
}

function tintinPullOrdersFromWeb_() {
  var rows = tintinSnapshot_('orders').map(function(order) {
    return [order.orderId, order.orderNumber, order.requestId, order.customerId, order.userId, order.userEmail,
      order.contactEmail, order.userName, order.userPhone, order.ci, order.status, order.paymentMethod,
      order.paymentStatus, order.shippingMethod, order.shippingCity, order.departamento, order.address,
      order.subtotal, order.shippingCost, order.total, order.invoiceWanted, order.razonSocial, order.ruc,
      JSON.stringify(order.itemsSnapshot || []), tintinDateFromIso_(order.createdAt), tintinDateFromIso_(order.updatedAt),
      order.inventoryState, order.notificationStatus, order.lastChangeId];
  });
  return tintinReplaceTabRows_(TINTIN_ORDERS_SHEET, 2, 29, rows);
}

function tintinPullAuditFromWeb_() {
  var rows = tintinSnapshot_('audit').map(function(record) {
    return [record.eventId, tintinDateFromIso_(record.timestamp), record.customerId || '', record.actorId || '',
      record.actorEmail || '', record.actorRole || '', record.action || '', record.entityType || '', record.entityId || '',
      JSON.stringify(record.before || {}), JSON.stringify(record.after || {}), record.origin || '', record.result || '', record.changeId || ''];
  });
  return tintinReplaceTabRows_(TINTIN_AUDIT_SHEET, 2, 14, rows);
}

function tintinReconciliarEspejosWeb() {
  var summary = {};
  summary.users = tintinPullUsersFromWeb_();
  summary.orders = tintinPullOrdersFromWeb_();
  summary.audit = tintinPullAuditFromWeb_();
  tintinRecordSyncSafely_('SYNCED', 'Sistema', 'web→sheets', 'Espejos web actualizados: usuarios ' + summary.users + ', pedidos ' + summary.orders + '.');
  return summary;
}

function tintinInstalarSincronizacionCompleta() {
  tintinInstalarDispatcherUnificado();
  ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'tintinReconciliarEspejosWeb';
  }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('tintinReconciliarEspejosWeb').timeBased().everyMinutes(5).create();
  return tintinReconciliarEspejosWeb();
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch (error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'JSON inválido' })).setMimeType(ContentService.MimeType.JSON); }
  var response = tintinHandleUnifiedProductsPost_(body);
  if (response) return response;
  if (typeof tintinParityHandleServerOrderSync_ === 'function') {
    var orderSyncResponse = tintinParityHandleServerOrderSync_(body);
    if (orderSyncResponse) return orderSyncResponse;
  }
  if (body.action === 'syncEngagement' && typeof tintinHandleEngagement_ === 'function') return tintinHandleEngagement_(body);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Acción no permitida' })).setMimeType(ContentService.MimeType.JSON);
}

// Enlazar desde el doPost existente antes de cualquier ruta heredada:
// var unifiedProductsResponse = tintinHandleUnifiedProductsPost_(body);
// if (unifiedProductsResponse) return unifiedProductsResponse;
// Esta ruta escribe solo en Productos y nunca vuelve a crear Catálogo web.
