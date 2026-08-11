import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const instant = fs.readFileSync('js/components/color/esquema-color-instantaneo.js', 'utf8');
const pages = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html',
  'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html', '404.html', 'login.html', 'perfil.html', 'checkout.html'
];
const version = 'tintin-20260810-fast-nav-2';

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

test('todas las páginas públicas apuntan al bootstrap nuevo', () => {
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(
      html,
      new RegExp(`js/components/color/esquema-color-instantaneo\\.js\\?v=${version}`),
      page
    );
  }
});
