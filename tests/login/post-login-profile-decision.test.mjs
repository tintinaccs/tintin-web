import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProfileCompletionPlan,
  readProfileName,
} from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const superAdminEmail = 'tintinaccs@gmail.com';
const COMPLETE_BASE = {
  phone: '+595981123456',
  username: 'alberto_valdez',
  dob: new Date('1990-01-01'),
  savedLocation: {
    lat: -25.29,
    lng: -57.63,
    name: 'Casa',
    address: 'San Lorenzo, Paraguay',
  },
};

test('un perfil mixto usa el nombre histórico para completar sólo el apellido ausente', () => {
  const profile = {
    ...COMPLETE_BASE,
    firstName: 'Alberto',
    lastName: '',
    name: 'Alberto Valdez',
  };

  assert.deepEqual(readProfileName(profile), {
    firstName: 'Alberto',
    lastName: 'Valdez',
  });

  const plan = getProfileCompletionPlan({
    profile,
    user: { email: 'cliente1@example.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
});

test('otro usuario completo obtiene la misma decisión sin excepciones por correo', () => {
  const profile = {
    ...COMPLETE_BASE,
    firstName: '',
    lastName: 'Gómez',
    name: 'María Gómez',
    username: 'maria_gomez',
  };

  const plan = getProfileCompletionPlan({
    profile,
    user: { email: 'otra-persona@example.com' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
  assert.equal(plan.needsAddress, false);
});

test('un perfil realmente incompleto sigue entrando a Últimos datos', () => {
  const plan = getProfileCompletionPlan({
    profile: {
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '+595981123456',
      savedLocation: COMPLETE_BASE.savedLocation,
    },
    user: { email: 'nuevo@example.com' },
    role: 'client',
    superAdminEmail,
  });

  assert.equal(plan.skip, false);
  assert.equal(plan.needsUsername, true);
  assert.equal(plan.needsDob, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsAddress, false);
});

test('Super Admin conserva bypass de onboarding', () => {
  const plan = getProfileCompletionPlan({
    profile: {},
    user: { email: superAdminEmail },
    role: 'superadmin',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
  assert.equal(plan.needsAddress, false);
});
