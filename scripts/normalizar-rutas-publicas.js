'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

const PAGE_ROUTES = new Map([
  ['index.html', '/'],
  ['catalogo.html', '/catalogo'],
  ['collections.html', '/collections'],
  ['product.html', '/product'],
  ['about.html', '/about'],
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
  ['nosotros.html', '/about'],
  ['404.html', '/404']
]);

function normalizePageUrl(raw) {
  const value = String(raw || '');
  if (!value || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(value)) return value;
  const match = value.match(/^(?:\.\/|\/)?([^/?#]+\.html)([?#].*)?$/i);
  if (!match) return value;
  const route = PAGE_ROUTES.get(match[1].toLowerCase());
  return route ? route + (match[2] || '') : value;
}

function normalizeHtml(text) {
  return text.replace(/\b(href|action)=(['"])([^'"]+)\2/gi, (full, attr, quote, raw) => {
    const clean = normalizePageUrl(raw);
    return `${attr}=${quote}${clean}${quote}`;
  });
}

function normalizeJs(text) {
  let output = text;

  // Asignaciones inequívocas de navegación: link.href = 'product.html?...',
  // form.action = 'checkout.html', window.location.href = 'index.html', etc.
  output = output.replace(/((?:[A-Za-z_$][\w$]*\.)*(?:href|action)\s*=\s*)(['"])([^'"]+\.html(?:[?#][^'"]*)?)\2/g, (full, prefix, quote, raw) => {
    const clean = normalizePageUrl(raw);
    return `${prefix}${quote}${clean}${quote}`;
  });
  output = output.replace(/((?:window\.)?location\.(?:href)\s*=\s*)(['"])([^'"]+\.html(?:[?#][^'"]*)?)\2/g, (full, prefix, quote, raw) => {
    const clean = normalizePageUrl(raw);
    return `${prefix}${quote}${clean}${quote}`;
  });
  output = output.replace(/((?:window\.)?location\.(?:assign|replace)\(\s*)(['"])([^'"]+\.html(?:[?#][^'"]*)?)\2/g, (full, prefix, quote, raw) => {
    const clean = normalizePageUrl(raw);
    return `${prefix}${quote}${clean}${quote}`;
  });

  // Constructores de URL inequívocos con query de producto/categoría.
  output = output.replace(/(['"`])(?:\.\/|\/)?(product|catalogo)\.html(\?(?:id|cat)=[^'"`]*?)\1/g, (full, quote, page, query) => {
    return `${quote}/${page}${query}${quote}`;
  });

  return output;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'artifacts', 'maintenance', 'tests', 'scripts'].includes(entry.name)) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

const rootRuntimeJs = fs.readdirSync(root)
  .filter(name => name.endsWith('.js'))
  .map(name => path.join(root, name));
const htmlFiles = fs.readdirSync(root)
  .filter(name => name.endsWith('.html'))
  .map(name => path.join(root, name));
const jsFiles = fs.existsSync(path.join(root, 'js')) ? walk(path.join(root, 'js')).filter(file => file.endsWith('.js')) : [];
const files = [...new Set([...htmlFiles, ...rootRuntimeJs, ...jsFiles])];

const changed = [];
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const after = file.endsWith('.html') ? normalizeHtml(before) : normalizeJs(before);
  if (before === after) continue;
  changed.push(path.relative(root, file));
  if (!checkOnly) fs.writeFileSync(file, after, 'utf8');
}

if (checkOnly && changed.length) {
  console.error('ERROR — todavía existen rutas internas .html que pueden normalizarse:');
  changed.forEach(file => console.error('- ' + file));
  process.exit(1);
}

if (checkOnly) console.log('OK — rutas internas publicables usan destinos limpios.');
else console.log(`Rutas internas normalizadas en ${changed.length} archivo(s).`);
