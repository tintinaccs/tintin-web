import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = fs.readFileSync(path.join(root, 'js/core/store/editor-visual-runtime.js'), 'utf8');
const serverCore = fs.readFileSync(path.join(root, 'cloudflare/visual-builder-core.js'), 'utf8');
const contentContract = await import('../../js/core/store/esquema-contenido.js');

test('runtime visual conserva rutas públicas limpias y compatibilidad con aliases legados', () => {
  assert.match(runtime, /CLEAN_VISUAL_ROUTES/);
  assert.match(runtime, /'catalogo\.html': '\/catalogo'/);
  assert.match(runtime, /'product\.html': '\/product'/);
  assert.match(runtime, /link\.href = `\/product\?id=/);
  assert.match(runtime, /\? '\/collections' : `\/catalogo\?cat=/);
  assert.doesNotMatch(runtime, /link\.href = `product\.html\?id=/);
  assert.doesNotMatch(runtime, /\? 'collections\.html'/);
  assert.doesNotMatch(runtime, /return 'catalogo\.html'/);
});

test('contenido editable proyecta aliases históricos como rutas canónicas', () => {
  assert.equal(contentContract.sanitizeContentHref('catalogo.html'), '/catalogo');
  assert.equal(contentContract.sanitizeContentHref('/about.html'), '/about');
  assert.equal(contentContract.sanitizeContentHref('product.html?id=abc'), '/product?id=abc');
  assert.equal(contentContract.sanitizeContentHref('javascript:alert(1)', '/catalogo'), '/catalogo');
  assert.equal(contentContract.sanitizeContentHref('https://example.com/path'), 'https://example.com/path');
});

test('la fachada conserva la normalización histórica del hero', () => {
  assert.equal(
    contentContract.normalizeContentValue('index', 'hero', 'title', 'TU BRILLO, TÚ ESTILO'),
    'TU BRILLO, TU ESTILO'
  );
  assert.equal(
    contentContract.normalizeContentValue('index', 'hero', 'subtitle', 'TÚ ESTILO'),
    'TÚ ESTILO'
  );
});

test('cliente y backend mantienen allowlists explícitos de rutas visuales', () => {
  assert.match(runtime, /sanitizeContentHref\(href, ''\)/);
  assert.match(serverCore, /CLEAN_INTERNAL_ROUTES/);
  assert.match(serverCore, /safeVisualHref/);
  assert.match(serverCore, /safeExternalHref|normalizeInternalHref/);
});
