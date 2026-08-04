import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCOMIENDA_MODES,
  encomiendaFieldPlan,
  encomiendaValidationError,
  encomiendaModeLabel,
} from '../../js/pages/checkout/checkout-encomienda.js';

test('sin elegir modo no se le pide ningún dato', () => {
  const plan = encomiendaFieldPlan('');
  assert.equal(plan.showAddress, false);
  assert.equal(plan.showReference, false);
  assert.equal(plan.showMap, false);
  assert.equal(plan.note, '');
});

test('retiro en agencia: sin mapa, sin dirección, con el aviso', () => {
  const plan = encomiendaFieldPlan(ENCOMIENDA_MODES.AGENCIA);
  assert.equal(plan.showMap, false);
  assert.equal(plan.showAddress, false);
  assert.equal(plan.showReference, false);
  assert.match(plan.note, /WhatsApp/);
});

test('entrega en puerta: mapa y dirección, igual que el delivery', () => {
  const plan = encomiendaFieldPlan(ENCOMIENDA_MODES.PUERTA);
  assert.equal(plan.showMap, true);
  assert.equal(plan.showAddress, true);
  assert.equal(plan.showReference, true);
  assert.equal(plan.note, '');
});

test('no se puede continuar sin elegir cómo lo recibe', () => {
  assert.match(encomiendaValidationError(''), /Elegí si retirás/);
});

test('retiro en agencia no exige nada más', () => {
  assert.equal(encomiendaValidationError(ENCOMIENDA_MODES.AGENCIA), null);
  assert.equal(encomiendaValidationError(ENCOMIENDA_MODES.AGENCIA, { mapLocation: null, address: '' }), null);
});

test('entrega en puerta exige el punto en el mapa', () => {
  assert.match(
    encomiendaValidationError(ENCOMIENDA_MODES.PUERTA, { mapLocation: null, locationName: 'Casa', address: 'Av. 1' }),
    /Marcá en el mapa/
  );
});

test('entrega en puerta exige un nombre para la ubicación', () => {
  assert.match(
    encomiendaValidationError(ENCOMIENDA_MODES.PUERTA, { mapLocation: { lat: 1, lng: 2 }, locationName: '   ', address: 'Av. 1' }),
    /nombre a tu ubicación/
  );
});

test('entrega en puerta exige la dirección escrita', () => {
  assert.match(
    encomiendaValidationError(ENCOMIENDA_MODES.PUERTA, { mapLocation: { lat: 1, lng: 2 }, locationName: 'Casa', address: '  ' }),
    /dirección de entrega/
  );
});

test('entrega en puerta con todo completo pasa', () => {
  assert.equal(
    encomiendaValidationError(ENCOMIENDA_MODES.PUERTA, { mapLocation: { lat: 1, lng: 2 }, locationName: 'Casa', address: 'Av. España 1234' }),
    null
  );
});

test('las etiquetas describen el modo para el resumen, el panel y los correos', () => {
  assert.equal(encomiendaModeLabel(ENCOMIENDA_MODES.AGENCIA), 'retiro en agencia');
  assert.equal(encomiendaModeLabel(ENCOMIENDA_MODES.PUERTA), 'entrega en puerta');
  assert.equal(encomiendaModeLabel(''), '');
});
