import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = 'tintin-20260731-phase8-stock-shell-1';
const publicPages = [
  '404.html', 'about.html', 'cambios-devoluciones.html', 'catalogo.html',
  'checkout.html', 'collections.html', 'contact.html', 'envios.html',
  'index.html', 'login.html', 'perfil.html', 'preguntas-frecuentes.html',
  'privacidad.html', 'product.html', 'terminos.html',
];

function replaceFile(relative, transform) {
  const absolute = path.join(root, relative);
  const before = fs.readFileSync(absolute, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(absolute, after, 'utf8');
  console.log(`Actualizado: ${relative}`);
  return true;
}

for (const page of publicPages) {
  replaceFile(page, text => text.replace(
    /js\/public-shell\.js\?v=tintin-[^"']+/g,
    `js/public-shell.js?v=${version}`
  ));
}

replaceFile('js/public-shell.js', text => text.replace(
  /const VERSION = 'tintin-[^']+';/,
  `const VERSION = '${version}';`
));

replaceFile('scripts/audit-public-shell.js', text => text.replace(
  /const VERSION = 'tintin-[^']+';/,
  `const VERSION = '${version}';`
));

fs.unlinkSync(fileURLToPath(import.meta.url));
console.log(`Shell público unificado en ${version}.`);
