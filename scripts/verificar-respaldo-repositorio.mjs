import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function newestBundle(directory) {
  const bundles = readdirSync(directory)
    .filter((name) => name.endsWith('.bundle'))
    .sort()
    .reverse();
  return bundles[0] ? join(directory, bundles[0]) : null;
}

const startedAt = Date.now();
const requestedPath = process.argv[2];
const backupDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || 'respaldos');
const bundlePath = requestedPath
  ? resolve(requestedPath)
  : newestBundle(backupDirectory);

if (!bundlePath || !existsSync(bundlePath)) {
  throw new Error('No se encontró un archivo .bundle para verificar.');
}

run('git', ['bundle', 'verify', bundlePath], process.cwd());
const heads = run('git', ['bundle', 'list-heads', bundlePath], process.cwd(), true);

if (!heads.includes('refs/heads/main')) {
  throw new Error('El respaldo no contiene refs/heads/main.');
}

const requiredRef = process.env.BACKUP_REQUIRED_REF;
if (requiredRef && !heads.includes(requiredRef)) {
  throw new Error(`El respaldo no contiene la referencia obligatoria: ${requiredRef}`);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'tintin-restore-'));
const restoredRepository = join(temporaryRoot, 'repositorio-restaurado');

try {
  run('git', ['clone', bundlePath, restoredRepository], process.cwd());
  run('git', ['fsck', '--full'], restoredRepository);
  run('git', ['checkout', 'main'], restoredRepository);
  const restoredSha = run('git', ['rev-parse', 'HEAD'], restoredRepository, true).trim();
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);

  console.log(`Restauración simulada correctamente desde ${basename(bundlePath)}.`);
  console.log(`main restaurado en: ${restoredSha}`);
  console.log(`Tiempo total: ${elapsedSeconds} segundos.`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
