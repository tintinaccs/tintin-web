// Normaliza únicamente contextos de navegación; no reescribe claves de esquema ni literales arbitrarios.
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

const htmlFiles = fs.readdirSync(root)
  .filter(name => name.endsWith('.html'))
  .map(name => path.join(root, name));
const jsFiles = [path.join(root, 'tienda.js'), ...walk(path.join(root, 'js'))].filter(fs.existsSync);
const files = [...htmlFiles, ...jsFiles];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanRouteLiteral(raw) {
  const value = String(raw || '');
  const match = value.match(/^(?:\.\/|\/)?([^?#]+\.html)([?#].*)?$/i);
  if (!match) return value;
  const route = routeMap.get(match[1]);
  return route == null ? value : `${route}${match[2] || ''}`;
}

function normalizeAbsoluteLegacyUrls(text) {
  let output = text;
  for (const [file, route] of routeMap) {
    const escapedFile = escapeRegex(file);
    output = output.replace(new RegExp(`https://tintinaccesorios\\.pages\\.dev/${escapedFile}(?=([?#'"<]|$))`, 'g'), `https://tintinaccesorios.pages.dev${route}`);
    output = output.replace(new RegExp(`https://tintinaccs\\.com/${escapedFile}(?=([?#'"<]|$))`, 'g'), `https://tintinaccs.com${route}`);
  }
  return output;
}

function normalizeHtml(text) {
  const local = text.replace(/\bhref=(['"])([^'"\n>]+)\1/gi, (whole, quote, value) => {
    const normalized = cleanRouteLiteral(value);
    return normalized === value ? whole : `href=${quote}${normalized}${quote}`;
  });
  return normalizeAbsoluteLegacyUrls(local);
}

function normalizeJs(text) {
  let output = text;

  output = output.replace(/\bhref=(\\?['"])([^'"\n>]+)(\\?['"])/gi, (whole, open, value, close) => {
    const normalized = cleanRouteLiteral(value);
    return normalized === value ? whole : `href=${open}${normalized}${close}`;
  });

  output = output.replace(/(\bhref\s*:\s*)(['"])([^'"\n]+)\2/g, (whole, prefix, quote, value) => {
    const normalized = cleanRouteLiteral(value);
    return normalized === value ? whole : `${prefix}${quote}${normalized}${quote}`;
  });

  output = output.replace(/((?:window\.)?location\.href\s*=\s*)(['"])([^'"\n]+)\2/g, (whole, prefix, quote, value) => {
    const normalized = cleanRouteLiteral(value);
    return normalized === value ? whole : `${prefix}${quote}${normalized}${quote}`;
  });
  output = output.replace(/((?:window\.)?location\.(?:assign|replace)\(\s*)(['"])([^'"\n]+)\2/g, (whole, prefix, quote, value) => {
    const normalized = cleanRouteLiteral(value);
    return normalized === value ? whole : `${prefix}${quote}${normalized}${quote}`;
  });

  output = output.replace(/`(?:\.\/|\/)?product\.html\?id=/g, '`/product?id=');
  output = output.replace(/(['"])(?:\.\/|\/)?product\.html\?id=/g, '$1/product?id=');

  return normalizeAbsoluteLegacyUrls(output);
}

const changed = [];
const remaining = [];
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const isHtml = file.endsWith('.html');
  const expected = isHtml ? normalizeHtml(original) : normalizeJs(original);
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (original !== expected) {
    changed.push(relative);
    if (write) fs.writeFileSync(file, expected, 'utf8');
  }

  const inspected = write ? expected : original;
  const actualHrefs = [...inspected.matchAll(/\bhref=(?:\\?['"])([^'"\n>]*\.html(?:[?#][^'"\n>]*)?)(?:\\?['"])/gi)];
  const navProps = isHtml ? [] : [...inspected.matchAll(/\bhref\s*:\s*['"]([^'"\n]*\.html(?:[?#][^'"\n>]*)?)['"]/gi)];
  const assignments = isHtml ? [] : [...inspected.matchAll(/(?:window\.)?location\.href\s*=\s*['"]([^'"\n]*\.html(?:[?#][^'"\n>]*)?)['"]/gi)];
  const count = actualHrefs.length + navProps.length + assignments.length;
  if (count) remaining.push(`${relative} (${count})`);
}

if (!write && changed.length) {
  console.error('Rutas públicas sin normalizar: ' + changed.join(', '));
  console.error('Ejecutá: node scripts/normalizar-rutas-publicas.mjs --write');
  process.exit(1);
}
if (remaining.length) {
  console.error('Todavía existen navegaciones/canonical internas .html: ' + remaining.join(', '));
  process.exit(1);
}

console.log(`${write ? 'Normalizadas' : 'OK'} — rutas limpias en ${files.length} archivos frontend.`);
