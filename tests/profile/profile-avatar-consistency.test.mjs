import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint = fs.readFileSync(new URL('../../functions/api/profile-avatar-commit.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../../js/quality/estabilidad-final-publica.js', import.meta.url), 'utf8');

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
