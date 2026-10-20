import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = fs.readFileSync(path.join(root, 'scripts/auditar-final-integracion.js'), 'utf8');

function auditIcon(src) {
  const messages = [];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  manifest.icons = [{ src, sizes: '192x192', type: 'image/png' }];
  const mockFs = { ...fs, readFileSync(file, ...args) {
    return path.resolve(file) === path.join(root, 'manifest.json')
      ? JSON.stringify(manifest) : fs.readFileSync(file, ...args);
  } };
  const stopped = new Error('audit exit');
  try {
    vm.runInNewContext(source, {
      require: name => name === 'fs' ? mockFs : path,
      __dirname: path.join(root, 'scripts'),
      console: { log: value => messages.push(value), error: () => {} },
      process: { env: {}, exit: () => { throw stopped; } },
    });
  } catch (error) { if (error !== stopped) throw error; }
  return messages.includes('OK — manifest es válido y sus iconos existen');
}

test('auditoría verifica el archivo real de íconos con versión y fragmento', () => {
  assert.equal(auditIcon('assets-tintin/images/admin/push-icon-192.png?v=release#icon'), true);
  assert.equal(auditIcon('assets-tintin/images/admin/push-icon-192.png'), true);
});

test('auditoría sigue rechazando íconos inexistentes o sin URL', () => {
  assert.equal(auditIcon('assets-tintin/images/admin/missing-icon.png?v=release'), false);
  assert.equal(auditIcon(undefined), false);
});
