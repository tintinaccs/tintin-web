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

// Aplica franjas de color por bloque lógico a "Usuarios web", siguiendo el
// layout ya documentado en TINTIN_USERS_COL (identidad, contacto, comercial,
// estado, administración, sincronización/técnico). tintinMigrarUsuariosWebColumnas_
// solo pone negrita en el encabezado; sin esta función la hoja quedaba sin
// color en varias columnas (o con color manual viejo desalineado). No
// reordena ni reescribe valores, solo formato.
// No se congelan columnas: la fila 4 (disclaimer "Esta es la única hoja
// maestra de cuentas web...") es una celda combinada que va de la columna 2
// a la 10, y cualquier cantidad de columnas congeladas entre medio de ese
// rango revienta con "No se pueden inmovilizar columnas que solo contengan
// parte de una celda combinada".
function tintinPulirVisualUsuariosWeb_() {
  var sheet = tintinProductsSpreadsheet_().getSheetByName(TINTIN_USERS_SHEET);
  if (!sheet) return { ok: false, reason: 'No existe Usuarios web.' };
  sheet.setFrozenRows(TINTIN_USERS_HEADER_ROW);
  tintinEstilizarBloques_(sheet, TINTIN_USERS_HEADER_ROW, [
    { from: TINTIN_USERS_COL.uid, to: TINTIN_USERS_COL.customerId, color: '#3f4b8f' },          // identidad
    { from: TINTIN_USERS_COL.email, to: TINTIN_USERS_COL.ci, color: '#2f7a4f' },                // contacto
    { from: TINTIN_USERS_COL.orders, to: TINTIN_USERS_COL.totalSpent, color: '#8f6b2f' },       // comercial
    { from: TINTIN_USERS_COL.role, to: TINTIN_USERS_COL.usernameChangeUsed, color: '#616161' }, // estado
    { from: TINTIN_USERS_COL.internalNotes, to: TINTIN_USERS_COL.action, color: '#ad3f67' },    // administración
    { from: TINTIN_USERS_COL.createdAt, to: TINTIN_USERS_COL.lastChangeId, color: '#616161' }   // sincronización/técnico
  ]);
  return { ok: true };
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

// Pasada para pestañas que este proyecto NO gobierna (Buscar, Índice,
// Resumen anual 2026, Reporte de ventas por cliente, Listas de apoyo, las
// 12 hojas mensuales, o cualquier otra que exista hoy o se agregue
// después). Inspección directa del spreadsheet real confirmó que TODAS
// estas hojas son paneles armados a mano: fila 1 es siempre el banner
// combinado "🟢 SINCRONIZADO" (indicador manual, no un encabezado de
// datos), seguido de filas de título/navegación ("⟵ Volver al Índice") y
// recién varias filas más abajo aparece el encabezado real de columnas
// --en las hojas mensuales incluso hay varias mini-tablas lado a lado
// (VENTAS/GASTOS/COMPRAS) con encabezados propios en filas distintas--.
// No hay forma confiable de detectar esa fila de encabezado real sin
// conocer cada hoja de antemano, así que ya no se pinta ni se bordea
// nada a ciegas: hacerlo sobrescribía el banner de sincronización con
// gris y agregaba bordes sobre un diseño manual ya terminado. Por la
// misma razón por la que este proyecto nunca reordena columnas en estas
// hojas (estructura desconocida), tampoco les reescribe el formato.
// Esta función solo deja constancia de qué pestañas fueron detectadas y
// dejadas intactas; no lee, reordena ni sobrescribe ningún valor ni
// formato.
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
    results[name] = 'sin cambios: panel manual (banner de sincronización en fila 1), no se reescribe';
  });
  return results;
}

// Punto de entrada SOLO estético (no reordena columnas), a diferencia de
// tintinReorganizarHojaAdministrativa. Seguro de ejecutar cuantas veces se
// quiera, incluso si la reorganización ya corrió antes (no depende del
// marcador de Script Properties). Aplica bloques de color a las pestañas
// que este proyecto gobierna (Usuarios web, Pedidos web, Productos,
// Auditoría web, Historial sync, Nuevo pedido web); las hojas no
// gobernadas (Buscar, Índice, Resumen anual 2026, Reporte de ventas por
// cliente, Listas de apoyo, mensuales, etc.) son paneles manuales ya
// diseñados y se dejan intactas --ver tintinPulirVisualHojasNoGobernadas_--.
// Ejecutar seleccionando tintinPulirEsteticaTodasLasHojas → Ejecutar en el
// editor de Apps Script.
function tintinPulirEsteticaTodasLasHojas() {
  var summary = {};
  summary.usuariosWeb = tintinPulirVisualUsuariosWeb_();
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
// por este Apps Script (Buscar, Índice, Resumen anual 2026, Reporte de
// ventas por cliente, Listas de apoyo, hojas mensuales, etc.) no se
// reordenan ni se reformatean --son paneles armados a mano con su propio
// banner de sincronización y diseño ya terminado; este proyecto no tiene
// forma confiable de leer su estructura interna, así que tocarlas a
// ciegas (columnas o formato) sería un riesgo innecesario sobre un
// diseño de producción ya correcto--. Si ya se ejecutó esta migración
// antes y solo se quiere repasar la estética de las pestañas gobernadas,
// usar tintinPulirEsteticaTodasLasHojas en su lugar (no está bloqueada
// por el marcador de Script Properties).
function tintinReorganizarHojaAdministrativa() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(TINTIN_REORG_MARKER_PROPERTY_)) {
    return { ok: false, reason: 'La reorganización ya se ejecutó antes (Script Properties: ' + TINTIN_REORG_MARKER_PROPERTY_ + '). No se repite para evitar reordenar datos ya reordenados.' };
  }

  var summary = {};
  summary.usuariosWeb = tintinMigrarUsuariosWebColumnas_();
  summary.usuariosWebVisual = tintinPulirVisualUsuariosWeb_();
  summary.pedidosWeb = tintinPulirVisualPedidosWeb_();
  summary.productos = tintinPulirVisualProductos_();
  summary.soloLectura = tintinPulirVisualSoloLectura_();
  summary.nuevoPedidoWeb = tintinPulirVisualNuevoPedidoWeb_();
  summary.otrasHojas = tintinPulirVisualHojasNoGobernadas_();

  tintinPrepararHojasParidad_();
  properties.setProperty(TINTIN_REORG_MARKER_PROPERTY_, new Date().toISOString());

  summary.ok = true;
  summary.note = 'Columnas reordenadas solo en Usuarios web. Formato visual por bloques aplicado a Usuarios web, Pedidos web, Productos, Auditoría web, Historial sync y Nuevo pedido web. Las pestañas no gobernadas (Buscar, Índice, Resumen anual 2026, Reporte de ventas por cliente, Listas de apoyo, mensuales y cualquier otra) quedaron intactas: son paneles manuales con banner de sincronización propio y no se les movió ni reescribió ningún valor ni formato.';
  return summary;
}
