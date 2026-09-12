import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingProfilePatch,
  getProfileCompletionPlan,
} from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const LOCATION = {
  lat: -25.33,
  lng: -57.52,
  name: 'Mi casa',
  address: 'San Lorenzo',
};

function completeFrom(status) {
  const currentProfile = {
    ...(status === undefined ? {} : { profileStatus: status }),
    name: 'María González',
    phone: '+595981123456',
    savedLocation: LOCATION,
  };
  return buildMissingProfilePatch({
    currentProfile,
    submittedUsername: 'maria_98',
    submittedDob: '1998-04-03',
  });
}

test('un perfil legacy que termina sus datos queda active', () => {
  const patch = completeFrom('legacy');
  assert.equal(patch.username, 'maria_98');
  assert.ok(patch.dob instanceof Date);
  assert.equal(patch.profileStatus, 'active');
});

test('un perfil sin profileStatus que termina sus datos queda active', () => {
  const patch = completeFrom(undefined);
  assert.equal(patch.profileStatus, 'active');
});

test('el segundo login no vuelve a abrir Últimos datos después del guardado', () => {
  const currentProfile = {
    profileStatus: 'legacy',
    name: 'María González',
    phone: '+595981123456',
    savedLocation: LOCATION,
  };
  const patch = completeFrom('legacy');
  const persisted = { ...currentProfile, ...patch };
  const plan = getProfileCompletionPlan({
    profile: persisted,
    user: { email: 'maria@example.com' },
    role: 'client',
  });
  assert.equal(plan.skip, true);
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, false);
  assert.equal(plan.needsAddress, false);
  assert.equal(plan.needsUsername, false);
  assert.equal(plan.needsDob, false);
});

test('un perfil deleted nunca se reactiva desde onboarding', () => {
  const patch = completeFrom('deleted');
  assert.equal('profileStatus' in patch, false);
});
