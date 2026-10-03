import test from 'node:test';
import assert from 'node:assert/strict';
import { readAccountIdentity, resolveAccountAvatar, buildAccountNamePatch, accountReadState, reconcileAccountOrders } from '../../js/pages/profile/estado-canonico-perfil.mjs';

test('Firestore prevalece sobre el nombre, pero un avatar vacío no tapa la foto de Auth', () => {
  const identity = readAccountIdentity({ firstName: 'María', lastName: 'Pérez', name: 'María Pérez', photoURL: '' }, { displayName: 'Nombre viejo', photoURL: 'https://example.com/old.jpg', email: 'cliente@example.com' });
  assert.equal(identity.name, 'María Pérez');
  assert.equal(identity.photoURL, 'https://example.com/old.jpg');
  assert.equal(identity.email, 'cliente@example.com');
});

test('la foto de Google prevalece sobre el valor histórico del perfil', () => {
  const photoURL = resolveAccountAvatar(
    { photoURL: 'https://cdn.example.com/legacy-profile.png' },
    { photoURL: 'https://cdn.example.com/current-auth.png', providerData: [{ providerId: 'google.com', photoURL: 'https://lh3.googleusercontent.com/a/google-photo' }] },
  );
  assert.equal(photoURL, 'https://lh3.googleusercontent.com/a/google-photo');
});

test('una foto elegida explícitamente conserva prioridad sobre Google', () => {
  const photoURL = resolveAccountAvatar(
    { avatarURL: 'https://res.cloudinary.com/tintin/image/upload/avatar.png' },
    { providerData: [{ providerId: 'google.com', photoURL: 'https://lh3.googleusercontent.com/a/google-photo' }] },
  );
  assert.equal(photoURL, 'https://res.cloudinary.com/tintin/image/upload/avatar.png');
});

test('un perfil histórico conserva sus nombres y demás datos', () => {
  const identity = readAccountIdentity({ nombre: 'Ana', apellido: 'Gómez', telefono: '+595981123456', userName: 'ana_gomez', fechaNacimiento: '2000-01-01' });
  assert.equal(identity.name, 'Ana Gómez');
  assert.equal(identity.phone, '+595981123456');
  assert.equal(identity.username, 'ana_gomez');
  assert.equal(identity.dob, '2000-01-01');
});

test('un cambio explícito sincroniza nombre, apellido y nombre completo', () => {
  assert.deepEqual(buildAccountNamePatch({ firstName: 'Ana', lastName: 'Gómez', name: 'Ana Gómez' }, { firstName: 'Ana María', lastName: 'López' }), { firstName: 'Ana María', lastName: 'López', name: 'Ana María López' });
  assert.deepEqual(buildAccountNamePatch({ firstName: 'Ana', lastName: 'Gómez', name: 'Ana Gómez' }, { firstName: 'Ana', lastName: 'Gómez' }), {});
  assert.throws(() => buildAccountNamePatch({}, { firstName: 'Ana', lastName: '' }), /name-required/);
});

test('los errores no se convierten en un perfil vacío', () => {
  assert.equal(accountReadState({ code: 'permission-denied' }), 'permission-denied');
  assert.equal(accountReadState({ code: 'unavailable' }, false), 'offline');
  assert.equal(accountReadState({ code: 'unavailable' }), 'unavailable');
});

test('pedidos se deduplican y una consulta incompleta falla explícitamente', () => {
  assert.deepEqual(reconcileAccountOrders([[{ id: 'a', total: 10 }], [{ id: 'a', total: 20 }, { id: 'b', total: 30 }]]), [{ id: 'a', total: 20 }, { id: 'b', total: 30 }]);
  assert.throws(() => reconcileAccountOrders([[{ id: 'a' }], null]), /orders-incomplete/);
});
