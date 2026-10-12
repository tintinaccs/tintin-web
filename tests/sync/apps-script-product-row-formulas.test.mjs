import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../apps-script/ProductosUnificados.gs', import.meta.url), 'utf8');
const formulas = new Map([[7, '=RC[-1]-RC[-2]'], [8, '=RC[-1]/RC[-2]'],
  [11, '=IF(RC[-9]="","",N(RC[-2])-N(RC[-1]))'], [13, '=IF(RC[-2]<=N(RC[-1]),"Reponer","")']]);

function setup(lastRow, initial = new Map()) {
  const cells = new Map(initial);
  const copies = [];
  const sheet = {
    getLastRow: () => lastRow,
    getRange(row, column) {
      return {
        copyTo: (_target, type) => copies.push(type),
        getFormulaR1C1: () => row === 7 ? formulas.get(column) || '' : cells.get(column)?.formula || '',
        getFormula: () => cells.get(column)?.formula || '',
        getValue: () => cells.get(column)?.value ?? '',
        setFormulaR1C1: formula => cells.set(column, { formula }),
      };
    },
  };
  const context = vm.createContext({ SpreadsheetApp: { CopyPasteType: { PASTE_FORMAT: 'format', PASTE_DATA_VALIDATION: 'validation' } } });
  vm.runInContext(source, context);
  return { context, sheet, cells, copies };
}

test('a newly appended product inherits relative stock, margin and alert formulas and validation', () => {
  const { context, sheet, cells, copies } = setup(1047);
  context.tintinPrepareNewProductRow_(sheet, 1048);
  assert.deepEqual(copies, ['format', 'validation']);
  assert.equal(cells.get(11).formula, formulas.get(11));
  assert.equal(cells.get(13).formula, formulas.get(13));
  assert.equal(cells.get(7).formula, formulas.get(7));
});

test('retry repairs missing computed cells after identity was written, preserving existing formulas and manual values', () => {
  const { context, sheet, cells, copies } = setup(1048, new Map([
    [7, { formula: '=CUSTOM_MARGIN()' }], [8, { value: 0 }], [10, { value: 3 }],
  ]));
  context.tintinPrepareNewProductRow_(sheet, 1048);
  assert.deepEqual(copies, []);
  assert.equal(cells.get(11).formula, formulas.get(11));
  assert.equal(cells.get(13).formula, formulas.get(13));
  assert.equal(cells.get(7).formula, '=CUSTOM_MARGIN()');
  assert.equal(cells.get(8).value, 0);
  assert.equal(cells.get(10).value, 3);
});

for (const mode of ['payload', 'user-token']) {
  test(`${mode} prepares the new row before writing its identity`, () => {
    const { context } = setup(1047);
    const events = [];
    const sheet = { getLastRow: () => 1047, getRange: () => ({ setValues: () => events.push('identity') }) };
    Object.assign(context, {
      SUPER_ADMIN_EMAIL: 'qa@example.test',
      tintinParitySecretMatches_: () => true,
      verifyFirebaseIdToken_: () => ({ ok: true, email: 'qa@example.test' }),
      phase3EmailMatches_: () => true,
      phase3FetchDocument_: () => ({ ok: true, data: { name: 'QA', stock: 0, active: false } }),
      tintinProductsSpreadsheet_: () => ({ getSheetByName: () => sheet }),
      tintinBuildProductRowIndex_: () => ({}),
      tintinPrepareNewProductRow_: () => events.push('prepare'),
      tintinWriteProductRow_: () => events.push('write'),
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: () => ({ setMimeType() {} }) },
    });
    if (mode === 'payload') context.tintinSyncProductsFromPayload_({ items: [{ id: 'qa', exists: true, product: {} }] });
    else context.tintinSyncProductsFromFirestore_({ productIds: ['qa'], idToken: 'fixture' });
    assert.deepEqual(events, ['prepare', 'identity', 'write']);
  });
}
