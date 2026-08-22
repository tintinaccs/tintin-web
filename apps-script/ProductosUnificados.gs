// Hoja canonica de inventario y catalogo web.
var TINTIN_PRODUCTS_SHEET = 'Productos';
var TINTIN_PRODUCTS_HEADER_ROW = 6;
var TINTIN_PRODUCTS_FIRST_ROW = 7;
var TINTIN_PRODUCTS_SPREADSHEET_ID = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
var TINTIN_USERS_SHEET = 'Usuarios web';
var TINTIN_SYNC_HISTORY_SHEET = 'Historial sync';
var TINTIN_PRODUCTS_WEBHOOK_PATH = '/api/sheets-products-webhook';
var TINTIN_PRODUCTS_WEBHOOK_REVISION = 'products-canonical-v3';
var TINTIN_ON_EDIT_DISPATCHER = 'tintinDespacharEdicionInstalable';
var TINTIN_SYNC_HISTORY_HEADER_ROW = 7;
var TINTIN_SYNC_HISTORY_FIRST_ROW = 8;
var TINTIN_SYNC_HISTORY_MAX_ROWS = 500;

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
    else if (/^(detalle|mensaje|descripcion|error)$/.test(key)) { values[index] = String(detail || '').slice(0, 500); matched += 1; }
  });
  // No adivina columnas: si la fila 7 no expone estado, conserva el historial intacto.
  if (!headers.some(function(header) { return /^(estado|status)$/.test(tintinSyncHeaderKey_(header)); })) return false;
  history.insertRowBefore(TINTIN_SYNC_HISTORY_FIRST_ROW);
  history.getRange(TINTIN_SYNC_HISTORY_FIRST_ROW, 1, 1, width).setValues([values]);
  var firstExcessRow = TINTIN_SYNC_HISTORY_FIRST_ROW + TINTIN_SYNC_HISTORY_MAX_ROWS;
  if (history.getLastRow() >= firstExcessRow) {
    history.deleteRows(firstExcessRow, history.getLastRow() - firstExcessRow + 1);
  }
  return matched > 0;
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

function tintinProductPayload_(row) {
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
    variants: row[33]
  };
}

function tintinSendProductRow_(sheet, rowNumber) {
  var row = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
  if (!row[1]) return;
  var requestedAction = String(row[34] || '').trim().toLowerCase();
  var payload = tintinProductPayload_(row);
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

// Crear como activador instalable "Al editar". Un activador simple no tiene
// permiso para UrlFetchApp.
function tintinProductosOnEdit(e) {
  tintinHandleProductEdit_(e);
}

function tintinHandleProductEdit_(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_PRODUCTS_SHEET || e.range.getRow() < TINTIN_PRODUCTS_FIRST_ROW) return;
  if (e.range.getColumn() === 2 || e.range.getColumn() === 4 || e.range.getColumn() === 5 ||
      e.range.getColumn() === 6 || e.range.getColumn() === 9 || e.range.getColumn() === 12 ||
      e.range.getColumn() === 14 || e.range.getColumn() >= 15) {
    var cell = e.range.getA1Notation();
    tintinRecordSyncSafely_('SYNCING', sheet.getName(), cell, 'Sincronizando producto con Firestore.');
    try {
      tintinSendProductRow_(sheet, e.range.getRow());
      tintinRecordSyncSafely_('SYNCED', sheet.getName(), cell, 'Producto sincronizado.');
    } catch (error) {
      // Una validacion rechazada restaura la celda, pero no transforma todo el
      // motor en NO SINCRONIZADO. El dispatcher superior puede registrarla como
      // REJECTED en el historial canónico.
      if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1) {
        if (Object.prototype.hasOwnProperty.call(e, 'oldValue')) e.range.setValue(e.oldValue);
        else e.range.clearContent();
      }
      var isRejected = error && error.tintinHttpStatus === 400 || /valor numerico invalido/i.test(String(error && error.message || error));
      var status = isRejected ? 'REJECTED' : 'ERROR';
      tintinRecordSyncSafely_(status, sheet.getName(), cell, String(error && error.message || error));
      throw error;
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

// Enlazar desde el doPost existente antes de cualquier ruta heredada:
// var unifiedProductsResponse = tintinHandleUnifiedProductsPost_(body);
// if (unifiedProductsResponse) return unifiedProductsResponse;
// Esta ruta escribe solo en Productos y nunca vuelve a crear Catálogo web.
