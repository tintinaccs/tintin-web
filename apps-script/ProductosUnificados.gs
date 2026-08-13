// Hoja canonica de inventario y catalogo web.
var TINTIN_PRODUCTS_SHEET = 'Productos';
var TINTIN_PRODUCTS_HEADER_ROW = 6;
var TINTIN_PRODUCTS_FIRST_ROW = 7;
var TINTIN_PRODUCTS_SPREADSHEET_ID = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';

function tintinProductsSpreadsheet_() {
  return SpreadsheetApp.openById(TINTIN_PRODUCTS_SPREADSHEET_ID);
}

function tintinBool_(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'si' || String(value || '').trim().toLowerCase() === 'sí';
}

function tintinOptionalNumber_(value) {
  return value === '' || value === null ? null : Number(value);
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
  var properties = PropertiesService.getScriptProperties();
  var baseUrl = properties.getProperty('TINTIN_STORE_URL') || 'https://tintinaccesorios.pages.dev';
  var secret = properties.getProperty('SHEETS_ENGAGEMENT_SECRET');
  if (!secret) throw new Error('Falta SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  var response = UrlFetchApp.fetch(baseUrl.replace(/\/$/, '') + '/api/sheets-products-webhook', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Tintin-Sheets-Secret': secret },
    payload: JSON.stringify(tintinProductPayload_(row)),
    muteHttpExceptions: true
  });
  var result = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.ok !== true) {
    throw new Error(result.error || 'La tienda rechazo la sincronizacion.');
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
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_PRODUCTS_SHEET || e.range.getRow() < TINTIN_PRODUCTS_FIRST_ROW) return;
  if (e.range.getColumn() === 2 || e.range.getColumn() === 4 || e.range.getColumn() === 5 ||
      e.range.getColumn() === 6 || e.range.getColumn() === 9 || e.range.getColumn() === 12 ||
      e.range.getColumn() === 14 || e.range.getColumn() >= 15) {
    tintinSendProductRow_(sheet, e.range.getRow());
  }
}

function tintinInstalarProductosUnificados() {
  var spreadsheet = tintinProductsSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'tintinProductosOnEdit') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('tintinProductosOnEdit').forSpreadsheet(spreadsheet).onEdit().create();
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

// Enlazar desde el doPost existente antes de cualquier ruta heredada:
// var unifiedProductsResponse = tintinHandleUnifiedProductsPost_(body);
// if (unifiedProductsResponse) return unifiedProductsResponse;
// Esta ruta escribe solo en Productos y nunca vuelve a crear Catálogo web.
