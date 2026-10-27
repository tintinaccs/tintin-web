import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');

test('el editor de productos agrupa la geometría de viewport a un frame', () => {
  const source = read('js/admin/products/interfaz-productos-adaptable.js');
  assert.match(source, /export function scheduleProductSurfaceSync\(\)/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /visualViewport\?\.addEventListener\('scroll',scheduleProductSurfaceSync,\{passive:true\}\)/);
  assert.doesNotMatch(source, /visualViewport\?\.addEventListener\('scroll',syncProductSurfaces/);
});

test('las galerías y filas largas evitan trabajo repetido fuera de pantalla', () => {
  const gallery = read('js/admin/products/galeria-unificada.js');
  const styles = read('css/admin/shopify-commerce-admin.css');
  assert.match(gallery, /function scheduleRender\(\)/);
  assert.match(gallery, /input\.addEventListener\(event,scheduleRender/);
  assert.match(styles, /\.tt-commercial-row[^\n]*content-visibility:auto/);
  assert.match(styles, /\.tt-unified-photo[^\n]*content-visibility:auto/);
});

test('el constructor y sus separadores limitan las actualizaciones a un frame', () => {
  const builder = read('js/admin/appearance/editor-visual-admin.js');
  const splitters = read('js/admin/appearance/workspace-splitters.js');
  assert.match(builder, /let previewFrame = 0/);
  assert.match(builder, /if \(previewFrame\) return/);
  assert.match(splitters, /if \(!frame\) frame = requestAnimationFrame\(applyMove\)/);
});
