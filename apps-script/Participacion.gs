/* Tintin customer participation sync.
   Add this file to the existing Apps Script project. In its doPost(e), route
   payload.action === 'syncEngagement' to tintinHandleEngagement_(payload).
   Run tintinSetupEngagement() once as the spreadsheet owner.

   IMPORTANTE: la identidad del usuario se valida en Cloudflare. Apps Script
   recibe únicamente eventos servidor-a-servidor autenticados con
   SHEETS_ENGAGEMENT_SECRET, evitando duplicar Firebase Auth/App Check. */

var TINTIN_REVIEWS_SHEET_ = 'Resenas';
var TINTIN_LIKES_SHEET_ = 'Me gusta';
var TINTIN_REVIEW_HEADERS_ = [
  'reviewId','Estado','Leida','Puntuacion','Comentario','Producto ID','Producto',
  'Nombre real','Username','Correo','Nombre publico','Creada','Actualizada',
  'Me gusta Tintin','Conversacion JSON','Historial JSON','Accion'
];
var TINTIN_LIKE_HEADERS_ = [
  'likeId','Leido','Tipo objetivo','Objetivo ID','Producto ID','Producto',
  'Nombre real','Username','Correo','Propietario objetivo ID','Propietario objetivo','Creado'
];
var TINTIN_ENGAGEMENT_PINK_ = '#FFC5D3';
var TINTIN_ENGAGEMENT_TEXT_ = '#5B162F';
var TINTIN_ENGAGEMENT_BORDER_ = '#D6B8C2';

function tintinJson_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function tintinEnsureHeaders_(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  tintinAplicarEstiloParticipacion_(sheet);
}

function tintinSheet_(name, headers) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  tintinEnsureHeaders_(sheet, headers);
  return sheet;
}

function tintinAplicarEstiloParticipacion_(sheet) {
  if (!sheet) return;
  var columns = Math.max(1, sheet.getMaxColumns());
  var rows = Math.max(1, sheet.getMaxRows());
  sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
    .setFontWeight('bold')
    .setBackground(TINTIN_ENGAGEMENT_PINK_)
    .setFontColor(TINTIN_ENGAGEMENT_TEXT_)
    .setVerticalAlignment('middle');
  sheet.getRange(1, 1, rows, columns).setBorder(
    true, true, true, true, true, true,
    TINTIN_ENGAGEMENT_BORDER_,
    SpreadsheetApp.BorderStyle.SOLID
  );
  sheet.setHiddenGridlines(true);
}

function tintinAplicarBordeFilaParticipacion_(sheet, rowNumber, width) {
  if (!sheet || rowNumber < 1 || width < 1) return;
  sheet.getRange(rowNumber, 1, 1, width).setBorder(
    true, true, true, true, true, true,
    TINTIN_ENGAGEMENT_BORDER_,
    SpreadsheetApp.BorderStyle.SOLID
  );
}

function tintinFindRow_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return 0;
  var found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function tintinDate_(value) {
  var date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date : '';
}

function tintinSortNewestFirst_(records, fields, idField) {
  return records.map(function(record, index) { return { record: record, index: index }; }).sort(function(left, right) {
    var leftTime = 0;
    var rightTime = 0;
    fields.some(function(field) { var value = new Date(left.record[field] || '').getTime(); if (!isNaN(value) && value) { leftTime = value; return true; } return false; });
    fields.some(function(field) { var value = new Date(right.record[field] || '').getTime(); if (!isNaN(value) && value) { rightTime = value; return true; } return false; });
    return rightTime - leftTime || String(left.record[idField] || '').localeCompare(String(right.record[idField] || '')) || left.index - right.index;
  }).map(function(item) { return item.record; });
}

function tintinReviewRow_(record) {
  return [
    record.reviewId,
    record.deleted ? 'Eliminada' : record.visible === false ? 'Oculta' : 'Visible',
    !record.unread,
    Number(record.rating || 0),
    String(record.comment || ''),
    String(record.productId || ''),
    String(record.productName || ''),
    String(record.realName || ''),
    String(record.username || ''),
    String(record.email || ''),
    String(record.publicName || record.maskedName || ''),
    tintinDate_(record.createdAt),
    tintinDate_(record.updatedAt),
    !!record.storeLiked,
    JSON.stringify(record.conversation || []),
    JSON.stringify(record.history || []),
    ''
  ];
}

function tintinLikeRow_(record) {
  return [
    record.likeId,
    !record.unread,
    String(record.targetType || 'product'),
    String(record.targetId || record.productId || ''),
    String(record.productId || ''),
    String(record.productName || ''),
    String(record.realName || ''),
    String(record.username || ''),
    String(record.email || ''),
    String(record.targetOwnerUid || ''),
    String(record.targetOwnerName || ''),
    tintinDate_(record.createdAt)
  ];
}

function tintinUpsert_(sheet, row) {
  var rowNumber = tintinFindRow_(sheet, row[0]) || sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  tintinAplicarBordeFilaParticipacion_(sheet, rowNumber, row.length);
  return rowNumber;
}

function tintinMoveRowToTop_(sheet, rowNumber, width) {
  if (!sheet || rowNumber <= 2) return;
  sheet.moveRows(sheet.getRange(rowNumber, 1, 1, width), 2);
}

function tintinSortEngagementSheetNewestFirst_(sheet, dateColumn, width) {
  if (!sheet || sheet.getLastRow() < 3) return;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, width).sort({ column: dateColumn, ascending: false });
}

function tintinOrdenarParticipacionExistente() {
  var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
  var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
  tintinSortEngagementSheetNewestFirst_(reviews, 12, TINTIN_REVIEW_HEADERS_.length);
  tintinSortEngagementSheetNewestFirst_(likes, 12, TINTIN_LIKE_HEADERS_.length);
  return { ok: true, reviews: Math.max(0, reviews.getLastRow() - 1), likes: Math.max(0, likes.getLastRow() - 1) };
}

function tintinHandleEngagement_(payload) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET');
  if (!expectedSecret || String(payload.syncSecret || '') !== expectedSecret) {
    return tintinJson_({ ok: false, error: 'unauthorized_source' });
  }
  var event = payload.event || {};
  var record = event.record || {};
  if (!event.type || !record) return tintinJson_({ ok: false, error: 'invalid_event' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (event.type === 'review') {
      var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
      tintinMoveRowToTop_(reviews, tintinUpsert_(reviews, tintinReviewRow_(record)), TINTIN_REVIEW_HEADERS_.length);
    } else if (event.type === 'like') {
      var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
      var row = tintinFindRow_(likes, record.likeId);
      if (event.operation === 'delete' || event.operation === 'trash') {
        if (row) likes.deleteRow(row);
      } else {
        tintinMoveRowToTop_(likes, tintinUpsert_(likes, tintinLikeRow_(record)), TINTIN_LIKE_HEADERS_.length);
      }
    } else {
      return tintinJson_({ ok: false, error: 'invalid_type' });
    }
    return tintinJson_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function tintinSetupEngagement() {
  var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
  var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
  var actionColumn = TINTIN_REVIEW_HEADERS_.indexOf('Accion') + 1;
  reviews.getRange(2, actionColumn, Math.max(1, reviews.getMaxRows() - 1), 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([
      'Publicar','Ocultar','Eliminar','Restaurar','Me gusta','Quitar Me gusta'
    ], true).build());
  [reviews, likes].forEach(function (sheet) {
    tintinAplicarEstiloParticipacion_(sheet);
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'tintinDailyEngagementDigest'; })
    .forEach(ScriptApp.deleteTrigger);
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'tintinEngagementOnEdit'; })
    .forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('tintinEngagementOnEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  ScriptApp.newTrigger('tintinDailyEngagementDigest').timeBased().everyDays(1).atHour(8).create();
}

function tintinEngagementOnEdit(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_REVIEWS_SHEET_ || e.range.getRow() < 2) return;
  var column = e.range.getColumn();
  var actionColumn = TINTIN_REVIEW_HEADERS_.indexOf('Accion') + 1;
  if ([4, 5, actionColumn].indexOf(column) === -1) return;
  var row = sheet.getRange(e.range.getRow(), 1, 1, TINTIN_REVIEW_HEADERS_.length).getValues()[0];
  var action = '';
  var input = { reviewId: String(row[0] || '') };
  if (column === 4 || column === 5) {
    action = 'reviewEdit';
    input.rating = Number(row[3]);
    input.comment = String(row[4] || '');
  } else {
    var value = String(row[actionColumn - 1] || '');
    var map = {
      'Publicar':'reviewVisibility',
      'Ocultar':'reviewVisibility',
      'Eliminar':'reviewDelete',
      'Restaurar':'reviewRestore',
      'Me gusta':'reviewLike',
      'Quitar Me gusta':'reviewLike'
    };
    action = map[value] || '';
    if (action === 'reviewVisibility') input.visible = value === 'Publicar';
    if (action === 'reviewLike') input.liked = value === 'Me gusta';
  }
  if (!action || !input.reviewId) return;
  input.action = action;

  var properties = PropertiesService.getScriptProperties();
  var url = properties.getProperty('TINTIN_STORE_URL');
  var secret = properties.getProperty('SHEETS_ENGAGEMENT_SECRET');
  if (!url || !secret) throw new Error('Configura TINTIN_STORE_URL y SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  var response = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/api/sheets-engagement-webhook', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Tintin-Sheets-Secret': secret },
    payload: JSON.stringify(input),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('No se pudo sincronizar el cambio con Firestore.');
  }
  var result = JSON.parse(response.getContentText() || '{}');
  if (!result.ok || !result.record) throw new Error(result.error || 'Respuesta de sincronizacion invalida.');
  sheet.getRange(e.range.getRow(), 1, 1, TINTIN_REVIEW_HEADERS_.length).setValues([tintinReviewRow_(result.record)]);
  tintinAplicarBordeFilaParticipacion_(sheet, e.range.getRow(), TINTIN_REVIEW_HEADERS_.length);
}

function tintinDailyEngagementDigest() {
  var email = PropertiesService.getScriptProperties().getProperty('SUPER_ADMIN_EMAIL') || 'tintinaccs@gmail.com';
  var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
  var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
  var reviewRows = Math.max(0, reviews.getLastRow() - 1);
  var likeRows = Math.max(0, likes.getLastRow() - 1);
  var unreadReviews = reviewRows
    ? reviews.getRange(2, 3, reviewRows, 1).getValues().filter(function (row) { return row[0] !== true; }).length
    : 0;
  var unreadLikes = likeRows
    ? likes.getRange(2, 2, likeRows, 1).getValues().filter(function (row) { return row[0] !== true; }).length
    : 0;
  if (!unreadReviews && !unreadLikes) return;
  MailApp.sendEmail(
    email,
    'Tintin: actividad pendiente',
    'Tenes ' + unreadReviews + ' resenas nuevas y ' + unreadLikes + ' interacciones de Me gusta nuevas. Revisa el Super Admin o Google Sheets.'
  );
}
