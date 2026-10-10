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

test('la restauración usa el plan breve sin variables inexistentes', () => {
  const body = login.slice(login.indexOf('async function ensureProfileComplete'), login.indexOf('async function finishGoogleLogin'));
  assert.doesNotMatch(body, /\busernameMissing\b/);
  assert.doesNotMatch(body, /\bdata\.(?:username|userName)\b/);
  assert.match(body, /nameField\.hidden = !plan\.needsName/);
  assert.match(body, /phoneField\.hidden = !plan\.needsPhone/);
});

test('una restauración de sesión lenta libera el loader y conserva la cuenta', () => {
  assert.match(login, /const PROFILE_READ_DEADLINE_MS = 15000/);
  assert.match(login, /withDeadline\(getStoreAccessConfig\(\), PROFILE_READ_DEADLINE_MS\)/);
  assert.match(login, /const \[profileResult, storeAccessResult\] = await Promise\.all/);
  assert.match(login, /if \(profileResult\.error \|\| storeAccessResult\.error\)/);
  assert.match(login, /try \{\s*await ensureProfileComplete\(user, role\);[\s\S]*?\} catch \(restoreError\) \{[\s\S]*?hideLoginOverlay\(\);[\s\S]*?revealLoginSurface\(\)/);
  assert.match(login, /showActiveSessionState\('No pudimos preparar el acceso en este navegador/);
  assert.match(login, /Cuenta activa/);
});

