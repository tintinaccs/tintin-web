import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unknownRefs, versionedRefs, notifySiteContentChange, pageRevision, changedLoadedResources } from '../../js/quality/vigilancia-version.js';
import { visualSource, clientResourcePath } from '../../js/quality/revision-visual.mjs';

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

test('el cargador lo inicia globalmente en ambos runtimes, incluido checkout y fuera de previews/iframes', () => {
  const loader = read('js/cargador-pagina.js');
  assert.match(loader, /importSibling\('quality\/vigilancia-version\.js', 'Version Watch'(?:,\s*undefined,\s*'[\w.-]+')?\)/);
  assert.equal(loader.match(/^\s*bootVersionWatch\(\);/gm)?.length, 2);
  assert.match(loader, /if \(isVisualPreviewFrame \|\| framed\) return;/);
  assert.doesNotMatch(loader.slice(loader.indexOf('function bootVersionWatch()'), loader.indexOf('function bootHeaderScrollHide()')), /checkout.*return/);
});

test('propagar versiones de imports y del loader no altera su identidad visual', () => {
  const source = `<script src="js/cargador-pagina.js?v=antes"></script>\nconst v='tintin-20261020-anterior-1'; import '../../js/quality/vigilancia-version.js?v=antes';`;
  assert.equal(visualSource(source), visualSource(source.replaceAll('antes', 'despues').replace('tintin-20261020-anterior-1', 'tintin-20261021-otra-1')));
  assert.notEqual(visualSource(source), visualSource(source + '\nbutton.textContent="Guardar";'));
  for (const url of ['https://youtube.com/watch?v=video1', 'https://cdn.test/library.js?v=1', '/assets/foto.png?v=1']) assert.notEqual(visualSource(`src="${url}"`), visualSource(`src="${url.replace(/1$/, '2')}"`));
  assert.equal(visualSource('<head>\n<meta name="tintin-page-revision" content="abc">\n<title>Tintin</title>'), '<head>\n<title>Tintin</title>');
});

test('los recursos del servidor y terceros no forman parte de la interfaz cargada', () => {
  for (const ref of ['/functions/api/product.js?v=1', '/cloudflare/product.js?v=1', '/scripts/build.js?v=1', 'https://other.test/a.js?v=1', '/api/products', '/a.js']) assert.equal(clientResourcePath(ref, 'https://version.test/'), '');
  assert.equal(clientResourcePath('/js/admin/admin-app.js?v=1', 'https://version.test/'), 'js/admin/admin-app.js');
});

test('un cambio de otra pantalla no avisa aunque cambie la publicación global', async () => {
  const revision = 'a'.repeat(64), next = 'b'.repeat(64);
  const data = { schemaVersion: 2, clientResources: { 'js/home.js': { version:'1', revision }, 'js/product.js': { version:'2', revision:next } } };
  const digest = () => assert.fail('no descarga recursos que siguen en su versión inmutable');
  assert.deepEqual(await changedLoadedResources(data, ['https://version.test/js/home.js?v=1'], 'https://version.test/', digest), []);
});

test('distingue una propagación de tags de un cambio real de recurso cargado', async () => {
  const revision = 'a'.repeat(64), next = 'b'.repeat(64);
  const data = { schemaVersion:2, clientResources:{ 'js/loader.js':{version:'2',revision}, 'css/product.css':{version:'2',revision:next} } };
  assert.deepEqual(await changedLoadedResources(data, ['/js/loader.js?v=1'], 'https://version.test/', async () => revision), []);
  assert.deepEqual(await changedLoadedResources(data, ['/js/loader.js?v=1','/css/product.css?v=1'], 'https://version.test/', async () => revision), [`css/product.css:${next}`]);
  assert.deepEqual(await changedLoadedResources(data, ['/css/product.css?v=1'], 'https://version.test/', async () => ''), []);
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
