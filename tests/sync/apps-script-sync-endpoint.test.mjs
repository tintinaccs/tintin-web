import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

const SYNC_MODULES = [
  'cloudflare/order-sheets-sync.js',
  'cloudflare/sincronizacion-participacion-sheets.js',
  'cloudflare/resiliencia-sync-participacion.js',
  'cloudflare/system-health.js',
];

test('Toda sincronización servidor→Sheets usa el único Web App canónico', () => {
  for (const file of SYNC_MODULES) {
    const source = read(file);
    assert.match(source, /import \{[^}]*APPS_SCRIPT_SYNC_URL[^}]*\} from ['"]\.\/sheets-sync-config\.js['"]/, `${file} debe importar APPS_SCRIPT_SYNC_URL`);
    assert.doesNotMatch(source, /script\.google\.com\/macros\/s\//, `${file} no debe fijar su propio deployment`);
  }
});

test('El doPost canónico enruta cada acción que envía Cloudflare', () => {
  const doPost = read('apps-script/ProductosUnificados.gs').match(/function doPost\(e\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(doPost, 'doPost de ProductosUnificados.gs no encontrado');
  const engagement = read('cloudflare/sincronizacion-participacion-sheets.js')
    + read('cloudflare/resiliencia-sync-participacion.js');
  const sent = [...engagement.matchAll(/action: '([A-Za-z]+)'/g)].map(match => match[1]);
  assert.deepEqual(sent.sort(), ['syncEngagement', 'syncEngagementBatch']);
  for (const action of sent) {
    assert.match(doPost, new RegExp(`body\\.action === '${action}'`), `doPost no enruta ${action}`);
  }
});
import vm from 'node:vm';

for (const failOtherColumn of [false, true]) {
  test(`Materiales combinados conserva la validación después de ${failOtherColumn ? 'un rechazo' : 'la escritura'}`, () => {
    const rule = [[{ dropdown: ['Acero', 'Plata'] }, null, { dropdown: ['Oro', 'Plata'] }, ...Array(9).fill(null)]];
    let validation = rule;
    let written;
    let flushed = false;
    const material = {
      getDataValidations: () => validation,
      clearDataValidations: () => { validation = null; },
      setDataValidations: value => { validation = value; },
    };
    const sheet = {
      getRange(row, column, height, width) {
        if (column === 23) {
          assert.equal(width, 12);
          return material;
        }
        return {
          getValues: () => [Array(35).fill('')],
          setValue() {},
          setValues(values) {
            if (column !== 14) return;
            assert.equal(validation, null);
            if (failOtherColumn) throw new Error('Otra columna inválida');
            written = values[0];
          },
        };
      },
    };
    const context = vm.createContext({ SpreadsheetApp: { flush: () => { flushed = true; } } });
    vm.runInContext(read('apps-script/ProductosUnificados.gs'), context);
    context.tintinPrepareNewProductRow_ = () => {};
    context.tintinMarkRowPushInProgress_ = () => {};
    const write = () => context.tintinWriteProductRow_(sheet, 7, { material: 'Acero, Plata', colorFinish: 'Oro, Plata' }, {});
    if (failOtherColumn) assert.throws(write, /Otra columna inválida/);
    else {
      write();
      assert.equal(written[9], 'Acero, Plata');
      assert.equal(written[11], 'Oro, Plata');
      assert.equal(flushed, true);
    }
    assert.equal(validation, rule);
  });
}

test('La excepción de Sheets retorna JSON rechazado y oculta las credenciales', () => {
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType(type) { this.type = type; return this; } }),
    },
  });
  vm.runInContext(read('apps-script/ProductosUnificados.gs'), context);
  context.tintinHandleUnifiedProductsPost_ = () => { throw new Error('Error de la hoja credential-fixture token-fixture'); };
  const response = context.doPost({ postData: { contents: JSON.stringify({ action: 'syncProductsPayload', secret: 'credential-fixture', idToken: 'token-fixture' }) } });
  assert.equal(response.type, 'application/json');
  const result = JSON.parse(response.text);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'products_sync_failed');
  assert.match(result.error, /Error de la hoja/);
  assert.doesNotMatch(response.text, /credential-fixture|token-fixture/);
});

test('El rechazo de autenticación no se transforma en éxito ni accede a la hoja', () => {
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType(type) { this.type = type; return this; } }),
    },
  });
  vm.runInContext(read('apps-script/ProductosUnificados.gs'), context);
  context.tintinParitySecretMatches_ = () => false;
  context.tintinProductsSpreadsheet_ = () => { assert.fail('Una solicitud no autorizada no puede leer la hoja'); };
  const response = context.doPost({ postData: { contents: JSON.stringify({ action: 'syncProductsPayload', items: [] }) } });
  assert.deepEqual(JSON.parse(response.text), { ok: false, error: 'No autorizado' });
});
