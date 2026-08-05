'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, '.github/workflows/completar-navegacion-compartida.yml');
const selfPath = __filename;
const excludedDirs = new Set(['.git', '.github', 'node_modules', 'artifacts', 'public']);
const textExtensions = new Set(['.js', '.mjs', '.css', '.md', '.txt', '.json', '.yml', '.yaml', '.html', '.xml']);

const moves = [
  ['js/components/navigation/shared/acordeon-pie-pagina.js', 'js/components/navigation/compartido/acordeon-pie-pagina.js'],
  ['js/components/navigation/shared/assets.js', 'js/components/navigation/compartido/recursos-navegacion.js'],
  ['js/components/navigation/shared/collections-runtime.js', 'js/components/navigation/compartido/carga-colecciones.js'],
  ['js/components/navigation/shared/config.js', 'js/components/navigation/compartido/configuracion.js'],
  ['js/components/navigation/shared/control-busqueda.js', 'js/components/navigation/compartido/control-busqueda.js'],
  ['js/components/navigation/shared/icons.js', 'js/components/navigation/compartido/iconos.js'],
  ['js/components/navigation/shared/panel-busqueda.js', 'js/components/navigation/compartido/panel-busqueda.js'],
  ['js/components/navigation/shared/panel-carrito.js', 'js/components/navigation/compartido/panel-carrito.js'],
  ['js/components/navigation/shared/panel-colecciones.js', 'js/components/navigation/compartido/panel-colecciones.js'],
  ['js/components/navigation/shared/panel-cuenta.js', 'js/components/navigation/compartido/panel-cuenta.js'],
  ['js/components/navigation/shared/register-surfaces.js', 'js/components/navigation/compartido/registro-paneles.js'],
  ['js/components/navigation/shared/route-state.js', 'js/components/navigation/compartido/estado-ruta.js'],
  ['js/components/navigation/shared/router.js', 'js/components/navigation/compartido/enrutador.js'],
  ['js/components/navigation/shared/runtime.js', 'js/components/navigation/compartido/carga-navegacion.js'],
  ['js/components/navigation/shared/surface-controller.js', 'js/components/navigation/compartido/control-paneles.js'],
  ['js/components/navigation/shared/surface-layer.js', 'js/components/navigation/compartido/capas-paneles.js'],
  ['css/components/navigation/shared/navigation-transitions.css', 'css/components/navigation/compartido/transiciones-navegacion.css'],
  ['css/components/navigation/shared/search.css', 'css/components/navigation/compartido/busqueda.css'],
  ['css/components/navigation/shared/surface-controller.css', 'css/components/navigation/compartido/control-paneles.css'],
  ['css/components/navigation/shared/surfaces.css', 'css/components/navigation/compartido/paneles.css'],
];

function absolute(relative) {
  return path.join(root, relative);
}

for (const [oldPath, newPath] of moves) {
  fs.mkdirSync(path.dirname(absolute(newPath)), { recursive: true });
  fs.renameSync(absolute(oldPath), absolute(newPath));
}

const replacements = [];
for (const [oldPath, newPath] of moves) {
  replacements.push([oldPath, newPath]);
  replacements.push([
    oldPath.replace(/^(?:js|css)\//, ''),
    newPath.replace(/^(?:js|css)\//, ''),
  ]);
  replacements.push([
    oldPath.replace(/^(?:js|css)\/components\//, ''),
    newPath.replace(/^(?:js|css)\/components\//, ''),
  ]);

  if (oldPath.startsWith('js/components/navigation/shared/')) {
    const oldName = path.basename(oldPath);
    const newName = path.basename(newPath);
    replacements.push([`./shared/${oldName}`, `./compartido/${newName}`]);
    replacements.push([`../shared/${oldName}`, `../compartido/${newName}`]);
  }
}
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
  if (file === selfPath) return false;
  return textExtensions.has(path.extname(relative).toLowerCase());
});

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  let updated = source;

  for (const [from, to] of replacements) {
    if (from && updated.includes(from)) updated = updated.split(from).join(to);
  }

  if (relative.startsWith('js/components/navigation/compartido/')) {
    updated = updated
      .split("'./config.js'").join("'./configuracion.js'")
      .split('"./config.js"').join('"./configuracion.js"')
      .split("'./icons.js'").join("'./iconos.js'")
      .split('"./icons.js"').join('"./iconos.js"')
      .split("'./route-state.js'").join("'./estado-ruta.js'")
      .split('"./route-state.js"').join('"./estado-ruta.js"');
  }

  if (relative === 'docs/ARQUITECTURA.md') {
    const docNames = [
      ['`shared/`', '`compartido/`'],
      ['└── shared/', '└── compartido/'],
      ['├── assets.js', '├── recursos-navegacion.js'],
      ['├── collections-runtime.js', '├── carga-colecciones.js'],
      ['├── config.js', '├── configuracion.js'],
      ['├── icons.js', '├── iconos.js'],
      ['├── register-surfaces.js', '├── registro-paneles.js'],
      ['├── route-state.js', '├── estado-ruta.js'],
      ['├── router.js', '├── enrutador.js'],
      ['├── runtime.js', '├── carga-navegacion.js'],
      ['├── surface-controller.js', '├── control-paneles.js'],
      ['└── surface-layer.js', '└── capas-paneles.js'],
      ['├── navigation-transitions.css', '├── transiciones-navegacion.css'],
      ['├── search.css', '├── busqueda.css'],
      ['└── surfaces.css', '└── paneles.css'],
      ['`surface-controller.js`', '`control-paneles.js`'],
      ['`register-surfaces.js`', '`registro-paneles.js`'],
      ['`search.css`', '`busqueda.css`'],
      ['`collections-runtime.js`', '`carga-colecciones.js`'],
      ['`runtime.js`', '`carga-navegacion.js`'],
      ['`route-state.js`', '`estado-ruta.js`'],
      ['`assets.js`', '`recursos-navegacion.js`'],
    ];
    for (const [from, to] of docNames) updated = updated.split(from).join(to);
  }

  if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
}

const staleNeedles = [
  'js/components/navigation/shared/',
  'css/components/navigation/shared/',
  'components/navigation/shared/',
  'navigation/shared/',
  './shared/',
  '../shared/',
];
const stale = [];
for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const matches = staleNeedles.filter(needle => source.includes(needle));
  if (matches.length) stale.push(`${relative}: ${matches.join(', ')}`);
}
if (stale.length) {
  console.error('Quedaron referencias antiguas de navegación compartida:');
  stale.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

fs.unlinkSync(workflowPath);
fs.unlinkSync(selfPath);
console.log('Navegación compartida renombrada y referencias actualizadas.');
