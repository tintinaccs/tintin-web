import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const profileStore = read('js/core/store/perfil-usuario.js');
const login = read('login.html');

test('la recuperación comercial auxiliar no bloquea la creación ni el reingreso', () => {
  assert.match(profileStore, /const HISTORY_CLAIM_TIMEOUT_MS = 4_500/);
  assert.match(profileStore, /controller\?\.abort\(\)/);
  assert.match(profileStore, /function queueHistoricalCommerceClaim/);
  assert.doesNotMatch(profileStore, /await claimHistoricalCommerce\(user\)/);
});

test('las operaciones canónicas de perfil tienen un plazo finito', () => {
  assert.match(profileStore, /const PROFILE_OPERATION_TIMEOUT_MS = 8_000/);
  assert.match(profileStore, /function withProfileDeadline/);
  assert.match(profileStore, /withProfileDeadline\(\(\) => getDoc\(ref\), 'read'\)/);
  assert.match(profileStore, /withProfileDeadline\(\(\) => setDoc\(ref,/);
});

test('una restauración de sesión lenta libera el loader y conserva la cuenta', () => {
  assert.match(login, /const PROFILE_READ_DEADLINE_MS = 15000/);
  assert.match(login, /withDeadline\(getStoreAccessConfig\(\), PROFILE_READ_DEADLINE_MS\)/);
  assert.match(login, /const \[profileResult, storeAccessResult\] = await Promise\.all/);
  assert.match(login, /if \(profileResult\.error \|\| storeAccessResult\.error\)/);
  assert.match(login, /try \{\s*await ensureProfileComplete\(user, role\);[\s\S]*?\} catch \(restoreError\) \{[\s\S]*?hideLoginOverlay\(\);[\s\S]*?revealLoginSurface\(\)/);
  assert.match(login, /Tu sesión sigue activa; recargá la página y no hace falta volver a registrarte/);
});

test('el onboarding restaurado usa únicamente el plan canónico y no referencia data inexistente', () => {
  assert.doesNotMatch(login, /data\.username\s*\|\|\s*data\.userName/);
  assert.doesNotMatch(login, /usernameMissing/);
  assert.match(login, /usernameField\.style\.display = plan\.needsUsername \? '' : 'none'/);
  assert.match(login, /if \(plan\.needsUsername\) \{/);
});
