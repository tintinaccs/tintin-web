import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCountryByCode,
  normalizePhone,
  isValidPhone,
  isRealisticPhone,
  phoneKey,
} from '../../js/components/forms/utilidades-telefono.js';

const PY = findCountryByCode('PY');
const AR = findCountryByCode('AR');

test('el mismo número escrito distinto da la misma clave', () => {
  const esperado = '595981123456';
  for (const escrito of [
    '0981123456',
    '0981 123 456',
    '0981-123-456',
    '+595981123456',
    '+595 981 123 456',
    '595981123456',
    '  0981123456  ',
    '(0981) 123-456',
  ]) {
    assert.equal(phoneKey(escrito, PY), esperado, `debería normalizar ${JSON.stringify(escrito)}`);
  }
});

test('números distintos dan claves distintas', () => {
  assert.notEqual(phoneKey('0981123456', PY), phoneKey('0981123457', PY));
  assert.notEqual(phoneKey('0981123456', PY), phoneKey('0971123456', PY));
});

test('un celular paraguayo real se acepta', () => {
  for (const numero of ['0981123456', '0971456789', '0991234876', '0961548732', '0921876543']) {
    assert.equal(isRealisticPhone(numero, PY), true, `debería aceptar ${numero}`);
  }
});

test('los números de relleno se rechazan', () => {
  for (const numero of [
    '0000000000',   // todo ceros
    '0981111111',   // cuerpo todo igual
    '0999999999',   // todo igual
  ]) {
    assert.equal(isRealisticPhone(numero, PY), false, `debería rechazar ${numero}`);
  }
});

test('un cuerpo correlativo NO se rechaza: puede ser un número real', () => {
  // 0981123456 es correlativo y es perfectamente plausible. Rechazar
  // secuencias bloqueaba clientas de verdad, que es peor que dejar entrar un
  // número raro.
  assert.equal(isRealisticPhone('0981234567', PY), true);
  assert.equal(isRealisticPhone('0987654321', PY), true);
});

test('un fijo paraguayo se rechaza: no recibe WhatsApp', () => {
  assert.equal(isRealisticPhone('021123456', PY), false);
});

test('un prefijo de operadora inexistente se rechaza', () => {
  assert.equal(isRealisticPhone('0901123456', PY), false);
  assert.equal(isRealisticPhone('0911123456', PY), true); // 91 sí existe
});

test('un número con largo incorrecto se rechaza', () => {
  assert.equal(isRealisticPhone('098112345', PY), false);
  assert.equal(isRealisticPhone('09811234567', PY), false);
  assert.equal(isRealisticPhone('', PY), false);
});

test('fuera de Paraguay sólo se valida el largo', () => {
  // No tenemos el padrón de prefijos de cada país: rechazar un número bueno
  // del exterior es peor que aceptar uno raro.
  const argentino = '1123456789';
  assert.equal(isRealisticPhone(argentino, AR), isValidPhone(argentino, AR));
});

test('normalizePhone no se rompe con entradas vacías o basura', () => {
  assert.equal(phoneKey('', PY), '');
  assert.equal(phoneKey('   ', PY), '');
  assert.equal(phoneKey('abc', PY), '');
  assert.equal(isRealisticPhone(null, PY), false);
});
