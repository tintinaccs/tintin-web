import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACCOUNT_CONTRACT,
  ASSIGNABLE_ROLES,
  customerIdForUid,
} from '../../js/core/auth/contrato-cuentas-generado.js';

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('customerId es estable, no contiene PII y rechaza UIDs inválidos', () => {
  const uid = 'firebaseUid_123456';
  assert.equal(customerIdForUid(uid), 'CUS_firebaseUid_123456');
  assert.equal(customerIdForUid(uid), customerIdForUid(uid));
  assert.throws(() => customerIdForUid('x'));
  assert.throws(() => customerIdForUid('uid/con/barra'));
});

test('el contrato mantiene Super Admin efectivo pero no asignable', () => {
  assert.deepEqual([...ACCOUNT_CONTRACT.roles], ['superadmin', 'admin', 'agent', 'viewer', 'client']);
  assert.deepEqual([...ASSIGNABLE_ROLES], ['admin', 'agent', 'viewer', 'client']);
  assert.equal(ASSIGNABLE_ROLES.includes('superadmin'), false);
});

test('Google y PIN convergen sobre findOrCreateUserByEmail', () => {
  const send = read('functions/api/email-otp-send.js');
  const verify = read('functions/api/email-otp-verify.js');
  assert.equal(send.includes('google_account_exists'), false);
  assert.match(verify, /findOrCreateUserByEmail\(env, email\)/);
});

test('el login por correo y username usa Pages Functions también desde localhost', () => {
  const auth = read('js/email/correo-autenticacion.js');
  assert.match(auth, /LOCAL_FUNCTIONS_ORIGIN/);
  assert.match(auth, /hostname/);
});

test('la eliminación administrativa es tombstone y la auditoría es append-only', () => {
  const endpoint = read('functions/api/admin-delete-user.js');
  const lifecycle = read('cloudflare/user-lifecycle-domain.js');
  const rules = read('firestore.rules');
  assert.match(endpoint, /applyUserLifecycle/);
  assert.match(lifecycle, /profileStatus: fsString\('deleted'\)/);
  assert.match(lifecycle, /deleted: fsBoolean\(true\)/);
  assert.match(lifecycle, /setFirebaseUserDisabled\(env, uid, action === 'softDelete'\)/);
  assert.match(lifecycle, /auditLog\/\$\{eventId\}/);
  assert.doesNotMatch(endpoint, /deleteFirebaseUser/);
  assert.doesNotMatch(lifecycle, /deleteFirebaseUser/);
  assert.match(rules, /match \/auditLog\/\{logId\}[\s\S]*?allow update, delete: if false/);
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*?allow delete: if false/);
});

test('clientes no tienen expiración fija y staff usa inactividad', () => {
  const session = read('js/core/auth/proteccion-sesion.js');
  assert.match(session, /if \(!STAFF_ROLES\.includes\(currentRole\)\) \{ clearSessionStart\(\); return; \}/);
  assert.match(session, /STAFF_INACTIVITY_MS = 30 \* 60 \* 1000/);
  assert.match(session, /SUPERADMIN_INACTIVITY_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(session, /window\.addEventListener\(eventName, recordActivity/);
});
