import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('prepara Mayoristas en la planilla canónica sin depender de una planilla activa', () => {
  let locked = false;
  let released = false;
  let headers;
  let frozenRows;
  const range = { setValues: value => { headers = value; return range; }, setFontWeight: () => range };
  const sheet = { getLastRow: () => 0, getName: () => 'Mayoristas', getRange: () => range, setFrozenRows: value => { frozenRows = value; } };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('No hay planilla activa'); } },
    tintinProductsSpreadsheet_: () => ({ getSheetByName: () => null, insertSheet: name => { assert.equal(name, 'Mayoristas'); return sheet; } }),
    LockService: { getScriptLock: () => ({ waitLock: () => { locked = true; }, releaseLock: () => { released = true; } }) },
  });
  vm.runInContext(fs.readFileSync(new URL('../../apps-script/Mayoristas.gs', import.meta.url), 'utf8'), context);
  assert.equal(context.tintinPrepararMayoristas().ok, true);
  assert.equal(headers[0].length, 18);
  assert.equal(frozenRows, 1);
  assert.equal(locked && released, true);
});

test('el espejo de mayoristas guarda textos externos sin ejecutar fórmulas y conserva los importes', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../../apps-script/Mayoristas.gs', import.meta.url), 'utf8'), context);
  const row = context.tintinWholesaleRow_('WQ_fixture_123456', {
    customerName: '=IMPORTXML("https://evil.example", "//a")',
    businessName: 'Bella', whatsapp: '+595912345678', city: 'Luque',
    notes: '\t=1+1', adminNote: '@SUM(1)', total: 150000,
    items: [{ name: '=1+1', qty: 2, unitPrice: 75000 }], itemCount: 2,
  });
  assert.equal(row[5], '\'=IMPORTXML("https://evil.example", "//a")');
  assert.equal(row[7], 'Bella');
  assert.equal(row[8], "'+595912345678");
  assert.equal(row[9], 'Luque');
  assert.equal(row[13], 150000);
  assert.equal(row[14], "'=1+1 x2 — Gs. 75000 c/u");
  assert.equal(row[15], "'\t=1+1");
  assert.equal(row[16], "'@SUM(1)");
});
