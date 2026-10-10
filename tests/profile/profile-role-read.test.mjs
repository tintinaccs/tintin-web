import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isSuperAdminEmail } from '../../js/core/auth/identidad-super-admin.js';
import { ASSIGNABLE_ROLES } from '../../js/core/auth/contrato-cuentas-generado.js';

const source = fs.readFileSync(new URL('../../js/core/auth/roles.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function getUserRole(');
const end = source.indexOf('\n/**', start);
const build = new Function('auth', 'db', 'doc', 'getDoc', 'ASSIGNABLE_ROLES', 'isSuperAdminEmail',
  source.slice(start, end).replace('export ', '') + '\nreturn getUserRole;');

function fixture(currentUid = 'client') {
  let reads = 0;
  const role = build({ currentUser: { uid: currentUid, email: 'client@example.com' } }, {},
    (_db, _collection, uid) => uid,
    async () => { reads += 1; return { exists: () => true, data: () => ({ role: 'client' }) }; },
    ASSIGNABLE_ROLES, isSuperAdminEmail);
  return { role, reads: () => reads };
}

test('perfil confirmado de la cuenta actual evita una segunda lectura de rol', async () => {
  const f = fixture();
  assert.equal(await f.role('client', 'client@example.com', { role: 'admin' }), 'admin');
  assert.equal(f.reads(), 0);
});

test('un campo superadmin o correo elevado en el perfil no concede ese rol', async () => {
  const f = fixture();
  assert.equal(await f.role('client', 'client@example.com', { role: 'superadmin', email: 'tintinaccs@gmail.com' }), 'client');
  assert.equal(f.reads(), 0);
});

test('no se reutiliza el perfil de otra cuenta para resolver permisos', async () => {
  const f = fixture('other');
  assert.equal(await f.role('client', 'client@example.com', { role: 'admin' }), 'client');
  assert.equal(f.reads(), 1);
});

test('consumidores existentes sin perfil confirmado conservan su lectura', async () => {
  const f = fixture();
  assert.equal(await f.role('client', 'client@example.com'), 'client');
  assert.equal(f.reads(), 1);
});
