import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCsvDelimiter,
  parseDelimitedRows,
  parseLocalizedNumber,
  parseOptionalStock,
  validateOperationalBackupEnvelope,
} from '../../js/core/store/normalizacion-importacion.mjs';

test('parsea números localizados sin confundir miles y decimales', () => {
  assert.equal(parseLocalizedNumber('100.000'), 100000);
  assert.equal(parseLocalizedNumber('1.234.567'), 1234567);
  assert.equal(parseLocalizedNumber('1.234,56'), 1234.56);
  assert.equal(parseLocalizedNumber('1,234.56'), 1234.56);
  assert.equal(parseLocalizedNumber('Gs. 180.000'), 180000);
  assert.equal(parseLocalizedNumber('1000,50'), 1000.5);
  assert.equal(parseLocalizedNumber('1000.50'), 1000.5);
  assert.ok(Number.isNaN(parseLocalizedNumber('sin precio')));
});

test('preserva stock ilimitado y rechaza valores inválidos', () => {
  assert.equal(parseOptionalStock(''), null);
  assert.equal(parseOptionalStock(null), null);
  assert.equal(parseOptionalStock('Sin límite'), null);
  assert.equal(parseOptionalStock('∞'), null);
  assert.equal(parseOptionalStock('1.000'), 1000);
  assert.equal(parseOptionalStock('12'), 12);
  assert.ok(Number.isNaN(parseOptionalStock('-1')));
  assert.ok(Number.isNaN(parseOptionalStock('2,5')));
});

test('detecta coma, punto y coma o tabulador sin mirar delimitadores citados', () => {
  assert.equal(detectCsvDelimiter('name,description\nA,"uno; dos"'), ',');
  assert.equal(detectCsvDelimiter('name;price;stock\nA;100.000;'), ';');
  assert.equal(detectCsvDelimiter('name\tprice\tstock\nA\t100000\t2'), '\t');
});

test('parsea comillas escapadas y saltos de línea dentro de una celda', () => {
  const rows = parseDelimitedRows('name;description\nReloj;"Línea 1\nLínea ""dos"""');
  assert.deepEqual(rows, [
    ['name', 'description'],
    ['Reloj', 'Línea 1\nLínea "dos"'],
  ]);
});

test('valida proyecto, formato y versión de copias operativas', () => {
  const valid = {
    format: 'tintin-operational-backup',
    projectId: 'tintin-accesorios',
    schemaVersion: 1,
    data: { products: [{ name: 'Reloj' }] },
  };
  assert.deepEqual(validateOperationalBackupEnvelope(valid), valid.data.products);
  assert.throws(() => validateOperationalBackupEnvelope({ ...valid, projectId: 'otro' }), /otro proyecto/i);
  assert.throws(() => validateOperationalBackupEnvelope({ ...valid, schemaVersion: 2 }), /versión/i);
  assert.throws(() => validateOperationalBackupEnvelope({ ...valid, format: 'otro' }), /formato/i);
});
