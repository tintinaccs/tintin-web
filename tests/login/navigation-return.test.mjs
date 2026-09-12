import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

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
