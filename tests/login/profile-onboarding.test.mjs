import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildMissingProfilePatch,
  getProfileCompletionPlan,
  isValidNamePart,
  isValidFullName,
  isValidCustomerName,
  splitFullName,
  readProfileName,
  hasUsableAddress,
  hasUsableDob,
  isSuperAdminProfile,
} from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const superAdminEmail = 'tintinaccs@gmail.com';
const ADDRESS = { savedLocation: { lat: -25.29, lng: -57.63, name: 'Av. España 1234', address: 'Av. España 1234, Asunción' }, address: 'Av. España 1234, Asunción' };
const CORE = { name: 'Juan Pérez', phone: '+595981123456', ...ADDRESS };
const COMPLETE = { ...CORE, username: 'juan_perez', dob: new Date('2000-01-01') };
const readLogin = () => fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');

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
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
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
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
});

test('un perfil histórico del panel no repite username, fecha ni ubicación ya guardados', () => {
  const historical = {
    name: 'Juan Pérez',
    phone: '+595981123456',
    userName: 'juan_perez',
    birthDate: '2000-01-01',
    locationName: 'Casa',
    address: 'Av. España 1234',
    addressLat: -25.29,
    addressLng: -57.63,
  };
  const plan = getProfileCompletionPlan({
    profile: historical,
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(hasUsableDob(historical), true);
  assert.equal(hasUsableAddress(historical), true);
  assert.equal(plan.skip, true);
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
  assert.equal(plan.needsAddress, false);
});

test('aliases históricos de teléfono y username no reabren el onboarding', () => {
  const historical = {
    name: 'Juan Pérez',
    phoneNumber: '+595981123456',
    userName: 'juan_perez',
    birthDate: '2000-01-01',
    locationName: 'Casa',
    address: 'Av. España 1234',
    addressLat: -25.29,
    addressLng: -57.63,
  };
  const plan = getProfileCompletionPlan({
    profile: historical,
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsUsername, false);
});

test('si savedLocation quedó parcial, conserva la ubicación válida de una versión anterior', () => {
  const historical = {
    ...COMPLETE,
    savedLocation: { address: 'Av. España 1234' },
    location: { latitude: -25.29, longitude: -57.63, label: 'Casa', formattedAddress: 'Av. España 1234, Asunción' },
  };
  assert.equal(hasUsableAddress(historical), true);
  assert.equal(getProfileCompletionPlan({
    profile: historical,
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  }).skip, true);
});

test('acepta ubicación histórica guardada como coordenadas o mapLocation', () => {
  const coordinateProfile = {
    ...COMPLETE,
    savedLocation: null,
    coordinates: { lat: -25.29, lng: -57.63 },
    locationName: 'Casa',
    address: 'Av. España 1234, Asunción',
  };
  const mapProfile = {
    ...COMPLETE,
    savedLocation: null,
    mapLocation: { latitude: -25.29, longitude: -57.63, name: 'Casa' },
  };
  assert.equal(hasUsableAddress(coordinateProfile), true);
  assert.equal(hasUsableAddress(mapProfile), true);
});

test('si falta solo el teléfono conserva los demás datos y no vuelve a pedir la ubicación', () => {
  const profile = { ...COMPLETE, phone: '' };
  const plan = getProfileCompletionPlan({
    profile,
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, true);
  assert.equal(plan.needsAddress, false);
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
  assert.equal(plan.addressAlreadySaved, true);
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: profile,
    submittedFirstName: 'Nombre',
    submittedLastName: 'Accidental',
    submittedPhone: '+595981123456',
    submittedAddress: ADDRESS.savedLocation,
  }), { phone: '+595981123456' });
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

test('un perfil con un solo nombre vuelve a pedir el apellido pero no repite la ubicación', () => {
  const plan = getProfileCompletionPlan({
    profile: { ...COMPLETE, name: 'Juan', firstName: '', lastName: '' },
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsName, true);
  assert.equal(plan.suggestedFirstName, 'Juan');
  assert.equal(plan.needsAddress, false);
  assert.equal(plan.addressAlreadySaved, true);
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

test('una ubicación guardada desde checkout no abre el onboarding si el resto del perfil está completo', () => {
  const plan = getProfileCompletionPlan({
    profile: { ...COMPLETE, savedLocation: { lat: -25.29, lng: -57.63, name: 'Casa' } },
    user: { email: 'juan@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsAddress, false);
  assert.equal(plan.skip, true);
});

test('profileStatus active con todos los datos entra directo', () => {
  const plan = getProfileCompletionPlan({
    profile: { ...COMPLETE, profileStatus: 'active' },
    user: { email: 'cliente@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
});

test('login.html no usa variables inexistentes en el alta (ReferenceError de data)', () => {
  const html = readLogin();
  assert.doesNotMatch(html, /data\.username \|\| data\.userName/);
  assert.match(html, /readProfileState\(user, role\);\s*\n\s*if \(verified\.state !== PROFILE_STATE\.COMPLETE\)/);
});

test('una cuenta incomplete con username y DOB ya guardados no vuelve a pedirlos', () => {
  const plan = getProfileCompletionPlan({
    profile: { ...COMPLETE, profileStatus: 'incomplete', username: 'maria_98', dob: new Date('2000-01-01') },
    user: { email: 'maria@hotmail.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
  assert.equal(plan.skip, true);
});

test('una cuenta legacy no se activa automáticamente desde esta transacción', () => {
  const patch = buildMissingProfilePatch({
    currentProfile: { profileStatus: 'legacy', ...CORE },
    submittedUsername: 'maria_98',
    submittedDob: '2000-05-15',
  });
  assert.equal('profileStatus' in patch, false);
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


test('alta breve no exige usuario, fecha de nacimiento ni mapa', () => {
  for (const profileStatus of ['incomplete','active','legacy',undefined]) {
    const plan=getProfileCompletionPlan({profile:{name:'María González',phone:'+595981123456',profileStatus}});
    assert.equal(plan.skip,true);
    assert.equal(plan.needsUsername,false);
    assert.equal(plan.needsDob,false);
    assert.equal(plan.needsAddress,false);
  }
  const missing=getProfileCompletionPlan({profile:{}});
  assert.equal(missing.needsName,true);
  assert.equal(missing.needsPhone,true);
});

test('guardar nombre y teléfono activa el perfil y no reabre el registro', () => {
  const before={profileStatus:'incomplete'};
  const patch=buildMissingProfilePatch({currentProfile:before,submittedName:'María González',submittedPhone:'+595981123456'});
  assert.deepEqual(patch,{firstName:'María',lastName:'González',name:'María González',phone:'+595981123456',profileStatus:'active'});
  assert.equal(getProfileCompletionPlan({profile:{...before,...patch}}).skip,true);
});

test('nombre de una palabra no activa el perfil; nombres compuestos válidos sí', () => {
  for(const name of ['María','A Pérez','Jo Pérez','María Pe','José de la Cruz','María 123','María <script>']) assert.equal(isValidCustomerName(name),false,name);
  for(const name of ['María González',"Ana D’Angelo",'María José Pérez']) assert.equal(isValidCustomerName(name),true,name);
  const patch=buildMissingProfilePatch({currentProfile:{profileStatus:'incomplete'},submittedName:'María',submittedPhone:'+595981123456'});
  assert.equal('profileStatus' in patch,false);
});

test('el formulario contiene sólo nombre completo y WhatsApp, sin enlace redundante', () => {
  const html=readLogin();
  assert.match(html,/autocomplete="name"/);
  assert.doesNotMatch(html,/<input[^>]+id="login-profile-(?:last-name|username|dob|address)"/);
  assert.doesNotMatch(html,/id="login-mode-toggle"/);
});

test('identidades vacías no obtienen la excepción de superadmin', () => {
  assert.equal(isSuperAdminProfile({},''),false);
  assert.equal(isSuperAdminProfile({email:'other@example.com'},'official@example.com'),false);
});
