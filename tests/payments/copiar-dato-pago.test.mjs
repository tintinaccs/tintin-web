import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerDatoParaCopiar, copiarTexto } from '../../js/pages/checkout/copiar-dato-pago.js';

test('copia solo el alias y respeta "Sin Guión"', () => {
  const dato = 'Alias Teléfono: 0971-300-923 (Sin Guión)\nNombre de la Cuenta: Bárbara Ruiz';
  assert.equal(extraerDatoParaCopiar(dato), '0971300923');
});

test('alias sin nota conserva el valor tal cual', () => {
  assert.equal(extraerDatoParaCopiar('Alias: mi.alias'), 'mi.alias');
  assert.equal(extraerDatoParaCopiar('Alias Teléfono: 0971-300-923'), '0971-300-923');
});

test('sin línea de alias copia el texto completo', () => {
  assert.equal(extraerDatoParaCopiar('Cuenta 123-456\nTitular Ana'), 'Cuenta 123-456\nTitular Ana');
  assert.equal(extraerDatoParaCopiar(null), '');
});

test('copiarTexto usa el portapapeles y devuelve false si no hay texto', async () => {
  let copiado = '';
  const nav = { clipboard: { writeText: async value => { copiado = value; } } };
  assert.equal(await copiarTexto('0971300923', {}, nav), true);
  assert.equal(copiado, '0971300923');
  assert.equal(await copiarTexto('', {}, nav), false);
});

test('si el portapapeles falla usa el método clásico', async () => {
  const area = { setAttribute() {}, style: {}, select() {}, setSelectionRange() {}, remove() {} };
  const doc = { createElement: () => area, body: { appendChild() {} }, execCommand: cmd => cmd === 'copy' };
  const nav = { clipboard: { writeText: async () => { throw new Error('denegado'); } } };
  assert.equal(await copiarTexto('abc', doc, nav), true);
});
