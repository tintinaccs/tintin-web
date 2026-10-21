import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Sólo lee un export existente. Nunca exporta, importa ni cambia Firestore.
export function copyEncryptedBackup({ bucket, recipientPem, outputDirectory, run = execFileSync }) {
  const root = String(bucket || '').replace(/\/$/, '');
  if (!/^gs:\/\/[a-z0-9][a-z0-9._-]+$/.test(root)) throw new Error('Bucket de respaldo inválido.');
  const pem = String(recipientPem || '').trim();
  if (pem.length > 12000 || !/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----$/.test(pem)) {
    throw new Error('Se requiere un certificado público PEM, nunca una clave privada.');
  }
  const output = path.resolve(outputDirectory);
  fs.mkdirSync(output, { recursive: true });
  const encrypted = path.join(output, 'firestore-backup.p7m');
  const receipt = path.join(output, 'firestore-backup.json');
  if (fs.existsSync(encrypted) || fs.existsSync(receipt)) throw new Error('El respaldo de destino ya existe.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-encrypted-backup-'));
  const execute = (command, args) => run(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  try {
    const certificate = path.join(temp, 'recipient.pem');
    fs.writeFileSync(certificate, pem, { mode: 0o600 });
    execute('openssl', ['x509', '-in', certificate, '-noout', '-checkend', '0']);
    const prefix = `${root}/production/`;
    const snapshots = String(execute('gcloud', ['storage', 'ls', prefix])).split(/\r?\n/).map(line => line.trim()).filter(line =>
      line.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\/$/.test(line.slice(prefix.length))).sort().reverse();
    let source;
    for (const candidate of snapshots) {
      try {
        const metadata = String(execute('gcloud', ['storage', 'ls', `${candidate}*.overall_export_metadata`])).trim();
        if (metadata.startsWith(candidate) && metadata.endsWith('.overall_export_metadata')) { source = candidate; break; }
      } catch { /* Un export todavía en curso no es un respaldo utilizable. */ }
    }
    if (!source) throw new Error('No hay un export completo con metadata de restauración.');
    const data = path.join(temp, 'data');
    fs.mkdirSync(data);
    execute('gcloud', ['storage', 'cp', '--recursive', source, data]);
    const archive = path.join(temp, 'firestore.tar.gz');
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
    execute(tar, ['-czf', archive, '-C', data, '.']);
    execute('openssl', ['cms', '-encrypt', '-binary', '-aes-256-cbc', '-in', archive, '-out', encrypted, '-outform', 'DER', certificate]);
    if (!fs.statSync(encrypted).size) throw new Error('El archivo cifrado está vacío.');
    const summary = { schemaVersion: 1, createdAt: new Date().toISOString(), snapshot: source.slice(prefix.length).replace(/\/$/, ''), format: 'CMS EnvelopedData AES-256-CBC; tar.gz', sha256: createHash('sha256').update(fs.readFileSync(encrypted)).digest('hex') };
    fs.writeFileSync(receipt, `${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } catch (error) {
    // No publicar artefactos incompletos ni errores que incluyan configuración privada.
    fs.rmSync(encrypted, { force: true });
    fs.rmSync(receipt, { force: true });
    throw new Error('No se pudo preparar la copia cifrada. Revisar certificado público, export completo y permisos de lectura.', { cause: error });
  } finally {
    // temp fue creado por mkdtemp; nunca se deriva de una ruta del usuario.
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = copyEncryptedBackup({ bucket: process.env.FIRESTORE_BACKUP_BUCKET, recipientPem: process.env.BACKUP_RECIPIENT_PEM, outputDirectory: 'artifacts/encrypted-backup' });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
