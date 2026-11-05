import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBlock, moveSection } from '../../js/core/store/orden-casillas.js';

const schema = {
  allowTopBlocks: true,
  sections: {
    hero: { movable: true, blockAnchor: true },
    trust: { movable: true, blockAnchor: true },
    reviews: { movable: true, blockAnchor: true },
    fixed: { movable: false, blockAnchor: false },
    footer: { movable: false, global: true },
  },
};
const order = ['hero', 'trust', 'fixed', 'reviews', 'footer'];

test('subir, bajar, tope y final de secciones respetan las fijas', () => {
  assert.deepEqual(moveSection(schema, order, 'trust', 'up'), ['trust', 'hero', 'fixed', 'reviews', 'footer']);
  assert.deepEqual(moveSection(schema, order, 'hero', 'bottom'), ['trust', 'reviews', 'fixed', 'hero', 'footer']);
  assert.deepEqual(moveSection(schema, order, 'reviews', 'top'), ['reviews', 'hero', 'fixed', 'trust', 'footer']);
  assert.equal(moveSection(schema, order, 'hero', 'up'), order);
  assert.equal(moveSection(schema, order, 'fixed', 'down'), order);
  assert.equal(moveSection(schema, order, 'footer', 'top'), order);
});

const b = (id, afterSection) => ({ id, afterSection });
test('bloques: top, bottom, up y down cruzan secciones', () => {
  const blocks = [b('a', 'hero'), b('b', 'hero'), b('c', 'trust')];
  const ids = list => list.map(x => `${x.afterSection}:${x.id}`);
  assert.deepEqual(ids(moveBlock(schema, order, blocks, 'c', 'top')), ['__top__:c', 'hero:a', 'hero:b']);
  assert.deepEqual(ids(moveBlock(schema, order, blocks, 'a', 'bottom')), ['hero:b', 'trust:c', 'reviews:a']);
  assert.deepEqual(ids(moveBlock(schema, order, blocks, 'b', 'up')), ['hero:b', 'hero:a', 'trust:c']);
  assert.deepEqual(ids(moveBlock(schema, order, blocks, 'b', 'down')), ['hero:a', 'trust:b', 'trust:c']);
  assert.deepEqual(ids(moveBlock(schema, order, blocks, 'a', 'up')), ['__top__:a', 'hero:b', 'trust:c']);
});

test('sin ancla superior permitida el bloque no sube más allá de la primera sección', () => {
  const closed = { ...schema, allowTopBlocks: false };
  const out = moveBlock(closed, order, [b('a', 'hero')], 'a', 'top');
  assert.equal(out[0].afterSection, 'hero');
});
