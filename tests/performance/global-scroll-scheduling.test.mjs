import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');

test('las superficies públicas agrupan el trabajo de scroll en un frame', () => {
  const store = read('tienda.js');
  const studio = read('js/core/store/visual-studio-global-runtime.js');

  assert.match(store, /const schedule = \(\) => \{ if \(!frame\) frame = requestAnimationFrame\(onScroll\); \};/);
  assert.match(store, /window\.addEventListener\('scroll', schedule, \{ passive: true \}\);/);
  assert.match(store, /const schedule = \(\) => \{ if \(!frame\) frame = requestAnimationFrame\(update\); \};/);
  assert.match(studio, /const schedule = \(\) => \{ if \(!fired && !frame\) frame = requestAnimationFrame\(handler\); \};/);
  assert.match(studio, /window\.addEventListener\('scroll', schedule, \{ passive: true \}\); handler\(\); return;/);
});

test('los avisos compartidos y Pedidos no recalculan geometría por cada evento', () => {
  const notice = read('js/quality/vigilancia-version.js');
  const orders = read('js/admin/orders/tablero-pedidos-vista.mjs');

  assert.match(notice, /const schedulePlace = \(\) => \{ if \(!placeFrame\) placeFrame = requestAnimationFrame\(place\); \};/);
  assert.match(notice, /visualViewport\?\.addEventListener\('scroll', schedulePlace, \{ passive: true \}\);/);
  assert.match(orders, /const scheduleUpdate = \(\) => \{/);
  assert.match(orders, /window\.visualViewport\?\.addEventListener\('scroll', scheduleUpdate, \{ passive: true \}\);/);
  assert.doesNotMatch(orders, /window\.visualViewport\?\.addEventListener\('scroll', update/);
});

