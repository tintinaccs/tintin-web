/* =============================================================
   TINTIN — Espejo de cotizaciones mayoristas en la planilla
   =============================================================
   Cloudflare empuja cada cotización (al crearse y cada vez que el Super Admin
   la responde) con action 'syncWholesaleQuote'. La fuente de verdad es
   Firestore (wholesaleQuotes); esta pestaña es solo de lectura operativa.
   Usa el mismo secreto servidor-a-servidor que la sincronización de pedidos. */

var TINTIN_WHOLESALE_SHEET = 'Mayoristas';
var TINTIN_WHOLESALE_HEADERS = [
  'ID cotización', 'Número', 'Estado', 'Creada', 'Respondida', 'Clienta', 'Correo',
  'Emprendimiento', 'WhatsApp', 'Ciudad', 'Productos', 'Unidades', 'Total referencia minorista',
  'Total mayorista', 'Detalle', 'Nota de la clienta', 'Nota de Tintin', 'Respondida por'
];

function tintinWholesaleSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(TINTIN_WHOLESALE_SHEET) || spreadsheet.insertSheet(TINTIN_WHOLESALE_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TINTIN_WHOLESALE_HEADERS.length).setValues([TINTIN_WHOLESALE_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function tintinWholesaleText_(value, max) {
  return String(value == null ? '' : value).slice(0, max || 500);
}

function tintinWholesaleRow_(quoteId, quote) {
  var items = Array.isArray(quote.items) ? quote.items : [];
  var detail = items.map(function(item) {
    var price = item.unitPrice == null ? 'sin precio' : ('Gs. ' + item.unitPrice + ' c/u');
    return tintinWholesaleText_(item.name, 120) + (item.variant ? ' (' + tintinWholesaleText_(item.variant, 60) + ')' : '') +
      ' x' + (Number(item.qty) || 0) + ' — ' + price;
  }).join('\n');
  return [
    quoteId,
    tintinWholesaleText_(quote.quoteNumber, 30),
    tintinWholesaleText_(quote.status, 20),
    tintinWholesaleText_(quote.createdAt, 40),
    tintinWholesaleText_(quote.respondedAt, 40),
    tintinWholesaleText_(quote.customerName, 120),
    tintinWholesaleText_(quote.userEmail, 254),
    tintinWholesaleText_(quote.businessName, 120),
    tintinWholesaleText_(quote.whatsapp, 30),
    tintinWholesaleText_(quote.city, 120),
    items.length,
    Number(quote.itemCount) || 0,
    Number(quote.retailReferenceTotal) || 0,
    quote.total == null ? '' : Number(quote.total),
    detail.slice(0, 45000),
    tintinWholesaleText_(quote.notes, 1000),
    tintinWholesaleText_(quote.adminNote, 1000),
    tintinWholesaleText_(quote.respondedBy, 254)
  ].map(function(value) {
    // setValues interpreta las cadenas que empiezan con '=' como fórmulas.
    // Los textos de clientas y catálogo deben almacenarse como texto literal.
    return typeof value === 'string' && /^\s*[=+@-]/.test(value) ? "'" + value : value;
  });
}

function tintinUpsertWholesaleQuote_(quoteId, quote) {
  if (!/^WQ_[A-Za-z0-9_-]{12,220}$/.test(quoteId)) throw new Error('Cotización inválida.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = tintinWholesaleSheet_();
    var row = tintinWholesaleRow_(quoteId, quote || {});
    var lastRow = sheet.getLastRow();
    var target = 0;
    if (lastRow > 1) {
      var match = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(quoteId).matchEntireCell(true).findNext();
      if (match) target = match.getRow();
    }
    if (!target) target = lastRow + 1;
    sheet.getRange(target, 1, 1, row.length).setValues([row]);
    return target;
  } finally {
    lock.releaseLock();
  }
}

function tintinHandleWholesaleSync_(body) {
  var json = function(payload) {
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
  };
  if (typeof tintinParitySecretMatches_ !== 'function' || !tintinParitySecretMatches_(body.secret)) {
    return json({ ok: false, error: 'No autorizado' });
  }
  try {
    return json({ ok: true, row: tintinUpsertWholesaleQuote_(String(body.quoteId || ''), body.quote || {}) });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message || error).slice(0, 300) });
  }
}
