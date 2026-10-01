import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('un perfil legacy con banderas de onboarding sigue exento', () => {
  const plan = getProfileCompletionPlan({
    profile: { profileStatus: 'legacy', onboardingCompleted: true },
    user,
    role: 'client',
    superAdminEmail,
  });
  assert.equal(plan.skip, true);
});

test('el tutorial de bienvenida no se muestra a un perfil incompleto', () => {
  const src = fs.readFileSync(new URL('../../js/components/welcome/tutorial-bienvenida.js', import.meta.url), 'utf8');
  assert.match(src, /profileStatus[^\n]*\)\.toLowerCase\(\) === 'incomplete'\) return false/);
});
