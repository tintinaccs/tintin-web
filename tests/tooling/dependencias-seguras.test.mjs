import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Usa la misma resolución CommonJS que Firebase CLI, no otra copia del watcher.
const rootRequire = createRequire(import.meta.url);
const firebasePackage = 'firebase-tools';
const firebaseRequire = createRequire(rootRequire.resolve(firebasePackage));
const watcherPackage = 'chokidar';
const chokidar = firebaseRequire(watcherPackage);

test('el watcher de Firebase CLI observa cambios en un archivo literal y puede cerrarse', { timeout: 10000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tintin-rules-watcher-'));
  const file = path.join(directory, 'firestore.rules');
  await fs.writeFile(file, 'rules_version = "2";\n');
  const watcher = chokidar.watch(file, { persistent: true, ignoreInitial: true });
  try {
    assert.ok(watcher instanceof chokidar.FSWatcher, 'API CommonJS que usa Firebase CLI');
    await new Promise((resolve, reject) => { watcher.once('ready', resolve); watcher.once('error', reject); });
    const changed = new Promise((resolve, reject) => {
      watcher.once('change', changedFile => { try { assert.equal(path.resolve(changedFile), file); resolve(); } catch (error) { reject(error); } });
      watcher.once('error', reject);
    });
    await fs.writeFile(file, 'rules_version = "2";\n// actualización local\n');
    await changed;
    const closed = await watcher.close();
    assert.equal(closed, undefined);
  } finally {
    await watcher.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
