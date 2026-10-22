import test from 'node:test';
import assert from 'node:assert/strict';
import { sortCatalogProducts, productPriorityLevel } from '../../js/pages/catalog/politica-exhibicion-catalogo.js';

const available = {stock:5,active:true,price:50000,category:'relojes'};
test('badge NUEVO vence una reposición de stock más reciente', () => {
  const products = [
    {...available,id:'stock',name:'Stock',updatedAt:2000,restockedAt:2000},
    {...available,id:'badge',name:'Nuevo',badge:'Nuevo',updatedAt:1000},
  ];
  assert.equal(sortCatalogProducts(products)[0].id, 'badge');
});
test('destacado y modificación comercial van delante de inventario', () => {
  const products = [
    {...available,id:'stock',name:'Stock',restockedAt:5000},
    {...available,id:'price',name:'Precio',merchandisingUpdatedAt:3000},
    {...available,id:'featured',name:'Destacado',destacado:true,updatedAt:2000},
  ];
  assert.equal(productPriorityLevel(products[0]),1);
  assert.deepEqual(sortCatalogProducts(products).map(item=>item.id), ['price','featured','stock']);
});
test('agotados al final y prioridad consistente con fecha y desempate', () => {
  const products = [
    {...available,id:'out',name:'Agotado',stock:0,badge:'Nuevo',updatedAt:9999},
    {...available,id:'b',name:'B',badge:'Nuevo',updatedAt:1000},
    {...available,id:'a',name:'A',badge:'Nuevo',updatedAt:1000},
  ];
  assert.deepEqual(sortCatalogProducts(products).map(item=>item.id),['a','b','out']);
});
