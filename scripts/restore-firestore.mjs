import { spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const project = String(process.env.FIREBASE_PROJECT_ID || 'tintin-accesorios').trim();
const source = String(process.env.FIRESTORE_RESTORE_SOURCE || '').trim().replace(/\/$/, '');
const confirmation = String(process.env.TINTIN_RESTORE_CONFIRM || '').trim();

if (!source || !source.startsWith('gs://')) {
  console.error('FIRESTORE_RESTORE_SOURCE es obligatorio y debe comenzar con gs://');
  process.exit(2);
}
if (!dryRun && confirmation !== `RESTORE:${project}`) {
  console.error(`Restauración bloqueada. Define TINTIN_RESTORE_CONFIRM=RESTORE:${project}`);
  process.exit(3);
}

const args = ['firestore', 'import', source, '--project', project, '--async=false'];
console.log(JSON.stringify({ operation: 'restore', project, source, dryRun }, null, 2));
if (dryRun) process.exit(0);

const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: false });
if (result.error) {
  console.error('No se pudo ejecutar gcloud:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
