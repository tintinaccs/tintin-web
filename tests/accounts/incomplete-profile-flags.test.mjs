import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getProfileCompletionPlan } from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const superAdminEmail = 'tintinaccs@gmail.com';
const user = { email: 'nuevo@example.com', displayName: 'Nuevo Usuario' };

test('un alta incompleta no se salta la completación aunque el tutorial haya marcado banderas', () => {
  const plan = getProfileCompletionPlan({
    profile: {
      profileStatus: 'incomplete',
      name: 'Nuevo Usuario',
      phone: '',
      onboardingCompleted: true,
      welcomeTutorialSeen: true,
      welcomeTutorialCompletedAt: new Date(),
      onboardingCompletedAt: new Date(),
    },
    user,
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, false);
});

test('un perfil legacy con banderas de onboarding pero sin datos debe completarlos', () => {
  const plan = getProfileCompletionPlan({
    profile: { profileStatus: 'legacy', onboardingCompleted: true },
    user,
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, false);
});

test('el tutorial de bienvenida no se muestra a un perfil incompleto', () => {
  const src = fs.readFileSync(new URL('../../js/components/welcome/tutorial-bienvenida.js', import.meta.url), 'utf8');
  const start = src.indexOf('  function seen(data)');
  const end = src.indexOf('  function bounded(operation)', start);
  const shouldShow = vm.runInNewContext(src.slice(start, end) + '\nshouldShow');
  const profile = { role: 'client', welcomeTutorialPending: true };
  assert.equal(shouldShow(user, { ...profile, profileStatus: 'incomplete' }, false), false);
  assert.equal(shouldShow(user, { ...profile, profileStatus: 'active' }, false), true);
  assert.equal(shouldShow(user, { ...profile, profileStatus: 'active', welcomeTutorialFirstShownAt: new Date() }, false), false);
});
