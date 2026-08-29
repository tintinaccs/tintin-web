import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

test('estabilidad final mantiene las seis áreas y las nuevas superficies conectadas', () => {
  let output = '';
  assert.doesNotThrow(() => {
    output = execFileSync(process.execPath, [path.join(root, 'scripts/auditar-estabilidad-final-v1.mjs')], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  });
  assert.match(output, /AUDITORÍA ESTABILIDAD FINAL V1: OK/);
});
