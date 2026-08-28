// TINTIN — Reorganización administrativa de "TINTIN INVENTARIO 2026".
//
// Este archivo NO se instala como trigger. La migración de columnas se ejecuta
// una sola vez; la pasada estética puede repetirse de forma segura.

var TINTIN_USERS_COL_LEGACY_ = {
  uid: 2, name: 3, email: 4, createdAt: 5, role: 6, blocked: 7,
  orders: 8, totalSpent: 9, internalNotes: 10, action: 11, customerId: 12,
  username: 13, phone: 14, ci: 15, profileStatus: 16, lastAccess: 17,
  usernameChangeUsed: 18, lastChangeId: 19
};

var TINTIN_REORG_MARKER_PROPERTY_ = 'TINTIN_REORG_USUARIOS_WEB_V1';

// Identidad visual única del inventario.
var TINTIN_SHEETS_PINK_ = '#FFC5D3';
var TINTIN_SHEETS_TEXT_ = '#5B162F';
var TINTIN_SHEETS_BORDER_ = '#D6B8C2';
var TINTIN_SHEETS_SOFT_ = '#FFF4F7';

function tintinAplicarCuadriculaCompleta_(sheet) {
  if (!sheet) return false;
  var rows = Math.max(1, sheet.getMaxRows());
  var columns = Math.max(1, sheet.getMaxColumns());
  sheet.getRange(1, 1, rows, columns).setBorder(
    true, true, true, true, true, true,
    TINTIN_SHEETS_BORDER_,
    SpreadsheetApp.BorderStyle.SOLID
  );
  sheet.setHiddenGridlines(true);
  return true;
}

function tintinAplicarCuadriculaTodasLasHojas_() {
  var result = {};
  tintinProductsSpreadsheet_().getSheets().forEach(function(sheet) {
    result[sheet.getName()] = tintinAplicarCuadriculaCompleta_(sheet);
  });
  return result;
}

function tintinMigrarUsuariosWebColumnas_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_USERS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe la hoja Usuarios web.' };

  var lastRow = sheet.getLastRow();
  var dataRows = Math.max(0, lastRow - TINTIN_USERS_FIRST_ROW + 1);
  var width = TINTIN_USERS_COL.lastChangeId;

  if (dataRows > 0) {
    var oldValues = sheet.getRange(TINTIN_USERS_FIRST_ROW, 1, dataRows, width).getValues();
    var newValues = oldValues.map(function(oldRow) {
      var newRow = new Array(width).fill('');
      Object.keys(TINTIN_USERS_COL_LEGACY_).forEach(function(field) {
        var oldIndex = TINTIN_USERS_COL_LEGACY_[field] - 1;
        var newIndex = TINTIN_USERS_COL[field] - 1;
        newRow[newIndex] = oldRow[oldIndex];
      });
      return newRow;
    });
    sheet.getRange(TINTIN_USERS_FIRST_ROW, 1, dataRows, width).clearDataValidations();
    sheet.getRange(TINTIN_USERS_FIRST_ROW, 1, dataRows, width).setValues(newValues);
  }

  sheet.getRange(TINTIN_USERS_HEADER_ROW, 1, 1, width).setValues([TINTIN_USERS_HEADERS]);
  sheet.getRange(TINTIN_USERS_HEADER_ROW, 1, 1, width).setFontWeight('bold');
  sheet.setFrozenRows(TINTIN_USERS_HEADER_ROW);
  sheet.setFrozenColumns(TINTIN_USERS_COL.username);

  return { ok: true, rows: dataRows, width: width };
}

// Mantiene la división lógica de columnas, pero con un único rosa Tintin.
function tintinEstilizarBloques_(sheet, headerRow, blocks) {
  blocks.forEach(function(block) {
    if (block.to < block.from) return;
    sheet.getRange(headerRow, block.from, 1, block.to - block.from + 1)
      .setBackground(TINTIN_SHEETS_PINK_)
      .setFontColor(TINTIN_SHEETS_TEXT_)
      .setFontWeight('bold')
      .setVerticalAlignment('middle');
  });
}

function tintinPulirVisualUsuariosWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_USERS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Usuarios web.' };
  sheet.setFrozenRows(TINTIN_USERS_HEADER_ROW);
  sheet.setFrozenColumns(TINTIN_USERS_COL.username);
  tintinEstilizarBloques_(sheet, TINTIN_USERS_HEADER_ROW, [
    { from: TINTIN_USERS_COL.uid, to: TINTIN_USERS_COL.customerId },
    { from: TINTIN_USERS_COL.email, to: TINTIN_USERS_COL.ci },
    { from: TINTIN_USERS_COL.orders, to: TINTIN_USERS_COL.totalSpent },
    { from: TINTIN_USERS_COL.role, to: TINTIN_USERS_COL.usernameChangeUsed },
    { from: TINTIN_USERS_COL.internalNotes, to: TINTIN_USERS_COL.action },
    { from: TINTIN_USERS_COL.createdAt, to: TINTIN_USERS_COL.lastChangeId }
  ]);
  tintinAplicarCuadriculaCompleta_(sheet);
  return { ok: true };
}

function tintinPulirVisualPedidosWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_ORDERS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Pedidos web.' };
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  tintinEstilizarBloques_(sheet, 1, [
    { from: 1, to: 10 },
    { from: 11, to: 17 },
    { from: 18, to: 23 },
    { from: 24, to: 29 },
    { from: 30, to: 31 }
  ]);
  tintinAplicarCuadriculaCompleta_(sheet);
  return { ok: true };
}

function tintinPulirVisualProductos_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Productos.' };
  sheet.setFrozenRows(TINTIN_PRODUCTS_HEADER_ROW);
  sheet.setFrozenColumns(2);
  tintinEstilizarBloques_(sheet, TINTIN_PRODUCTS_HEADER_ROW, [
    { from: 1, to: 6 },
    { from: 7, to: 13 },
    { from: 14, to: 19 },
    { from: 20, to: 22 },
    { from: 23, to: 32 },
    { from: 33, to: 35 }
  ]);
  tintinAplicarCuadriculaCompleta_(sheet);
  return { ok: true };
}

function tintinPulirVisualSoloLectura_() {
  var results = {};
  [TINTIN_AUDIT_SHEET, TINTIN_SYNC_HISTORY_SHEET].forEach(function(name) {
    var sheet = tintinProductsSpreadsheet_().getSheetByName(name);
    if (!sheet) { results[name] = false; return; }
    var headerRow = name === TINTIN_SYNC_HISTORY_SHEET ? TINTIN_SYNC_HISTORY_HEADER_ROW : 1;
    sheet.setFrozenRows(headerRow);
    sheet.getRange(headerRow, 1, 1, Math.max(1, sheet.getLastColumn()))
      .setFontWeight('bold')
      .setBackground(TINTIN_SHEETS_PINK_)
      .setFontColor(TINTIN_SHEETS_TEXT_)
      .setVerticalAlignment('middle');
    tintinAplicarCuadriculaCompleta_(sheet);
    results[name] = true;
  });
  return results;
}

function tintinPulirVisualNuevoPedidoWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PARITY_NEW_ORDER_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Nuevo pedido web.' };

  sheet.getRange('A1:E1')
    .setBackground(TINTIN_SHEETS_PINK_)
    .setFontColor(TINTIN_SHEETS_TEXT_)
    .setFontWeight('bold')
    .setFontSize(13)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  sheet.getRange('A2:E2')
    .setBackground(TINTIN_SHEETS_SOFT_)
    .setFontColor(TINTIN_SHEETS_TEXT_)
    .setFontStyle('italic')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(2, 34);

  sheet.getRange('A3:A17')
    .setBackground(TINTIN_SHEETS_PINK_)
    .setFontColor(TINTIN_SHEETS_TEXT_)
    .setFontWeight('bold')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');

  sheet.getRange('A20:E20')
    .setBackground(TINTIN_SHEETS_PINK_)
    .setFontColor(TINTIN_SHEETS_TEXT_)
    .setFontWeight('bold')
    .setVerticalAlignment('middle');

  tintinAplicarCuadriculaCompleta_(sheet);
  return { ok: true };
}

// Las hojas manuales conservan sus títulos, fórmulas, colores funcionales y
// estructura. Solo se aplica la cuadrícula visible solicitada a todo el rango.
function tintinPulirVisualHojasNoGobernadas_() {
  var gobernadas = {};
  [TINTIN_PRODUCTS_SHEET, TINTIN_USERS_SHEET, TINTIN_ORDERS_SHEET, TINTIN_AUDIT_SHEET,
    TINTIN_SYNC_HISTORY_SHEET, TINTIN_PARITY_NEW_ORDER_SHEET].forEach(function(name) {
    gobernadas[name] = true;
  });

  var results = {};
  tintinProductsSpreadsheet_().getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (gobernadas[name]) return;
    tintinAplicarCuadriculaCompleta_(sheet);
    results[name] = 'cuadrícula aplicada; contenido y formato manual preservados';
  });
  return results;
}

// Punto de entrada estético, seguro de repetir. Unifica encabezados gobernados
// con #FFC5D3 y garantiza cuadros visibles en TODAS las hojas, incluidas las
// pestañas manuales y ocultas, sin mover ni reescribir sus datos.
function tintinPulirEsteticaTodasLasHojas() {
  var summary = {};
  summary.usuariosWeb = tintinPulirVisualUsuariosWeb_();
  summary.pedidosWeb = tintinPulirVisualPedidosWeb_();
  summary.productos = tintinPulirVisualProductos_();
  summary.soloLectura = tintinPulirVisualSoloLectura_();
  summary.nuevoPedidoWeb = tintinPulirVisualNuevoPedidoWeb_();
  summary.otrasHojas = tintinPulirVisualHojasNoGobernadas_();
  summary.cuadriculaTodas = tintinAplicarCuadriculaTodasLasHojas_();
  summary.ok = true;
  return summary;
}

// Migración única de Usuarios web. Después de reorganizar, aplica la misma
// estética rosa y la cuadrícula a todo el libro.
function tintinReorganizarHojaAdministrativa() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(TINTIN_REORG_MARKER_PROPERTY_)) {
    return { ok: false, reason: 'La reorganización ya se ejecutó antes (Script Properties: ' + TINTIN_REORG_MARKER_PROPERTY_ + '). No se repite para evitar reordenar datos ya reordenados.' };
  }

  // Crea/prepara hojas de paridad antes de aplicar formato, para que ninguna
  // pestaña nueva quede fuera de la pasada estética.
  tintinPrepararHojasParidad_();

  var summary = {};
  summary.usuariosWeb = tintinMigrarUsuariosWebColumnas_();
  summary.usuariosWebVisual = tintinPulirVisualUsuariosWeb_();
  summary.pedidosWeb = tintinPulirVisualPedidosWeb_();
  summary.productos = tintinPulirVisualProductos_();
  summary.soloLectura = tintinPulirVisualSoloLectura_();
  summary.nuevoPedidoWeb = tintinPulirVisualNuevoPedidoWeb_();
  summary.otrasHojas = tintinPulirVisualHojasNoGobernadas_();
  summary.cuadriculaTodas = tintinAplicarCuadriculaTodasLasHojas_();

  properties.setProperty(TINTIN_REORG_MARKER_PROPERTY_, new Date().toISOString());

  summary.ok = true;
  summary.note = 'Usuarios web fue reordenada una sola vez. Encabezados gobernados usan #FFC5D3 y todas las hojas tienen cuadrícula visible sin alterar datos ni fórmulas.';
  return summary;
}
