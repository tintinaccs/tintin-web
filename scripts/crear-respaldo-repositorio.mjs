import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function sanitizeTimestamp(value) {
  return value.replaceAll(':', '-').replaceAll('.', '-');
}

const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || 'respaldos');
const createdAt = new Date().toISOString();
const timestamp = sanitizeTimestamp(createdAt);
const repository = process.env.GITHUB_REPOSITORY || basename(process.cwd());
const safeRepository = repository.replaceAll('/', '-');
const bundleName = `${safeRepository}-${timestamp}.bundle`;
const bundlePath = join(outputDirectory, bundleName);
const checksumPath = `${bundlePath}.sha256`;
const manifestPath = join(outputDirectory, `${safeRepository}-${timestamp}.json`);

mkdirSync(outputDirectory, { recursive: true });

runGit(['rev-parse', '--is-inside-work-tree']);
runGit(['bundle', 'create', bundlePath, '--all']);
runGit(['bundle', 'verify', bundlePath]);

const bundleBuffer = readFileSync(bundlePath);
const checksum = createHash('sha256').update(bundleBuffer).digest('hex');
const headSha = runGit(['rev-parse', 'HEAD'], { capture: true }).trim();
const refs = runGit(['bundle', 'list-heads', bundlePath], { capture: true })
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, ref] = line.trim().split(/\s+/, 2);
    return { sha, ref };
  });

writeFileSync(checksumPath, `${checksum}  ${bundleName}\n`, 'utf8');
writeFileSync(
  manifestPath,
  `${JSON.stringify({
    format: 'tintin-repository-backup',
    version: 1,
    createdAt,
    repository,
    headSha,
    bundle: bundleName,
    sha256: checksum,
    refs,
  }, null, 2)}\n`,
  'utf8',
);

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `bundle_path=${bundlePath}\nmanifest_path=${manifestPath}\nchecksum_path=${checksumPath}\n`,
    { encoding: 'utf8', flag: 'a' },
  );
}

console.log(`Respaldo creado: ${bundlePath}`);
console.log(`SHA-256: ${checksum}`);
console.log(`Referencias incluidas: ${refs.length}`);
