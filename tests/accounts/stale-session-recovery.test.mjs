import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const login = await readFile(new URL('../../login.html', import.meta.url), 'utf8');

test('una sesión restaurada con identidad Auth eliminada se limpia y ofrece reingreso por correo', () => {
  assert.match(login, /function isUnavailableAuthIdentity\(error\)/);
  assert.match(login, /auth\/user-not-found/);
  assert.match(login, /auth\/user-disabled/);
  assert.match(login, /await withDeadline\(signOut\(auth\), 8000\)/);
  assert.match(login, /RESTORED_SESSION_INVALID/);
  assert.match(login, /data-login-email-recovery/);
  assert.match(login, /Verificá tu correo para volver a entrar/);
});
