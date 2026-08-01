import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingProfilePatch,
  getProfileCompletionPlan,
} from '../../js/profile-onboarding.mjs';

const superAdminEmail = 'tintinaccs@gmail.com';

test('el superadmin nunca entra al onboarding aunque no tenga datos', () => {
  assert.deepEqual(getProfileCompletionPlan({
    profile: {},
    user: { email: superAdminEmail },
    role: 'superadmin',
    superAdminEmail,
  }), {
    skip: true,
    needsName: false,
    needsPhone: false,
    suggestedName: '',
  });
});

test('una cuenta completa entra directo sin pedir ni escribir datos', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: 'Juan Pérez', phone: '+595981123456' },
    user: { email: 'juan@hotmail.com', displayName: 'Otro nombre' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Juan Pérez', phone: '+595981123456' },
    submittedName: 'Otro nombre',
    submittedPhone: '+595971000000',
  }), {});
});

test('si falta solo el teléfono conserva el nombre existente', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: 'Juan Pérez', phone: '' },
    user: { email: 'juan@hotmail.com' },
    role: 'agent',
    superAdminEmail,
  });
  assert.equal(plan.needsName, false);
  assert.equal(plan.needsPhone, true);
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Juan Pérez', phone: '' },
    submittedName: 'Nombre accidental',
    submittedPhone: '+595981123456',
  }), { phone: '+595981123456' });
});

test('si Google entrega un nombre se propone para confirmarlo', () => {
  const plan = getProfileCompletionPlan({
    profile: { name: '', phone: '' },
    user: { email: 'juan@gmail.com', displayName: 'Juan Pérez' },
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, false);
  assert.equal(plan.needsName, true);
  assert.equal(plan.needsPhone, true);
  assert.equal(plan.suggestedName, 'Juan Pérez');
});

test('una transacción concurrente no vuelve a pisar campos ya completados', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Nombre guardado', phone: '+595981111111' },
    submittedName: 'Nombre viejo',
    submittedPhone: '+595982222222',
  }), {});
});

test('un cambio de nombre solo se aplica cuando fue explícito', () => {
  assert.deepEqual(buildMissingProfilePatch({
    currentProfile: { name: 'Juan Perez', phone: '' },
    submittedName: 'Juan Pérez',
    submittedPhone: '+595981123456',
    explicitNameChange: true,
  }), { name: 'Juan Pérez', phone: '+595981123456' });
});
