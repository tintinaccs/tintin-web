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
  for (const missing of ['firstName', 'lastName', 'phone']) {
    const profile = { ...completeLegacyProfile };
    delete profile[missing];
    assert.equal(isPurchaseEligibleProfile(profile), false, `debe faltar ${missing}`);
  }
});

test('ubicación opcional no bloquea compra; se solicita en entrega', () => {
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: { lat: 0, lng: 0, name: 'Mi casa' }
  }), true);
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: { lat: -25.33, lng: -57.52, name: '' }
  }), true);
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

test('checkout acepta la misma ubicación histórica que Login', () => {
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: {
      addressLat: -27.0739,
      addressLng: -55.6422,
      address: 'Hohenau, Itapúa'
    },
    locationName: 'Hohenau (Itapúa)'
  }), true);
});

test('checkout puede reutilizar coordenadas anidadas con nombre persistido a nivel perfil', () => {
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: {
      coordinates: { latitude: -27.0739, longitude: -55.6422 }
    },
    addressName: 'Hohenau (Itapúa)'
  }), true);
});

test('dirección histórica incompleta se corrige en envío, no en registro', () => {
  assert.equal(isPurchaseEligibleProfile({
    ...completeLegacyProfile,
    savedLocation: {
      addressLat: -27.0739,
      addressLng: -55.6422
    }
  }), true);
});

test('nombre y WhatsApp bastan sin datos opcionales ni marca de alta', () => {
  assert.equal(isPurchaseEligibleProfile({ name:'María González', phone:'+595981123456' }),true);
  assert.equal(isPurchaseEligibleProfile({ name:'María', phone:'+595981123456' }),false);
});

test('un nombre separado válido prevalece sobre un alias completo inválido', () => {
  assert.equal(isPurchaseEligibleProfile({firstName:'María', lastName:'González', name:'undefined', phone:'+595981123456'}), true);
});
