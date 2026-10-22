import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { hasProductStock } from '../../js/core/store/inventario-variantes.mjs';
const source = fs.readFileSync(new URL('../../js/pages/catalog/politica-exhibicion-catalogo.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const context = vm.createContext({ window: {}, hasProductStock });
vm.runInContext(source, context);
const { sortCatalogProducts, productPriorityLevel } = context;

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
  assert.deepEqual(Array.from(sortCatalogProducts(products), item=>item.id), ['price','featured','stock']);
});
test('agotados al final y prioridad consistente con fecha y desempate', () => {
  const products = [
    {...available,id:'out',name:'Agotado',stock:0,badge:'Nuevo',updatedAt:9999},
    {...available,id:'b',name:'B',badge:'Nuevo',updatedAt:1000},
    {...available,id:'a',name:'A',badge:'Nuevo',updatedAt:1000},
  ];
  assert.deepEqual(sortCatalogProducts(products).map(item=>item.id),['a','b','out']);
});

test('reponer una novedad no supera una edición comercial más reciente', () => {
  const products = [
    {...available,id:'reposicion',name:'Novedad',badge:'Nuevo',merchandisingUpdatedAt:1000,restockedAt:9000,updatedAt:9000},
    {...available,id:'edicion',name:'Precio editado',merchandisingUpdatedAt:6000,updatedAt:6000},
    {...available,id:'soloStock',name:'Sin badge',restockedAt:10000,updatedAt:10000},
  ];
  assert.deepEqual(Array.from(sortCatalogProducts(products), p=>p.id),
    ['edicion','reposicion','soloStock']);
});
