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
