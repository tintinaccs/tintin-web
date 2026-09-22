import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el panel de cuenta conserva destinos por rol y CTA legible', () => {
  const authNav = read('js/core/auth/navegacion-autenticacion.js');
  const header = read('js/components/navigation/escritorio/encabezado-escritorio.js');
  const css = read('css/components/navigation/compartido/coherencia-visual.css');

  assert.match(header, /id="btn-cuenta"[\s\S]*data-nav-action="account"/);
  assert.match(authNav, /href="\/perfil"/);
  assert.match(authNav, /href="\/perfil#mis-pedidos"/);
  assert.match(authNav, /hasAdminAccess\(user,role\)[\s\S]*href="\/admin"/);
  assert.match(authNav, /href="\$\{loginHref\}"/);
  assert.match(css, /\.tt-account-primary[\s\S]*color: #fff !important/);
  assert.match(css, /--tt-drawer-accent: #c64273/);
});
