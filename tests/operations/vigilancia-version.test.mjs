import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unknownRefs, versionedRefs, notifySiteContentChange, pageRevision } from '../../js/quality/vigilancia-version.js';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function el(tagName, attrs, { inside = null } = {}) {
  return {
    tagName,
    getAttribute: name => attrs[name] ?? null,
    closest: selector => (inside && selector.split(',').map(s => s.trim()).includes(inside) ? {} : null),
  };
}

const doc = elements => ({ querySelectorAll: () => elements });

test('el marcador selecciona únicamente la página abierta y conserva fallback para publicaciones anteriores', () => {
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  const data = { revision: b, pages: { 'index.html': a, 'admin.html': b, 'product.html': b } };
  for (const route of ['/', '/index', '/index.html', '/index/']) assert.equal(pageRevision(data, route), a);
  assert.equal(pageRevision(data, '/admin'), b);
  assert.equal(pageRevision(data, '/product.html'), b);
  assert.equal(pageRevision(data, '/pages/propia'), '');
  assert.equal(pageRevision({ revision: b }, '/'), '');
  assert.equal(pageRevision({ pages: { 'index.html': 'invalid' } }, '/'), '');
});

test('solo cuenta referencias same-origin con ?v= que se ejecutan', () => {
  const refs = versionedRefs(doc([
    el('SCRIPT', { src: 'js/cargador-pagina.js?v=tintin-20261004-location-consistency-1-repair-20261005-1-profile-wholesale-20261005-1' }),
    el('LINK', { href: '/css/base.css?v=tag-2' }),
    el('SCRIPT', { src: 'js/sin-version.js' }),
    el('SCRIPT', { src: 'https://www.gstatic.com/firebasejs/app.js?v=9' }),
    el('LINK', { href: 'css/noscript.css?v=tag-2' }, { inside: 'noscript' }),
    el('SCRIPT', { src: 'js/plantilla.js?v=tag-2' }, { inside: 'template' }),
  ]), 'https://tintinaccesorios.pages.dev/catalogo');

  assert.deepEqual(refs, [
    { raw: 'js/cargador-pagina.js?v=tintin-20261004-location-consistency-1-repair-20261005-1-profile-wholesale-20261005-1', href: 'https://tintinaccesorios.pages.dev/js/cargador-pagina.js?v=tintin-20261004-location-consistency-1-repair-20261005-1-profile-wholesale-20261005-1' },
    { raw: '/css/base.css?v=tag-2', href: 'https://tintinaccesorios.pages.dev/css/base.css?v=tag-2' },
  ]);
});

test('una versión nueva aparece como referencia desconocida; la misma versión no', () => {
  const fresh = [
    { raw: 'js/a.js?v=tag-2', href: 'https://x.dev/js/a.js?v=tag-2' },
    { raw: 'css/b.css?v=tag-1', href: 'https://x.dev/css/b.css?v=tag-1' },
  ];
  // Lo conocido puede venir como atributo literal del DOM o como URL absoluta
  // (entradas de performance de módulos importados dinámicamente).
  const known = new Set(['js/a.js?v=tag-1', 'https://x.dev/css/b.css?v=tag-1']);
  assert.deepEqual(unknownRefs(fresh, known), [fresh[0]]);
  known.add('https://x.dev/js/a.js?v=tag-2');
  assert.deepEqual(unknownRefs(fresh, known), []);
});

test('el aviso nunca borra datos del navegador ni recarga por su cuenta', () => {
  // Se ignoran los comentarios, que explican justamente qué no se toca.
  const source = read('js/quality/vigilancia-version.js').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.|document\.cookie|serviceWorker/);
  // Única recarga: el botón "Actualizar" que pulsa el usuario.
  assert.equal(source.match(/location\.reload\(/g)?.length, 1);
  assert.match(source, /update\.addEventListener\('click', \(\) => location\.reload\(\)\)/);
  assert.match(source, /cache: 'no-store'/);
});

test('el cargador lo inicia en ambos runtimes, fuera del checkout y de iframes', () => {
  const loader = read('js/cargador-pagina.js');
  assert.match(loader, /importSibling\('quality\/vigilancia-version\.js', 'Version Watch'(?:,\s*undefined,\s*'[\w.-]+')?\)/);
  assert.equal(loader.match(/^\s*bootVersionWatch\(\);/gm)?.length, 2);
  assert.match(loader, /if \(isVisualPreviewFrame \|\| framed\) return;/);
  assert.match(loader, /checkout\(\?:\\\.html\)\?\$/);
});

// La publicación de datos no representa una versión nueva de la aplicación.
test('los cambios de datos emiten la señal de sincronización sin acceder al DOM ni recargar', () => {
  const previous = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type) };
  try {
    notifySiteContentChange();
    assert.deepEqual(events, ['tintin:site-content-updated']);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
