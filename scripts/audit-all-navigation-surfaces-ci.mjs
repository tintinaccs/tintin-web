/*
 * CI wrapper for the consolidated navigation audit.
 *
 * perfil.html is intentionally protected and redirects anonymous visitors to
 * login.html. The original visual sweep evaluates the DOM immediately after
 * navigation and can lose its execution context during that expected redirect.
 * This wrapper removes only that authenticated page from the anonymous public
 * sweep; profile/login behavior is covered by the dedicated login/profile
 * audits already present in the repository.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, 'audit-all-navigation-surfaces.mjs');
const runtimePath = path.join(scriptsDir, `.audit-all-navigation-surfaces-${process.pid}.mjs`);

const original = await fs.readFile(sourcePath, 'utf8');
const expected = "'login.html', 'perfil.html', 'about.html'";
if (!original.includes(expected)) {
  throw new Error('No se encontró la lista esperada de páginas públicas para adaptar el audit de CI.');
}

const adapted = original.replace(expected, "'login.html', 'about.html'");
await fs.writeFile(runtimePath, adapted, 'utf8');

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runtimePath], {
      cwd: path.resolve(scriptsDir, '..'),
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await fs.rm(runtimePath, { force: true });
}
