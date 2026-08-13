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

// Enlazar desde el doPost existente antes de cualquier ruta heredada:
// if (body.action === 'syncProducts') return tintinSyncProductsFromFirestore_(body);
// La implementacion desplegada debe escribir solo en Productos (A, B, D, F,
// K y O:AH) y nunca volver a crear la pestaña Catálogo web.
