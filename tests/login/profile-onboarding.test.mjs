import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingProfilePatch,
  getProfileCompletionPlan,
  isValidNamePart,
  isValidFullName,
  splitFullName,
  readProfileName,
  hasUsableAddress,
} from '../../js/pages/profile/profile-onboarding.mjs';

const superAdminEmail = 'tintinaccs@gmail.com';
const ADDRESS = { savedLocation: { lat: -25.29, lng: -57.63, name: 'Av. España 1234', address: 'Av. España 1234, Asunción' }, address: 'Av. España 1234, Asunción' };
const COMPLETE = { name: 'Juan Pérez', phone: '+595981123456', ...ADDRESS };

test('el superadmin nunca entra al onboarding aunque no tenga datos', () => {
  const plan = getProfileCompletionPlan({
    profile: {},
    user: { email: superAdminEmail },
    role: 'superadmin',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsAddress, false);
});

test('una cuenta completa entra directo sin volver a abrir el onboarding', () => {
  const plan = getProfileCompletionPlan({
    profile: COMPLETE,
    user: { email: 'juan@hotmail.com', displayName: 'Otro nombre' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsAddress, false);
});

test('si falta solo el teléfono conserva el nombre y muestra la ubicación ya guardada', () => {
  const profile = { name: 'Juan Pérez', phone: '', ...ADDRESS };
  const plan = getProfileCompletionPlan({
    profile,
    user: { email: 'juan@hotmail.com' },
    role: 'agent',
    superAdminEmail,
  });
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, true);
  assert.equal(plan.needsAddress, true);
  assert.equal(plan.addressAlreadySaved, true);
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: profile,
    submittedFirstName: 'Nombre',
    submittedLastName: 'Accidental',
    submittedPhone: '+595981123456',
    submittedAddress: ADDRESS.savedLocation,
  }), { phone: '+595981123456' });
});

test('si Google entrega un nombre completo se propone para confirmarlo', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: '', phone: '' },
    user: { email: 'juan@gmail.com', displayName: 'Juan Pérez' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, false);
  assert.equal(plan.needsName, true);
  assert.equal(plan.needsPhone, true);
  assert.equal(plan.needsAddress, true);
  assert.equal(plan.suggestedFirstName, 'Juan');
  assert.equal(plan.suggestedLastName, 'Pérez');
  assert.equal(plan.suggestedName, 'Juan Pérez');
});

test('si Google solo entrega una inicial no se propone nada', () => {
  const plan = getProfileCompletionPlan({
    profile: {},
    user: { email: 'j@gmail.com', displayName: 'J' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsName, true);
  assert.equal(plan.suggestedFirstName, '');
  assert.equal(plan.suggestedLastName, '');
});

test('si Google entrega solo el nombre se propone y se sigue pidiendo el apellido', () => {
  const plan = getProfileCompletionPlan({
    profile: {},
    user: { email: 'ana@gmail.com', displayName: 'Ana' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsName, true);
  assert.equal(plan.suggestedFirstName, 'Ana');
  assert.equal(plan.suggestedLastName, '');
});

test('un perfil viejo con un solo nombre vuelve a pedir el apellido', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: 'Juan', phone: '+595981123456', ...ADDRESS },
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsName, true);
  assert.equal(plan.suggestedFirstName, 'Juan');
  assert.equal(plan.needsAddress, true);
  assert.equal(plan.addressAlreadySaved, true);
});

test('falta la ubicación aunque el nombre y el teléfono estén completos', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: 'Juan Pérez', phone: '+595981123456' },
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, false);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsAddress, true);
  assert.equal(plan.addressAlreadySaved, false);
});

test('una transacción concurrente no vuelve a pisar campos ya completados', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: COMPLETE,
    submittedFirstName: 'Nombre',
    submittedLastName: 'Viejo',
    submittedPhone: '+595982222222',
    submittedAddress: ADDRESS.savedLocation,
  }), {});
});

test('un cambio de nombre solo se aplica cuando fue explícito', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Juan Perez', phone: '', ...ADDRESS },
    submittedFirstName: 'Juan',
    submittedLastName: 'Pérez',
    submittedPhone: '+595981123456',
    submittedAddress: ADDRESS.savedLocation,
    explicitNameChange: true,
  }), {
    firstName: 'Juan',
    lastName: 'Pérez',
    name: 'Juan Pérez',
    phone: '+595981123456',
  });
});

test('la ubicación se guarda en el mismo formato que usa el checkout', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Juan Pérez', phone: '+595981123456' },
    submittedAddress: { address: 'Av. España 1234', addressLat: -25.29, addressLng: -57.63, addressName: 'Casa' },
  }), {
    savedLocation: { lat: -25.29, lng: -57.63, name: 'Casa', address: 'Av. España 1234' },
    address: 'Av. España 1234',
  });
});

test('una ubicación existente solo cambia cuando la persona mueve o reemplaza el punto', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: COMPLETE,
    submittedAddress: ADDRESS.savedLocation,
  }), {});

  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: COMPLETE,
    submittedAddress: { lat: -25.31, lng: -57.61, name: 'Trabajo', address: 'Centro, Asunción' },
  }), {
    savedLocation: { lat: -25.31, lng: -57.61, name: 'Trabajo', address: 'Centro, Asunción' },
    address: 'Centro, Asunción',
  });
});

test('una ubicación sin coordenadas no se guarda', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: {},
    submittedAddress: { address: 'Escrito a mano, sin marcar en el mapa' },
  }), {});
});

test('una ubicación guardada desde checkout no abre el onboarding por sí sola', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: 'Juan Pérez', phone: '+595981123456', savedLocation: { lat: -25.29, lng: -57.63, name: 'Casa' } },
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsAddress, false);
  assert.equal(plan.skip, true);
});

test('un nombre inválido nunca se guarda', () => {
  for (const [first, last] of [['A', 'B'], ['Usuario', 'Sin nombre'], ['undefined', 'null'], ['Juan2', 'Pérez'], ['😀', 'Pérez'], ['', 'Pérez']]) {
    assert.deepEqual(
      buildMissingProfilePatch({ currentProfile: {}, submittedFirstName: first, submittedLastName: last }),
      {},
      `debería rechazar ${JSON.stringify([first, last])}`
    );
  }
});

test('los nombres reales con tildes, apóstrofes y guiones se aceptan', () => {
  for (const name of ['Juan', 'María José', "D'Angelo", 'García-López', 'Ñandú', 'Müller', 'De la Cruz']) {
    assert.equal(isValidNamePart(name), true, `debería aceptar ${name}`);
  }
});

test('los nombres basura se rechazan', () => {
  for (const name of ['', '   ', 'A', 'X', '1', '123', 'Juan3', 'undefined', 'null', 'Usuario', 'Sin nombre', 'test', '@#$', '😀', 'a'.repeat(61)]) {
    assert.equal(isValidNamePart(name), false, `debería rechazar ${JSON.stringify(name)}`);
  }
});

test('isValidFullName exige que los dos lados sirvan', () => {
  assert.equal(isValidFullName('Juan', 'Pérez'), true);
  assert.equal(isValidFullName('Juan', ''), false);
  assert.equal(isValidFullName('', 'Pérez'), false);
  assert.equal(isValidFullName('Juan', 'X'), false);
});

test('splitFullName separa la primera palabra del resto', () => {
  assert.deepEqual(splitFullName('Juan Pérez'), { firstName: 'Juan', lastName: 'Pérez' });
  assert.deepEqual(splitFullName('María José Pérez Duarte'), { firstName: 'María', lastName: 'José Pérez Duarte' });
  assert.deepEqual(splitFullName('  Juan   Pérez  '), { firstName: 'Juan', lastName: 'Pérez' });
  assert.deepEqual(splitFullName('Juan'), { firstName: 'Juan', lastName: '' });
  assert.deepEqual(splitFullName(''), { firstName: '', lastName: '' });
});

test('readProfileName prefiere los campos separados y si no parte `name`', () => {
  assert.deepEqual(readProfileName({ firstName: 'Ana', lastName: 'Gómez', name: 'Otro Distinto' }), { firstName: 'Ana', lastName: 'Gómez' });
  assert.deepEqual(readProfileName({ name: 'Ana Gómez' }), { firstName: 'Ana', lastName: 'Gómez' });
  assert.deepEqual(readProfileName({}), { firstName: '', lastName: '' });
});

test('hasUsableAddress exige nombre y coordenadas reales', () => {
  assert.equal(hasUsableAddress(ADDRESS), true);
  assert.equal(hasUsableAddress({ address: 'Solo texto' }), false);
  assert.equal(hasUsableAddress({ savedLocation: { lat: 0, lng: 0, name: 'Cero' } }), false);
  assert.equal(hasUsableAddress({ savedLocation: { lat: -25.29, lng: -57.63 } }), false);
});
