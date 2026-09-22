import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('cloudflare/borrado-global-catalogo.js', 'utf8');

test('fallas de referencias sociales no bloquean el borrado canónico de productos', () => {
  assert.match(source, /optionalReferences\('reviews',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('reviewRecords',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('likeRecords',\s*runProductIdQuery/);
  assert.match(source, /optionalReferences\('reviewLikeProducts',\s*runProductIdQuery/);
});
