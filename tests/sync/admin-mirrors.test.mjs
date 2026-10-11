import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('Sheets no puede eliminar cuentas: sólo activas o bloqueadas', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');

  assert.doesNotMatch(webhook, /deleteFirebaseUser|applyUserLifecycle/);
  assert.doesNotMatch(webhook, /path:\s*`users\/\$\{uid\}`\s*,\s*delete:\s*true/);
  assert.match(webhook, /La eliminación de cuentas fue retirada/);
  assert.doesNotMatch(parity, /softDeleteUser|reactivateUser|'ELIMINAR'/);
  assert.match(parity, /tintinPullUsersFromWeb_\(\)/);
  assert.doesNotMatch(parity, /sheet\.deleteRow/);
});

test('Pedidos web solo administra pedidos mediante el dominio canónico de inventario', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');
  const orderDomain = read('cloudflare/order-admin-domain.js');

  assert.match(webhook, /input\.entity === 'order'/);
  assert.match(webhook, /applyOrderAdminMutation/);
  assert.match(webhook, /createOrderAdmin/);
  assert.match(parity, /entity: 'order'/);
  assert.match(parity, /action: 'updateOrder'/);
  assert.match(parity, /baseChangeId:/);
  assert.match(parity, /tintinParityCallWebhook_\(TINTIN_ADMIN_WEBHOOK_PATH, payload\)/);
  assert.doesNotMatch(parity, /productInventory\//);
  assert.doesNotMatch(parity, /firestoreAdmin(?:Batch)?Commit|phase4Commit_/);
  assert.match(orderDomain, /computeInventoryDeltas/);
  assert.match(orderDomain, /auditLog/);
});

test('Usuarios administrativos usa changeId, baseChangeId y origen', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');

  assert.match(webhook, /baseChangeId/);
  assert.match(webhook, /currentChangeId === nextChangeId/);
  assert.match(webhook, /baseChangeId !== currentChangeId/);
  assert.match(webhook, /syncOrigin/);
  assert.match(parity, /baseChangeId:/);
  assert.match(parity, /source: 'google-sheets:Usuarios web'/);
  assert.match(parity, /schemaVersion: 6/);
});

test('Snapshot administrativo pagina hasta 5000 y recupera cédula de checkout', () => {
  const snapshot = read('functions/api/sheets-sync-snapshot.js');
  assert.match(snapshot, /const MAX_RECORDS = 5000;/);
  assert.match(snapshot, /checkoutDefaults/);
  assert.match(snapshot, /ci:\s*user\.ci \|\| checkoutDefaults\.ci \|\| ''/);
  assert.match(snapshot, /firestoreAdminListAll\(env, collection, MAX_RECORDS\)/);
  assert.match(snapshot, /firstName: user\.firstName/);
  assert.match(snapshot, /locationName: savedLocation\.name/);
  assert.match(snapshot, /ruc: invoice\.ruc/);
  assert.match(snapshot, /return \{ \.\.\.record, eventId: documentId\(document\), timestamp: asIso/);
});

test('Reconciliación Sheets reintenta solo errores de red transitorios del snapshot de solo lectura', async () => {
  const productsScript = read('apps-script/ProductosUnificados.gs');
  const snapshot = productsScript.match(/function tintinSnapshot_\(entity\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(snapshot, /TINTIN_SNAPSHOT_PATH/);
  const makeContext = (call, waits = []) => {
    const context = { tintinCallInternalWebhook_: call, TINTIN_SNAPSHOT_PATH: '/api/sheets-sync-snapshot', Utilities: { sleep: ms => waits.push(ms) } };
    vm.runInNewContext(`${snapshot}\nthis.runSnapshot = tintinSnapshot_;`, context);
    return context;
  };

  let calls = 0;
  const waits = [];
  const retryContext = makeContext(() => {
    calls += 1;
    if (calls < 3) throw new Error('Exception: Address unavailable: https://example.test/api/sheets-sync-snapshot');
    return { records: [{ uid: 'fixture' }] };
  }, waits);
  assert.deepEqual(retryContext.runSnapshot('users'), [{ uid: 'fixture' }]);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [250, 750]);

  calls = 0;
  const apiError = new Error('HTTP 503: service unavailable');
  const noRetryContext = makeContext(() => { calls += 1; throw apiError; });
  assert.throws(() => noRetryContext.runSnapshot('users'), /HTTP 503/);
  assert.equal(calls, 1);

  calls = 0;
  const offlineWaits = [];
  const offlineContext = makeContext(() => { calls += 1; throw new Error('Address unavailable'); }, offlineWaits);
  assert.throws(() => offlineContext.runSnapshot('users'), /Address unavailable/);
  assert.equal(calls, 3);
  assert.deepEqual(offlineWaits, [250, 750]);
});

test('Bloqueo desde Sheets compensa Firebase Auth si falla Firestore', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  assert.match(webhook, /restoreAuthStateBestEffort/);
  assert.match(webhook, /previousDisabled = current\.blocked === true/);
  assert.match(webhook, /if \(previousDisabled !== blocked\)/);
  assert.match(webhook, /authFirestoreCompensation:\s*true/);
});

test('Historial sync serializa inserciones y Nuevo pedido no se corta en fila 1000', () => {
  const productsScript = read('apps-script/ProductosUnificados.gs');
  const parity = read('apps-script/AdminParity.gs');
  assert.match(productsScript, /LockService\.getScriptLock\(\)/);
  assert.match(productsScript, /lock\.tryLock\(10000\)/);
  assert.match(productsScript, /lock\.releaseLock\(\)/);
  assert.doesNotMatch(parity, /Productos!\$A\$7:\$F\$1000/);
  assert.match(parity, /Productos!\$A\$7:\$F;2;FALSE/);
  assert.match(parity, /Productos!\$A\$7:\$F;6;FALSE/);
});

test('el espejo de Usuarios recupera factura canónica de checkout sin perder compatibilidad histórica', () => {
  const source=read('functions/api/sheets-sync-snapshot.js');
  const block=source.slice(source.indexOf('function userRecord('),source.indexOf('function orderRecord('));
  const project=new Function('decodeFirestoreFields','documentId','asIso',block+'return userRecord;')(fields=>fields,document=>document.name,value=>value||'');
  const record=project({name:'customer',fields:{checkoutDefaults:{ci:'4123456',shipping:{departamento:'Central'},invoice:{razonSocial:'María López',ruc:'4123456-7',taxpayerType:'fisica'}}}});
  assert.equal(record.departamento,'Central');assert.equal(record.ci,'4123456');assert.equal(record.razonSocial,'María López');assert.equal(record.ruc,'4123456-7');
  assert.equal(project({name:'legacy',fields:{invoice:{razonSocial:'Empresa anterior',ruc:'80012345-6'}}}).ruc,'80012345-6');
  const updated=project({name:'updated',fields:{address:'Dirección anterior',departamento:'Departamento anterior',wantsInvoice:true,invoice:{razonSocial:'Empresa anterior',ruc:'80012345-6',wanted:true},checkoutDefaults:{shipping:{address:'Dirección nueva',departamento:'Central'},invoice:{razonSocial:'María López',ruc:'4123456-7',wanted:false}}}});
  assert.equal(updated.razonSocial,'María López');assert.equal(updated.ruc,'4123456-7');assert.equal(updated.invoiceWanted,false);assert.equal(updated.address,'Dirección nueva');assert.equal(updated.departamento,'Central');
});

function snapshotHttpFixture(responses) {
  const source = read('apps-script/ProductosUnificados.gs');
  const names = ['tintinParseJsonResponse_', 'tintinCallInternalWebhook_', 'tintinSnapshot_'];
  const code = names.map(name => {
    const match = source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    assert.ok(match, name);
    return match[0];
  }).join('\n');
  const calls = []; const waits = [];
  const context = {
    tintinStoreOrigin_: () => 'https://example.test',
    tintinWebhookSecret_: () => 'fixture-secret-never-log',
    TINTIN_SNAPSHOT_PATH: '/api/sheets-sync-snapshot',
    Utilities: { sleep: ms => waits.push(ms) },
    UrlFetchApp: { fetch: (url, options) => {
      calls.push({ url, options });
      const next = responses[Math.min(calls.length - 1, responses.length - 1)];
      return { getResponseCode: () => next.status, getContentText: () => next.body };
    } },
  };
  vm.runInNewContext(code, context);
  return { context, calls, waits };
}

for (const status of [502, 503, 429]) {
  test(`snapshot retries typed HTTP ${status} then returns confirmed records`, () => {
    const fixture = snapshotHttpFixture([
      { status, body: '<html>upstream failure fixture-secret-never-log</html>' },
      { status: 200, body: JSON.stringify({ ok: true, records: [{ eventId: 'fixture' }] }) },
    ]);
    assert.equal(fixture.context.tintinSnapshot_('audit')[0].eventId, 'fixture');
    assert.equal(fixture.calls.length, 2);
    assert.deepEqual(fixture.waits, [250]);
    assert.ok(fixture.calls.every(call => call.url.endsWith('/api/sheets-sync-snapshot')));
  });
}

test('snapshot transient rejection remains an error after three attempts without exposing response body', () => {
  const fixture = snapshotHttpFixture([{ status: 504, body: '<html>fixture-secret-never-log</html>' }]);
  assert.throws(() => fixture.context.tintinSnapshot_('audit'), error => {
    assert.equal(error.httpStatus, 504);
    assert.match(error.message, /HTTP 504/);
    assert.doesNotMatch(error.message, /fixture-secret|<html>/);
    return true;
  });
  assert.equal(fixture.calls.length, 3);
  assert.deepEqual(fixture.waits, [250, 750]);
});

for (const status of [400, 401, 403]) {
  test(`snapshot preserves HTTP ${status} and never retries validation or access rejection`, () => {
    const fixture = snapshotHttpFixture([{ status, body: '<html>denied</html>' }]);
    assert.throws(() => fixture.context.tintinSnapshot_('audit'), error => error.httpStatus === status);
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.waits, []);
  });
}

test('mutating webhook does not inherit snapshot retries', () => {
  const fixture = snapshotHttpFixture([{ status: 503, body: '{"ok":false,"error":"temporarily unavailable"}' }]);
  assert.throws(() => fixture.context.tintinCallInternalWebhook_('/api/sheets-admin-webhook', { action: 'updateUser' }), error => error.httpStatus === 503);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.waits, []);
});

test('snapshot rejects missing/malformed records instead of replacing a mirror with an invented empty snapshot', () => {
  for (const body of ['{"ok":true}', '{"ok":true,"records":{}}']) {
    const fixture = snapshotHttpFixture([{ status: 200, body }]);
    assert.throws(() => fixture.context.tintinSnapshot_('audit'), /snapshot.*records/i);
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.waits, []);
  }
  const empty = snapshotHttpFixture([{ status: 200, body: '{"ok":true,"records":[]}' }]);
  assert.equal(empty.context.tintinSnapshot_('audit').length, 0);
});
