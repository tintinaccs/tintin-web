import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('Firestore protege teléfono, cédula y username después del onboarding', () => {
  const rules = read('firestore.rules');
  const protectedBlock = rules.match(/function protectedUserFieldsChanged\(\)[\s\S]*?\n    \}/)?.[0] || '';
  for (const field of ['phone', 'ci', 'username', 'usernameChangeCount', 'usernameChangedAt']) {
    assert.match(protectedBlock, new RegExp(`'${field}'`), `${field} debe quedar protegido`);
  }
  assert.match(rules, /match \/ciReservations\/\{ciKey\}/);
  assert.match(rules, /allow create, update, delete: if false;/);
});

test('las reservas activas no pueden liberarse desde el navegador', () => {
  const rules = read('firestore.rules');
  const phoneRules = rules.match(/match \/phoneReservations\/\{phoneKey\}[\s\S]*?allow update: if false;/)?.[0] || '';
  const usernameRules = rules.match(/match \/usernameReservations\/\{usernameKey\}[\s\S]*?allow update: if false;/)?.[0] || '';
  assert.match(phoneRules, /phoneReservationKey\([\s\S]*?\) != phoneKey/);
  assert.match(usernameRules, /\.data\.username != usernameKey/);
});

test('el perfil usa el módulo Firebase real y bloquea el teléfono', () => {
  const profile = read('js/pages/profile/mantenimiento-perfil.js');
  assert.doesNotMatch(profile, /import\(`\.\/firebase\.js/);
  assert.match(profile, /import\(`\.\.\/\.\.\/core\/firebase\/firebase\.js/);
  assert.match(profile, /input\.readOnly = true/);
  assert.match(profile, /\/api\/account-username-change/);
});

test('el cambio de username se decide en backend y sólo una vez', () => {
  const endpoint = read('functions/api/account-username-change.js');
  assert.match(endpoint, /requireFirebaseUser/);
  assert.match(endpoint, /usernameChangeCount/);
  assert.match(endpoint, /usedChanges >= 1/);
  assert.match(endpoint, /currentDocument: \{ updateTime: userDoc\.updateTime \}/);
  assert.match(endpoint, /auditLog/);
});

test('la encomienda fija cédula canónica y customerId en el pedido', () => {
  const server = read('apps-script/CrearPedido.gs');
  assert.match(server, /var expectedCustomerId = 'CUS_' \+ uid/);
  assert.match(server, /customerId: customerId/);
  assert.match(server, /ciReservations\//);
  assert.match(server, /userIdentityPatch\.ci = ci/);
  assert.match(server, /error: 'ci_mismatch'/);
  assert.match(server, /error: 'ci_already_registered'/);
});

test('el PIN se genera sin sesgo por módulo y se emite con precondición atómica', () => {
  const sender = read('functions/api/email-otp-send.js');
  assert.match(sender, /OTP_UNBIASED_LIMIT/);
  assert.match(sender, /while \(value >= OTP_UNBIASED_LIMIT\)/);
  assert.match(sender, /currentDocument: existingDoc[\s\S]*?updateTime: existingDoc\.updateTime/);
  assert.match(sender, /firestoreAdminCommit/);
});

test('un PIN correcto se consume atómicamente antes de crear la sesión', () => {
  const verify = read('functions/api/email-otp-verify.js');
  assert.match(verify, /consumedAt/);
  assert.match(verify, /currentDocument: \{ updateTime: existingDoc\.updateTime \}/);
  assert.match(verify, /await atomicMerge\(env, path, doc, \{ consumedAt:/);
  const consumeIndex = verify.indexOf('await atomicMerge(env, path, doc, { consumedAt:');
  const sessionIndex = verify.indexOf('findOrCreateUserByEmail');
  assert.ok(consumeIndex >= 0 && sessionIndex >= 0 && consumeIndex < sessionIndex, 'el PIN debe consumirse antes de crear la sesión');
});
