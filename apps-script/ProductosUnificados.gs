// Hoja canonica de inventario y catalogo web.
var TINTIN_PRODUCTS_SHEET = 'Productos';
var TINTIN_PRODUCTS_HEADER_ROW = 6;
var TINTIN_PRODUCTS_FIRST_ROW = 7;
var TINTIN_PRODUCTS_SPREADSHEET_ID = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
var TINTIN_PRODUCTS_CANARY_ID = 'CANARY-SHEETS-FIRESTORE';
var TINTIN_PRODUCTS_CANARY_NAME = 'PRUEBA QA · NO VENDER';
var TINTIN_USERS_SHEET = 'Usuarios web';
var TINTIN_USERS_HEADER_ROW = 6;
var TINTIN_USERS_FIRST_ROW = 7;
// Fuente única de verdad del layout de Usuarios web. Bloques: identidad (2-5),
// contacto (6-8), comercial (9-10), estado (11-14), administración (15-16),
// sincronización/técnico (17-19) y perfil/checkout (20-31). Cualquier reorganización de columnas debe
// actualizarse solo acá; el resto del código lee por nombre de campo.
var TINTIN_USERS_COL = {
  uid: 2, name: 3, username: 4, customerId: 5,
  email: 6, phone: 7, ci: 8,
  orders: 9, totalSpent: 10,
  role: 11, blocked: 12, profileStatus: 13, usernameChangeUsed: 14,
  internalNotes: 15, action: 16,
  createdAt: 17, lastAccess: 18, lastChangeId: 19,
  firstName: 20, lastName: 21, dob: 22, address: 23, locationName: 24,
  addressLat: 25, addressLng: 26, departamento: 27, invoiceWanted: 28,
  razonSocial: 29, ruc: 30, updatedAt: 31
};
var TINTIN_USERS_HEADERS = (function() {
  var labels = {
    uid: 'UID', name: 'Nombre', username: 'Username', customerId: 'ID cliente',
    email: 'Correo', phone: 'Teléfono', ci: 'Cédula',
    orders: 'Pedidos', totalSpent: 'Total gastado (Gs.)',
    role: 'Rol', blocked: 'Bloqueado', profileStatus: 'Estado de perfil', usernameChangeUsed: 'Cambió username',
    internalNotes: 'Notas internas', action: 'Acción',
    createdAt: 'Creado', lastAccess: 'Último acceso', lastChangeId: 'Último changeId',
    firstName: 'Nombre', lastName: 'Apellido', dob: 'Fecha nacimiento', address: 'Dirección', locationName: 'Ubicación mapa',
    addressLat: 'Latitud', addressLng: 'Longitud', departamento: 'Departamento', invoiceWanted: 'Solicita factura',
    razonSocial: 'Razón social', ruc: 'RUC', updatedAt: 'Actualizado'
  };
  var headerRow = new Array(TINTIN_USERS_COL.updatedAt).fill('');
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
  if (!history) throw new Error('No existe la hoja Historial sync.');
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
  // No adivina columnas: si la fila 7 no expone estado, conserva el historial intacto
  // y lo informa; un retorno silencioso ocultaba que el evento no se registró.
  if (!headers.some(function(header) { return /^(estado|status)$/.test(tintinSyncHeaderKey_(header)); })) {
    throw new Error('Historial sync no expone una columna Estado en la fila ' + TINTIN_SYNC_HISTORY_HEADER_ROW + '.');
  }
  // insertRowBefore/deleteRows desplazan filas. Un lock evita que dos onEdit
  // concurrentes calculen límites incompatibles y pierdan el registro.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('No se pudo obtener el lock de Historial sync.');
  try {
    history.insertRowBefore(TINTIN_SYNC_HISTORY_FIRST_ROW);
    history.getRange(TINTIN_SYNC_HISTORY_FIRST_ROW, 1, 1, width).setValues([values]);
    var firstExcessRow = TINTIN_SYNC_HISTORY_FIRST_ROW + TINTIN_SYNC_HISTORY_MAX_ROWS;
    if (history.getLastRow() >= firstExcessRow) {
      history.deleteRows(firstExcessRow, history.getLastRow() - firstExcessRow + 1);
    }
  } finally {
    lock.releaseLock();
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

// Nunca interrumpe la sincronización, pero devuelve si el evento quedó
// registrado para que las pruebas explícitas no lo den por supuesto.
function tintinRecordSyncSafely_(status, sheetName, cell, detail) {
  try {
    if (tintinAppendSyncHistory_(status, sheetName, cell, detail)) return { recorded: true };
    console.error('Historial sync no registró el evento ' + status + ': ninguna columna reconocida.');
    return { recorded: false, reason: 'no-recognized-columns' };
  } catch (historyError) {
    var reason = String(historyError && historyError.message || historyError);
    console.error('No se pudo registrar Historial sync: ' + reason);
    return { recorded: false, reason: reason };
  }
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
  // Desde este punto la paridad administrativa es el único dispatcher válido.
  // El dispatcher heredado podía encontrar funciones antiguas en el proyecto
  // y escribir datos de usuarios desde Sheets sin pasar por la autoridad de
  // Firestore.
  var dispatcher = typeof TINTIN_PARITY_DISPATCHER !== 'undefined'
    ? TINTIN_PARITY_DISPATCHER
    : TINTIN_ON_EDIT_DISPATCHER;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    var isEdit = trigger.getEventType && trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
    var sourceId = '';
    if (isEdit && trigger.getTriggerSourceId) {
      try { sourceId = trigger.getTriggerSourceId() || ''; } catch (sourceError) { sourceId = ''; }
    }
    var sameSource = !sourceId || sourceId === spreadsheet.getId();
    if (isEdit && sameSource) ScriptApp.deleteTrigger(trigger);
    else if (handler === 'tintinProductosOnEdit' || handler === TINTIN_ON_EDIT_DISPATCHER || handler === 'tintinDespacharEdicionParidad' || handler === 'tintinReconciliarEspejosWeb' || handler === 'tintinReconciliarAdminParidad') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(dispatcher).forSpreadsheet(spreadsheet).onEdit().create();
  if (typeof TINTIN_PARITY_RECONCILER !== 'undefined') {
    ScriptApp.newTrigger(TINTIN_PARITY_RECONCILER).timeBased().everyMinutes(1).create();
  } else {
    ScriptApp.newTrigger('tintinReconciliarEspejosWeb').timeBased().everyMinutes(5).create();
  }
  return tintinDiagnosticarActivadores();
}

function tintinDespacharEdicionInstalable(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === TINTIN_PRODUCTS_SHEET) {
    tintinHandleProductEdit_(e);
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

function tintinBuildProductRowIndex_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), TINTIN_PRODUCTS_FIRST_ROW);
  var ids = sheet.getRange(TINTIN_PRODUCTS_FIRST_ROW, 1, lastRow - TINTIN_PRODUCTS_FIRST_ROW + 1, 1).getDisplayValues();
  var rows = {};
  for (var index = 0; index < ids.length; index += 1) {
    var id = String(ids[index][0] || '').trim();
    if (id) rows[id] = TINTIN_PRODUCTS_FIRST_ROW + index;
  }
  return rows;
}

function tintinFindProductRow_(sheet, productId, rowIndex) {
  if (rowIndex && rowIndex[productId]) return rowIndex[productId];
  if (!rowIndex) rowIndex = tintinBuildProductRowIndex_(sheet);
  if (rowIndex[productId]) return rowIndex[productId];
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

// Compartido entre el sincronizador con idToken (tintinSyncProductsFromFirestore_)
// y el worker programado con secreto (tintinSyncProductsFromPayload_): escribe
// una fila de Productos a partir de un producto/inventario ya resueltos.
function tintinWriteProductRow_(sheet, rowNumber, product, inventory) {
  product = product || {};
  inventory = inventory || {};
  tintinPrepareNewProductRow_(sheet, rowNumber);
  tintinMarkRowPushInProgress_(sheet, rowNumber);
  var current = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  var sold = Number(current[9] || 0);
  var purchased = inventory.purchased == null
    ? (product.stock == null ? current[8] : Number(product.stock) + sold)
    : inventory.purchased;

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
    sheet.getRange(rowNumber, 1, 1, 2).setValues([[id, product.name || '']]);
    tintinWriteProductRow_(sheet, rowNumber, product, inventory);
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true, sheetName: TINTIN_PRODUCTS_SHEET, synced: ids.length }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Worker programado (catalogSheetSyncQueue): Cloudflare ya resolvió products/
// productInventory con su propia credencial de servicio y empuja el payload
// completo, porque un cron no dispone de un idToken de usuario vivo para que
// Apps Script tire de Firestore por sí mismo. Autenticación por secreto
// compartido, igual que tintinParityHandleServerOrderSync_ para syncOrder.
function tintinSyncProductsFromPayload_(body) {
  if (!tintinParitySecretMatches_(body.secret)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No autorizado' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (!sheet) throw new Error('No existe la hoja Productos.');
  // Un POST puede traer cinco productos. Construir el índice una vez evita
  // leer toda la columna A por cada ítem, que era el costo dominante y hacía
  // que los lotes legítimos excedieran el timeout de Cloudflare.
  var rowIndex = tintinBuildProductRowIndex_(sheet);

  items.forEach(function(item) {
    var id = String((item && item.id) || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
    var rowNumber = tintinFindProductRow_(sheet, id, rowIndex);
    if (!item.exists) {
      if (rowNumber <= sheet.getLastRow()) {
        sheet.deleteRow(rowNumber);
        // Al borrar, los números de fila posteriores se desplazan.
        rowIndex = tintinBuildProductRowIndex_(sheet);
      }
      return;
    }
    var product = item.product || {};
    sheet.getRange(rowNumber, 1, 1, 2).setValues([[id, product.name || '']]);
    tintinWriteProductRow_(sheet, rowNumber, product, item.inventory || {});
    rowIndex[id] = rowNumber;
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true, sheetName: TINTIN_PRODUCTS_SHEET, synced: items.length }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Llamar desde el doPost existente. Devuelve null cuando la solicitud no
// pertenece al sincronizador de productos y permite continuar las demás rutas.
function tintinHandleUnifiedProductsPost_(body) {
  if (!body) return null;
  if (body.action === 'syncProducts') return tintinSyncProductsFromFirestore_(body);
  if (body.action === 'syncProductsPayload') return tintinSyncProductsFromPayload_(body);
  return null;
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
  var dispatcherHandlers = [TINTIN_ON_EDIT_DISPATCHER, 'tintinDespacharEdicionParidad'];
  var reconcileHandlers = ['tintinReconciliarEspejosWeb', 'tintinReconciliarAdminParidad'];
  return {
    ok: !!spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET),
    spreadsheetId: spreadsheet.getId(),
    productsSheet: !!spreadsheet.getSheetByName(TINTIN_PRODUCTS_SHEET),
    usersSheet: !!spreadsheet.getSheetByName(TINTIN_USERS_SHEET),
    historySheet: !!spreadsheet.getSheetByName(TINTIN_SYNC_HISTORY_SHEET),
    legacyCatalogSheetPresent: !!spreadsheet.getSheetByName('Catálogo web'),
    sheetsSecretConfigured: !!String(properties.getProperty('SHEETS_ENGAGEMENT_SECRET') || ''),
    storeUrlConfigured: !!String(properties.getProperty('TINTIN_STORE_URL') || '').trim(),
    dispatcherTriggers: triggers.filter(function(item) { return dispatcherHandlers.indexOf(item.handler) >= 0; }).length,
    canonicalDispatcher: triggers.filter(function(item) { return item.handler === 'tintinDespacharEdicionParidad'; }).length,
    reconciliationTriggers: triggers.filter(function(item) { return reconcileHandlers.indexOf(item.handler) >= 0; }).length,
    editTriggers: triggers.filter(function(item) { return item.eventType.indexOf('ON_EDIT') !== -1; }),
    triggers: triggers
  };
}

function tintinRevisarConfiguracionTintin() {
  var products = tintinRevisarProductosUnificados();
  var webhook = tintinDiagnosticarWebhookProductos();
  return {
    ok: products.ok && products.usersSheet && products.historySheet && products.dispatcherTriggers === 1 && products.reconciliationTriggers === 1 && webhook.ok,
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
  if (!sheet || sheet.getLastRow() < TINTIN_PRODUCTS_FIRST_ROW) return {
    ok: false, destructive: false, error: 'canary-not-found'
  };
  var canaryRows = [];
  var names = sheet.getRange(TINTIN_PRODUCTS_FIRST_ROW, 2, sheet.getLastRow() - TINTIN_PRODUCTS_FIRST_ROW + 1, 1).getDisplayValues();
  for (var index = 0; index < names.length; index += 1) {
    if (String(names[index][0] || '').trim() === TINTIN_PRODUCTS_CANARY_NAME) {
      canaryRows.push(TINTIN_PRODUCTS_FIRST_ROW + index);
    }
  }
  if (!canaryRows.length) return {
    ok: false, destructive: false, error: 'canary-not-found', requiredProductId: TINTIN_PRODUCTS_CANARY_ID,
    requiredProductName: TINTIN_PRODUCTS_CANARY_NAME
  };
  if (canaryRows.length !== 1) return {
    ok: false, destructive: false, error: 'canary-duplicate', rows: canaryRows
  };
  var rowNumber = canaryRows[0];
  var before = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  if (String(before[0] || '').trim() !== TINTIN_PRODUCTS_CANARY_ID) return {
    ok: false, destructive: false, error: 'canary-id-mismatch', row: rowNumber
  };
  if (tintinBool_(before[14]) || Number(before[10] || 0) !== 0 || String(before[34] || '').trim()) return {
    ok: false, destructive: false, error: 'canary-must-be-inactive-zero-stock-and-action-clear', row: rowNumber
  };
  if (!String(before[3] || '').trim() || !(Number(before[5]) > 0) || String(before[19] || '').trim()) return {
    ok: false, destructive: false, error: 'canary-needs-category-price-and-no-image', row: rowNumber
  };
  var cell = sheet.getRange(rowNumber, 1, 1, 35).getA1Notation();
  var historyStart = tintinRecordSyncSafely_('SYNCING', TINTIN_PRODUCTS_SHEET, cell, 'Ejecutando prueba controlada Sheets → Firestore para el canary inactivo.') || {};
  try {
    // El webhook trata changedFields vacío como una actualización parcial sin
    // campos y la rechaza. La prueba explícita declara el conjunto mínimo que
    // valida ambos documentos Firestore sin tocar otros productos.
    tintinSendProductRow_(sheet, rowNumber, [
      'name', 'category', 'price', 'active', 'stock',
      'costUnit', 'purchased', 'stockMinimum', 'internalNotes'
    ]);
    var after = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
    var sameName = String(before[1] || '') === String(after[1] || '');
    var samePrice = Number(before[5] || 0) === Number(after[5] || 0);
    var sameStock = Number(before[10] || 0) === Number(after[10] || 0);
    var result = {
      ok: String(after[0] || '').trim() === TINTIN_PRODUCTS_CANARY_ID &&
        String(after[1] || '').trim() === TINTIN_PRODUCTS_CANARY_NAME && !tintinBool_(after[14]) &&
        Number(after[10] || 0) === 0 && String(after[19] || '').trim() === '' &&
        sameName && samePrice && sameStock && String(after[34] || '').trim() === '',
      destructive: false,
      writesFirestore: true,
      publicCatalogVisible: false,
      productId: String(after[0] || ''),
      row: rowNumber,
      sameName: sameName,
      samePrice: samePrice,
      inactive: !tintinBool_(after[14]),
      zeroStock: sameStock && Number(after[10] || 0) === 0,
      actionCleared: String(after[34] || '').trim() === ''
    };
    var historyEnd = tintinRecordSyncSafely_(result.ok ? 'SYNCED' : 'ERROR', TINTIN_PRODUCTS_SHEET, cell,
      result.ok ? 'Prueba canary Sheets → Firestore confirmada; producto inactivo y sin stock.' : 'La escritura terminó, pero falló la verificación posterior del canary.') || {};
    // La escritura de negocio y el registro de auditoría son evidencias distintas.
    result.historyRecorded = historyStart.recorded === true && historyEnd.recorded === true;
    if (!result.historyRecorded) result.historyError = String(historyEnd.reason || historyStart.reason || 'unknown');
    return result;
  } catch (error) {
    tintinRecordSyncSafely_('ERROR', TINTIN_PRODUCTS_SHEET, cell, 'Falló la prueba canary Sheets → Firestore: ' + String(error && error.message || error));
    throw error;
  }
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
  if ([TINTIN_USERS_COL.role, TINTIN_USERS_COL.blocked, TINTIN_USERS_COL.internalNotes, TINTIN_USERS_COL.action].indexOf(column) === -1) {
    // Toda la información de perfil es un espejo de Firestore. Si alguien
    // la edita manualmente, se descarta de inmediato y se restaura el valor
    // canónico; nunca debe quedar un dato que exista solo en Sheets.
    tintinPullUsersFromWeb_();
    tintinRecordSyncSafely_('REJECTED', e.range.getSheet().getName(), e.range.getA1Notation(), 'La columna de usuario es informativa; Firestore conserva la autoridad del dato.');
    return;
  }
  var sheet = e.range.getSheet();
  var row = sheet.getRange(e.range.getRow(), 2, 1, TINTIN_USERS_COL.lastChangeId - 1).getValues()[0];
  var at = function(col) { return row[col - 2]; };
  var uid = String(at(TINTIN_USERS_COL.uid) || '').trim();
  if (!uid) return;
  var changeId = Utilities.getUuid();
  var payload = {
    entity: 'user', action: 'updateUser', // la eliminación de cuentas se retiró
    uid: uid, role: String(at(TINTIN_USERS_COL.role) || '').trim().toLowerCase(), blocked: tintinBool_(at(TINTIN_USERS_COL.blocked)),
    internalNotes: String(at(TINTIN_USERS_COL.internalNotes) || ''), changeId: changeId,
    baseChangeId: String(sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.lastChangeId).getValue() || '').trim(),
    source: 'google-sheets:Usuarios web', schemaVersion: 4
  };
  tintinRecordSyncSafely_('SYNCING', sheet.getName(), e.range.getA1Notation(), 'Sincronizando cuenta web.');
  try {
    tintinCallInternalWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    sheet.getRange(e.range.getRow(), TINTIN_USERS_COL.lastChangeId).setValue(changeId);
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Cuenta web sincronizada.');
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
  var attempt = 0;
  while (true) {
    try {
      return tintinCallInternalWebhook_(TINTIN_SNAPSHOT_PATH, { action: 'snapshot', entity: entity }).records || [];
    } catch (error) {
      var message = String(error && error.message || error);
      // Apps Script sometimes fails before receiving an HTTP response when its
      // outbound connection cannot resolve/reach Pages. Snapshot POSTs are
      // strictly read-only, so retry only these transport failures; never
      // retry an HTTP/API rejection or a mutating webhook here.
      if (attempt >= 2 || !/address unavailable|dns lookup failed|name resolution/i.test(message)) throw error;
      Utilities.sleep(attempt === 0 ? 250 : 750);
      attempt += 1;
    }
  }
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
  var existing = Math.max(0, sheet.getLastRow() - firstRow + 1);
  if (existing) sheet.getRange(firstRow, 1, existing, width).clearContent();
  if (rows.length) sheet.getRange(firstRow, 1, rows.length, width).setValues(rows);
  return rows.length;
}

function tintinPullUsersFromWeb_() {
  var usersSheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_USERS_SHEET);
  // Firestore es la fuente de verdad. Las validaciones antiguas de la hoja no
  // deben impedir que se repinte el espejo completo cuando cambió el catálogo
  // de roles o quedó una fila histórica con un valor anterior.
  if (usersSheet) {
    if (usersSheet.getMaxColumns() < TINTIN_USERS_COL.updatedAt) {
      usersSheet.insertColumnsAfter(usersSheet.getMaxColumns(), TINTIN_USERS_COL.updatedAt - usersSheet.getMaxColumns());
    }
    var roleColumn = tintinColumnLetter_(TINTIN_USERS_COL.role);
    usersSheet.getRange(TINTIN_USERS_FIRST_ROW, 1, Math.max(1, usersSheet.getMaxRows() - TINTIN_USERS_FIRST_ROW + 1), TINTIN_USERS_COL.updatedAt).clearDataValidations();
  }
  var rows = tintinSnapshot_('users').map(function(user) {
    var row = new Array(TINTIN_USERS_COL.updatedAt).fill('');
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
    row[TINTIN_USERS_COL.firstName - 1] = user.firstName;
    row[TINTIN_USERS_COL.lastName - 1] = user.lastName;
    row[TINTIN_USERS_COL.dob - 1] = tintinDateFromIso_(user.dob);
    row[TINTIN_USERS_COL.address - 1] = user.address;
    row[TINTIN_USERS_COL.locationName - 1] = user.locationName;
    row[TINTIN_USERS_COL.addressLat - 1] = user.addressLat;
    row[TINTIN_USERS_COL.addressLng - 1] = user.addressLng;
    row[TINTIN_USERS_COL.departamento - 1] = user.departamento;
    row[TINTIN_USERS_COL.invoiceWanted - 1] = tintinYesNo_(user.invoiceWanted);
    row[TINTIN_USERS_COL.razonSocial - 1] = user.razonSocial;
    row[TINTIN_USERS_COL.ruc - 1] = user.ruc;
    row[TINTIN_USERS_COL.updatedAt - 1] = tintinDateFromIso_(user.updatedAt);
    return row;
  });
  var count = tintinReplaceTabRows_(TINTIN_USERS_SHEET, TINTIN_USERS_FIRST_ROW, TINTIN_USERS_COL.updatedAt, rows);
  if (usersSheet && typeof tintinParityValidation_ === 'function') {
    var blockedColumn = tintinColumnLetter_(TINTIN_USERS_COL.blocked);
    var actionColumn = tintinColumnLetter_(TINTIN_USERS_COL.action);
    usersSheet.getRange(roleColumn + TINTIN_USERS_FIRST_ROW + ':' + roleColumn).setDataValidation(tintinParityValidation_(['client', 'viewer', 'agent', 'admin']));
    usersSheet.getRange(blockedColumn + TINTIN_USERS_FIRST_ROW + ':' + blockedColumn).setDataValidation(tintinParityValidation_(['Sí', 'No']));
    usersSheet.getRange(actionColumn + TINTIN_USERS_FIRST_ROW + ':' + actionColumn).clearDataValidations();
  }
  return count;
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
  if (typeof tintinReconciliarAdminParidad === 'function') return tintinReconciliarAdminParidad();
  return tintinReconciliarEspejosWeb();
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch (error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'JSON inválido' })).setMimeType(ContentService.MimeType.JSON); }
  // La creación pública de pedidos usa la transacción privilegiada de Fase 4.
  // Esta ruta debe resolverse antes del router de Sheets: ambos usan `createOrder`
  // como nombre de acción, pero sólo Fase 4 recibe el draft del checkout y el
  // idToken para validar la sesión y reservar stock atómicamente.
  if (body.action === 'createOrder' && typeof phase4CreateOrder_ === 'function') {
    return ContentService.createTextOutput(JSON.stringify(
      phase4CreateOrder_(body, body.idToken)
    )).setMimeType(ContentService.MimeType.JSON);
  }
  var response = tintinHandleUnifiedProductsPost_(body);
  if (response) return response;
  if (typeof tintinParityHandleServerOrderSync_ === 'function') {
    var orderSyncResponse = tintinParityHandleServerOrderSync_(body);
    if (orderSyncResponse) return orderSyncResponse;
  }
  if (body.action === 'syncEngagement' && typeof tintinHandleEngagement_ === 'function') return tintinHandleEngagement_(body);
  if (body.action === 'syncEngagementBatch' && typeof tintinHandleEngagementBatch_ === 'function') return tintinHandleEngagementBatch_(body);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Acción no permitida' })).setMimeType(ContentService.MimeType.JSON);
}

// Enlazar desde el doPost existente antes de cualquier ruta heredada:
// var unifiedProductsResponse = tintinHandleUnifiedProductsPost_(body);
// if (unifiedProductsResponse) return unifiedProductsResponse;
// Esta ruta escribe solo en Productos y nunca vuelve a crear Catálogo web.
