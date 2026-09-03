import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync(new URL('../../js/pages/checkout/checkout-facturacion-estable.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../../js/components/navigation/compartido/carga-navegacion.js', import.meta.url), 'utf8');

test('Factura usa un único listener idempotente y deshabilita los campos ocultos', () => {
  assert.match(moduleSource, /checkbox\.onchange\s*=\s*null/);
  assert.match(moduleSource, /checkbox\.addEventListener\('change',\s*\(\)\s*=>\s*setInvoiceVisibility/);
  assert.match(moduleSource, /control\.disabled\s*=\s*!enabled/);
  assert.match(moduleSource, /fields\.hidden\s*=\s*!enabled/);
  assert.match(moduleSource, /aria-hidden/);
});

test('RUC se normaliza localmente antes del onclick canónico del checkout', () => {
  assert.match(moduleSource, /next\.addEventListener\('click',\s*normalizeRucField,\s*\{\s*capture:\s*true\s*\}\)/);
  assert.match(moduleSource, /normalizeCheckoutRuc\(input\.value\)/);
  assert.match(moduleSource, /if \(\/\^\\d\{6,9\}\$\/\.test\(value\)\) return `\$\{value\.slice\(0, -1\)\}-\$\{value\.slice\(-1\)\}`/);
});

test('Persistencia del perfil ocurre solo después de que el paso de datos fue validado', () => {
  assert.match(moduleSource, /confirmedDataPanelIsActive\(\)/);
  assert.match(moduleSource, /window\.setTimeout\(\(\)\s*=>\s*\{/);
  assert.match(moduleSource, /if \(confirmedDataPanelIsActive\(\)\) void persistConfirmedCheckoutProfile\(\)/);
  assert.match(moduleSource, /setDoc\(doc\(db, 'users', user\.uid\), patch, \{ merge: true \}\)/);
});

test('La capa de facturación estable se carga junto al runtime del checkout', () => {
  assert.match(loaderSource, /pages\/checkout\/checkout-facturacion-estable\.js/);
});
