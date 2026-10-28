import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { indexPreviewAssets, previewAsset } = createRequire(import.meta.url)('../../scripts/lib/preview-static-assets.cjs');

test('la vista previa sólo entrega archivos públicos indexados, con consultas y nombres codificados', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-preview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets-tintin'));
  fs.mkdirSync(path.join(root, 'vendor'));
  fs.writeFileSync(path.join(root, 'assets-tintin', 'foto rosa.webp'), 'public');
  fs.writeFileSync(path.join(root, 'vendor', 'runtime.wasm'), 'wasm');
  const index = indexPreviewAssets(root);
  assert.equal(previewAsset(index, '/assets-tintin/foto%20rosa.webp?v=1'), path.join(root, 'assets-tintin', 'foto rosa.webp'));
  assert.equal(previewAsset(index, '/vendor/runtime.wasm'), path.join(root, 'vendor', 'runtime.wasm'));
  assert.equal(previewAsset(index, '/assets-tintin/ausente.webp'), undefined);
});

test('traversal, prefijos parecidos y enlaces simbólicos no permiten leer archivos ajenos', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-preview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets-tintin'));
  fs.mkdirSync(path.join(root, 'assets-tintin-private'));
  fs.writeFileSync(path.join(root, 'secret.txt'), 'private');
  fs.writeFileSync(path.join(root, 'assets-tintin-private', 'secret.txt'), 'private');
  fs.symlinkSync(path.join(root, 'secret.txt'), path.join(root, 'assets-tintin', 'linked.txt'));
  fs.symlinkSync(path.join(root, 'assets-tintin-private'), path.join(root, 'assets-tintin', 'linked-dir'), 'dir');
  const index = indexPreviewAssets(root);
  for (const url of ['/secret.txt', '/assets-tintin/../secret.txt', '/assets-tintin/%2e%2e/secret.txt', '/assets-tintin/%2e%2e%2fsecret.txt', '/assets-tintin-private/secret.txt', '/assets-tintin/linked.txt', '/assets-tintin/linked-dir/secret.txt', '/assets-tintin/%00secret.txt', '/assets-tintin/%zz']) {
    assert.equal(previewAsset(index, url), undefined, url);
  }
});
