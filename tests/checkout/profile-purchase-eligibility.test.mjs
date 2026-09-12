import test from 'node:test';
import assert from 'node:assert/strict';
import { isPurchaseEligibleProfile } from '../../functions/api/apps-script-bridge.js';

const completeLegacyProfile = {
  firstName: 'María',
  lastName: 'González',
  phone: '+595981123456',
  username: 'maria_98',
  dob: '1998-04-03',
  savedLocation: {
    lat: -25.33,
    lng: -57.52,
    name: 'Mi casa',
    address: 'San Lorenzo'
  }
};

test('profileStatus active es autoridad persistida de compra', () => {
  assert.equal(isPurchaseEligibleProfile({ profileStatus: 'active' }), true);
});

test('marcas históricas de onboarding siguen siendo compatibles', () => {
  assert.equal(isPurchaseEligibleProfile({ onboardingCompleted: true }), true);
  assert.equal(isPurchaseEligibleProfile({ welcomeTutorialSeen: true }), true);
});

test('perfil legacy completo puede comprar sin exigir migración destructiva', () => {
  assert.equal(isPurchaseEligibleProfile(completeLegacyProfile), true);
});

test('perfil incompleto no puede llegar al commit comercial', () => {
  for (const missing of ['firstName', 'lastName', 'phone', 'username', 'dob', 'savedLocation']) {
    const profile = { ...completeLegacyProfile };
    delete profile[missing];
    assert.equal(isPurchaseEligibleProfile(profile), false, `debe faltar ${missing}`);
  }
});

test('ubicación requiere nombre y coordenadas reales', () => {
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: { lat: 0, lng: 0, name: 'Mi casa' }
  }), false);
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: { lat: -25.33, lng: -57.52, name: '' }
  }), false);
});

test('aliases históricos siguen la misma definición de perfil completo', () => {
  assert.equal(isPurchaseEligibleProfile({
    nombre: 'María',
    apellido: 'González',
    telefono: '+595981123456',
    userName: 'maria_98',
    fechaNacimiento: '1998-04-03',
    location: { latitude: -25.33, longitude: -57.52, name: 'Mi casa' }
  }), true);
});
