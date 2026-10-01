import { spawnSync } from 'node:child_process';
import { platform } from 'node:process';

const dryRun = process.argv.includes('--dry-run');
const project = String(process.env.FIREBASE_PROJECT_ID || 'tintin-accesorios').trim();
const source = String(process.env.FIRESTORE_RESTORE_SOURCE || '').trim().replace(/\/$/, '');
const database = String(process.env.FIRESTORE_RESTORE_DATABASE || '(default)').trim();
const confirmation = String(process.env.TINTIN_RESTORE_CONFIRM || '').trim();

if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) {
  console.error('FIREBASE_PROJECT_ID debe ser un ID de proyecto válido.');
  process.exit(2);
}
if (!/^gs:\/\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(source)) {
  console.error('FIRESTORE_RESTORE_SOURCE debe indicar un prefijo de exportación gs://bucket/ruta/snapshot.');
  process.exit(2);
}
if (!database || !/^(?:\(default\)|[a-z][a-z0-9-]{3,61}[a-z0-9])$/.test(database)) {
  console.error('FIRESTORE_RESTORE_DATABASE debe ser (default) o un ID de base válido.');
  process.exit(2);
}
// La confirmación nombra también la base de destino. Con la misma frase para
// todas las bases, un comando de prueba copiado sin FIRESTORE_RESTORE_DATABASE
// caía en (default) y sobrescribía producción con la confirmación del ensayo.
const requiredConfirmation = `RESTORE:${project}:${database}`;
if (!dryRun && confirmation !== requiredConfirmation) {
  console.error(`Restauración bloqueada. Define TINTIN_RESTORE_CONFIRM='${requiredConfirmation}'`);
  process.exit(3);
}

// gcloud firestore import espera a que termine por defecto. --async es un flag
// sin valor: --async=false no es válido y bloqueaba la restauración.
const args = ['firestore', 'import', source, '--project', project, `--database=${database}`];
// La copia diaria es una exportación completa: se importan todas las
// colecciones y cada documento con el mismo ID vuelve al estado del snapshot
// (pedidos y usuarios incluidos). Firestore no permite importar colecciones
// sueltas desde una exportación completa.
console.log(JSON.stringify({
  operation: 'restore',
  project,
  database,
  source,
  scope: 'all-collections',
  overwritesSameIdDocuments: true,
  requiredConfirmation,
  dryRun
}, null, 2));
if (dryRun) process.exit(0);

// En Windows el CLI de Google es un .cmd y Node no puede ejecutarlo con
// shell:false. Proyecto, origen y base se validan arriba y no admiten espacios
// ni metacaracteres de cmd, por eso el shell sólo se habilita en esa plataforma.
const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: platform === 'win32' });
if (result.error) {
  console.error('No se pudo ejecutar gcloud:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
