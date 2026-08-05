'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, '.github/workflows/organizar-compatibilidad-navegacion.yml');
const selfPath = __filename;
const excludedDirs = new Set(['.git', 'node_modules', 'artifacts', 'public']);
const textExtensions = new Set(['.js', '.mjs', '.css', '.md', '.txt', '.json', '.yml', '.yaml', '.html', '.xml']);

const moves = [
  ['js/public-shell.js', 'js/inicio-navegacion-publica.js'],
  ['js/components/navigation/public-shell-entry.js', 'js/components/navigation/entrada-navegacion-publica.js'],

  ['js/components/navigation/legacy/header-account-mobile-fix.js', 'js/components/navigation/compartido/compatibilidad-cuenta-movil.js'],
  ['js/components/navigation/legacy/header-dropdown-fix.js', 'js/components/navigation/compartido/compatibilidad-menus-desplegables.js'],
  ['js/components/navigation/legacy/header-scroll-hide.js', 'js/components/navigation/compartido/ocultar-encabezado-al-desplazar.js'],
  ['js/components/navigation/legacy/mobile-header-mode.js', 'js/components/navigation/compartido/visibilidad-navegacion-por-dispositivo.js'],

  ['js/components/navigation/legacy/nav-collections.js', 'js/components/navigation/compatibilidad/colecciones.js'],
  ['js/components/navigation/legacy/navigation-desktop.js', 'js/components/navigation/compatibilidad/navegacion-escritorio.js'],
  ['js/components/navigation/legacy/navigation-mobile.js', 'js/components/navigation/compatibilidad/navegacion-movil.js'],
  ['js/components/navigation/legacy/navigation-shared.js', 'js/components/navigation/compatibilidad/navegacion-compartida.js'],
  ['js/components/navigation/legacy/navigation-tablet.js', 'js/components/navigation/compatibilidad/navegacion-tableta.js'],

  ['css/components/navigation/legacy/mobile-header-actions-solid.css', 'css/components/navigation/movil/fondos-solidos-movil.css'],
  ['css/components/navigation/legacy/navigation-desktop.css', 'css/components/navigation/compatibilidad/navegacion-escritorio.css'],
  ['css/components/navigation/legacy/navigation-mobile.css', 'css/components/navigation/compatibilidad/navegacion-movil.css'],
  ['css/components/navigation/legacy/navigation-shared.css', 'css/components/navigation/compatibilidad/navegacion-compartida.css'],
  ['css/components/navigation/legacy/navigation-tablet.css', 'css/components/navigation/compatibilidad/navegacion-tableta.css'],
];

function absolute(relative) {
  return path.join(root, relative);
}

function escapedForRegexLiteral(value) {
  return value
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\//g, '\\/');
}

for (const [oldPath, newPath] of moves) {
  const oldAbsolute = absolute(oldPath);
  const newAbsolute = absolute(newPath);
  if (!fs.existsSync(oldAbsolute)) throw new Error(`No existe el archivo esperado: ${oldPath}`);
  if (fs.existsSync(newAbsolute)) throw new Error(`El destino ya existe: ${newPath}`);
  fs.mkdirSync(path.dirname(newAbsolute), { recursive: true });
  fs.renameSync(oldAbsolute, newAbsolute);
}

const replacements = [];
for (const [oldPath, newPath] of moves) {
  const oldWithoutRoot = oldPath.replace(/^(?:js|css)\//, '');
  const newWithoutRoot = newPath.replace(/^(?:js|css)\//, '');
  const oldWithoutComponents = oldPath.replace(/^(?:js|css)\/components\//, '');
  const newWithoutComponents = newPath.replace(/^(?:js|css)\/components\//, '');
  const oldBase = path.basename(oldPath);
  const newBase = path.basename(newPath);

  replacements.push([oldPath, newPath]);
  replacements.push([oldWithoutRoot, newWithoutRoot]);
  replacements.push([oldWithoutComponents, newWithoutComponents]);
  replacements.push([oldBase, newBase]);

  replacements.push([escapedForRegexLiteral(oldPath), escapedForRegexLiteral(newPath)]);
  replacements.push([escapedForRegexLiteral(oldWithoutRoot), escapedForRegexLiteral(newWithoutRoot)]);
  replacements.push([escapedForRegexLiteral(oldWithoutComponents), escapedForRegexLiteral(newWithoutComponents)]);
  replacements.push([escapedForRegexLiteral(oldBase), escapedForRegexLiteral(newBase)]);
}

replacements.push(
  ['js/components/navigation/legacy/', 'js/components/navigation/compatibilidad/'],
  ['css/components/navigation/legacy/', 'css/components/navigation/compatibilidad/'],
  ['components/navigation/legacy/', 'components/navigation/compatibilidad/'],
  ['navigation/legacy/', 'navigation/compatibilidad/'],
);

replacements.sort((a, b) => b[0].length - a[0].length);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (excludedDirs.has(entry.name)) return [];
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

const files = walk(root).filter(file => {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'diagnostic-manifest.json') return false;
  if (file === selfPath || file === workflowPath) return false;
  return textExtensions.has(path.extname(relative).toLowerCase());
});

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  let updated = source;

  for (const [from, to] of replacements) {
    if (from && updated.includes(from)) updated = updated.split(from).join(to);
  }

  if (relative === 'docs/ARQUITECTURA.md' || relative === 'docs/MAPA-DE-CODIGO.md' || relative === 'docs/CSS_LAYERS.md') {
    updated = updated
      .split('`legacy/`').join('`compatibilidad/`')
      .split('├── legacy/').join('├── compatibilidad/')
      .split('└── legacy/').join('└── compatibilidad/');
  }

  if (relative.startsWith('js/components/navigation/compatibilidad/')) {
    updated = updated
      .split('/* Compatibility module.').join('/* Modulo de compatibilidad.')
      .split('/* Compatibility shim.').join('/* Adaptador de compatibilidad.');
  }

  if (relative === 'js/inicio-navegacion-publica.js') {
    updated = updated
      .split('desktop, tablet, mobile y superficies compartidas')
      .join('escritorio, tableta, movil y superficies compartidas');
  }

  if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
}

const staleNeedles = [
  'js/public-shell.js',
  'public-shell-entry.js',
  'js/components/navigation/legacy/',
  'css/components/navigation/legacy/',
  'header-account-mobile-fix.js',
  'header-dropdown-fix.js',
  'header-scroll-hide.js',
  'mobile-header-mode.js',
  'nav-collections.js',
  'navigation-desktop.js',
  'navigation-mobile.js',
  'navigation-shared.js',
  'navigation-tablet.js',
  'mobile-header-actions-solid.css',
  'navigation-desktop.css',
  'navigation-mobile.css',
  'navigation-shared.css',
  'navigation-tablet.css',
];

const stale = [];
for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const matches = staleNeedles.filter(needle => source.includes(needle) || source.includes(escapedForRegexLiteral(needle)));
  if (matches.length) stale.push(`${relative}: ${matches.join(', ')}`);
}

if (stale.length) {
  console.error('Quedaron referencias con nombres anteriores:');
  stale.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

fs.unlinkSync(workflowPath);
fs.unlinkSync(selfPath);
console.log('Compatibilidad y entrada pública de navegación organizadas correctamente.');
