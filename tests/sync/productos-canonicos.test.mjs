import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  PRODUCTS_WEBHOOK_REVISION,
  classifySheetsWebhookAuth,
  onRequestPost,
} from '../../functions/api/sheets-products-webhook.js';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function request(body, secret = '') {
  const headers = { 'content-type': 'application/json' };
  if (secret) headers['X-Tintin-Sheets-Secret'] = secret;
  return new Request('https://tintinaccesorios.pages.dev/api/sheets-products-webhook', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

test('clasifica fallos de autenticación sin devolver el secreto', async () => {
  assert.equal(classifySheetsWebhookAuth('', 'server-value'), 'missing-header');
  assert.equal(classifySheetsWebhookAuth('client-value', ''), 'server-secret-missing');
  assert.equal(classifySheetsWebhookAuth('client-value', 'server-value'), 'secret-mismatch');
  assert.equal(classifySheetsWebhookAuth('same-value', 'same-value'), 'authenticated');
  const response = await onRequestPost({ request: request({ action: 'diagnose' }), env: { SHEETS_ENGAGEMENT_SECRET: 'server-value' } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('x-tintin-auth-state'), 'missing-header');
  assert.equal(response.headers.get('x-tintin-products-webhook'), PRODUCTS_WEBHOOK_REVISION);
  assert.doesNotMatch(await response.text(), /server-value/);
});

test('diagnóstico autenticado es no destructivo y distingue el deployment', async () => {
  const response = await onRequestPost({ request: request({ action: 'diagnose' }, 'shared-value'), env: { SHEETS_ENGAGEMENT_SECRET: 'shared-value' } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.authenticated, true);
  assert.equal(body.destructive, false);
  assert.equal(body.revision, PRODUCTS_WEBHOOK_REVISION);
  assert.equal(body.endpoint, '/api/sheets-products-webhook');
  assert.doesNotMatch(JSON.stringify(body), /shared-value/);
});

test('una eliminación exige productId y no inventa otro producto', async () => {
  const response = await onRequestPost({ request: request({ action: 'deleteProduct', productId: '' }, 'shared-value'), env: { SHEETS_ENGAGEMENT_SECRET: 'shared-value' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /productId/);
});

test('Products e inventario se guardan en un commit atómico', () => {
  const source = read('functions/api/sheets-products-webhook.js');
  assert.match(source, /const writes = \[\];/);
  assert.match(source, /await firestoreAdminCommit\(env, writes\);/);
  assert.match(source, /path: `products\/\$\{id\}`/);
  assert.match(source, /path: `productInventory\/\$\{id\}`/);
  assert.match(source, /upstreamStatus === 409 \|\| upstreamStatus === 502/);
  assert.doesNotMatch(source, /firestoreAdminMerge/);
});

test('Apps Script conserva Productos y agrega un dispatcher de paridad instalable', () => {
  const source = read('apps-script/ProductosUnificados.gs');
  const parity = read('apps-script/AdminParity.gs');
  assert.match(source, /TINTIN_PRODUCTS_SHEET = 'Productos'/);
  assert.match(source, /TINTIN_USERS_SHEET = 'Usuarios web'/);
  assert.match(source, /function tintinHandleProductEdit_/);
  assert.match(parity, /TINTIN_PARITY_DISPATCHER = 'tintinDespacharEdicionParidad'/);
  assert.match(parity, /ScriptApp\.newTrigger\(TINTIN_PARITY_DISPATCHER\)/);
  assert.match(parity, /sheetName === TINTIN_PRODUCTS_SHEET/);
  assert.match(parity, /sheetName === TINTIN_USERS_SHEET/);
  assert.match(parity, /sheetName === TINTIN_ORDERS_SHEET/);
  assert.doesNotMatch(source + parity, /insertSheet\(['"]Catálogo web['"]\)/);
});

test('una edición parcial no valida ni reemplaza las demás columnas del producto', () => {
  const source = read('functions/api/sheets-products-webhook.js');
  const appScript = read('apps-script/ProductosUnificados.gs');
  assert.match(source, /const fields = selectedFields\(input\.changedFields, id\);/);
  assert.match(source, /if \(\(!fields \|\| fields\.has\('name'\)\) && !name\)/);
  assert.match(source, /if \(Object\.keys\(publicData\)\.length\) publicData\.updatedAt/);
  assert.match(appScript, /function tintinProductFieldsForColumns_/);
  assert.match(appScript, /2: \['name'\]/);
  assert.match(appScript, /33: \['tags'\], 34: \['variants'\]/);
  assert.match(appScript, /tintinSendProductRowWithRetry_\(sheet, rowNumber, changedFields\)/);
});

test('Sheets y Superadmin comparten la autoridad de pedidos; auditoría sigue read-only', () => {
  const parity = read('apps-script/AdminParity.gs');
  const adminWebhook = read('functions/api/sheets-admin-webhook.js');
  const adminRuntime = read('js/admin/products/integridad-inventario-admin.js');
  const orderDomain = read('cloudflare/order-admin-domain.js');
  const snapshot = read('functions/api/sheets-sync-snapshot.js');

  assert.match(parity, /entity: 'order'/);
  assert.match(parity, /action: 'updateOrder'/);
  assert.match(parity, /baseChangeId:/);
  assert.match(parity, /changeId:/);
  assert.match(parity, /tintinPullOrdersParity_/);
  assert.match(parity, /tintinParityCallWebhook_\(TINTIN_ADMIN_WEBHOOK_PATH, payload\)/);
  assert.doesNotMatch(parity, /productInventory\//);
  assert.doesNotMatch(parity, /firestoreAdmin(?:Batch)?Commit|phase4Commit_/);

  assert.match(adminWebhook, /writableEntities: \['user', 'order'\]/);
  assert.match(adminWebhook, /readOnlyMirrors: \['audit'\]/);
  assert.match(adminWebhook, /orderMutationsUseInventoryDomain: true/);
  assert.match(adminWebhook, /applyOrderAdminMutation/);
  assert.match(orderDomain, /computeInventoryDeltas/);
  assert.match(orderDomain, /firestoreAdminBatchCommit/);
  assert.match(orderDomain, /currentDocument: precondition/);
  assert.match(orderDomain, /auditLog/);

  assert.match(adminRuntime, /fetch\('\/api\/admin-order-mutation'/);
  assert.match(adminRuntime, /TintinInventoryIntegrity/);
  assert.match(snapshot, /ALLOWED_ENTITIES = new Set\(\['products', 'users', 'orders', 'audit'\]\)/);
  assert.match(snapshot, /reference:/);
  assert.match(snapshot, /notes:/);
});

test('Usuarios web permite lifecycle seguro desde Sheets sin destruir identidades', () => {
  const parity = read('apps-script/AdminParity.gs');
  const adminWebhook = read('functions/api/sheets-admin-webhook.js');
  assert.match(parity, /'ELIMINAR' \? 'softDeleteUser'/);
  assert.match(parity, /'REACTIVAR' \? 'reactivateUser'/);
  assert.match(adminWebhook, /applyUserLifecycle/);
  assert.doesNotMatch(adminWebhook, /deleteFirebaseUser/);
});

test('Historial sync conserva el contrato de estados, fila 8 y máximo 500', () => {
  const source = read('apps-script/ProductosUnificados.gs');
  assert.match(source, /TINTIN_SYNC_HISTORY_FIRST_ROW = 8/);
  assert.match(source, /TINTIN_SYNC_HISTORY_MAX_ROWS = 500/);
  assert.match(source, /SYNCED: true, SYNCING: true, ERROR: true, REJECTED: true, LOCAL: true/);
  assert.match(source, /detalle\|mensaje\|descripcion\|resultado\|error/);
  assert.match(source, /insertRowBefore\(TINTIN_SYNC_HISTORY_FIRST_ROW\)/);
  assert.match(source, /tintinRecordSyncSafely_\('SYNCING'/);
  assert.match(source, /tintinRecordSyncSafely_\('SYNCED'/);
  assert.match(source, /tintinRecordSyncSafely_\('LOCAL'/);
  assert.match(source, /isRejected \? 'REJECTED' : 'ERROR'/);
  assert.match(source, /function tintinSendProductRowWithRetry_/);
  assert.match(source, /status !== 409 && status !== 502/);
  assert.match(source, /if \(isRejected && e\.range\.getNumRows\(\) === 1/);
  assert.match(source, /function tintinClaimProductEdit_/);
  assert.match(source, /if \(!tintinClaimProductEdit_\(e\)\) return;/);
});

test('los archivos Apps Script versionados no tienen funciones globales duplicadas', () => {
  const files = fs.readdirSync(path.join(root, 'apps-script')).filter(name => name.endsWith('.gs'));
  const definitions = new Map();
  for (const file of files) {
    const source = read(`apps-script/${file}`);
    for (const match of source.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
      const locations = definitions.get(match[1]) || [];
      locations.push(file);
      definitions.set(match[1], locations);
    }
  }
  const duplicates = [...definitions].filter(([, filesForName]) => filesForName.length > 1);
  assert.deepEqual(duplicates, []);
});

test('restauración web conserva roleBeforeBlock desde una sola autoridad', () => {
  const admin = read('js/admin/admin-app.js');
  const compat = read('js/admin/users/gestion-usuarios-admin.js');
  assert.match(admin, /ASSIGNABLE_ROLES\.includes\(u\?\.roleBeforeBlock\)/);
  assert.match(admin, /role: targetRole/);
  assert.doesNotMatch(compat, /roleBeforeBlock:/);
  assert.doesNotMatch(compat, /updateDoc\(|writeBatch\(|setDoc\(/);
});
