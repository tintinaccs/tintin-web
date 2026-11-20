import assert from 'node:assert/strict';
import test from 'node:test';

import { updateCustomerProfileAdmin, validateCustomerProfileInput } from '../../cloudflare/perfil-cliente-admin.mjs';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { DEFAULT_COUNTRY, phoneKey } from '../../js/components/forms/utilidades-telefono.js';

const UID = 'cliente_uid_123';
const ACTOR = { uid: 'super-uid', email: 'tintinaccs@gmail.com' };
const VALID = { uid: UID, changeId: 'cliente_cambio_0001', firstName: 'Ana', lastName: 'Ruiz', phone: '0981 123 456', email: 'ana@example.com', address: 'Av. España 1234', baseChangeId: '' };

function document(path, data) {
  return { name: `projects/test/databases/(default)/documents/${path}`, fields: encodeFirestoreFields(data), updateTime: '2026-11-01T00:00:00.000Z' };
}

function deps(entries = {}, { commitError, authError, orders = [] } = {}) {
  const map = new Map(Object.entries(entries));
  const commits = [];
  const authCalls = [];
  return {
    commits,
    authCalls,
    get: async (_env, path) => map.get(path) || null,
    commit: async (_env, writes) => { if (commitError) throw commitError; commits.push(writes); return {}; },
    updateAuthEmail: async (_env, uid, email) => { authCalls.push([uid, email]); if (authError) throw authError; return { changed: true, removedProviders: ['google.com'] }; },
    ordersOfUser: async () => orders,
    now: () => new Date('2026-11-19T12:00:00.000Z'),
    randomId: () => 'evento1',
  };
}

function client(extra = {}) {
  return { [`users/${UID}`]: document(`users/${UID}`, { firstName: 'Ana', lastName: 'Ruiz', name: 'Ana Ruiz', phone: '+595981123456', email: 'temp@tempmail.test', address: 'Av. España 1234', customerId: 'CUS_ANA', ...extra }) };
}

test('ningún dato obligatorio puede quedar vacío', () => {
  for (const [field, error] of [['firstName', /nombre no puede/], ['lastName', /apellido no puede/], ['phone', /teléfono no puede/], ['email', /correo no puede/]]) {
    assert.throws(() => validateCustomerProfileInput({ ...VALID, [field]: '   ' }), error);
  }
  assert.throws(() => validateCustomerProfileInput({ ...VALID, address: '' }, { address: 'Previa' }), /dirección no puede/);
  assert.equal(validateCustomerProfileInput({ ...VALID, address: '' }, {}).address, '');
  assert.throws(() => validateCustomerProfileInput({ ...VALID, email: 'sin-arroba' }), /Correo inválido/);
  assert.throws(() => validateCustomerProfileInput({ ...VALID, email: 'TintinAccs@gmail.com' }), /Super Admin/);
  assert.throws(() => validateCustomerProfileInput({ ...VALID, phone: '123' }), /Teléfono inválido/);
});

test('cambiar el correo cambia primero el acceso y después confirma perfil y auditoría juntos', async () => {
  const store = deps(client());
  const result = await updateCustomerProfileAdmin({}, VALID, ACTOR, store);
  assert.equal(result.emailChanged, true);
  assert.deepEqual(store.authCalls, [[UID, 'ana@example.com']]);
  const writes = store.commits[0];
  const profile = decodeFirestoreFields(writes.find(write => write.path === `users/${UID}`).fields);
  assert.equal(profile.email, 'ana@example.com');
  assert.equal(profile.lastChangeId, VALID.changeId);
  const audit = decodeFirestoreFields(writes.find(write => write.path.startsWith('auditLog/')).fields);
  assert.equal(audit.action, 'cambiar_correo_cliente');
  assert.equal(audit.before.email, 'temp@tempmail.test');
  assert.deepEqual(audit.removedProviders, ['google.com']);
});

test('si el guardado falla se devuelve el correo de acceso anterior', async () => {
  const store = deps(client(), { commitError: Object.assign(new Error('conflicto'), { status: 409 }) });
  await assert.rejects(updateCustomerProfileAdmin({}, VALID, ACTOR, store), /La ficha cambió/);
  assert.deepEqual(store.authCalls, [[UID, 'ana@example.com'], [UID, 'temp@tempmail.test']]);
});

test('editar sin cambiar el correo no toca el acceso; un teléfono ajeno se rechaza', async () => {
  const same = deps(client({ email: 'ana@example.com' }));
  const result = await updateCustomerProfileAdmin({}, { ...VALID, firstName: 'Ana María' }, ACTOR, same);
  assert.equal(result.emailChanged, false);
  assert.equal(same.authCalls.length, 0);
  assert.equal(decodeFirestoreFields(same.commits[0].find(write => write.path.startsWith('auditLog/')).fields).action, 'editar_cliente');

  const key = phoneKey('0982 765 432', DEFAULT_COUNTRY);
  const taken = deps({ ...client({ email: 'ana@example.com' }), [`phoneReservations/${key}`]: document(`phoneReservations/${key}`, { uid: 'otra_cuenta_1' }) });
  await assert.rejects(updateCustomerProfileAdmin({}, { ...VALID, phone: '0982 765 432' }, ACTOR, taken), /ya está registrado/);
  assert.equal(taken.commits.length, 0);
});

test('la cuenta Super Admin está protegida y una versión vieja de la ficha no pisa cambios', async () => {
  await assert.rejects(updateCustomerProfileAdmin({}, VALID, ACTOR, deps(client({ email: 'tintinaccs@gmail.com' }))), /protegida/);
  await assert.rejects(updateCustomerProfileAdmin({}, { ...VALID, baseChangeId: 'cliente_viejo_01' }, ACTOR, deps(client({ lastChangeId: 'cliente_nuevo_01' }))), /La ficha cambió/);
  // Dos fichas abiertas sobre un cliente sin versión: la segunda no pisa a la primera.
  await assert.rejects(updateCustomerProfileAdmin({}, { ...VALID, changeId: 'cliente_cambio_0002' }, ACTOR, deps(client({ lastChangeId: VALID.changeId.replace('1', '9') }))), /La ficha cambió/);
  const { baseChangeId: _omitted, ...withoutBase } = VALID;
  await assert.rejects(updateCustomerProfileAdmin({}, withoutBase, ACTOR, deps(client())), /La ficha cambió/);
  const replay = await updateCustomerProfileAdmin({}, VALID, ACTOR, deps(client({ lastChangeId: VALID.changeId })));
  assert.equal(replay.duplicate, true);
  await assert.rejects(updateCustomerProfileAdmin({}, { ...VALID, changeId: '' }, ACTOR, deps(client())), /identificador del cambio/);
});

test('los pedidos de la cuenta pasan al correo nuevo; los ajenos y los ya actualizados no se tocan', async () => {
  const orders = [
    document('orders/TINPED-1', { userId: UID, userEmail: 'temp@tempmail.test' }),
    document('orders/TINPED-2', { userId: UID, userEmail: 'ana@example.com' }),
    document('orders/TINPED-3', { userId: 'otra_cuenta_1', userEmail: 'temp@tempmail.test' }),
  ];
  const store = deps(client(), { orders });
  const result = await updateCustomerProfileAdmin({}, VALID, ACTOR, store);
  assert.equal(result.ordersEmailSynced, true);
  assert.equal(result.ordersUpdated, 1);
  const orderWrites = store.commits[1];
  assert.deepEqual(orderWrites.map(write => write.path), ['orders/TINPED-1']);
  assert.deepEqual(orderWrites[0].mergeFields, ['userEmail']);
  assert.deepEqual(orderWrites[0].currentDocument, { exists: true });
  assert.equal(decodeFirestoreFields(orderWrites[0].fields).userEmail, 'ana@example.com');
});

test('si pasar el correo a los pedidos falla, se informa y guardar de nuevo lo termina', async () => {
  const store = deps(client(), { orders: [document('orders/TINPED-1', { userId: UID, userEmail: 'temp@tempmail.test' })] });
  store.ordersOfUser = async () => { throw new Error('sin red'); };
  const first = await updateCustomerProfileAdmin({}, VALID, ACTOR, store);
  assert.equal(first.emailChanged, true);
  assert.equal(first.ordersEmailSynced, false);

  const saved = deps(client({ email: 'ana@example.com', lastChangeId: VALID.changeId }), { orders: [document('orders/TINPED-1', { userId: UID, userEmail: 'temp@tempmail.test' })] });
  const retry = await updateCustomerProfileAdmin({}, { ...VALID, changeId: 'cliente_cambio_0002', baseChangeId: VALID.changeId }, ACTOR, saved);
  assert.equal(retry.unchanged, true);
  assert.equal(retry.ordersUpdated, 1);
  assert.equal(decodeFirestoreFields(saved.commits[0][0].fields).userEmail, 'ana@example.com');
});

test('si otro guardado ganó, el acceso queda en el correo guardado y no en el original', async () => {
  const store = deps(client(), { commitError: Object.assign(new Error('conflicto'), { status: 409 }) });
  const winner = document(`users/${UID}`, { firstName: 'Ana', lastName: 'Ruiz', phone: '+595981123456', email: 'otra@example.com' });
  let reads = 0;
  const original = store.get;
  store.get = async (env, path) => (path === `users/${UID}` && reads++ > 0 ? winner : original(env, path));
  await assert.rejects(updateCustomerProfileAdmin({}, VALID, ACTOR, store), /La ficha cambió/);
  assert.deepEqual(store.authCalls, [[UID, 'ana@example.com'], [UID, 'otra@example.com']]);
});
