import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {
  PRODUCTS_WEBHOOK_REVISION,
  classifySheetsWebhookAuth,
  onRequestPost,
} from '../../functions/api/sheets-products-webhook.js';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function runAppsScriptCanary(rows, { sendError = '' } = {}) {
  const source = read('apps-script/ProductosUnificados.gs');
  const sendCalls = [];
  const historyEvents = [];
  const sheet = {
    getLastRow: () => 6 + rows.length,
    getRange(row, column, rowCount) {
      const offset = row - 7;
      const selected = rows.slice(offset, offset + rowCount);
      return {
        getDisplayValues: () => selected.map(values => [String(values[column - 1] ?? '')]),
        getValues: () => selected.map(values => [...values]),
        getA1Notation: () => `A${row}:${column}`,
      };
    },
  };
  const context = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === 'Productos' ? sheet : null }) },
  };
  context.sendError = sendError;
  vm.runInNewContext(source, context);
  context.tintinSendProductRow_ = (_sheet, rowNumber, changedFields) => {
    sendCalls.push({ rowNumber, changedFields: Array.from(changedFields || []) });
    if (context.sendError) throw new Error(context.sendError);
  };
  context.tintinRecordSyncSafely_ = (...event) => { historyEvents.push(event); return { recorded: true }; };
  let result;
  let error = '';
  try { result = context.tintinProbarEdicionCatalogo(); }
  catch (caught) { error = String(caught && caught.message || caught); }
  return { result, sendCalls, historyEvents, error };
}

function canaryRow({ active = 'No', stock = 0 } = {}) {
  const row = Array(35).fill('');
  row[0] = 'CANARY-SHEETS-FIRESTORE';
  row[1] = 'PRUEBA QA · NO VENDER';
  row[3] = 'Canary de integración';
  row[5] = 1000;
  row[10] = stock;
  row[14] = active;
  return row;
}

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

test('la prueba Sheets→Firestore nunca selecciona un producto real como canary', () => {
  const activeProduct = Array(35).fill('');
  activeProduct[0] = 'real-product-id';
  activeProduct[1] = 'ANILLO mojojo';
  activeProduct[5] = 55000;
  activeProduct[10] = 1;
  activeProduct[14] = 'Sí';
  const { result, sendCalls } = runAppsScriptCanary([activeProduct]);

  assert.equal(result.ok, false);
  assert.equal(result.error, 'canary-not-found');
  assert.equal(result.requiredProductId, 'CANARY-SHEETS-FIRESTORE');
  assert.deepEqual(sendCalls, []);
});

test('la prueba Sheets→Firestore solo envía el canary inactivo y sin stock', () => {
  const { result, sendCalls, historyEvents } = runAppsScriptCanary([canaryRow()]);

  assert.equal(result.ok, true);
  assert.equal(result.destructive, false);
  assert.equal(result.writesFirestore, true);
  assert.equal(result.publicCatalogVisible, false);
  assert.equal(result.productId, 'CANARY-SHEETS-FIRESTORE');
  assert.deepEqual(sendCalls, [{
    rowNumber: 7,
    changedFields: ['name', 'category', 'price', 'active', 'stock', 'costUnit', 'purchased', 'stockMinimum', 'internalNotes'],
  }]);
  assert.deepEqual(historyEvents.map(event => event[0]), ['SYNCING', 'SYNCED']);
  assert.equal(historyEvents[0][1], 'Productos');
  assert.match(historyEvents[1][3], /confirmada/);
});

test('la prueba canary registra ERROR en Historial sync cuando falla el webhook', () => {
  const failing = runAppsScriptCanary([canaryRow()], { sendError: 'simulated webhook failure' });
  assert.equal(failing.error, 'simulated webhook failure');
  assert.deepEqual(failing.historyEvents.map(event => event[0]), ['SYNCING', 'ERROR']);
  assert.match(failing.historyEvents[1][3], /simulated webhook failure/);
});

test('la prueba canary informa si Historial sync no registró el evento', () => {
  const ok = runAppsScriptCanary([canaryRow()]);
  assert.equal(ok.result.historyRecorded, true);
  assert.equal(ok.result.historyError, undefined);
});

function runHistoryRecorder({ historySheet, headers }) {
  const source = read('apps-script/ProductosUnificados.gs');
  const inserted = [];
  const errors = [];
  const sheet = historySheet === null ? null : {
    getLastColumn: () => headers.length,
    getLastRow: () => 8,
    getRange: (row, _column, _rows, cols) => ({
      getDisplayValues: () => [headers],
      setValues: values => inserted.push({ row, values, cols }),
    }),
    insertRowBefore: () => {},
    deleteRows: () => {},
  };
  const context = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    console: { error: message => errors.push(message) },
  };
  vm.runInNewContext(source, context);
  const outcome = context.tintinRecordSyncSafely_('SYNCED', 'Productos', 'A710:AI710', 'detalle');
  return { outcome, inserted, errors };
}

test('Historial sync informa en vez de silenciar hoja o columna Estado ausente', () => {
  const good = runHistoryRecorder({ headers: ['Fecha', 'Origen', 'Hoja', 'Celda', 'Estado', 'Detalle'] });
  assert.equal(good.outcome.recorded, true);
  assert.equal(good.inserted.length, 1);

  const noStatus = runHistoryRecorder({ headers: ['Fecha', 'Origen', 'Hoja', 'Celda', 'Detalle'] });
  assert.equal(noStatus.outcome.recorded, false);
  assert.match(noStatus.outcome.reason, /columna Estado/);
  assert.equal(noStatus.inserted.length, 0);
  assert.equal(noStatus.errors.length, 1);

  const missing = runHistoryRecorder({ historySheet: null, headers: [] });
  assert.equal(missing.outcome.recorded, false);
  assert.match(missing.outcome.reason, /No existe la hoja Historial sync/);
});

test('la prueba Sheets→Firestore no elige entre canaries duplicados', () => {
  const { result, sendCalls } = runAppsScriptCanary([canaryRow(), canaryRow()]);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'canary-duplicate');
  assert.deepEqual([...result.rows], [7, 8]);
  assert.deepEqual(sendCalls, []);
});

test('la prueba Sheets→Firestore rechaza un canary activo, con stock o con ID incorrecto', () => {
  for (const row of [canaryRow({ active: 'Sí' }), canaryRow({ stock: 1 })]) {
    const { result, sendCalls } = runAppsScriptCanary([row]);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'canary-must-be-inactive-zero-stock-and-action-clear');
    assert.deepEqual(sendCalls, []);
  }

  const wrongId = canaryRow();
  wrongId[0] = 'real-product-id';
  const mismatch = runAppsScriptCanary([wrongId]);
  assert.equal(mismatch.result.error, 'canary-id-mismatch');
  assert.deepEqual(mismatch.sendCalls, []);

  const withShopifyImage = canaryRow();
  withShopifyImage[19] = 'https://cdn.shopify.com/test.png';
  const media = runAppsScriptCanary([withShopifyImage]);
  assert.equal(media.result.error, 'canary-needs-category-price-and-no-image');
  assert.deepEqual(media.sendCalls, []);
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

test('el payload mínimo del canary escribe catálogo e inventario por webhook autenticado', async () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const env = {
    SHEETS_ENGAGEMENT_SECRET: 'test-only-shared-secret',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'test-project',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      private_key: privateKey,
    }),
  };
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-only-access-token', expires_in: 3600 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/documents:commit')) {
      writes.push(JSON.parse(init.body));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected network request: ${url}`);
  };

  try {
    const response = await onRequestPost({ request: request({
      action: 'saveProduct',
      productId: 'CANARY-SHEETS-FIRESTORE',
      name: 'PRUEBA QA · NO VENDER',
      category: 'otros',
      price: 1000,
      active: false,
      stock: 0,
      costUnit: 0,
      purchased: 0,
      stockMinimum: 0,
      internalNotes: '',
      imageUrl: 'https://res.cloudinary.com/tintin/image/upload/canary.webp',
      changedFields: ['name', 'category', 'price', 'active', 'stock', 'costUnit', 'purchased', 'stockMinimum', 'internalNotes', 'imageUrl'],
    }, 'test-only-shared-secret'), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.productId, 'CANARY-SHEETS-FIRESTORE');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].writes.map(write => write.update.name), [
      'projects/test-project/databases/(default)/documents/products/CANARY-SHEETS-FIRESTORE',
      'projects/test-project/databases/(default)/documents/productInventory/CANARY-SHEETS-FIRESTORE',
    ]);
    assert.equal(writes[0].writes[0].update.fields.name.stringValue, 'PRUEBA QA · NO VENDER');
    assert.equal(writes[0].writes[0].update.fields.active.booleanValue, false);
    assert.equal(writes[0].writes[0].update.fields.stock.integerValue, '0');
    assert.equal(writes[0].writes[0].update.fields.imageUrl.stringValue, 'https://res.cloudinary.com/tintin/image/upload/canary.webp');
    assert.equal(writes[0].writes[1].update.fields.purchased.integerValue, '0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Sheets→Firestore rechaza URLs Shopify en campos públicos antes de escribir', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    throw new Error('No se esperaba acceso a Firestore para un medio rechazado.');
  };

  try {
    for (const [field, value] of [
      ['imageUrl', 'https://cdn.shopify.com/s/files/1/product.png'],
      ['imagesExtra', ['//cdn.shopify.com/s/files/1/alternate.png']],
      ['imageUrl', 'https://store.myshopify.com/cdn/product.png'],
      ['description', 'Ver detalles en https://shopify.com/producto.'],
    ]) {
      const response = await onRequestPost({ request: request({
        action: 'saveProduct',
        productId: 'product-1',
        name: 'Producto',
        category: 'relojes',
        price: 100,
        imageUrl: field === 'imageUrl' ? value : '',
        imagesExtra: field === 'imagesExtra' ? value : [],
        description: field === 'description' ? value : '',
        changedFields: [field],
      }, 'test-only-shared-secret'), env: { SHEETS_ENGAGEMENT_SECRET: 'test-only-shared-secret' } });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /URLs de Shopify/);
    }
    assert.deepEqual(requests, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('una imagen Shopify antigua no bloquea ni se reescribe en una edicion de precio parcial', async () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const env = {
    SHEETS_ENGAGEMENT_SECRET: 'test-only-shared-secret',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'test-project',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      private_key: privateKey,
    }),
  };
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-only-access-token', expires_in: 3600 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/documents:commit')) {
      writes.push(JSON.parse(init.body));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected network request: ${url}`);
  };

  try {
    const response = await onRequestPost({ request: request({
      action: 'saveProduct',
      productId: 'product-1',
      name: 'Producto',
      category: 'relojes',
      price: 125,
      imageUrl: 'https://cdn.shopify.com/s/files/1/old.png',
      changedFields: ['price'],
    }, 'test-only-shared-secret'), env });
    assert.equal(response.status, 200);
    assert.equal(writes.length, 1);
    const productFields = writes[0].writes[0].update.fields;
    assert.equal(productFields.price.integerValue, '125');
    assert.equal(Object.hasOwn(productFields, 'imageUrl'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

  assert.match(adminRuntime, /(?:authenticatedFetch|fetch)\('\/api\/admin-order-mutation'/);
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

test('Usuarios web es un espejo estricto de Firestore y no conserva dispatcher heredado', () => {
  const productsScript = read('apps-script/ProductosUnificados.gs');
  const parity = read('apps-script/AdminParity.gs');

  assert.match(productsScript, /function tintinPullUsersFromWeb_\(\)/);
  assert.match(productsScript, /tintinSnapshot_\('users'\)/);
  assert.match(productsScript, /tintinPullUsersFromWeb_\(\);[\s\S]{0,260}La columna de usuario es informativa/);
  assert.doesNotMatch(productsScript, /alEditarClientas\s*\(/);
  assert.match(productsScript, /TINTIN_PARITY_DISPATCHER/);
  assert.match(productsScript, /TINTIN_PARITY_RECONCILER/);
  assert.match(parity, /summary\.users\s*=\s*tintinPullUsersFromWeb_\(\)/);
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
