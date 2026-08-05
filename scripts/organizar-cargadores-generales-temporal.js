'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const selfPath = __filename;
const excludedDirs = new Set(['.git', 'node_modules', 'artifacts', 'public']);
const textExtensions = new Set(['.js', '.mjs', '.css', '.md', '.txt', '.json', '.yml', '.yaml', '.html', '.xml']);

const moves = [
  ['js/page-loader.js', 'js/cargador-pagina.js'],
  ['js/page-maintenance-loader.js', 'js/cargador-mantenimiento-pagina.js'],
  ['js/ui-navigation-controller.js', 'js/components/navigation/compatibilidad/inicio-control-paneles.js'],
];

function absolute(relative) {
  return path.join(root, relative);
}

function escaped(value) {
  return value
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\//g, '\\/');
}

for (const [oldPath, newPath] of moves) {
  const source = absolute(oldPath);
  const destination = absolute(newPath);
  if (!fs.existsSync(source)) throw new Error(`No existe: ${oldPath}`);
  if (fs.existsSync(destination)) throw new Error(`El destino ya existe: ${newPath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
}

const replacements = [];
for (const [oldPath, newPath] of moves) {
  const oldBase = path.basename(oldPath);
  const newBase = path.basename(newPath);
  const variants = [
    [oldPath, newPath],
    [`/${oldPath}`, `/${newPath}`],
    [oldBase, newBase],
    [escaped(oldPath), escaped(newPath)],
    [escaped(`/${oldPath}`), escaped(`/${newPath}`)],
    [escaped(oldBase), escaped(newBase)],
  ];
  replacements.push(...variants);
}

replacements.push(
  ['./ui-navigation-controller.js', './components/navigation/compatibilidad/inicio-control-paneles.js'],
  [escaped('./ui-navigation-controller.js'), escaped('./components/navigation/compatibilidad/inicio-control-paneles.js')],
);
replacements.sort((a, b) => b[0].length - a[0].length);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (excludedDirs.has(entry.name)) return [];
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(item) : [item];
  });
}

const files = walk(root).filter(file => {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'diagnostic-manifest.json') return false;
  if (relative.startsWith('.github/workflows/')) return false;
  if (file === selfPath) return false;
  return textExtensions.has(path.extname(relative).toLowerCase());
});

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let updated = source;
  for (const [from, to] of replacements) {
    if (from && updated.includes(from)) updated = updated.split(from).join(to);
  }
  if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
}

const oldNames = moves.flatMap(([oldPath]) => [oldPath, path.basename(oldPath), escaped(oldPath), escaped(path.basename(oldPath))]);
const stale = [];
for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const matches = oldNames.filter(name => source.includes(name));
  if (matches.length) stale.push(`${relative}: ${[...new Set(matches)].join(', ')}`);
}

if (stale.length) {
  console.error('Quedaron referencias anteriores fuera de workflows:');
  stale.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

fs.unlinkSync(selfPath);
console.log('Cargadores generales y controlador de navegación renombrados correctamente.');
