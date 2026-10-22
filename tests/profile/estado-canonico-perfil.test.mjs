import test from 'node:test';
import assert from 'node:assert/strict';
import { readAccountIdentity, resolveAccountAvatar, buildAccountNamePatch, accountReadState, reconcileAccountOrders } from '../../js/pages/profile/estado-canonico-perfil.mjs';

test('un listener rezagado por correo no revierte el pedido confirmado por UID', () => {
  const old = { id: 'order', status: 'pendiente', total: 50000, inventoryRevision: 1 };
  const fresh = { ...old, status: 'preparando', total: 80000, inventoryRevision: 2 };
  assert.deepEqual(reconcileAccountOrders([[fresh], [old]]), [fresh]);
  assert.deepEqual(reconcileAccountOrders([[old], [fresh]]), [fresh]);
  const newer = { ...fresh, total: 90000, updatedAt: { seconds: 20 } };
  assert.deepEqual(reconcileAccountOrders([[newer], [{ ...fresh, updatedAt: { seconds: 10 } }]]), [newer]);
});

test('Firestore prevalece sobre el nombre, pero un avatar vacío no tapa la foto de Auth', () => {
  const identity = readAccountIdentity({ firstName: 'María', lastName: 'Pérez', name: 'María Pérez', photoURL: '' }, { displayName: 'Nombre viejo', photoURL: 'https://example.com/old.jpg', email: 'cliente@example.com' });
  assert.equal(identity.name, 'María Pérez');
  assert.equal(identity.photoURL, 'https://example.com/old.jpg');
  assert.equal(identity.email, 'cliente@example.com');
});

test('una foto propia histórica prevalece sobre Google', () => {
  const photoURL = resolveAccountAvatar(
    { photoURL: 'https://cdn.example.com/legacy-profile.png' },
    { photoURL: 'https://cdn.example.com/current-auth.png', providerData: [{ providerId: 'google.com', photoURL: 'https://lh3.googleusercontent.com/a/google-photo' }] },
  );
  assert.equal(photoURL, 'https://cdn.example.com/legacy-profile.png');
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

test('una copia antigua de Google usa la foto actual de Google como respaldo',()=>{
 assert.equal(resolveAccountAvatar({photoURL:'https://lh3.googleusercontent.com/old'},{providerData:[{providerId:'google.com',photoURL:'https://lh3.googleusercontent.com/current'}]}),'https://lh3.googleusercontent.com/current');
});

test('perfil pendiente conserva sólo foto propia; Google espera confirmación',()=>{
 const google='https://lh3.googleusercontent.com/current';
 const user={photoURL:google,providerData:[{providerId:'google.com',photoURL:google}]};
 for(const profile of [{},{avatarURL:google},{photoURL:google}]) assert.equal(resolveAccountAvatar(profile,user,{profilePending:true}),'');
 for(const profile of [{avatarURL:'/custom.png'},{photoURL:'/custom.png'}]) assert.equal(resolveAccountAvatar(profile,user,{profilePending:true}),'/custom.png');
 assert.equal(resolveAccountAvatar({},user),google);
});
