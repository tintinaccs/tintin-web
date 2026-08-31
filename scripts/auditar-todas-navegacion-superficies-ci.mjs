/*
 * CI wrapper for the consolidated navigation audit.
 *
 * perfil.html is intentionally protected and redirects anonymous visitors to
 * login.html. The original visual sweep evaluates the DOM immediately after
 * navigation and can lose its execution context during that expected redirect.
 * This wrapper removes only that authenticated page from the anonymous public
 * sweep; profile/login behavior is covered by the dedicated login/profile
 * audits already present in the repository.
 *
 * product.html is data-driven and the underlying consolidated audit deliberately
 * aborts every request whose hostname is not 127.0.0.1. Running the product
 * detail without a real product id while Firestore/public APIs are blocked makes
 * the audit measure the product fallback timeout instead of navigation. Product
 * runtime/route behavior is already covered by the dedicated Cloudflare product
 * route check and catalog/cart gates, so this anonymous OFFLINE navigation sweep
 * excludes only that dynamic detail page. The static product document remains
 * covered by the general page smoke audit.
 *
 * The production navigation now uses clean URLs. The historical audit still
 * targets contact.html for the tablet-menu close regression, so CI adapts only
 * that selector to the canonical /contact route while preserving the exact
 * assertion that one click invokes close() exactly once.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, 'auditar-todas-navegacion-superficies.mjs');
const runtimePath = path.join(scriptsDir, `.audit-all-navigation-surfaces-${process.pid}.mjs`);

const original = await fs.readFile(sourcePath, 'utf8');
const expectedDynamicPages =
  "'index.html', 'catalogo.html', 'collections.html', 'product.html', 'checkout.html'";
const expectedAuthPages = "'login.html', 'perfil.html', 'about.html'";
const expectedTabletSelector = `#tt-tablet-menu a[href="contact.html"]`;
if (!original.includes(expectedDynamicPages)) {
  throw new Error('No se encontró la lista esperada que contiene la ficha dinámica de producto.');
}
if (!original.includes(expectedAuthPages)) {
  throw new Error('No se encontró la lista esperada de páginas públicas/protegidas para adaptar el audit de CI.');
}
if (!original.includes(expectedTabletSelector)) {
  throw new Error('No se encontró el selector histórico del enlace Contacto del menú tablet.');
}

const adapted = original
  .replace(
    expectedDynamicPages,
    "'index.html', 'catalogo.html', 'collections.html', 'checkout.html'"
  )
  .replace(expectedAuthPages, "'login.html', 'about.html'")
  .replace(
    expectedTabletSelector,
    `#tt-tablet-menu a[href="/contact"], #tt-tablet-menu a[href="contact.html"]`
  );
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
