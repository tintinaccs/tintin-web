import test from 'node:test';
import assert from 'node:assert/strict';
import { stripEscapedSvgPrefix } from '../../js/pages/checkout/checkout-resumen-confirmacion.js';

test('el resumen elimina un SVG escapado visible antes del método de envío', () => {
  const value = '<svg width="13" height="13"><path d="M0 0h1"/></svg>Por encomienda — retiro en agencia';
  assert.equal(stripEscapedSvgPrefix(value), 'Por encomienda — retiro en agencia');
});

test('el resumen elimina un SVG escapado visible antes del método de pago', () => {
  const value = '<svg width="13" height="13">\n<line x1="3" y1="21" x2="21" y2="21"/>\n</svg>Transferencia bancaria';
  assert.equal(stripEscapedSvgPrefix(value), 'Transferencia bancaria');
});

test('el resumen conserva texto normal sin modificarlo', () => {
  assert.equal(stripEscapedSvgPrefix('A confirmar'), 'A confirmar');
  assert.equal(stripEscapedSvgPrefix('Gs. 65.000'), 'Gs. 65.000');
});

test('el normalizador no interpreta ni elimina HTML que no sea el SVG escapado inicial', () => {
  const value = '<img src=x onerror=alert(1)>Transferencia bancaria';
  assert.equal(stripEscapedSvgPrefix(value), value);
});
