import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('parse5');
const source = fs.readFileSync(new URL('../../scripts/sincronizar-inicio-navegacion-publica.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function ensureSectionFlow('), source.indexOf('function ensurePublicStructuralStyles('));
const context = vm.createContext({ parse });
vm.runInContext(code, context);
const apply = context.ensureSectionFlow;

test('generador reemplaza el nodo completo y conserva scripts ajenos de manera idempotente', () => {
  const original = '<!doctype html><html><head><script id="other">window.example = 1;</script><script defer id="tt-section-flow-runtime">/* <script> */ old();</script></head><body><section>Contenido</section></body></html>';
  const next = apply(original);
  assert.equal((next.match(/id="tt-section-flow-runtime"/g) || []).length, 1);
  assert.ok(!next.includes('old();'));
  assert.ok(next.includes('<script id="other">window.example = 1;</script>'));
  assert.ok(next.includes('<section>Contenido</section>'));
  assert.equal(apply(next), next);
});

test('redirecciones no cargan runtime y 404 conserva la URL absoluta', () => {
  const stub = '<html><head><meta http-equiv="refresh" content="0; url=/about"></head><body>Redirección</body></html>';
  assert.equal(apply(stub), stub);
  assert.ok(apply('<html><head></head><body>404</body></html>', true).includes('src="/js/theme/alternancia-secciones.js'));
});
