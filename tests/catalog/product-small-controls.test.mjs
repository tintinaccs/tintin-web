import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const classic = fs.readFileSync(new URL('../../tienda.js', import.meta.url), 'utf8');
const copySource = classic.slice(classic.indexOf('async function _copyProductLink'), classic.indexOf('function _renderProductDetail'));

for (const mode of ['modern', 'fallback', 'denied', 'unsupported', 'throw']) test(`copiar producto confirma sólo un resultado real: ${mode}`, async () => {
  let removed = 0, appended = 0, copied;
  const context = vm.createContext({
    navigator: mode === 'modern' || mode === 'denied' ? { clipboard: { async writeText(url) { if(mode === 'denied') throw new Error('denied'); copied = url; } } } : {},
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() { removed++; } }),
      body: { appendChild() { appended++; } },
      execCommand(command) { assert.equal(command, 'copy'); if(mode === 'throw') throw new Error('unsupported'); return mode === 'fallback'; },
    },
  });
  vm.runInContext(copySource, context);
  const attempt = context._copyProductLink('https://example.invalid/product?id=fixture');
  if (['denied', 'unsupported', 'throw'].includes(mode)) await assert.rejects(attempt);
  else await attempt;
  if(mode === 'modern') assert.equal(copied, 'https://example.invalid/product?id=fixture');
  assert.equal(removed, appended); // nunca quedan textareas invisibles después de fallar
});

test('la línea del carrito no ofrece favoritos y conserva el nombre escapado después de cada repintado', () => {
  const elements = new Map(), listeners = new Map();
  for (const id of ['tinsel-root', 'tinsel-items', 'tinsel-footer', 'tinsel-count', 'tinsel-total-head', 'tinsel-total-footer']) elements.set(id, { style: {}, textContent: '', innerHTML: '', addEventListener() {} });
  vm.runInNewContext(fs.readFileSync(new URL('../../js/pages/product/seleccion-producto.js', import.meta.url), 'utf8'), {
    document: { getElementById: id => elements.get(id), addEventListener() {} },
    window: {
      syncCartWithCatalog: () => [{ id: 'fixture', name: 'Aro "rosa" & más', qty: 1, price: 1000 }],
      addEventListener(type, fn) { listeners.set(type, fn); },
    },
  });
  const html = () => elements.get('tinsel-items').innerHTML;
  assert.match(html(), /Aro &quot;rosa&quot; &amp; más/);
  assert.doesNotMatch(html(), /favorit/i);
  assert.doesNotMatch(html(), /aria-pressed/);
});
