import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditScript = path.join(root, 'scripts', 'audit-global-responsive-final.mjs');
const maximumAttempts = 2;

function runAttempt(attempt) {
  console.log(`\nAuditoría responsive global — intento ${attempt}/${maximumAttempts}`);
  return spawnSync(process.execPath, [auditScript], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
}

for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
  const result = runAttempt(attempt);
  const status = Number.isInteger(result.status) ? result.status : 1;

  if (status === 0) process.exit(0);

  if (result.error) {
    console.error(`No se pudo iniciar la auditoría: ${result.error.message}`);
  }

  if (attempt < maximumAttempts) {
    console.warn('La primera ejecución no fue concluyente. Se repetirá automáticamente una sola vez.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

console.error('\nLa auditoría responsive siguió fallando después del reintento automático.');
process.exit(1);
