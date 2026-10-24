import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('el manifiesto excluye resultados efímeros de pruebas y cobertura', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/construir-manifiesto-diagnostico.js'), 'utf8');
  for (const directory of ['artifacts', 'coverage', 'playwright-report', 'test-results']) {
    assert.match(source, new RegExp(`['"]${directory}['"]`), `${directory} debe quedar excluido`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'diagnostic-manifest.json'), 'utf8'));
  const paths = (manifest.files || []).map(file => file.path);
  assert.equal(paths.some(file => /^(?:artifacts|coverage|playwright-report|test-results)\//.test(file)), false);
});

test('imports integrados de Node en bibliotecas universales no son archivos locales faltantes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'diagnostic-manifest.json'),'utf8'));
 const runtime=manifest.modules.find(module=>module.path==='vendor/onnxruntime-web-1.22.0/ort-wasm-simd-threaded.mjs');
 const builtins=runtime.imports.filter(dependency=>['module','worker_threads'].includes(dependency.raw));
 assert.equal(builtins.length,2);assert.ok(builtins.every(dependency=>dependency.target===null));
 const worker=manifest.modules.find(module=>module.path==='js/admin/products/vision-productos-worker.js');
 assert.ok(worker.imports.some(dependency=>dependency.target==='js/admin/products/vision-productos-core.mjs'));
 assert.ok(!manifest.missingReferences.some(reference=>/vision-productos|onnxruntime/.test(reference.page)));
});
