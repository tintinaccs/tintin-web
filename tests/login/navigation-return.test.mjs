import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => readFile(path.join(repoRoot, relativePath), 'utf8');

// Regresión integral: este archivo cubre los contratos de retorno y el inventario UX del cierre final.
async function listFilesRecursive(directory, extensions) {
  const output = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (extensions.some(extension => entry.name.endsWith(extension))) output.push(full);
    }
  }
  await walk(directory);
  return output;
}

function occurrences(source, regex) {
  return [...source.matchAll(regex)].length;
}

test('Mi cuenta conserva pathname, query y hash al entrar o crear cuenta', async () => {
  const [panel, authNav] = await Promise.all([
    read('js/components/navigation/compartido/panel-cuenta.js'),
    read('js/core/auth/navegacion-autenticacion.js'),
  ]);

  for (const source of [panel, authNav]) {
    assert.match(source, /window\.location\.pathname/);
    assert.match(source, /window\.location\.search/);
    assert.match(source, /window\.location\.hash/);
    assert.match(source, /`\/login\?from=\$\{encodeURIComponent\(path\)\}`/);
  }

  assert.doesNotMatch(authNav, /href="\/login">Iniciar sesión<\/a><a[^>]+href="\/login">Crear una cuenta/);
});

test('el guardia de checkout conserva la URL completa al pedir perfil', async () => {
  const gate = await read('js/pages/profile/control-acceso-perfil.js');
  assert.match(gate, /location\.pathname/);
  assert.match(gate, /location\.search/);
  assert.match(gate, /location\.hash/);
  assert.match(gate, /location\.replace\(`\/login\?from=\$\{encodeURIComponent\(from\)\}`\)/);
  assert.doesNotMatch(gate, /const from = `\/\$\{page\}`/);
});

test('las acciones de producto que exigen cuenta ya conservan el destino completo', async () => {
  const reviews = await read('js/pages/product/resenas-producto.js');
  assert.match(reviews, /location\.pathname/);
  assert.match(reviews, /location\.search/);
  assert.match(reviews, /location\.hash/);
  assert.match(reviews, /\/login\?from=/);
});

test('inventario de superficies no contiene enlaces vacíos, javascript href ni IDs estáticos duplicados', async () => {
  const rootEntries = await readdir(repoRoot, { withFileTypes: true });
  const htmlFiles = rootEntries
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => path.join(repoRoot, entry.name))
    .sort();

  const inventory = {
    pages: htmlFiles.length,
    sections: 0,
    articles: 0,
    anchors: 0,
    buttons: 0,
    forms: 0,
    formControls: 0,
    jsFiles: 0,
    eventBindings: 0,
    namedFunctions: 0,
  };

  for (const file of htmlFiles) {
    const source = await readFile(file, 'utf8');
    const staticMarkup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    inventory.sections += occurrences(staticMarkup, /<section\b/gi);
    inventory.articles += occurrences(staticMarkup, /<article\b/gi);
    inventory.anchors += occurrences(staticMarkup, /<a\b/gi);
    inventory.buttons += occurrences(staticMarkup, /<button\b/gi);
    inventory.forms += occurrences(staticMarkup, /<form\b/gi);
    inventory.formControls += occurrences(staticMarkup, /<(?:input|select|textarea)\b/gi);

    assert.doesNotMatch(staticMarkup, /href\s*=\s*["']\s*["']/i, `${path.basename(file)} contiene href vacío`);
    assert.doesNotMatch(staticMarkup, /href\s*=\s*["']\s*javascript:/i, `${path.basename(file)} contiene javascript: href`);

    const ids = [...staticMarkup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    assert.deepEqual(duplicates, [], `${path.basename(file)} contiene IDs estáticos duplicados: ${duplicates.join(', ')}`);
  }

  const jsFiles = await listFilesRecursive(path.join(repoRoot, 'js'), ['.js', '.mjs']);
  inventory.jsFiles = jsFiles.length;
  for (const file of jsFiles) {
    const source = await readFile(file, 'utf8');
    inventory.eventBindings += occurrences(source, /\.addEventListener\s*\(/g) + occurrences(source, /\.on(?:click|submit|change|input|keydown|keyup)\s*=/g);
    inventory.namedFunctions += occurrences(source, /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g);
  }

  console.log(`INVENTARIO UX | páginas=${inventory.pages} | secciones=${inventory.sections} | artículos=${inventory.articles} | enlaces=${inventory.anchors} | botones=${inventory.buttons} | formularios=${inventory.forms} | controles=${inventory.formControls} | JS=${inventory.jsFiles} | bindings=${inventory.eventBindings} | funciones_nombradas=${inventory.namedFunctions}`);

  assert.ok(inventory.pages > 0, 'Debe existir al menos una página HTML');
  assert.ok(inventory.anchors > 0, 'Debe existir navegación enlazada');
  assert.ok(inventory.buttons > 0, 'Debe existir al menos un botón interactivo');
});
