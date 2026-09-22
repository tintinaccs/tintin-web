import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('las tarjetas de colecciones de inicio son enlaces nativos y apuntan al filtro canónico', () => {
  const carousel = read('js/pages/home/carrusel-colecciones.js');

  assert.match(carousel, /link\.href = collectionHref\(collection\.slug\)/);
  assert.match(carousel, /link\.dataset\.noTransition = ['"]true['"]/);
  assert.match(carousel, /function collectionHref\(slug\) \{[\s\S]*?\/catalogo\?cat=/);
  assert.doesNotMatch(carousel, /window\.location\.assign\(card\.href\)/);
  assert.match(carousel, /Date\.now\(\) < this\.suppressClickUntil\) event\.preventDefault\(\)/);
});
