import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../../scripts/restore-firestore.mjs', import.meta.url));
const commonEnv = {
  ...process.env,
  FIREBASE_PROJECT_ID: 'demo-tintin-restore',
  FIRESTORE_RESTORE_SOURCE: 'gs://example-backups/snapshot-001',
  TINTIN_RESTORE_CONFIRM: ''
};

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...commonEnv, ...env }
  });
}

function withFakeGcloud(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'tintin-restore-'));
  const argsFile = join(dir, 'gcloud-args.txt');
  const binary = join(dir, 'gcloud');
  writeFileSync(binary, '#!/bin/sh\nprintf "%s\\n" "$@" > "$GCLOUD_ARGS_FILE"\nexit "$GCLOUD_EXIT"\n');
  chmodSync(binary, 0o755);
  const env = {
    PATH: [dir, process.env.PATH || ''].join(delimiter),
    GCLOUD_ARGS_FILE: argsFile,
    GCLOUD_EXIT: '0'
  };
  try { callback({ env, argsFile }); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('dry-run muestra proyecto, base y snapshot sin ejecutar gcloud', () => {
  const result = run(['--dry-run'], { FIRESTORE_RESTORE_DATABASE: 'restauracion-prueba', PATH: '' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.project, 'demo-tintin-restore');
  assert.equal(report.database, 'restauracion-prueba');
  assert.equal(report.source, 'gs://example-backups/snapshot-001');
  assert.equal(report.dryRun, true);
  assert.equal(report.scope, 'all-collections');
  assert.equal(report.overwritesSameIdDocuments, true);
  assert.equal(report.requiredConfirmation, 'RESTORE:demo-tintin-restore:restauracion-prueba');
});

test('restauración rechaza origen incompleto o base inválida', () => {
  assert.equal(run(['--dry-run'], { FIRESTORE_RESTORE_SOURCE: 'gs://bucket' }).status, 2);
  assert.equal(run(['--dry-run'], { FIRESTORE_RESTORE_DATABASE: '../otra' }).status, 2);
});

test('sin confirmación explícita no invoca gcloud', () => {
  withFakeGcloud(({ env, argsFile }) => {
    const result = run([], env);
    assert.equal(result.status, 3, result.stderr);
    assert.equal(existsSync(argsFile), false);
  });
});

test('la confirmación de una base de prueba no autoriza restaurar (default)', () => {
  withFakeGcloud(({ env, argsFile }) => {
    const result = run([], { ...env, TINTIN_RESTORE_CONFIRM: 'RESTORE:demo-tintin-restore:restauracion-prueba' });
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /RESTORE:demo-tintin-restore:\(default\)/);
    assert.equal(existsSync(argsFile), false);
  });
});

test('la confirmación anterior sin base ya no autoriza ninguna restauración', () => {
  withFakeGcloud(({ env, argsFile }) => {
    const result = run([], { ...env, TINTIN_RESTORE_CONFIRM: 'RESTORE:demo-tintin-restore' });
    assert.equal(result.status, 3, result.stderr);
    assert.equal(existsSync(argsFile), false);
  });
});

test('importa en base aislada y no pasa --async=false', () => {
  withFakeGcloud(({ env, argsFile }) => {
    const result = run([], {
      ...env,
      FIRESTORE_RESTORE_DATABASE: 'restauracion-prueba',
      TINTIN_RESTORE_CONFIRM: 'RESTORE:demo-tintin-restore:restauracion-prueba'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(argsFile, 'utf8').trim().split('\n'), [
      'firestore', 'import', 'gs://example-backups/snapshot-001',
      '--project', 'demo-tintin-restore', '--database=restauracion-prueba'
    ]);
  });
});

test('un fallo de gcloud no se informa como restauración correcta', () => {
  withFakeGcloud(({ env }) => {
    const result = run([], { ...env, GCLOUD_EXIT: '37', TINTIN_RESTORE_CONFIRM: 'RESTORE:demo-tintin-restore:(default)' });
    assert.equal(result.status, 37);
  });
});
