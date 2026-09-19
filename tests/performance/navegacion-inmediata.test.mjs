import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const instant = fs.readFileSync('js/components/color/esquema-color-instantaneo.js', 'utf8');
const pages = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html',
  'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'
];
const publicShellSync = fs.readFileSync('scripts/sincronizar-inicio-navegacion-publica.js', 'utf8');
const version = publicShellSync.match(/const NAV_ENTRY_VERSION = '([^']+)'/)?.[1];
const colorVersion = publicShellSync.match(/const COLOR_FIRST_PAINT_VERSION = '([^']+)'/)?.[1];

assert.ok(version, 'La versión canónica de entrada de navegación debe existir en el sincronizador público.');
assert.ok(colorVersion, 'La versión canónica de primer paint debe existir en el sincronizador público.');

test('la primera pintura se libera en <=250 ms sin esperar Firestore', () => {
  const release = Number(instant.match(/RELEASE_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);
  const reveal = Number(instant.match(/FAST_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);
  assert.ok(Number.isFinite(release) && release <= 250, `release=${release}`);
  assert.ok(Number.isFinite(reveal) && reveal <= 250, `reveal=${reveal}`);
  assert.match(instant, /release\(usedCachedScheme \? 'cache-first-paint' : 'fallback-first-paint'\)/);
});

test('store gate pending permite navegar pero closed conserva su bloqueo propio', () => {
  assert.match(instant, /tt-fast-navigation\.tt-store-gate-pending/);
  assert.match(instant, /visibility:visible!important/);
  assert.doesNotMatch(instant, /tt-fast-navigation\.tt-store-gate-blocked/);
});

test('el ocultado rápido del loader inicial es one-shot', () => {
  assert.match(instant, /if \(initialLoaderReleased\) return true/);
  assert.match(instant, /initialLoaderReleased = true/);
  assert.match(instant, /TintinLoader\.hide/);
});

test('prefetch solo adelanta navegación interna y respeta ahorro de datos', () => {
  assert.match(instant, /link\.rel = 'prefetch'/);
  assert.match(instant, /url\.origin !== window\.location\.origin/);
  assert.match(instant, /connection\.saveData/);
  assert.match(instant, /pointerover/);
  assert.match(instant, /touchstart/);
});

test('la navegación solo importa la superficie activa', () => {
  const navigation = fs.readFileSync('js/components/navigation/compartido/carga-navegacion.js', 'utf8');
  assert.match(navigation, /navigationSurfaceImportFactories/);
  assert.match(navigation, /navigationSurfaceImportFactories\[surface\]\?\.\(\)/);
  assert.doesNotMatch(navigation, /const imports = \{\s*desktop:\s*\[\s*import\(/s);
});

function navigationModules(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...navigationModules(file));
    else if (/\.m?js$/i.test(entry.name)) output.push(file);
  }
  return output;
}

test('el árbol público de navegación no deja imports relativos JS sin versión', () => {
  const root = path.join(process.cwd(), 'js', 'components', 'navigation');
  const unversioned = [];
  const relativeImport = /(?:\bfrom\s*|\bimport\s*\()(['"])(\.\.?\/[^'"]+\.m?js)\1/g;

  for (const file of navigationModules(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(relativeImport)) {
      if (!/[?&]v=[A-Za-z0-9._-]+(?:$|[#'"`])/i.test(match[2])) {
        unversioned.push(`${path.relative(process.cwd(), file)} → ${match[2]}`);
      }
    }
  }

  assert.deepEqual(unversioned, [], `imports relativos JS/MJS sin ?v=:\n${unversioned.join('\n')}`);
});

test('todas las páginas públicas apuntan al bootstrap nuevo', () => {
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(
      html,
      new RegExp(`js/components/color/esquema-color-instantaneo\\.js\\?v=${colorVersion}`),
      page
    );
  }
});

test('el adaptador y el preload comparten una sola identidad de navegación', () => {
  const adapter = fs.readFileSync('js/inicio-navegacion-publica.js', 'utf8');
  assert.match(adapter, new RegExp(`const ENTRY_VERSION = '${version}'`));
});

test('el carrito se inicia únicamente desde la navegación modular', () => {
  const loader = fs.readFileSync('js/cargador-pagina.js', 'utf8');
  const quality = fs.readFileSync('js/quality/calidad-interfaz.js', 'utf8');
  const navigation = fs.readFileSync('js/components/navigation/compartido/carga-navegacion.js', 'utf8');
  assert.doesNotMatch(loader, /importSibling\('components\/cart\/sincronizacion-carrito\.js', 'Cart Sync'\)/);
  assert.doesNotMatch(quality, /bootCartPhase7/);
  assert.match(navigation, /CART_RUNTIME_URL = '\.\.\/\.\.\/\.\.\/components\/cart\/sincronizacion-carrito\.js\?v=tintin-20260918-global-session-restore-1-auth-persistence-20260919-1'/);
});
