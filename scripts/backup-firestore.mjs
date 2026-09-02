import { spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const project = String(process.env.FIREBASE_PROJECT_ID || 'tintin-accesorios').trim();
const bucket = String(process.env.FIRESTORE_BACKUP_BUCKET || '').trim().replace(/\/$/, '');
const prefix = String(process.env.FIRESTORE_BACKUP_PREFIX || 'tintin-firestore').trim().replace(/^\/+|\/+$/g, '');

if (!bucket) {
  console.error('FIRESTORE_BACKUP_BUCKET es obligatorio (ej.: gs://mi-bucket-backups).');
  process.exit(2);
}
if (!bucket.startsWith('gs://')) {
  console.error('FIRESTORE_BACKUP_BUCKET debe comenzar con gs://');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = `${bucket}/${prefix}/${stamp}`;
// `gcloud firestore export` waits for the operation by default.  The CLI only
// accepts `--async` as a flag, so passing `--async=false` breaks current
// Cloud SDK versions before the export can begin.
const args = ['firestore', 'export', destination, '--project', project];

console.log(JSON.stringify({ operation: 'backup', project, destination, dryRun }, null, 2));
if (dryRun) process.exit(0);

const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: false });
if (result.error) {
  console.error('No se pudo ejecutar gcloud:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
