import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const ATOMIC_VERSION = 'tintin-20260909-navigation-atomic-1';

test('el shell público no mezcla entry nuevo con dependencias ESM sin versión', () => {
  const entry = read('js/components/navigation/entrada-navegacion-publica.js');
  const bootstrap = read('js/inicio-navegacion-publica.js');
  const iconConsumers = [
    'js/components/navigation/escritorio/encabezado-escritorio.js',
    'js/components/navigation/tableta/encabezado-tableta.js',
    'js/components/navigation/movil/encabezado-movil.js',
    'js/components/navigation/compartido/panel-busqueda.js',
    'js/components/navigation/compartido/panel-carrito.js',
    'js/components/navigation/compartido/panel-cuenta.js',
    'js/components/navigation/compartido/panel-colecciones.js',
  ];

  assert.match(bootstrap, new RegExp(`ENTRY_VERSION = '${ATOMIC_VERSION}'`));
  assert.ok([...entry.matchAll(/^import .+ from ['"]([^'"]+)['"];?$/gm)]
    .every(([, source]) => source.includes(`?v=${ATOMIC_VERSION}`)),
  'cada dependencia estática del entry debe llevar la revisión atómica');

  for (const path of iconConsumers) {
    assert.match(read(path), new RegExp(`iconos\\.js\\?v=${ATOMIC_VERSION}`), path);
  }
});
