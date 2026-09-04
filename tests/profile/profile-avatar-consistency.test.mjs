import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint = fs.readFileSync(new URL('../../functions/api/profile-avatar-commit.js', import.meta.url), 'utf8');
const adminEndpoint = fs.readFileSync(new URL('../../functions/api/profile-avatar-admin.js', import.meta.url), 'utf8');
const moderateEndpoint = fs.readFileSync(new URL('../../functions/api/profile-avatar-moderate.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../../js/quality/estabilidad-final-publica.js', import.meta.url), 'utf8');
const adminHtml = fs.readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
const adminApp = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');

test('la foto de perfil se consolida server-side y deja historial/auditoría', () => {
  assert.match(endpoint, /requireFirebaseUser/);
  assert.match(endpoint, /profilePhotoHistory/);
  assert.match(endpoint, /auditLog/);
  assert.match(endpoint, /currentDocument: \{ updateTime: currentDocument\.updateTime \}/);
  assert.match(endpoint, /profile_photo_updated/);
});

test('el navegador no escribe directamente users/{uid} para cerrar la foto', () => {
  assert.match(client, /profile-avatar-commit/);
  assert.match(client, /await authApi\.updateProfile\(user, \{ photoURL \}\)/);
  assert.doesNotMatch(client, /firestoreApi\.setDoc\(firestoreApi\.doc\(db, 'users', user\.uid\)/);
});

test('la bandeja futura de fotos usa una proyección server-side y permiso delegable', () => {
  assert.match(adminEndpoint, /requireStaffPermission\(request, env, 'usuarios', 'gestionarFotos'\)/);
  assert.match(adminEndpoint, /firestoreAdminListAll\(env, 'users', MAX_USERS\)/);
  assert.doesNotMatch(adminEndpoint, /profile\.email/);
  assert.match(adminEndpoint, /photoURL/);
});

test('Usuarios integra la pestaña de fotos sin exponer el CRUD de cuentas', () => {
  assert.match(adminHtml, /data-user-tab="photos"/);
  assert.match(adminHtml, /id="profile-photos-card"/);
  assert.match(adminApp, /profile-avatar-admin/);
  assert.match(adminApp, /roleCanDo\('usuarios', 'gestionarFotos'\)/);
  assert.match(adminApp, /getElementById\('users-management-card'\)/);
});

test('la moderación de fotos es específica, versionada, auditable y protege la cuenta oficial', () => {
  assert.match(moderateEndpoint, /requireStaffPermission\(request, env, 'usuarios', 'gestionarFotos'\)/);
  assert.match(moderateEndpoint, /SUPERADMIN_EMAIL/);
  assert.match(moderateEndpoint, /currentDocument: \{ updateTime: currentDocument\.updateTime \}/);
  assert.match(moderateEndpoint, /limpieza_foto_perfil_fallida/);
  assert.match(moderateEndpoint, /destroyProfileAsset/);
  assert.match(adminApp, /profile-avatar-moderate/);
});
