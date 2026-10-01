import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'js/admin/admin-app.js'), 'utf8');

test('el historial de precio y stock conserva antes/después en la auditoría canónica', () => {
  assert.match(source, /entry\.productHistory = meta\.productHistory/);
  assert.match(source, /priceBefore: oldProd\?\.price/);
  assert.match(source, /priceAfter: data\.price/);
  assert.match(source, /stockBefore: oldProd\?\.stock/);
  assert.match(source, /stockAfter: data\.stock/);
  assert.match(source, /createdAt: serverTimestamp\(\)/);
});

test('las acciones masivas también capturan valores anteriores y posteriores', () => {
  assert.match(source, /const productHistory = ids\.map\(id =>/);
  assert.match(source, /Stock → \$\{stock\}.*productHistory/s);
  assert.match(source, /Precio → \$\{formatPrice\(price\)\}.*productHistory/s);
});
