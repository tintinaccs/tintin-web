// TINTIN — Reorganización administrativa de "TINTIN INVENTARIO 2026".
//
// Este archivo NO se instala como trigger. Es una migración manual: quien
// tenga acceso de edición a la hoja la ejecuta UNA VEZ desde el editor de
// Apps Script (seleccionar tintinReorganizarHojaAdministrativa → Ejecutar).
// El resto del código (ProductosUnificados.gs, AdminParity.gs) ya fue
// actualizado para operar sobre el layout NUEVO descrito acá; por eso esta
// migración usa constantes propias con el layout VIEJO en vez de leer
// TINTIN_USERS_COL, que ya representa el destino.

// Layout de "Usuarios web" antes de esta reorganización (columnas 1-19).
var TINTIN_USERS_COL_LEGACY_ = {
  uid: 2, name: 3, email: 4, createdAt: 5, role: 6, blocked: 7,
  orders: 8, totalSpent: 9, internalNotes: 10, action: 11, customerId: 12,
  username: 13, phone: 14, ci: 15, profileStatus: 16, lastAccess: 17,
  usernameChangeUsed: 18, lastChangeId: 19
};

// Marca en Script Properties (no en la hoja, para no pisar contenido que no
// podemos ver de antemano) que permite detectar si la migración ya corrió,
// para que ejecutarla dos veces por error no reordene datos ya reordenados.
var TINTIN_REORG_MARKER_PROPERTY_ = 'TINTIN_REORG_USUARIOS_WEB_V1';

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

function tintinEstilizarBloques_(sheet, headerRow, blocks) {
  blocks.forEach(function(block) {
    if (block.to < block.from) return;
    sheet.getRange(headerRow, block.from, 1, block.to - block.from + 1)
      .setBackground(block.color)
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  });
}

// Aplica encabezado congelado + franjas de color por bloque lógico a las
// hojas cuyo orden de columnas YA sigue identidad→contacto→comercial→
// estado→administración→sincronización y por eso no requieren mover datos,
// solo lectura visual más clara. No reordena ni reescribe valores.
function tintinPulirVisualPedidosWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_ORDERS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Pedidos web.' };
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  tintinEstilizarBloques_(sheet, 1, [
    { from: 1, to: 10, color: '#3f4b8f' },  // identidad/contacto
    { from: 11, to: 17, color: '#2f7a4f' }, // comercial/logística
    { from: 18, to: 23, color: '#8f6b2f' }, // montos y facturación
    { from: 24, to: 29, color: '#616161' }, // técnico/sincronización
    { from: 30, to: 31, color: '#ad3f67' }  // administración
  ]);
  return { ok: true };
}

function tintinPulirVisualProductos_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PRODUCTS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Productos.' };
  sheet.setFrozenRows(TINTIN_PRODUCTS_HEADER_ROW);
  sheet.setFrozenColumns(2);
  tintinEstilizarBloques_(sheet, TINTIN_PRODUCTS_HEADER_ROW, [
    { from: 1, to: 6, color: '#3f4b8f' },   // identidad/comercial base
    { from: 7, to: 13, color: '#2f7a4f' },  // stock
    { from: 14, to: 19, color: '#ad3f67' }, // administración/estado
    { from: 20, to: 22, color: '#616161' }, // media/técnico
    { from: 23, to: 32, color: '#8f6b2f' }, // atributos extendidos
    { from: 33, to: 35, color: '#616161' }  // tags/variants/acción técnica
  ]);
  return { ok: true };
}

function tintinPulirVisualSoloLectura_() {
  var results = {};
  [TINTIN_AUDIT_SHEET, TINTIN_SYNC_HISTORY_SHEET].forEach(function(name) {
    var sheet = tintinProductsSpreadsheet_().getSheetByName(name);
    if (!sheet) { results[name] = false; return; }
    var headerRow = name === TINTIN_SYNC_HISTORY_SHEET ? TINTIN_SYNC_HISTORY_HEADER_ROW : 1;
    sheet.setFrozenRows(headerRow);
    sheet.getRange(headerRow, 1, 1, Math.max(1, sheet.getLastColumn())).setFontWeight('bold').setBackground('#616161').setFontColor('#ffffff');
    if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      sheet.getRange(headerRow, 1, sheet.getLastRow() - headerRow + 1, sheet.getLastColumn())
        .setBorder(true, true, true, true, true, true, '#d0d0d0', SpreadsheetApp.BorderStyle.SOLID);
    }
    results[name] = true;
  });
  return results;
}

// Estiliza "Nuevo pedido web" (formulario de creación manual de pedidos).
// tintinParityPrepareNewOrderSheet_ (AdminParity.gs) crea el contenido
// (títulos, etiquetas, tabla de items) pero nunca le aplicó color ni
// bordes; esta función solo agrega formato visual, no toca valores.
function tintinPulirVisualNuevoPedidoWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_PARITY_NEW_ORDER_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Nuevo pedido web.' };

  sheet.getRange('A1:E1')
    .setBackground('#ad3f67')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(13)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  sheet.getRange('A2:E2')
    .setBackground('#f3e6ec')
    .setFontColor('#4a4a4a')
    .setFontStyle('italic')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(2, 34);

  sheet.getRange('A3:A17')
    .setBackground('#ececec')
    .setFontWeight('bold')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
  sheet.getRange('A3:B17')
    .setBorder(true, true, true, true, true, true, '#c4c4c4', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange('A20:E20')
    .setBackground('#3f4b8f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.getRange(20, 1, TINTIN_PARITY_NEW_ORDER_LAST_ITEM_ROW - 20 + 1, 5)
    .setBorder(true, true, true, true, true, true, '#c4c4c4', SpreadsheetApp.BorderStyle.SOLID);

  return { ok: true };
}

// Pasada visual genérica para pestañas que este proyecto NO gobierna
// (Listas, Clientes de ventas, Resumen anual, hojas mensuales, Buscar, o
// cualquier otra que exista hoy o se agregue después). Solo aplica
// encabezado congelado + negrita/color + bordes sobre la fila 1 y el
// rango con datos: nunca lee, reordena ni sobrescribe un valor, así que
// es seguro de ejecutar sin conocer la estructura interna de cada hoja.
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
    if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) { results[name] = false; return; }

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground('#616161')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setVerticalAlignment('middle');
    sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
      .setBorder(true, true, true, true, true, true, '#d0d0d0', SpreadsheetApp.BorderStyle.SOLID);
    results[name] = true;
  });
  return results;
}

// Punto de entrada SOLO estético (no reordena columnas), a diferencia de
// tintinReorganizarHojaAdministrativa. Seguro de ejecutar cuantas veces se
// quiera, incluso si la reorganización ya corrió antes (no depende del
// marcador de Script Properties). Cubre TODAS las pestañas del
// spreadsheet: las gobernadas por este proyecto con sus bloques de color
// y cualquier otra (Listas, Clientes de ventas, Resumen anual, mensuales,
// Buscar, etc.) con un encabezado prolijo genérico. Ejecutar seleccionando
// tintinPulirEsteticaTodasLasHojas → Ejecutar en el editor de Apps Script.
function tintinPulirEsteticaTodasLasHojas() {
  var summary = {};
  summary.pedidosWeb = tintinPulirVisualPedidosWeb_();
  summary.productos = tintinPulirVisualProductos_();
  summary.soloLectura = tintinPulirVisualSoloLectura_();
  summary.nuevoPedidoWeb = tintinPulirVisualNuevoPedidoWeb_();
  summary.otrasHojas = tintinPulirVisualHojasNoGobernadas_();
  summary.ok = true;
  return summary;
}

// Punto de entrada único (con reordenamiento de columnas). Ejecutar una
// sola vez desde el editor de Apps Script (seleccionar esta función →
// Ejecutar). Reordena físicamente "Usuarios web" (username pasa a estar
// junto a UID/nombre, ya no enterrado en la columna 13) y aplica
// organización visual por bloques al resto de las hojas administradas por
// este proyecto, incluida "Nuevo pedido web". Las pestañas no gobernadas
// por este Apps Script (Listas, Clientes de ventas, Resumen anual, hojas
// mensuales, Buscar, etc.) no se reordenan --este proyecto no tiene forma
// confiable de leer su estructura interna antes de mover columnas, así que
// hacerlo a ciegas sería un riesgo innecesario sobre datos de producción--
// pero sí reciben formato visual genérico (encabezado + bordes) vía
// tintinPulirVisualHojasNoGobernadas_, que no lee ni mueve valores. Si ya
// se ejecutó esta migración antes y solo se quiere repasar la estética de
// todas las pestañas, usar tintinPulirEsteticaTodasLasHojas en su lugar
// (no está bloqueada por el marcador de Script Properties).
function tintinReorganizarHojaAdministrativa() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(TINTIN_REORG_MARKER_PROPERTY_)) {
    return { ok: false, reason: 'La reorganización ya se ejecutó antes (Script Properties: ' + TINTIN_REORG_MARKER_PROPERTY_ + '). No se repite para evitar reordenar datos ya reordenados.' };
  }

  var summary = {};
  summary.usuariosWeb = tintinMigrarUsuariosWebColumnas_();
  summary.pedidosWeb = tintinPulirVisualPedidosWeb_();
  summary.productos = tintinPulirVisualProductos_();
  summary.soloLectura = tintinPulirVisualSoloLectura_();
  summary.nuevoPedidoWeb = tintinPulirVisualNuevoPedidoWeb_();
  summary.otrasHojas = tintinPulirVisualHojasNoGobernadas_();

  tintinPrepararHojasParidad_();
  properties.setProperty(TINTIN_REORG_MARKER_PROPERTY_, new Date().toISOString());

  summary.ok = true;
  summary.note = 'Columnas reordenadas solo en Usuarios web. En el resto de pestañas (incluidas Listas, Clientes de ventas, Resumen anual, mensuales, Buscar y cualquier otra) solo se aplicó formato visual (encabezado + bordes): ningún valor de celda fue leído, movido ni sobrescrito.';
  return summary;
}
