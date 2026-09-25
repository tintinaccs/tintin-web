import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

const SYNC_MODULES = [
  'cloudflare/order-sheets-sync.js',
  'cloudflare/sincronizacion-participacion-sheets.js',
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
  const engagement = read('cloudflare/sincronizacion-participacion-sheets.js');
  const sent = [...engagement.matchAll(/action: '([A-Za-z]+)'/g)].map(match => match[1]);
  assert.deepEqual(sent.sort(), ['syncEngagement', 'syncEngagementBatch']);
  for (const action of sent) {
    assert.match(doPost, new RegExp(`body\\.action === '${action}'`), `doPost no enruta ${action}`);
  }
});
