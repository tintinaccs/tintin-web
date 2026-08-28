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
    results[name] = true;
  });
  return results;
}

// Punto de entrada único. Ejecutar una sola vez desde el editor de Apps
// Script (seleccionar esta función → Ejecutar). Reordena físicamente
// "Usuarios web" (username pasa a estar junto a UID/nombre, ya no
// enterrado en la columna 13) y aplica organización visual por bloques al
// resto de las hojas administradas por este proyecto. No toca Listas,
// Clientes de ventas, Resumen anual, las hojas mensuales ni Buscar: esas
// pestañas no están gobernadas por este Apps Script y este proyecto no
// tiene forma confiable de leer su contenido actual antes de reordenarlas,
// así que reordenarlas a ciegas sería un riesgo innecesario sobre datos de
// producción. Si también se quiere reorganizar esas hojas, hacerlo a mano
// siguiendo el mismo criterio de bloques (identidad → contacto → comercial
// → estado → administración → sincronización → IDs/metadatos técnicos).
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

  tintinPrepararHojasParidad_();
  properties.setProperty(TINTIN_REORG_MARKER_PROPERTY_, new Date().toISOString());

  summary.ok = true;
  summary.note = 'No se tocaron Listas, Clientes de ventas, Resumen anual, hojas mensuales ni Buscar: revisarlas manualmente si también se quieren reorganizar.';
  return summary;
}
