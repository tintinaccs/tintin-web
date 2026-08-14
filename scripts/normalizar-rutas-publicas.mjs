import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const routeMap = new Map([
  ['index.html', '/'],
  ['about.html', '/about'],
  ['catalogo.html', '/catalogo'],
  ['collections.html', '/collections'],
  ['product.html', '/product'],
  ['contact.html', '/contact'],
  ['envios.html', '/envios'],
  ['cambios-devoluciones.html', '/cambios-devoluciones'],
  ['preguntas-frecuentes.html', '/preguntas-frecuentes'],
  ['terminos.html', '/terminos'],
  ['privacidad.html', '/privacidad'],
  ['checkout.html', '/checkout'],
  ['login.html', '/login'],
  ['perfil.html', '/perfil'],
  ['admin.html', '/admin'],
  ['admin-images.html', '/admin-images'],
  ['404.html', '/404']
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.(?:js|mjs)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [
  ...fs.readdirSync(root).filter(name => name.endsWith('.html')).map(name => path.join(root, name)),
  path.join(root, 'tienda.js'),
  ...walk(path.join(root, 'js'))
].filter(fs.existsSync);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text) {
  let output = text;
  for (const [file, route] of routeMap) {
    const escapedFile = escapeRegex(file);
    const localPrefix = '(?:\\./|/)?';

    // href reales y href dentro de templates/strings, con o sin ./ o /.
    output = output.replace(
      new RegExp(`href=(['"])${localPrefix}${escapedFile}(?=([?#]|\\1))`, 'g'),
      `href=$1${route}`
    );
    output = output.replace(
      new RegExp(`href=\\\\(['"])${localPrefix}${escapedFile}(?=([?#]|\\\\?\\1))`, 'g'),
      `href=\\$1${route}`
    );

    // Strings de navegación usados por location.href, assign(), etc.
    output = output.replace(
      new RegExp(`(['"])${localPrefix}${escapedFile}(?=([?#]|\\1))`, 'g'),
      (match, quote) => `${quote}${route}`
    );

    // Canonical/OG absolutos que todavía llevan extensión.
    output = output.replace(new RegExp(`https://tintinaccesorios\\.pages\\.dev/${escapedFile}(?=([?#'"<]|$))`, 'g'), `https://tintinaccesorios.pages.dev${route}`);
    output = output.replace(new RegExp(`https://tintinaccs\\.com/${escapedFile}(?=([?#'"<]|$))`, 'g'), `https://tintinaccs.com${route}`);
  }

  // URLs de producto construidas por template literal.
  output = output.replace(/`(?:\.\/|\/)?product\.html\?id=/g, '`/product?id=');
  output = output.replace(/(['"])(?:\.\/|\/)?product\.html\?id=/g, '$1/product?id=');
  return output;
}

const changed = [];
const remaining = [];
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const expected = normalize(original);
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (original !== expected) {
    changed.push(relative);
    if (write) fs.writeFileSync(file, expected, 'utf8');
  }
  const inspected = write ? expected : original;
  const matches = [...inspected.matchAll(/href=(?:\\?['"])[^'"\n>]*\.html(?:[?#][^'"\n>]*)?(?:\\?['"])/g)];
  if (matches.length) remaining.push(`${relative} (${matches.length})`);
}

if (!write && changed.length) {
  console.error('Rutas públicas sin normalizar: ' + changed.join(', '));
  console.error('Ejecutá: node scripts/normalizar-rutas-publicas.mjs --write');
  process.exit(1);
}
if (remaining.length) {
  console.error('Todavía existen href internos .html: ' + remaining.join(', '));
  process.exit(1);
}

console.log(`${write ? 'Normalizadas' : 'OK'} — rutas limpias en ${files.length} archivos frontend.`);
