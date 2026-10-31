import test from 'node:test';
import assert from 'node:assert/strict';
import bundleModule from '../../scripts/lib/estilos-inicio.js';
const { bundleHomeStyles, restoreStyleSources, rebaseCss } = bundleModule;

test('conserva orden, media queries, IDs y URLs relativas de cada hoja', () => {
  const html = '<html><head>\n  <link id="first" rel="stylesheet" href="css/a.css?v=1">\n  <link id="second" media="(max-width: 767px)" rel="stylesheet" href="css/b.css?v=2">\n</head><body></body></html>';
  const files = { 'css/a.css': '.a{background:url(../assets/a.webp)}', 'css/b.css': '.b{color: red}' };
  const result = bundleHomeStyles(html, file => files[file]);
  assert.match(result.css, /url\("\/assets\/a.webp"\)/);
  assert.match(result.css, /@media \(max-width: 767px\) \{\n\.b\{color: red\}/);
  assert.ok(result.css.indexOf('.a{') < result.css.indexOf('.b{'));
  assert.match(result.html, /id="first"[^>]+disabled data-tt-style-bundle=/);
  assert.match(result.html, /id="second"[^>]+disabled data-tt-style-bundle=/);
  assert.deepEqual(bundleHomeStyles(result.html, file => files[file]), result);
  assert.equal(restoreStyleSources(result.html), html);
  assert.notEqual(bundleHomeStyles(html, file => files[file] + '/* cambio */').version, result.version);
});

test('no altera URLs absolutas, datos ni referencias locales SVG', () => {
  const css = '.a{a:url(#filter);b:url("data:image/svg+xml,<svg/>");c:url(https://example.test/a);d:url(/assets/a)}';
  assert.equal(rebaseCss(css, 'css/a.css'), css);
  assert.throws(() => rebaseCss(`@import "other${'.css'}";`, 'css/a.css'), /no combinable/);
});

test('Nosotros reutiliza el empaquetado con identidad independiente, reversible e idempotente',()=>{
 const html='<html><head>\n  <link id="about" rel="stylesheet" href="css/about.css?v=1">\n</head><body></body></html>';
 const options={id:'tt-about-css-bundle',file:'css/generated/nosotros.css',versionPrefix:'tintin-about'};
 const result=bundleHomeStyles(html,()=>'.about{color:pink}',options);
 assert.match(result.html,/id="tt-about-css-bundle" href="css\/generated\/nosotros\.css\?v=tintin-about-/);
 assert.match(result.html,/data-tt-style-bundle="tt-about-css-bundle"/);
 assert.deepEqual(bundleHomeStyles(result.html,()=>'.about{color:pink}',options),result);
 assert.equal(restoreStyleSources(result.html,options.id),html);
});

test('corta el empaquetado en estilos en línea y hojas con integridad para conservar la cascada', () => {
  const html = '<html><head>\n  <link rel="stylesheet" href="css/a.css">\n  <link rel="stylesheet" href="/js/vendor/x.css" integrity="sha384-x" crossorigin="anonymous">\n  <link rel="stylesheet" href="css/b.css">\n  <style>.inline{color:red}</style>\n  <link rel="stylesheet" href="css/c.css">\n</head><body></body></html>';
  const files = { 'css/a.css': '.a{}', 'css/b.css': '.b{}', 'css/c.css': '.c{}' };
  const options = { id: 'tt-page-css-bundle', file: 'css/generated/pagina.css', versionPrefix: 'tintin-page' };
  const result = bundleHomeStyles(html, file => files[file], options);
  assert.deepEqual(result.bundles.map(bundle => [bundle.id, bundle.file, bundle.entries.map(entry => entry.file)]), [
    ['tt-page-css-bundle', 'css/generated/pagina.css', ['css/a.css']],
    ['tt-page-css-bundle-2', 'css/generated/pagina-2.css', ['css/b.css']],
    ['tt-page-css-bundle-3', 'css/generated/pagina-3.css', ['css/c.css']],
  ]);
  const order = ['id="tt-page-css-bundle"', 'integrity="sha384-x"', 'id="tt-page-css-bundle-2"', '<style>', 'id="tt-page-css-bundle-3"'].map(part => result.html.indexOf(part));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(!order.includes(-1));
  assert.match(result.html, /rel="stylesheet" href="\/js\/vendor\/x\.css" integrity="sha384-x"/);
  assert.deepEqual(bundleHomeStyles(result.html, file => files[file], options), result);
  assert.equal(restoreStyleSources(result.html, options.id), html);
});
