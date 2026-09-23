import { spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const project = String(process.env.FIREBASE_PROJECT_ID || 'tintin-accesorios').trim();
const source = String(process.env.FIRESTORE_RESTORE_SOURCE || '').trim().replace(/\/$/, '');
const database = String(process.env.FIRESTORE_RESTORE_DATABASE || '(default)').trim();
const confirmation = String(process.env.TINTIN_RESTORE_CONFIRM || '').trim();

if (!/^gs:\/\/[^/\s]+\/[^\s]+$/.test(source)) {
  console.error('FIRESTORE_RESTORE_SOURCE debe indicar un prefijo de exportación gs://bucket/ruta/snapshot.');
  process.exit(2);
}
if (!database || !/^(?:\(default\)|[a-z][a-z0-9-]{3,61}[a-z0-9])$/.test(database)) {
  console.error('FIRESTORE_RESTORE_DATABASE debe ser (default) o un ID de base válido.');
  process.exit(2);
}
if (!dryRun && confirmation !== `RESTORE:${project}`) {
  console.error(`Restauración bloqueada. Define TINTIN_RESTORE_CONFIRM=RESTORE:${project}`);
  process.exit(3);
}

// gcloud firestore import espera a que termine por defecto. --async es un flag
// sin valor: --async=false no es válido y bloqueaba la restauración.
const args = ['firestore', 'import', source, '--project', project, `--database=${database}`];
console.log(JSON.stringify({ operation: 'restore', project, database, source, dryRun }, null, 2));
if (dryRun) process.exit(0);

const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: false });
if (result.error) {
  console.error('No se pudo ejecutar gcloud:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
