// Hoja canonica de inventario y catalogo web.
var TINTIN_PRODUCTS_SHEET = 'Productos';
var TINTIN_PRODUCTS_HEADER_ROW = 6;
var TINTIN_PRODUCTS_FIRST_ROW = 7;

function tintinBool_(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'si' || String(value || '').trim().toLowerCase() === 'sí';
}

function tintinOptionalNumber_(value) {
  return value === '' || value === null ? null : Number(value);
}

function tintinProductPayload_(row) {
  return {
    action: String(row[34] || '').toLowerCase() === 'eliminar' ? 'deleteProduct' : 'saveProduct',
    productId: String(row[0] || '').trim(),
    name: row[1],
    category: row[3],
    costUnit: tintinOptionalNumber_(row[4]),
    price: tintinOptionalNumber_(row[5]),
    purchased: tintinOptionalNumber_(row[8]),
    stock: tintinOptionalNumber_(row[10]),
    stockMinimum: tintinOptionalNumber_(row[11]),
    internalNotes: row[13],
    active: tintinBool_(row[14]),
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
  if (!row[0] && result.productId) sheet.getRange(rowNumber, 1).setValue(result.productId);
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
  var spreadsheet = SpreadsheetApp.getActive();
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

function tintinSyncProductsFromFirestore_(body) {
  var auth = verifyFirebaseIdToken_(body && body.idToken);
  if (!auth || auth.ok !== true || !phase3EmailMatches_(auth.email, SUPER_ADMIN_EMAIL)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No autorizado' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ids = Array.isArray(body.productIds) ? body.productIds.slice(0, 100) : [];
  var sheet = SpreadsheetApp.getActive().getSheetByName(TINTIN_PRODUCTS_SHEET);
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
    var current = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
    var sold = Number(current[9] || 0);
    var purchased = inventory.purchased == null
      ? (product.stock == null ? current[8] : Number(product.stock) + sold)
      : inventory.purchased;

    current[0] = id;
    current[1] = product.name || '';
    current[3] = product.category || '';
    current[4] = inventory.costUnit == null ? '' : inventory.costUnit;
    current[5] = product.price == null ? '' : product.price;
    current[8] = purchased == null ? '' : purchased;
    current[11] = inventory.stockMinimum == null ? '' : inventory.stockMinimum;
    current[13] = inventory.internalNotes || '';
    current[14] = tintinYesNo_(product.active !== false);
    current[15] = tintinYesNo_(product.oferta === true);
    current[16] = tintinYesNo_(product.destacado === true);
    current[17] = product.priceBefore == null ? '' : product.priceBefore;
    current[18] = product.badge || '';
    current[19] = product.imageUrl || '';
    current[20] = product.description || '';
    current[21] = new Date();
    current[22] = product.material || '';
    current[23] = product.measurements || '';
    current[24] = product.colorFinish || '';
    current[25] = product.care || '';
    current[26] = product.waterResistance || '';
    current[27] = product.warranty || '';
    current[28] = product.sizeFit || '';
    current[29] = product.packageContents || '';
    current[30] = Array.isArray(product.imagesExtra) ? product.imagesExtra.join('\n') : '';
    current[31] = product.collection || '';
    current[32] = Array.isArray(product.tags) ? product.tags.join(', ') : '';
    current[33] = product.variants ? JSON.stringify(product.variants) : '';
    current[34] = '';
    sheet.getRange(rowNumber, 1, 1, 35).setValues([current]);
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
