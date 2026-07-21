import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'audit-home-visual-part2b.mjs');
const runtimePath = path.join(directory, '.audit-home-part2b-runtime.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const original = `    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      ['visibility','overflow','position','top','left','right','width','touch-action'].forEach(prop => document.body.style.removeProperty(prop));
    }
  });
  await page.waitForTimeout(1200);`;

const replacement = `    if (document.body) {
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
    document.querySelectorAll('.tt-home-motion').forEach(node => node.classList.add('is-visible'));
  });
  await page.waitForTimeout(250);`;

if (!source.includes(original)) {
  throw new Error('No se encontró el bloque de preparación esperado en la auditoría base del Inicio.');
}

source = source.replace(original, replacement);
fs.writeFileSync(runtimePath, source);
try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(runtimePath, { force: true });
}
