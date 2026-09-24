import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCatalogPreflightOutcome } from '../../functions/api/admin-catalog-delete.js';

test('un fallo de preflight no degrada una sincronización final confirmada', () => {
  const result = {
    sheets: { products: true, social: true },
    partial: false,
    errors: [],
  };

  applyCatalogPreflightOutcome(result, 'Firestore BATCH GET devolvió una respuesta inválida.');

  assert.equal(result.partial, false);
  assert.equal(result.sheets.products, true);
  assert.equal(result.pendingSheetSync, undefined);
  assert.deepEqual(result.errors, []);
  assert.equal(result.preflightRecovered, true);
});

test('un fallo de preflight sí queda pendiente cuando el cierre final no confirmó Sheets', () => {
  const result = {
    sheets: { products: false, social: true },
    partial: false,
    errors: [],
  };

  applyCatalogPreflightOutcome(result, 'Google Sheets no disponible');

  assert.equal(result.partial, true);
  assert.equal(result.pendingSheetSync, true);
  assert.equal(result.sheets.products, false);
  assert.match(result.errors[0], /Preflight de Google Sheets pendiente/);
});

test('sin fallo de preflight no altera el resultado', () => {
  const result = { sheets: { products: true }, partial: false, errors: [] };
  assert.equal(applyCatalogPreflightOutcome(result, ''), result);
  assert.equal(result.preflightRecovered, undefined);
});
