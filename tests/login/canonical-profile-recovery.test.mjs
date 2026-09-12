import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../js/pages/login/mantenimiento-acceso.js', import.meta.url), 'utf8');
const profileStore = fs.readFileSync(new URL('../../js/core/store/perfil-usuario.js', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

test('login repara una sesión Auth cuyo users/{uid} no existe usando ensureUserProfile', () => {
  assert.match(source, /repairCanonicalProfileIfNeeded/);
  assert.match(source, /getDoc\(ref\)/);
  assert.match(source, /if \(snapshot\.exists\(\)\) return/);
  assert.match(source, /ensureUserProfile\(db, user, method\)/);
  assert.match(source, /auth\.authStateReady/);
});

test('guardar Últimos datos espera la reparación canónica y no hace signOut', () => {
  assert.match(source, /TintinCanonicalProfileReady/);
  assert.match(source, /#btn-save-profile/);
  assert.match(source, /canonicalProfileReady\.then/);
  assert.doesNotMatch(source, /signOut\s*\(/);
});

test('la reparación es necesaria porque las reglas exigen el contrato completo al crear users', () => {
  assert.match(rules, /function userCreateValid\(userId\)/);
  assert.match(rules, /data\.customerId == 'CUS_' \+ userId/);
  assert.match(rules, /data\.identityVersion == 1/);
  assert.match(rules, /data\.profileStatus == 'incomplete'/);
  assert.match(rules, /allow create: if userCreateValid\(userId\)/);
});

test('un login existente no degrada active o incomplete a legacy', () => {
  assert.match(profileStore, /if \(!data\.customerId && !data\.profileStatus\)/);
  assert.match(profileStore, /identityPatch\.profileStatus = 'legacy'/);
  assert.doesNotMatch(profileStore, /if \(!data\.customerId\) \{[\s\S]{0,240}identityPatch\.profileStatus = 'legacy'/);
});

test('el login de un perfil existente sólo sincroniza metadata salvo bootstrap realmente legacy', () => {
  assert.match(profileStore, /const identityPatch = \{[\s\S]*?updatedAt:[\s\S]*?lastLogin:[\s\S]*?lastAuthMethod:[\s\S]*?authMethods/);
  assert.match(profileStore, /await setDoc\(ref, identityPatch, \{ merge: true \}\)/);
});
