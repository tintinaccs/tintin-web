import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function update(relative, transform) {
  const absolute = path.join(root, relative);
  const before = fs.readFileSync(absolute, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No se aplicó la corrección esperada en ${relative}`);
  fs.writeFileSync(absolute, after, 'utf8');
  console.log(`Actualizado: ${relative}`);
}

update('css/phase8-ui-ux.css', text => text.replace(
  '@media (min-width: 769px) and (max-width: 1024px) {\n  body.tt-home-premium #look-grid {',
  '@media (min-width: 769px) {\n  body.tt-home-premium #look-grid {'
));

update('collections.html', text => text.replace(
  '<!-- COLLECTIONS PAGE GRID -->\n<section class="section tt-colls-page-section">',
  '<!-- COLLECTIONS PAGE GRID -->\n<div id="tt-collections-sync-state" role="status" aria-live="polite" data-state="loading">Actualizando colecciones…</div>\n<section class="section tt-colls-page-section">'
));

fs.unlinkSync(fileURLToPath(import.meta.url));
console.log('Correcciones finales de geometría y CLS aplicadas.');
