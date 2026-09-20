import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const login = read('login.html');
const session = read('js/core/auth/proteccion-sesion.js');
const profile = read('js/pages/profile/control-acceso-perfil.js');
const profilePage = read('perfil.html');
const publicAuthNav = read('js/core/auth/navegacion-autenticacion.js');
const publicCart = read('js/components/cart/sincronizacion-carrito.js');
const admin = read('js/admin/admin-app.js');
const coordinator = read('js/core/auth/coordinador-sesion.js');
const pureState = read('js/core/auth/estado-sesion.mjs');
const firebase = read('js/core/firebase/firebase.js');

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

test('la autoridad global expone estados explícitos y no convierte null inicial en logout', () => {
  assert.match(pureState, /RESTORING/);
  assert.match(pureState, /AUTHENTICATED/);
  assert.match(pureState, /UNAUTHENTICATED/);
  assert.match(pureState, /UNKNOWN/);
  assert.match(coordinator, /sessionReady/);
  assert.match(coordinator, /subscribeSession/);
  assert.match(coordinator, /machine\.restorationResolved\(null,\s*source\)/);
  assert.doesNotMatch(coordinator, /publish\(auth\.currentUser \|\| null/);
});

test('persistencia Auth se instrumenta sin exponer identidad y el login espera su configuración', () => {
  assert.match(firebase, /browserLocalPersistence/);
  assert.match(firebase, /authPersistenceReady/);
  assert.match(firebase, /inspectAuthPersistenceStorage/);
  for (const code of ['PERSISTENCE_READY', 'PERSISTENCE_ERROR']) {
    assert.match(firebase, new RegExp(code));
  }
  for (const code of ['PERSISTENCE_BACKEND', 'PERSISTENCE_RECORD_PRESENT']) {
    assert.match(coordinator, new RegExp(code));
  }
  assert.match(login, /if \(!loginPersistenceReady\)/);
  assert.match(login, /await authPersistenceReady\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(firebase, /console\.(log|info|debug).*\b(uid|email|token|credential)\b/i);
});

test('cold restore no emite login ni reconfigura persistencia en cada pestaña', () => {
  assert.equal((coordinator.match(/onAuthStateChanged\(auth/g) || []).length, 1);
  assert.match(coordinator, /RESTORE_AUTHENTICATED/);
  assert.doesNotMatch(coordinator, /USER_LOGIN/);
  assert.match(firebase, /AUTH_PERSISTENCE_PROMISE_KEY/);
  assert.match(firebase, /window\[AUTH_PERSISTENCE_PROMISE_KEY\]/);
  assert.match(coordinator, /Promise\.resolve\(authPersistenceReady\)[\s\S]*auth\.authStateReady\(\)/);
});

test('redirect, OTP y handoff conservan contratos de persistencia sin ser autoridad de Auth', () => {
  assert.match(login, /authPersistenceReady\.then\(\(\) => getRedirectResult\(auth\)\)/);
  assert.match(login, /await authPersistenceReady/);
  assert.match(login, /createAuthHandoff\(options\.user\?\.uid\)/);
  assert.match(coordinator, /authStateReady\(\)/);
  assert.doesNotMatch(coordinator, /readAuthHandoff\(\).*restorationResolved/);
});

test('login mantiene un único dueño del listener de Auth y no redirige en UNKNOWN', () => {
  assert.equal((login.match(/onAuthStateChanged\(auth/g) || []).length, 0);
  assert.match(login, /subscribeSession\(async snapshot =>/);
  assert.match(login, /snapshot\.status === AUTH_STATES\.UNKNOWN/);
  assert.match(login, /createAuthHandoff\(options\.user\?\.uid\)/);
  assert.match(login, /googleRedirectHandlingPromise/);
});

test('ningún consumidor instala un listener directo de Firebase Auth', () => {
  const jsRoot = path.join(root, 'js');
  const excluded = [path.join('core', 'auth', 'coordinador-sesion.js')];
  const offenders = collectJavaScriptFiles(jsRoot).filter(file => {
    const relative = path.relative(jsRoot, file);
    if (excluded.includes(relative)) return false;
    const source = fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return /onAuthStateChanged\s*\(/.test(source)
      || /import\s*\{[^}]*\bonAuthStateChanged\b[^}]*\}\s*from\s*['"]https:\/\/www\.gstatic\.com\/firebase\/10\.14\.1\/firebase-auth\.js['"]/.test(source);
  });
  assert.deepEqual(offenders, [], `listeners directos fuera del coordinador: ${offenders.join(', ')}`);
});

test('admin conserva UNKNOWN y ofrece recuperación ante una ausencia de sesión', () => {
  assert.match(admin, /AUTH_STATES\.RESTORING/);
  assert.match(admin, /AUTH_STATES\.UNKNOWN/);
  assert.match(admin, /function showAdminAuthUnknown/);
  assert.match(admin, /AUTH_SESSION_RECOVERY_REQUIRED/);
  assert.match(admin, /adm-auth-login/);
  assert.match(admin, /clearAuthHandoff\(\)/);
  assert.match(admin, /window\.location\.replace\('login\.html'\)/);
  assert.match(admin, /showAdminAuthUnknown\(\)/);
  assert.match(admin, /function dismissAdminAuthUnknown/);
  assert.match(admin, /dismissAdminAuthUnknown\(\);[\s\S]*clearAdminAuthHandoffWithDiagnostic/);
  assert.match(admin, /recoverAdminUserFromHandoff/);
  assert.match(admin, /HANDOFF_WAIT_START/);
  assert.match(admin, /HANDOFF_RECOVERED/);
});

test('los headers marcan el handoff antes de abrir el panel y todos usan el runtime actualizado', () => {
  assert.match(publicAuthNav, /createAuthHandoff\(user\.uid\)/);
  assert.match(publicAuthNav, /data-internal-admin-link/);
  assert.match(publicAuthNav, /tintin-20260920-auth-handoff-header-1/);
  assert.match(admin, /tintin-20260920-auth-handoff-header-1/);
  assert.match(login, /tintin-20260920-auth-handoff-header-1/);
});

test('checkout, navegación pública y carrito nunca deciden Auth con timeouts locales', () => {
  const checkout = read('checkout.html');
  const checkoutHardening = read('js/pages/checkout/checkout-hardening.js');
  assert.match(checkout, /sessionReady/);
  assert.match(checkout, /subscribeSession/);
  assert.doesNotMatch(checkout, /setTimeout\(\(\) => \{ clearInterval/);
  assert.match(checkoutHardening, /AUTH_STATES\.UNKNOWN/);
  assert.doesNotMatch(checkoutHardening, /AUTH_READY_TIMEOUT_MS|auth\.authStateReady/);
  assert.match(publicAuthNav, /subscribeSession\(async snapshot=>/);
  assert.match(publicAuthNav, /tt-auth-restoring/);
  assert.match(publicCart, /subscribeAuthState\(activateIdentity\)/);
});

test('errores de perfil/App Check no cierran la sesión', () => {
  const product = read('js/pages/product/resenas-producto.js');
  const favorites = read('js/components/favorites/sincronizacion-favoritos.js');
  const apiClient = read('js/core/auth/cliente-api-autenticado.js');
  assert.match(product, /AUTH_STATES\.UNKNOWN/);
  assert.match(favorites, /AUTH_STATES\.UNKNOWN/);
  assert.match(apiClient, /auth\/session-unknown/);
  assert.doesNotMatch(apiClient, /authStateReady/);
});

test('arranque global no vence ni cierra sesiones automáticamente', () => {
  assert.match(session, /startProfileGate\(\)/);
  assert.doesNotMatch(session, /signOut\(/);
  assert.doesNotMatch(session, /setInterval\(/);
});

test('guard de perfil sigue limitado a checkout y no redirige durante UNKNOWN', () => {
  assert.match(profile, /const GUARDED_PAGES = \['checkout'\]/);
  assert.match(profilePage, /profile-auth-pending/);
});
