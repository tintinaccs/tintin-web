/* Tintin customer participation sync.
   Add this file to the existing Apps Script project. In its doPost(e), route
   payload.action === 'syncEngagement' to tintinHandleEngagement_(payload).
   Run tintinSetupEngagement() once as the spreadsheet owner. */

var TINTIN_REVIEWS_SHEET_ = 'Resenas';
var TINTIN_LIKES_SHEET_ = 'Me gusta';
var TINTIN_REVIEW_HEADERS_ = ['reviewId','Estado','Leida','Puntuacion','Comentario','Producto ID','Producto','Nombre real','Correo','Nombre publico','Creada','Actualizada','Editada','Comentario anterior','Me gusta Tintin','Conversacion JSON','Historial JSON','Accion'];
var TINTIN_LIKE_HEADERS_ = ['likeId','Leido','Producto ID','Producto','Nombre real','Correo','Creado'];

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
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
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
}

function tintinHandleEngagement_(payload) {
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
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#ad3f67').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
  ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'tintinDailyEngagementDigest'; }).forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('tintinDailyEngagementDigest').timeBased().everyDays(1).atHour(8).create();
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
