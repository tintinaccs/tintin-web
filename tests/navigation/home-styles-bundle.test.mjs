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
