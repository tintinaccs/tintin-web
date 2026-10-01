import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('el guardia de perfil cubre toda página con sesión salvo login y admin', async () => {
  const gate = await read('js/pages/profile/control-acceso-perfil.js');
  assert.doesNotMatch(gate, /GUARDED_PAGES|isGuardedPage/);
  assert.match(gate, /page === 'login' \|\| page\.startsWith\('admin'\)/);
  assert.match(gate, /role !== 'client'/);
  assert.match(gate, /plan\.skip/);
  assert.match(gate, /goCompleteProfile\(\)/);
});

test('sin poder leer el perfil el guardia no bloquea y no marca como completo', async () => {
  const gate = await read('js/pages/profile/control-acceso-perfil.js');
  const catchBlock = gate.slice(gate.indexOf('} catch (error) {'), gate.indexOf('const role ='));
  assert.match(catchBlock, /return;/);
  assert.doesNotMatch(catchBlock, /markComplete/);
});

test('un perfil nuevo o recreado tras una baja nace incompleto y sin teléfono', async () => {
  const store = await read('js/core/store/perfil-usuario.js');
  assert.match(store, /profileStatus: 'incomplete'/);
  assert.match(store, /phone: ''/);
});

test('el error de Google por acceso deshabilitado siempre ofrece el camino por correo', async () => {
  const login = await read('login.html');
  const block = login.slice(login.indexOf('if (code === "auth/user-disabled")'));
  assert.match(block.slice(0, 900), /Verificar por correo/);
  assert.doesNotMatch(block.slice(0, 900), /isValidEmailFormat\(safeEmail\)\s*\?\s*`/);
  assert.match(login, /if \(!isValidEmailFormat\(email\)\) \{\s*emailInput\.focus\(\);\s*return;/);
});
