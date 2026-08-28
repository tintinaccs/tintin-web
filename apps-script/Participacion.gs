/* Tintin customer participation sync.
   Add this file to the existing Apps Script project. In its doPost(e), route
   payload.action === 'syncEngagement' to tintinHandleEngagement_(payload).
   Run tintinSetupEngagement() once as the spreadsheet owner. */

var TINTIN_REVIEWS_SHEET_ = 'Resenas';
var TINTIN_LIKES_SHEET_ = 'Me gusta';
var TINTIN_REVIEW_HEADERS_ = ['reviewId','Estado','Leida','Puntuacion','Comentario','Producto ID','Producto','Nombre real','Correo','Nombre publico','Creada','Actualizada','Editada','Comentario anterior','Me gusta Tintin','Conversacion JSON','Historial JSON','Accion'];
var TINTIN_LIKE_HEADERS_ = ['likeId','Leido','Producto ID','Producto','Nombre real','Correo','Creado'];
var TINTIN_ENGAGEMENT_PINK_ = '#FFC5D3';
var TINTIN_ENGAGEMENT_TEXT_ = '#5B162F';
var TINTIN_ENGAGEMENT_BORDER_ = '#D6B8C2';

function tintinJson_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function tintinVerifyUser_(idToken) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_API_KEY');
  if (!apiKey || !idToken) return null;
  var response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return null;
  var users = JSON.parse(response.getContentText() || '{}').users || [];
  return users[0] || null;
}

function tintinSheet_(name, headers) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    tintinAplicarEstiloParticipacion_(sheet);
  }
  sheet.setFrozenRows(1);
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
  var found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function tintinDate_(value) {
  var date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date : '';
}

function tintinReviewRow_(record) {
  var history = record.history || [];
  var prior = history.slice().reverse().find(function (entry) { return entry.action === 'customer_edit' || entry.action === 'admin_edit'; });
  return [record.reviewId, record.deleted ? 'Eliminada' : record.visible ? 'Visible' : 'Oculta', !record.unread, record.rating, record.comment,
    record.productId, record.productName, record.realName, record.email, record.maskedName, tintinDate_(record.createdAt), tintinDate_(record.updatedAt),
    Number(record.editCount || 0) > 0, prior ? prior.comment || '' : '', !!record.storeLiked, JSON.stringify(record.conversation || []), JSON.stringify(history), ''];
}

function tintinLikeRow_(record) {
  return [record.likeId, !record.unread, record.productId, record.productName, record.realName, record.email, tintinDate_(record.createdAt)];
}

function tintinUpsert_(sheet, row) {
  var rowNumber = tintinFindRow_(sheet, row[0]) || sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  tintinAplicarBordeFilaParticipacion_(sheet, rowNumber, row.length);
  return rowNumber;
}

function tintinHandleEngagement_(payload) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty('SHEETS_ENGAGEMENT_SECRET');
  if (!expectedSecret || String(payload.syncSecret || '') !== expectedSecret) return tintinJson_({ ok: false, error: 'unauthorized_source' });
  var user = tintinVerifyUser_(payload.idToken);
  var event = payload.event || {};
  var record = event.record || {};
  if (!user || !user.email || !event.type) return tintinJson_({ ok: false, error: 'unauthorized' });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (event.type === 'review') {
      var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
      tintinUpsert_(reviews, tintinReviewRow_(record));
    } else if (event.type === 'like') {
      var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
      var row = tintinFindRow_(likes, record.likeId);
      if (event.operation === 'delete') { if (row) likes.deleteRow(row); }
      else tintinUpsert_(likes, tintinLikeRow_(record));
    } else return tintinJson_({ ok: false, error: 'invalid_type' });
    return tintinJson_({ ok: true });
  } finally { lock.releaseLock(); }
}

function tintinSetupEngagement() {
  var reviews = tintinSheet_(TINTIN_REVIEWS_SHEET_, TINTIN_REVIEW_HEADERS_);
  var likes = tintinSheet_(TINTIN_LIKES_SHEET_, TINTIN_LIKE_HEADERS_);
  reviews.getRange('R2:R').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Publicar','Ocultar','Eliminar','Restaurar','Me gusta','Quitar Me gusta'], true).build());
  [reviews, likes].forEach(function (sheet) {
    tintinAplicarEstiloParticipacion_(sheet);
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
  ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'tintinDailyEngagementDigest'; }).forEach(ScriptApp.deleteTrigger);
  ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'tintinEngagementOnEdit'; }).forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('tintinEngagementOnEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  ScriptApp.newTrigger('tintinDailyEngagementDigest').timeBased().everyDays(1).atHour(8).create();
}

function tintinEngagementOnEdit(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TINTIN_REVIEWS_SHEET_ || e.range.getRow() < 2) return;
  var column = e.range.getColumn();
  if ([4, 5, 18].indexOf(column) === -1) return;
  var row = sheet.getRange(e.range.getRow(), 1, 1, TINTIN_REVIEW_HEADERS_.length).getValues()[0];
  var action = '';
  var input = { reviewId: String(row[0] || '') };
  if (column === 4 || column === 5) {
    action = 'reviewEdit'; input.rating = Number(row[3]); input.comment = String(row[4] || '');
  } else {
    var map = { 'Publicar':'reviewVisibility', 'Ocultar':'reviewVisibility', 'Eliminar':'reviewDelete', 'Restaurar':'reviewRestore', 'Me gusta':'reviewLike', 'Quitar Me gusta':'reviewLike' };
    action = map[String(row[17] || '')] || '';
    if (action === 'reviewVisibility') input.visible = row[17] === 'Publicar';
    if (action === 'reviewLike') input.liked = row[17] === 'Me gusta';
  }
  if (!action || !input.reviewId) return;
  input.action = action;
  var properties = PropertiesService.getScriptProperties();
  var url = properties.getProperty('TINTIN_STORE_URL');
  var secret = properties.getProperty('SHEETS_ENGAGEMENT_SECRET');
  if (!url || !secret) throw new Error('Configura TINTIN_STORE_URL y SHEETS_ENGAGEMENT_SECRET en Propiedades del script.');
  var response = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/api/sheets-engagement-webhook', {
    method: 'post', contentType: 'application/json', headers: { 'X-Tintin-Sheets-Secret': secret },
    payload: JSON.stringify(input), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('No se pudo sincronizar el cambio con Firestore.');
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
  var unreadReviews = reviewRows ? reviews.getRange(2, 3, reviewRows, 1).getValues().filter(function (row) { return row[0] !== true; }).length : 0;
  var unreadLikes = likeRows ? likes.getRange(2, 2, likeRows, 1).getValues().filter(function (row) { return row[0] !== true; }).length : 0;
  if (!unreadReviews && !unreadLikes) return;
  MailApp.sendEmail(email, 'Tintin: actividad pendiente', 'Tenes ' + unreadReviews + ' resenas nuevas y ' + unreadLikes + ' Me gusta nuevos. Revisa el Super Admin o Google Sheets.');
}
