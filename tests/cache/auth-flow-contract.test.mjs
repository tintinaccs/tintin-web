import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const login = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('../../js/core/auth/proteccion-sesion.js', import.meta.url), 'utf8');
const profile = fs.readFileSync(new URL('../../js/pages/profile/control-acceso-perfil.js', import.meta.url), 'utf8');
const profileCode = profile.replace(/\/\/.*$/gm, '');

test('login mantiene un único dueño del listener de Auth y evita redirecciones repetidas', () => {
  assert.equal((login.match(/onAuthStateChanged\(auth/g) || []).length, 1);
  assert.match(login, /googleRedirectHandlingPromise/);
  assert.match(login, /explicitLoginInProgress/);
  assert.match(login, /clearGoogleRedirectPending\(\)/);
  assert.match(login, /window\.location\.replace\(/);
});

test('protección de sesión pausa el polling oculto y evita carreras de usuario', () => {
  assert.match(session, /stopSessionChecks\(\)/);
  assert.match(session, /document\.hidden/);
  assert.match(session, /enforceSequence/);
  assert.match(session, /auth\.currentUser\?\.uid !== user\.uid/);
});

test('guard de perfil solo redirige checkout y no encadena from', () => {
  assert.match(profile, /const GUARDED_PAGES = \['checkout'\]/);
  assert.match(profileCode, /const from = `\/\$\{page\}`/);
});
