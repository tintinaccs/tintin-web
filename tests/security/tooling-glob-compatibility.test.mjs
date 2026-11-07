import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('glob actualizado mantiene las búsquedas de Firebase CLI y el archivador', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-glob-compat-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'fixture.json'), '{}');
    fs.writeFileSync(path.join(root, 'firebase-debug.log'), 'ignored');
    assert.deepEqual(require('firebase-tools/lib/listFiles.js').listFiles(root), ['src/fixture.json']);
    assert.deepEqual(require('archiver-utils').file.expand({ cwd: root }, ['**/*.json']), ['src/fixture.json']);
    assert.deepEqual(await require('glob').glob('**/*.json', { cwd: root }), ['src/fixture.json']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
