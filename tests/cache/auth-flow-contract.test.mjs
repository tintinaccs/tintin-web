import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const login = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('../../js/core/auth/proteccion-sesion.js', import.meta.url), 'utf8');
const profile = fs.readFileSync(new URL('../../js/pages/profile/control-acceso-perfil.js', import.meta.url), 'utf8');
const profileCode = profile.replace(/\/\/.*$/gm, '');
const profilePage = fs.readFileSync(new URL('../../perfil.html', import.meta.url), 'utf8');
const publicAuthNav = fs.readFileSync(new URL('../../js/core/auth/navegacion-autenticacion.js', import.meta.url), 'utf8');
const publicCart = fs.readFileSync(new URL('../../js/components/cart/sincronizacion-carrito.js', import.meta.url), 'utf8');
const superAdminIdentity = await import('../../js/core/auth/identidad-super-admin.js');

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

test('login mantiene un único dueño del listener de Auth y evita redirecciones repetidas', () => {
  assert.equal((login.match(/onAuthStateChanged\(auth/g) || []).length, 0);
  assert.match(login, /subscribeAuthState\(async user =>/);
  assert.match(login, /googleRedirectHandlingPromise/);
  assert.match(login, /explicitLoginInProgress/);
  assert.match(login, /clearGoogleRedirectPending\(\)/);
  assert.match(login, /window\.location\.replace\(/);
});

test('los consumidores de aplicación delegan Auth al coordinador de sesión', () => {
  const jsRoot = fileURLToPath(new URL('../../js/', import.meta.url));
  const excluded = [
    path.join('core', 'auth', 'coordinador-sesion.js'),
    path.join('diagnostic-shims', 'adaptador-autenticacion.js')
  ];
  const offenders = collectJavaScriptFiles(jsRoot).filter(file => {
    const relative = path.relative(jsRoot, file);
    if (excluded.includes(relative)) return false;
    const source = fs.readFileSync(file, 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    return /onAuthStateChanged\s*\(/.test(source)
      || /import\s*\{[^}]*\bonAuthStateChanged\b[^}]*\}\s*from\s*['"]https:\/\/www\.gstatic\.com\/firebase\/10\.14\.1\/firebase-auth\.js['"]/.test(source);
  });

  assert.deepEqual(offenders, [], `listeners/imports directos fuera del coordinador: ${offenders.join(', ')}`);
});

test('la identidad privilegiada tiene una sola autoridad y conserva exclusividad por email', () => {
  const identitySource = fs.readFileSync(new URL('../../js/core/auth/identidad-super-admin.js', import.meta.url), 'utf8');
  const rolesSource = fs.readFileSync(new URL('../../js/core/auth/roles.js', import.meta.url), 'utf8');
  const maestroSource = fs.readFileSync(new URL('../../js/admin/maestro/panel-maestro.js', import.meta.url), 'utf8');

  assert.match(identitySource, /SUPER_ADMIN_EMAIL/);
  assert.doesNotMatch(identitySource, /tintinaccs@gmail\.com/);
  assert.match(rolesSource, /isSuperAdminEmail\(authenticatedEmail\)/);
  assert.match(maestroSource, /import \{ isSuperAdmin \}/);
  assert.equal(superAdminIdentity.isSuperAdminEmail('tintinaccs@gmail.com'), true);
  assert.equal(superAdminIdentity.isSuperAdminEmail('otro@example.com'), false);
  assert.equal(superAdminIdentity.isSuperAdmin({ email: ' TINTINACCS@GMAIL.COM ' }), true);
  assert.equal(superAdminIdentity.isSuperAdmin({ email: 'otro@example.com', role: 'superadmin' }), false);
});

test('arranque global no vence ni cierra sesiones automáticamente', () => {
  assert.match(session, /startProfileGate\(\)/);
  assert.doesNotMatch(session, /signOut\(/);
  assert.doesNotMatch(session, /setInterval\(/);
  assert.doesNotMatch(session, /localStorage\.(?:setItem|removeItem)/);
});

test('guard de perfil solo redirige checkout y no encadena from', () => {
  assert.match(profile, /const GUARDED_PAGES = \['checkout'\]/);
  assert.match(profileCode, /const from = `\$\{location\.pathname \|\| `\/\$\{page\}`\}\$\{location\.search \|\| ''\}\$\{location\.hash \|\| ''\}`/);
});

test('el destino post-login separa cuentas internas y valida el perfil por su estado real', () => {
  assert.match(login, /\['superadmin', 'admin', 'agent', 'viewer'\]\.includes/);
  assert.match(login, /if \(internalRole\) \{[\s\S]*?window\.location\.replace\('admin\.html'\)/);
  assert.match(login, /window\.location\.replace\(options\.welcomePending \? 'index\.html\?welcome=1' : 'index\.html'\)/);
  assert.match(login, /async function ensureProfileComplete\(user, role\)/);
  assert.match(login, /await ensureProfileComplete\(user, role\);/);
  assert.doesNotMatch(login, /firstLogin/);
});

test('Últimos datos depende del perfil incompleto y nunca del método de acceso', () => {
  const completionFunction = login.match(/async function ensureProfileComplete[\s\S]*?\n\}/)?.[0] || '';

  assert.match(completionFunction, /SUPER_ADMIN\.toLowerCase\(\)/);
  assert.match(completionFunction, /role[^\n]*superadmin/);
  assert.match(completionFunction, /getProfileCompletionPlan/);
  assert.doesNotMatch(completionFunction, /firstLogin/);
});

test('el traspaso de cualquier cuenta interna al panel espera restaurar su sesión', () => {
  const admin = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');

  assert.match(login, /tt_auth_handoff_uid/);
  assert.match(login, /options\.user\?\.uid/);
  assert.match(admin, /tt_auth_handoff_uid/);
  assert.match(admin, /const MAX_ATTEMPTS = handoffUid \? 30 : 6/);
  assert.match(admin, /sessionStorage\.removeItem\('tt_auth_handoff_uid'\)/);
});

test('el panel ya iniciado no expulsa al SuperAdmin por un null transitorio de Firebase', () => {
  const admin = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');

  assert.match(admin, /if \(!user && \(currentUser\?\.uid \|\| adminGuardInitializedUid\)\)/);
  assert.match(admin, /Estado de Auth transitorio ignorado/);
});

test('el handoff pendiente conserva el loader y no muestra un falso error de inicio', () => {
  const admin = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
  const pendingBranch = admin.match(/if \(!user && hasPendingAdminAuthHandoff\(\)\) \{[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(pendingBranch, 'debe existir la rama de restauración pendiente');
  assert.doesNotMatch(pendingBranch, /showAdminInitFailure\(\)/);
  assert.match(pendingBranch, /TintinLoader\?\.setText/);
  assert.match(pendingBranch, /Restaurando tu sesión/);
});

test('el handoff sin identidad no deja el panel bloqueado indefinidamente', () => {
  const admin = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');

  assert.match(admin, /scheduleAdminHandoffRecovery\(\)/);
  assert.match(admin, /sessionStorage\.removeItem\('tt_auth_handoff_uid'\)/);
  assert.match(admin, /window\.location\.replace\('login\.html\?from=%2Fadmin'\)/);
  assert.match(admin, /if \(auth\.currentUser \|\| currentUser\?\.uid \|\| adminGuardInitializedUid\) return/);
});

test('los tres accesos conservan el mismo cierre de sesión y Google abre dentro del clic', () => {
  const emailAuth = fs.readFileSync(new URL('../../js/email/correo-autenticacion.js', import.meta.url), 'utf8');
  const popupIndex = login.indexOf('const cred = await signInWithPopup(auth, provider);');
  const persistenceAfterPopup = login.indexOf('await authPersistenceReady.catch(() => {});', popupIndex);

  assert.ok(popupIndex >= 0, 'Google debe abrir la ventana emergente');
  assert.ok(persistenceAfterPopup > popupIndex, 'Google no debe esperar persistencia antes de abrir el popup');
  assert.match(login, /await finishGoogleLogin\(cred\.user\)/);
  const redirectIndex = login.indexOf('await signInWithRedirect(auth, provider);');
  const persistenceBeforeRedirect = login.lastIndexOf('await authPersistenceReady.catch(() => {});', redirectIndex);
  assert.ok(persistenceBeforeRedirect > popupIndex, 'El fallback redirect debe esperar persistencia después del intento de popup');
  assert.ok(persistenceBeforeRedirect < redirectIndex, 'El fallback redirect debe persistir antes de abandonar la página');
  assert.match(login, /const user = await verifyOtpCode\(otpEmail, code\);[\s\S]*?await finishOtpLogin\(user\)/);
  assert.match(emailAuth, /await authPersistenceReady;[\s\S]*?signInWithCustomToken\(auth, data\.customToken\)/);
  assert.match(emailAuth, /identifierBody\(identifier\)/);
});

test('la identidad del SuperAdmin es insensible a mayúsculas al crear o reparar perfil', () => {
  const profileStore = fs.readFileSync(new URL('../../js/core/store/perfil-usuario.js', import.meta.url), 'utf8');
  assert.match(profileStore, /normalizedEmail === SUPER_ADMIN\.toLowerCase\(\)/g);
});

test('login conserva la sesión si falla transitoriamente la lectura del perfil', () => {
  const profileReadError = login.match(/if \(profileResult\.error\) \{[\s\S]*?\n  \}/)?.[0] || '';

  assert.match(login, /await authPersistenceReady\.catch\(\(\) => \{\}\)/);
  assert.match(login, /auth\.authStateReady\?\./);
  assert.doesNotMatch(profileReadError, /signOut\(auth\)/);
  assert.match(profileReadError, /Tu sesión sigue activa/);
});

test('rutas públicas esperan Auth antes de pintar visitante o activar carrito', () => {
  assert.match(publicAuthNav, /subscribeAuthState\(async user=>/);
  assert.doesNotMatch(publicAuthNav, /authStateReady\.then/);
  assert.match(publicCart, /subscribeAuthState\(activateIdentity\)/);
  assert.doesNotMatch(publicCart, /authStateReady\.then\(.*onAuthStateChanged/);
});

test('el perfil no expone placeholders privados mientras Auth restaura la sesión', () => {
  assert.match(profilePage, /profile-auth-pending/);
  assert.match(profilePage, /html\.profile-auth-pending \.perfil-wrap/);
  assert.match(profilePage, /if \(!user\) \{[\s\S]*?window\.location\.replace\('login\.html\?from=%2Fperfil'\)/);
  assert.match(profilePage, /document\.documentElement\.classList\.remove\('profile-auth-pending'\)/);
});

test('el icono de cuenta no tiene ninguna ruta de logout implícita', () => {
  assert.match(publicAuthNav, /data-auth-account-button/);
  assert.doesNotMatch(publicAuthNav, /closest\?\.\('#account-logout-btn,#tablet-user-logout-btn,#btn-logout'\)/);
  assert.match(publicAuthNav, /closest\?\.\('#account-logout-btn,#tablet-user-logout-btn'\)/);
});
