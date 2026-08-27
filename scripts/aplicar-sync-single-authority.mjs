#!/usr/bin/env node
import fs from 'node:fs';

const FILE = 'apps-script/ProductosUnificados.gs';
let source = fs.readFileSync(FILE, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  source = source.replace(before, after);
}

replaceOnce(
  'payload de usuario',
`  var payload = {
    entity: 'user', action: String(row[9] || '').trim() === 'ELIMINAR' ? 'deleteUser' : 'updateUser',
    uid: uid, role: String(row[4] || '').trim().toLowerCase(), blocked: tintinBool_(row[5]),
    internalNotes: String(row[8] || ''), changeId: changeId
  };`,
`  var payload = {
    entity: 'user', action: String(row[9] || '').trim() === 'ELIMINAR' ? 'softDeleteUser' : 'updateUser',
    uid: uid, role: String(row[4] || '').trim().toLowerCase(), blocked: tintinBool_(row[5]),
    internalNotes: String(row[8] || ''), changeId: changeId,
    baseChangeId: String(sheet.getRange(e.range.getRow(), 19).getValue() || '').trim(),
    source: 'google-sheets:Usuarios web', schemaVersion: 4
  };`
);

replaceOnce(
  'resultado de usuario',
`    tintinCallInternalWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    if (payload.action === 'deleteUser') sheet.deleteRow(e.range.getRow());
    else sheet.getRange(e.range.getRow(), 19).setValue(changeId);
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Cuenta web sincronizada.');`,
`    tintinCallInternalWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, payload);
    if (payload.action === 'softDeleteUser') {
      sheet.getRange(e.range.getRow(), 7).setValue('Sí');
      sheet.getRange(e.range.getRow(), 11).clearContent();
    }
    sheet.getRange(e.range.getRow(), 19).setValue(changeId);
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Cuenta web sincronizada sin eliminar su identidad histórica.');`
);

replaceOnce(
  'edición de pedidos',
`function tintinHandleOrderEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 2 || [11, 13].indexOf(e.range.getColumn()) === -1) return;
  var sheet = e.range.getSheet();
  var row = sheet.getRange(e.range.getRow(), 1, 1, 29).getValues()[0];
  var orderId = String(row[0] || '').trim();
  if (!orderId) return;
  var changeId = Utilities.getUuid();
  tintinRecordSyncSafely_('SYNCING', sheet.getName(), e.range.getA1Notation(), 'Sincronizando estado del pedido.');
  try {
    tintinCallInternalWebhook_(TINTIN_ADMIN_WEBHOOK_PATH, {
      entity: 'order', orderId: orderId, status: String(row[10] || '').trim(),
      paymentStatus: String(row[12] || '').trim(), changeId: changeId
    });
    sheet.getRange(e.range.getRow(), 29).setValue(changeId);
    tintinRecordSyncSafely_('SYNCED', sheet.getName(), e.range.getA1Notation(), 'Pedido sincronizado.');
  } catch (error) {
    tintinRecordSyncSafely_('ERROR', sheet.getName(), e.range.getA1Notation(), String(error && error.message || error));
    throw error;
  }
}`,
`function tintinHandleOrderEdit_(e) {
  if (!e || !e.range || e.range.getRow() < 2 || [11, 13].indexOf(e.range.getColumn()) === -1) return;
  var message = 'Pedidos web es un espejo de solo lectura. Cambiá estados desde Superadmin para conservar la integridad de stock.';
  if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1 && Object.prototype.hasOwnProperty.call(e, 'oldValue')) {
    e.range.setValue(e.oldValue);
  } else {
    tintinPullOrdersFromWeb_();
  }
  tintinRecordSyncSafely_('REJECTED', e.range.getSheet().getName(), e.range.getA1Notation(), message);
}`
);

fs.writeFileSync(FILE, source, 'utf8');
console.log('Apps Script migrado a autoridad única: Usuarios administrativos, Pedidos solo lectura.');
