import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCi,
  normalizeCi,
  isValidRuc,
  normalizeRuc,
  isValidRazonSocial
} from '../../js/components/forms/validacion-documentos-py.js';

test('CI acepta 5 a 8 dígitos, con o sin puntos, y rechaza letras', () => {
  assert.equal(isValidCi('4123456'), true);
  assert.equal(isValidCi('4.123.456'), true);
  assert.equal(normalizeCi('4.123.456'), '4123456');
  assert.equal(isValidCi('1234'), false, 'menos de 5 dígitos');
  assert.equal(isValidCi('123456789'), false, 'más de 8 dígitos');
  assert.equal(isValidCi('abc1234'), false);
  assert.equal(isValidCi(''), false);
});

test('RUC normaliza formatos habituales sin apartarse del contrato del servidor', () => {
  assert.equal(isValidRuc('80012345-6'), true);
  assert.equal(isValidRuc('4123456-8'), true);
  assert.equal(isValidRuc('800123456'), true, 'acepta base + DV escritos sin guion');
  assert.equal(isValidRuc('80.012.345-6'), true, 'acepta puntos de lectura');
  assert.equal(normalizeRuc(' 80.012.345 - 6 '), '80012345-6');
  assert.equal(normalizeRuc('800123456'), '80012345-6');
  assert.equal(isValidRuc('1234-5'), false, 'el servidor actual exige al menos 5 dígitos base');
  assert.equal(isValidRuc('123456789-0'), false, 'más de 8 dígitos base');
  assert.equal(isValidRuc('80012345-'), false, 'sin dígito verificador');
  assert.equal(isValidRuc('80012345-6x'), false);
});

test('razón social exige al menos 3 caracteres reales', () => {
  assert.equal(isValidRazonSocial('Tintin SA'), true);
  assert.equal(isValidRazonSocial('AB'), false);
  assert.equal(isValidRazonSocial('   '), false);
  assert.equal(isValidRazonSocial(''), false);
});
