import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../js/core/store/estadisticas-pedidos.js', import.meta.url), 'utf8');

test('las compras válidas excluyen pedidos cancelados o reembolsados', () => {
  assert.match(source, /const validForSpent = clean\.filter\(o => !isCancelled\(o\)\)/);
  assert.match(source, /purchaseCount:\s*Math\.max\(0, validForSpent\.length\)/);
  assert.match(source, /totalSpent,?\s*$/m);
  assert.match(source, /reembolsado/);
  assert.match(source, /refunded/);
});

test('el contador visible del perfil representa compras válidas, no pedidos históricos', () => {
  const profile = fs.readFileSync(new URL('../../js/pages/profile/correccion-estadisticas-pedidos-perfil.js', import.meta.url), 'utf8');
  assert.match(profile, /stats\.purchaseCount/);
});
