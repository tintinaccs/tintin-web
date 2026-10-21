import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyEncryptedBackup } from '../../scripts/copiar-respaldo-firestore-cifrado.mjs';
const openssl = process.env.OPENSSL_BIN || (process.platform === 'win32' ? path.join(process.env.ProgramFiles, 'Git', 'usr', 'bin', 'openssl.exe') : 'openssl');

test('copia sólo un export completo y restaura los bytes desde CMS real', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-cms-test-'));
  try {
    const key = path.join(folder, 'key.pem');
    const cert = path.join(folder, 'cert.pem');
    execFileSync(openssl, ['req', '-new', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', '/CN=BackupTest', '-days', '1'], { stdio: 'pipe' });
    const old = 'gs://test-backups/production/2026-10-20T01-00-00-000Z/';
    const latest = 'gs://test-backups/production/2026-10-21T01-00-00-000Z/';
    const payload = Buffer.from([0, 1, 2, 255, 10, 0, 42]);
    const calls = [];
    const run = (command, args, options) => {
      if (command !== 'gcloud') return execFileSync(command === 'openssl' ? openssl : command, args, options);
      calls.push(args);
      assert.deepEqual(args.slice(0, 1), ['storage']);
      if (args[1] === 'ls' && args[2] === 'gs://test-backups/production/') return `${old}\n${latest}\n`;
      if (args[1] === 'ls' && args[2].startsWith(latest)) throw new Error('Metadata aún ausente');
      if (args[1] === 'ls') return `${old}export.overall_export_metadata\n`;
      assert.equal(args[1], 'cp');
      assert.equal(args[3], old);
      fs.writeFileSync(path.join(args[4], 'documents.bin'), payload);
      fs.writeFileSync(path.join(args[4], 'export.overall_export_metadata'), 'metadata');
      return '';
    };
    const output = path.join(folder, 'encrypted');
    const receipt = copyEncryptedBackup({ bucket: 'gs://test-backups', recipientPem: fs.readFileSync(cert, 'utf8'), outputDirectory: output, run });
    const encrypted = path.join(output, 'firestore-backup.p7m');
    assert.equal(receipt.snapshot, '2026-10-20T01-00-00-000Z');
    assert.equal(receipt.sha256, createHash('sha256').update(fs.readFileSync(encrypted)).digest('hex'));
    assert.deepEqual(fs.readdirSync(output).sort(), ['firestore-backup.json', 'firestore-backup.p7m']);
    assert.equal(calls.filter(args => args[1] === 'cp').length, 1);
    const archive = path.join(folder, 'restored.tar.gz');
    execFileSync(openssl, ['cms', '-decrypt', '-binary', '-inform', 'DER', '-in', encrypted, '-recip', cert, '-inkey', key, '-out', archive], { stdio: 'pipe' });
    const restored = path.join(folder, 'restored');
    fs.mkdirSync(restored);
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
    execFileSync(tar, ['-xzf', archive, '-C', restored]);
    assert.deepEqual(fs.readFileSync(path.join(restored, 'documents.bin')), payload);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('rechaza claves privadas y bucket/rutas no canónicos antes de ejecutar comandos', () => {
  let calls = 0;
  const run = () => { calls++; throw new Error('No debe ejecutarse'); };
  for (const bucket of ['https://example.com', 'gs://bucket/path', 'gs://bucket;command']) {
    assert.throws(() => copyEncryptedBackup({ bucket, recipientPem: '', outputDirectory: os.tmpdir(), run }), /Bucket/);
  }
  assert.throws(() => copyEncryptedBackup({ bucket: 'gs://test-backups', recipientPem: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----', outputDirectory: os.tmpdir(), run }), /público/);
  assert.equal(calls, 0);
});

test('un fallo no deja una copia parcialmente publicable ni filtra configuración', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-cms-failure-'));
  try {
    const recipientPem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
    const run = () => { throw new Error('private-bucket-and-provider-detail'); };
    assert.throws(() => copyEncryptedBackup({ bucket: 'gs://test-backups', recipientPem, outputDirectory: folder, run }), error => !error.message.includes('private-bucket') && /No se pudo/.test(error.message));
    assert.deepEqual(fs.readdirSync(folder), []);
    fs.writeFileSync(path.join(folder, 'firestore-backup.p7m'), 'existing');
    assert.throws(() => copyEncryptedBackup({ bucket: 'gs://test-backups', recipientPem, outputDirectory: folder, run }), /ya existe/);
    assert.equal(fs.readFileSync(path.join(folder, 'firestore-backup.p7m'), 'utf8'), 'existing');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('el workflow conserva el export diario y sólo sube los dos artefactos cifrados explícitos', () => {
  const source = fs.readFileSync(new URL('../../.github/workflows/backup-firestore.yml', import.meta.url), 'utf8');
  assert.match(source, /cron: '17 5 \* \* \*'/);
  assert.match(source, /name: Exportar Firestore\r?\n\s+if: \$\{\{ !inputs\.encrypted_copy \}\}/);
  assert.match(source, /BACKUP_RECIPIENT_PEM: '\$\{\{ inputs\.recipient_pem \}\}'/);
  assert.doesNotMatch(source, /run:.*inputs\.recipient_pem/);
  assert.ok(source.indexOf('Autorizar copia cifrada') < source.indexOf('google-github-actions/auth'));
  assert.match(source, /GITHUB_REF !== 'refs\/heads\/main'/);
  assert.match(source, /GITHUB_ACTOR !== process\.env\.GITHUB_REPOSITORY_OWNER/);
  const upload = source.slice(source.indexOf('uses: actions/upload-artifact'));
  assert.match(upload, /artifacts\/encrypted-backup\/firestore-backup\.p7m/);
  assert.match(upload, /artifacts\/encrypted-backup\/firestore-backup\.json/);
  assert.doesNotMatch(upload, /path:.*\*|retention-days: (?:[2-9]|\d{2})/);
  const ignore = fs.readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^artifacts\/$/m);
  const helper = fs.readFileSync(new URL('../../scripts/copiar-respaldo-firestore-cifrado.mjs', import.meta.url), 'utf8');
  assert.match(helper, /outputDirectory: 'artifacts\/encrypted-backup'/);
});

test('borra temporales en claro y el cifrado parcial si falla el cifrado final', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-cms-partial-'));
  let plaintext;
  try {
    const snapshot = 'gs://test-backups/production/2026-10-21T01-00-00-000Z/';
    const run = (command, args) => {
      if (command === 'gcloud' && args[1] === 'ls') return args[2].includes('*') ? `${snapshot}export.overall_export_metadata` : snapshot;
      if (command === 'gcloud') {
        plaintext = args[4];
        fs.writeFileSync(path.join(plaintext, 'documents.bin'), 'private-test-data');
      } else if (command === 'openssl' && args[0] === 'cms') {
        fs.writeFileSync(args[args.indexOf('-out') + 1], 'incomplete');
        throw new Error('cipher failed');
      }
      return '';
    };
    assert.throws(() => copyEncryptedBackup({ bucket: 'gs://test-backups', recipientPem: '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----', outputDirectory: folder, run }), /No se pudo/);
    assert.equal(fs.existsSync(plaintext), false);
    assert.deepEqual(fs.readdirSync(folder), []);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
