import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'auditar-inicio-visual-parte-2b.mjs');
const runtimePath = path.join(directory, '.audit-home-part2b-runtime-v3.mjs');
let source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

const prepareOriginal = `    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      ['visibility','overflow','position','top','left','right','width','touch-action'].forEach(prop => document.body.style.removeProperty(prop));
    }
  });
  await page.waitForTimeout(1200);`;

const prepareReplacement = `    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      ['visibility','overflow','position','top','left','right','width','touch-action'].forEach(prop => document.body.style.removeProperty(prop));
    }
    const consent = document.getElementById('tt-privacy-consent');
    if (consent) consent.style.setProperty('display', 'none', 'important');
  });
  await page.waitForFunction(() => document.body?.classList.contains('tt-home-runtime-ready'), null, { timeout: 7000 }).catch(() => {});
  await page.waitForTimeout(5400);
  await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= max; y += Math.max(280, Math.floor(innerHeight * .72))) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 45));
    }
    window.scrollTo(0, 0);
    const consent = document.getElementById('tt-privacy-consent');
    if (consent) consent.style.setProperty('display', 'none', 'important');
    document.querySelectorAll('.tt-home-motion').forEach(node => node.classList.add('is-visible'));
  });
  await page.waitForFunction(() => {
    const grid = document.querySelector('.tt-collections-grid');
    if (!grid) return false;
    return grid.querySelector('.tt-coll-card') || grid.querySelector('.tt-phase4-collections-state');
  }, null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(250);`;

if (!source.includes(prepareOriginal)) throw new Error('No se encontró el bloque de preparación esperado.');
source = source.replace(prepareOriginal, prepareReplacement);
fs.writeFileSync(runtimePath, source);
try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(runtimePath, { force: true });
}
