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

test('el destino post-login separa cuentas internas, clientes existentes y altas nuevas', () => {
  assert.match(login, /\['superadmin', 'admin', 'agent', 'viewer'\]\.includes/);
  assert.match(login, /if \(internalRole\) \{[\s\S]*?window\.location\.replace\('admin\.html'\)/);
  assert.match(login, /window\.location\.replace\(options\.welcomePending \? 'index\.html\?welcome=1' : 'index\.html'\)/);
  assert.match(login, /await ensureProfileComplete\(user, role\)/);
});

test('los tres accesos conservan el mismo cierre de sesión y Google abre dentro del clic', () => {
  const emailAuth = fs.readFileSync(new URL('../../js/email/correo-autenticacion.js', import.meta.url), 'utf8');
  const popupIndex = login.indexOf('const cred = await signInWithPopup(auth, provider);');
  const persistenceAfterPopup = login.indexOf('await authPersistenceReady.catch(() => {});', popupIndex);

  assert.ok(popupIndex >= 0, 'Google debe abrir la ventana emergente');
  assert.ok(persistenceAfterPopup > popupIndex, 'Google no debe esperar persistencia antes de abrir el popup');
  assert.match(login, /await finishGoogleLogin\(cred\.user\)/);
  assert.match(login, /const user = await verifyOtpCode\(otpEmail, code\);[\s\S]*?await finishOtpLogin\(user\)/);
  assert.match(emailAuth, /await authPersistenceReady;[\s\S]*?signInWithCustomToken\(auth, data\.customToken\)/);
  assert.match(emailAuth, /identifierBody\(identifier\)/);
});

test('la identidad del SuperAdmin es insensible a mayúsculas al crear o reparar perfil', () => {
  const profileStore = fs.readFileSync(new URL('../../js/core/store/perfil-usuario.js', import.meta.url), 'utf8');
  assert.match(profileStore, /normalizedEmail === SUPER_ADMIN\.toLowerCase\(\)/g);
});
