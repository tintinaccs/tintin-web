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
  assert.match(source, /subscribeAuthState\(/);
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
  assert.match(profileStore, /await withProfileDeadline\(\(\) => setDoc\(ref, identityPatch, \{ merge: true \}\), 'write'\)/);
});

function runtimeRepair({existsAfterFailure}) {
  const begin=source.indexOf('  async function repairCanonicalProfileIfNeeded()');
  const end=source.indexOf('\n  function startCanonicalProfileRepair()',begin);
  const fn=source.slice(begin,end).replace(/await Promise\.all\(\[[\s\S]*?\]\);/, 'dependencies;');
  let reads=0;
  const failure=Object.assign(new Error('concurrent create rejected'),{code:'permission-denied'});
  const firestore={doc:()=>({}),getDoc:async()=>({exists:()=>++reads>1 && existsAfterFailure})};
  const deps=[{db:{}},{AUTH_METHOD:{EMAIL:'emailOtp'},ensureUserProfile:async()=>{throw failure;}},firestore,{subscribeAuthState:callback=>{queueMicrotask(()=>callback({uid:'u',providerData:[]}));return ()=>{};}}];
  return {run:new Function('dependencies','authMethodForUser','return '+fn)(deps,()=> 'emailOtp'),failure};
}

test('la reparación acepta el perfil creado simultáneamente por el login',async()=>{
  const {run}=runtimeRepair({existsAfterFailure:true});
  assert.deepEqual(await run(),{repaired:false,reason:'created_concurrently'});
});

test('una creación rechazada sin perfil persistido conserva el error de permisos',async()=>{
  const {run,failure}=runtimeRepair({existsAfterFailure:false});
  await assert.rejects(run(),error=>error===failure);
});
