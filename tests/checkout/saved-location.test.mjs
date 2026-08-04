import test from 'node:test';
import assert from 'node:assert/strict';
import { isConfirmableLocation, confirmPrompt } from '../../js/pages/checkout/checkout-saved-location.js';

const GUARDADA = { lat: -25.29, lng: -57.63, name: 'Mi casa', address: 'Av. España 1234, Asunción' };

test('una ubicación guardada completa se puede confirmar', () => {
  assert.equal(isConfirmableLocation(GUARDADA), true);
});

test('sin coordenadas no hay nada que confirmar', () => {
  assert.equal(isConfirmableLocation({ name: 'Mi casa' }), false);
  assert.equal(isConfirmableLocation({ lat: -25.29, name: 'Mi casa' }), false);
  assert.equal(isConfirmableLocation({ lat: '−25.29', lng: '-57.63', name: 'Mi casa' }), false);
});

test('sin nombre tampoco: confirmar dos números no significa nada', () => {
  assert.equal(isConfirmableLocation({ lat: -25.29, lng: -57.63 }), false);
  assert.equal(isConfirmableLocation({ lat: -25.29, lng: -57.63, name: '   ' }), false);
});

test('no se rompe con nada', () => {
  assert.equal(isConfirmableLocation(null), false);
  assert.equal(isConfirmableLocation(undefined), false);
  assert.equal(isConfirmableLocation({}), false);
  assert.equal(confirmPrompt(null), null);
});

test('la tarjeta muestra el nombre y la dirección', () => {
  const p = confirmPrompt(GUARDADA);
  assert.equal(p.name, 'Mi casa');
  assert.equal(p.detail, 'Av. España 1234, Asunción');
  assert.match(p.title, /\?$/);
});

test('si la dirección repite el nombre no se muestra dos veces', () => {
  const p = confirmPrompt({ lat: -25.29, lng: -57.63, name: 'Petropar', address: 'petropar' });
  assert.equal(p.name, 'Petropar');
  assert.equal(p.detail, '');
});

test('una ubicación sin dirección igual se puede confirmar por su nombre', () => {
  const p = confirmPrompt({ lat: -25.29, lng: -57.63, name: 'Mi casa' });
  assert.equal(p.name, 'Mi casa');
  assert.equal(p.detail, '');
});
