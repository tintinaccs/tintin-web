import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('la vista previa no modifica la persistencia de Auth de la pestaña principal', () => {
  const loader = read('js/cargador-pagina.js');
  const navigation = read('js/core/auth/navegacion-autenticacion.js');
  const sharedNavigation = read('js/components/navigation/compartido/carga-navegacion.js');

  assert.match(loader, /const isVisualPreviewFrame = new URLSearchParams\(window\.location\.search\)\.get\('ttVisualPreview'\) === '1'/);
  assert.match(loader, /window\.__TINTIN_AUTH_PERSISTENCE_READY__ = Promise\.resolve\(false\)/);
  assert.match(loader, /function bootSiteActivity\(\) \{\s*if \(isVisualPreviewFrame\) return;/);
  assert.match(navigation, /const IS_VISUAL_PREVIEW_FRAME = new URLSearchParams\(window\.location\.search\)\.get\('ttVisualPreview'\) === '1'/);
  assert.match(navigation, /if\(IS_LOGIN_PAGE\|\|IS_VISUAL_PREVIEW_FRAME\)return/);
  assert.match(sharedNavigation, /if \(IS_VISUAL_PREVIEW_FRAME\) return Promise\.resolve\(null\);/);
  assert.match(sharedNavigation, /if \(IS_VISUAL_PREVIEW_FRAME\) return;/);
});
