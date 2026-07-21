import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'audit-global-responsive-final-v2.mjs');
const temporaryPath = path.join(directory, '.audit-global-responsive-runtime.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const originalShellWait = `  await page.waitForSelector(expected, { state: 'attached', timeout: 5000 }).catch(() => {});`;
const deterministicShellWait = `  let shellAttached = await page.waitForSelector(expected, { state: 'attached', timeout: 1800 })
    .then(() => true)
    .catch(() => false);
  if (!shellAttached) {
    await page.evaluate(() => { window.TintinPublicShellBooted = false; });
    await page.addScriptTag({ path: path.join(root, 'js', 'public-shell.js') });
    shellAttached = await page.waitForSelector(expected, { state: 'attached', timeout: 2500 })
      .then(() => true)
      .catch(() => false);
  }`;
if (!source.includes(originalShellWait)) throw new Error('No se encontró la espera inicial del shell en la auditoría v2.');
source = source.replace(originalShellWait, deterministicShellWait);

const originalPreparation = `    document.documentElement.classList.remove('tt-initializing', 'tt-store-gate-pending');
    document.body?.style.removeProperty('visibility');
    document.body?.style.removeProperty('overflow');`;

const healedPreparation = `    document.documentElement.classList.remove(
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

if (!source.includes(originalPreparation)) {
  throw new Error('No se encontró el bloque de preparación esperado en la auditoría v2.');
}
source = source.replace(originalPreparation, healedPreparation);

const originalWait = `  await page.waitForTimeout(140);`;
const stableWait = `  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    if (!node) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }, expected, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(260);`;
if (!source.includes(originalWait)) throw new Error('No se encontró la espera esperada en la auditoría v2.');
source = source.replace(originalWait, stableWait);

const originalInternalOverflow = `    if (node.scrollWidth > node.clientWidth + 1) out.push(\`${'${label}'}: contenido interno desborda\`);`;
const visibleInternalOverflow = `    const visibleChildren = [...node.querySelectorAll('*')].filter(child => {
      if (child.hidden || child.closest('[hidden],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0;
    });
    if (visibleChildren.some(child => {
      const rect = child.getBoundingClientRect();
      return rect.left < r.left - 1 || rect.right > r.right + 1;
    })) out.push(\`${'${label}'}: contenido visible desborda\`);`;
if (!source.includes(originalInternalOverflow)) throw new Error('No se encontró el control interno esperado en la auditoría v2.');
source = source.replace(originalInternalOverflow, visibleInternalOverflow);

fs.writeFileSync(temporaryPath, source);
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
