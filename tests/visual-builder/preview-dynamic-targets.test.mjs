import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRandomPreviewProduct, productPreviewTarget } from '../../js/admin/appearance/preview-dynamic-targets.js';

test('producto dinámico elige un registro real con stock y conserva un solo id', () => {
  const products = [
    { id: 'oculto', name: 'Oculto', price: 100, active: false, stock: 4 },
    { id: 'agotado', name: 'Agotado', price: 100, active: true, stock: 0 },
    { id: 'reloj-rosa', name: 'Reloj rosa', price: 100, active: true, stock: 3 },
    { id: 'collar-dorado', name: 'Collar dorado', price: 120, active: true, stock: 2 },
  ];

  const selected = chooseRandomPreviewProduct(products, () => 0.99);
  assert.equal(selected.id, 'collar-dorado');
  assert.equal(productPreviewTarget('product.html', selected), 'product.html?id=collar-dorado');
});

test('producto dinámico usa existencias agotadas solo si no hay otra muestra válida', () => {
  const selected = chooseRandomPreviewProduct([
    { id: 'agotado', name: 'Agotado', price: 100, active: true, stock: 0 },
  ], () => 0.5);
  assert.equal(selected.id, 'agotado');
  assert.equal(productPreviewTarget('product.html?mode=preview', selected), 'product.html?mode=preview&id=agotado');
});
