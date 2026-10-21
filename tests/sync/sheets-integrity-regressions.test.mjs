import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { variantInventoryEntries } from '../../js/core/store/inventario-variantes.mjs';
const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
function loadModule(file, deps) {
  const source = read(file).replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({ Request, Response, URL, TextEncoder, crypto, console, ...deps });
  vm.runInContext(source, context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const fails of [false, true]) {
  test(`admin sync authenticates with context.env and ${fails ? 'queues transport failure' : 'reads canonical products'}`, async () => {
    const env = { fixture: true };
    const calls = [];
    const context = loadModule('functions/api/sheets-product-sync.js', {
      originIsAllowed: () => true,
      rateLimitErrorResponse: () => null,
      jsonResponse: (body, status) => Response.json(body, { status }),
      requireSuperAdmin: async (_request, actualEnv) => { assert.equal(actualEnv, env); calls.push('auth'); return { uid: 'fixture' }; },
      syncProductsPayloadWithRetry: async (actualEnv, ids, options) => {
        assert.equal(actualEnv, env); assert.deepEqual(plain(ids), ['fixture']);
        assert.equal(options.appScriptChunkSize, 2); calls.push('sync');
        if (fails) throw new Error('transport timeout');
        return { batches: 1 };
      },
      queueCatalogSheetSync: async (actualEnv, ids, error, actor) => {
        assert.equal(actualEnv, env); assert.deepEqual(plain(ids), ['fixture']);
        assert.equal(actor.uid, 'fixture'); assert.match(error.message, /timeout/); calls.push('queue'); return ['queued'];
      },
    });
    const response = await context.onRequest({ env, request: new Request('https://fixture.invalid/api/sheets-product-sync', {
      method: 'POST', headers: { origin: 'https://fixture.invalid' },
      body: JSON.stringify({ action: 'syncProducts', productIds: ['fixture'], idToken: 'fixture-token' }),
    }) });
    assert.equal(response.status, fails ? 202 : 200);
    assert.deepEqual(calls, fails ? ['auth', 'sync', 'queue'] : ['auth', 'sync']);
    const body = await response.json(); assert.equal(body.ok, !fails);
    if (fails) assert.equal(body.queued, true);
  });
}

function webhookFixture(product, { conflict = false } = {}) {
  const writes = []; let reads = 0;
  const context = loadModule('functions/api/sheets-products-webhook.js', {
    corsHeaders: () => ({}), sheetsInboundSecret: () => 'fixture',
    variantInventoryEntries, encodeFirestoreFields: value => value, decodeFirestoreFields: value => value,
    firestoreAdminGet: async () => { reads++; return product === null ? null : { fields: product, updateTime: 'version-1' }; },
    firestoreAdminCommit: async (_env, batch) => {
      if (conflict) throw Object.assign(new Error('Concurrent sale'), { status: 409 });
      writes.push(...plain(batch));
    },
    beginSheetsOperation: () => ({}), recordSheetsEvidence: async () => true,
  });
  return { writes, reads: () => reads, send: body => context.onRequestPost({ env: {}, request: new Request('https://fixture.invalid/webhook', {
    method: 'POST', headers: { 'X-Tintin-Sheets-Secret': 'fixture' }, body: JSON.stringify({ action: 'saveProduct', productId: 'fixture', ...body }),
  }) }, async () => true) };
}
const matrix = { stock: 3, variants: { Color: ['Dorado'] }, variantInventory: [{ variant: 'Dorado', stock: 3 }] };

test('aggregate edits cannot desynchronize variant quantities or purchased metadata', async () => {
  const f = webhookFixture(matrix);
  const r = await f.send({ changedFields: ['stock', 'purchased'], stock: 0, purchased: 0 });
  assert.equal(r.status, 409); assert.match((await r.json()).error, /variante/);
  assert.equal(f.reads(), 1); assert.deepEqual(f.writes, []);
});
test('Sheets cannot change option definitions of distributed inventory', async () => {
  const f = webhookFixture(matrix);
  assert.equal((await f.send({ changedFields: ['variants'], variants: { Color: ['Plateado'] } })).status, 409);
  assert.deepEqual(f.writes, []);
});
test('same aggregate total preserves matrix and includes atomic version precondition', async () => {
  const f = webhookFixture(matrix);
  assert.equal((await f.send({ changedFields: ['stock', 'purchased'], stock: 3, purchased: 5 })).status, 200);
  assert.deepEqual(f.writes[0].currentDocument, { updateTime: 'version-1' });
  assert.equal(f.writes[0].fields.stock, 3); assert.equal('variantInventory' in f.writes[0].fields, false);
  assert.equal(f.writes[1].fields.purchased, 5);
});
test('aggregate model uses a version precondition and new products require absence', async () => {
  for (const [product, condition] of [[{ stock: 3 }, { updateTime: 'version-1' }], [null, { exists: false }]]) {
    const f = webhookFixture(product);
    assert.equal((await f.send({ changedFields: ['stock'], stock: 0 })).status, 200);
    assert.deepEqual(f.writes[0].currentDocument, condition);
  }
});
test('concurrent sale rejects entire product/inventory commit', async () => {
  const f = webhookFixture({ stock: 3 }, { conflict: true });
  assert.equal((await f.send({ changedFields: ['stock', 'purchased'], stock: 4, purchased: 4 })).status, 409);
  assert.deepEqual(f.writes, []);
});
test('price-only edits preserve inventory without unnecessary stock read', async () => {
  const f = webhookFixture(matrix);
  assert.equal((await f.send({ changedFields: ['price'], price: 100 })).status, 200);
  assert.equal(f.reads(), 0); assert.deepEqual(Object.keys(f.writes[0].fields).sort(), ['price', 'updatedAt']);
});
test('malformed distributed inventory fails closed', async () => {
  const f = webhookFixture({ stock: 3, variantInventory: [] });
  assert.equal((await f.send({ changedFields: ['stock'], stock: 0 })).status, 400);
  assert.deepEqual(f.writes, []);
});

function apps() {
  const context = vm.createContext({ Date, JSON, SpreadsheetApp: { flush() {} } });
  for (const file of ['ProductosUnificados.gs', 'AdminParity.gs', 'Participacion.gs']) vm.runInContext(read(`apps-script/${file}`), context);
  return context;
}
test('external strings become literals while numbers, dates and booleans keep their types', () => {
  const c = apps();
  for (const value of ['=1+1', '+12', '-12', '@SUM(A1)', ' \t=1+1', '\n=IMPORTXML("x")']) assert.equal(c.tintinSheetLiteral_(value), "'" + value);
  for (const value of [0, 12, false, true, null, 'Texto normal', "'literal"]) assert.equal(c.tintinSheetLiteral_(value), value);
  const date = new Date(); assert.equal(c.tintinSheetLiteral_(date), date);
});
test('order, review and generic mirror write boundaries escape text without converting numbers', () => {
  const c = apps(); const written = [];
  const sheet = { getLastRow: () => 1, getRange: () => ({ setValues: rows => written.push(plain(rows)), clearContent() {} }) };
  c.tintinProductsSpreadsheet_ = () => ({ getSheetByName: () => sheet });
  c.tintinFindRow_ = () => null; c.tintinAplicarBordeFilaParticipacion_ = () => {};
  c.tintinParityUpsertOrder_('fixture', { notes: '=1+1', shipping: { address: '=2+2' }, total: 100 });
  c.tintinUpsert_(sheet, c.tintinReviewRow_({ reviewId: 'fixture', comment: '=3+3' }));
  c.tintinReplaceTabRows_('Usuarios web', 2, 2, [['fixture', '=4+4']]);
  assert.equal(written[0][0][16], "'=2+2"); assert.equal(written[0][0][29], "'=1+1"); assert.equal(written[0][0][19], 100);
  assert.equal(written[1][0][4], "'=3+3"); assert.equal(written[2][0][1], "'=4+4");
});
for (const stock of [0, 1, 7]) {
  test(`product mirror reflects canonical stock ${stock} despite stale purchased metadata`, () => {
    const c = apps(); const writes = new Map();
    const current = Array(35).fill(''); current[9] = 2; current[8] = 99;
    const sheet = { getRange: (_row, column) => ({
      getValues: () => [current], setValues: rows => writes.set(column, plain(rows[0])),
      setValue: value => writes.set(column, value), getDataValidations: () => [], clearDataValidations() {}, setDataValidations() {},
    }) };
    c.tintinPrepareNewProductRow_ = () => {}; c.tintinMarkRowPushInProgress_ = () => {};
    c.tintinWriteProductRow_(sheet, 7, { stock, description: '=1+1', price: 190000 }, { purchased: 99 });
    assert.equal(writes.get(9) - current[9], stock); assert.equal(writes.get(4)[2], 190000);
    assert.equal(writes.get(14)[7], "'=1+1");
    for (const column of [7, 8, 10, 11, 13]) assert.equal(writes.has(column), false, 'computed/manual columns preserved');
  });
}

test('native principal protection follows trusted snapshot identity after insertion/reorder, preserving ACL', () => {
  const c = apps(); c.SpreadsheetApp.ProtectionType = { RANGE: 'range' };
  const moved = [];
  const protection = { getDescription: () => 'Cuenta Super Admin protegida · identidad', isWarningOnly: () => false, canEdit: () => true, setRange: range => moved.push(range) };
  const sheet = { getProtections: () => [protection], getRange: (row, col, height, width) => ({ row, col, height, width }) };
  c.tintinProtectSuperAdminMirror_(sheet, [{ uid: 'other' }, { uid: 'principal', protectedAccount: true }]);
  c.tintinProtectSuperAdminMirror_(sheet, [{ uid: 'new' }, { uid: 'other' }, { uid: 'principal', protectedAccount: true }]);
  assert.deepEqual(moved, [{ row: 8, col: 2, height: 1, width: 11 }, { row: 9, col: 2, height: 1, width: 11 }]);
});
test('native protection does not guess a row or change permissions when identity/ACL is unverified', () => {
  const c = apps(); c.SpreadsheetApp.ProtectionType = { RANGE: 'range' };
  let moves = 0;
  for (const users of [[], [{ email: 'principal@example.test' }], [{ protectedAccount: true }, { protectedAccount: true }]]) {
    assert.throws(() => c.tintinProtectSuperAdminMirror_({}, users), /identificar/);
  }
  for (const warning of [false, true]) {
    const protection = { getDescription: () => 'Cuenta Super Admin protegida', isWarningOnly: () => warning, canEdit: () => false, setRange: () => moves++ };
    assert.throws(() => c.tintinProtectSuperAdminMirror_({ getProtections: () => [protection] }, [{ protectedAccount: true }]), /protección/);
  }
  assert.equal(moves, 0);
});
test('authenticated snapshot marks principal from canonical account contract, ignoring document-supplied flags', async () => {
  const context = loadModule('functions/api/sheets-sync-snapshot.js', {
    SUPERADMIN_EMAIL: 'principal@example.test', decodeFirestoreFields: value => value,
    firestoreAdminListAll: async () => [{ name: 'users/principal', fields: { email: ' Principal@Example.Test ', protectedAccount: false } }, { name: 'users/other', fields: { email: 'other@example.test', protectedAccount: true } }],
  });
  const users = await context.snapshot({}, 'users');
  assert.equal(users.find(x => x.uid === 'principal').protectedAccount, true);
  assert.equal(users.find(x => x.uid === 'other').protectedAccount, false);
});

for (const status of [409, 502]) {
  test(`Apps Script ${status === 409 ? 'does not retry a rejected aggregate or concurrent sale' : 'retries transient upstream failure once'}`, () => {
    const c = apps(); let calls = 0; let sleeps = 0;
    c.Utilities = { sleep: () => sleeps++ };
    c.tintinSendProductRow_ = () => { calls++; if (calls === 1) throw Object.assign(new Error('fixture'), { tintinHttpStatus: status }); return 'confirmed'; };
    if (status === 409) assert.throws(() => c.tintinSendProductRowWithRetry_({}, 7, ['stock']), /fixture/);
    else assert.equal(c.tintinSendProductRowWithRetry_({}, 7, ['stock']), 'confirmed');
    assert.equal(calls, status === 409 ? 1 : 2); assert.equal(sleeps, status === 409 ? 0 : 1);
  });
}
test('rejected paste restores existing rows from canonical stock, including previously accepted rows', () => {
  const c = apps(); const written = []; const names = [];
  c.tintinSnapshot_ = entity => { assert.equal(entity, 'products'); return [{ id: 'a', stock: 0, name: '=literal' }, { id: 'b', stock: 2, name: 'B' }]; };
  c.tintinWriteProductRow_ = (_sheet, row, product, inventory) => { written.push({ row, stock: product.stock }); assert.equal(product, inventory); };
  const sheet = { getRange: (row, col) => ({ getValues: () => [['a'], ['b']], setValue: value => names.push({ row, col, value }) }) };
  c.tintinRestoreProductConflict_(sheet, { getRow: () => 9, getNumRows: () => 2 });
  assert.deepEqual(written, [{ row: 9, stock: 0 }, { row: 10, stock: 2 }]);
  assert.equal(names[0].value, "'=literal");
});

test('new rows cannot bypass required product validation through changedFields', async () => {
  const f = webhookFixture(null);
  const r = await f.send({ productId: '', name: 'Only a name', changedFields: ['name'] });
  assert.equal(r.status, 400); assert.match((await r.json()).error, /categoria/);
  assert.deepEqual(f.writes, []); assert.equal(f.reads(), 0);
});
test('valid new rows keep full validation and save a complete inactive zero-stock product', async () => {
  const f = webhookFixture(null);
  const r = await f.send({ productId: '', name: 'Fixture', category: 'aros', price: 100, stock: 0, active: false, changedFields: ['name'] });
  assert.equal(r.status, 200);
  assert.equal(f.writes[0].fields.name, 'Fixture'); assert.equal(f.writes[0].fields.category, 'aros');
  assert.equal(f.writes[0].fields.price, 100); assert.equal(f.writes[0].fields.stock, 0); assert.equal(f.writes[0].fields.active, false);
  assert.deepEqual(f.writes[0].currentDocument, { exists: false });
});
