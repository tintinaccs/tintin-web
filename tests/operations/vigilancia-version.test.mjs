import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unknownRefs, versionedRefs } from '../../js/quality/vigilancia-version.js';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function el(tagName, attrs, { inside = null } = {}) {
  return {
    tagName,
    getAttribute: name => attrs[name] ?? null,
    closest: selector => (inside && selector.split(',').map(s => s.trim()).includes(inside) ? {} : null),
  };
}

const doc = elements => ({ querySelectorAll: () => elements });

test('solo cuenta referencias same-origin con ?v= que se ejecutan', () => {
  const refs = versionedRefs(doc([
    el('SCRIPT', { src: 'js/cargador-pagina.js?v=tag-2' }),
    el('LINK', { href: '/css/base.css?v=tag-2' }),
    el('SCRIPT', { src: 'js/sin-version.js' }),
    el('SCRIPT', { src: 'https://www.gstatic.com/firebasejs/app.js?v=9' }),
    el('LINK', { href: 'css/noscript.css?v=tag-2' }, { inside: 'noscript' }),
    el('SCRIPT', { src: 'js/plantilla.js?v=tag-2' }, { inside: 'template' }),
  ]), 'https://tintinaccesorios.pages.dev/catalogo');

  assert.deepEqual(refs, [
    { raw: 'js/cargador-pagina.js?v=tag-2', href: 'https://tintinaccesorios.pages.dev/js/cargador-pagina.js?v=tag-2' },
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
  assert.match(loader, /importSibling\('quality\/vigilancia-version\.js', 'Version Watch'\)/);
  assert.equal(loader.match(/^\s*bootVersionWatch\(\);/gm)?.length, 2);
  assert.match(loader, /if \(isVisualPreviewFrame \|\| framed\) return;/);
  assert.match(loader, /checkout\(\?:\\\.html\)\?\$/);
});
