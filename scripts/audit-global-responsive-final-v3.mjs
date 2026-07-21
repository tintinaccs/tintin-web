import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'audit-global-responsive-final-v2.mjs');
const temporaryPath = path.join(directory, '.audit-global-responsive-runtime.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const original = `    document.documentElement.classList.remove('tt-initializing', 'tt-store-gate-pending');
    document.body?.style.removeProperty('visibility');
    document.body?.style.removeProperty('overflow');`;

const replacement = `    document.documentElement.classList.remove(
      'tt-initializing',
      'tt-store-gate-pending',
      'tt-store-gate-blocked',
      'tt-scroll-locked'
    );
    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overscroll-behavior');
    const storeOverlay = document.getElementById('tt-store-closed-overlay');
    if (storeOverlay) storeOverlay.style.setProperty('display', 'none', 'important');
    if (loader) loader.style.setProperty('display', 'none', 'important');
    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      document.body.style.removeProperty('visibility');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('position');
      document.body.style.removeProperty('top');
      document.body.style.removeProperty('left');
      document.body.style.removeProperty('right');
      document.body.style.removeProperty('width');
      document.body.style.removeProperty('touch-action');
    }`;

if (!source.includes(original)) {
  throw new Error('No se encontró el bloque de preparación esperado en la auditoría v2.');
}

source = source.replace(original, replacement);
fs.writeFileSync(temporaryPath, source);

try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
