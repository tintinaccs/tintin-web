import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDeliveryCities, normalizeDeliveryCityName} from '../../js/components/location/tarifas-delivery.mjs';
test('las tarifas solicitadas deduplican zonas antiguas sin inventar otras ciudades ni precios',()=>{
 const result=canonicalDeliveryCities([{name:'San Lorenzo Centro',price:15000,departamento:'Central'},{name:'San Lorenzo Alrededores',price:20000},{name:'Fernando de la Mora',price:null},{name:'Luque',price:null},{name:'Luque',price:10000}]);
 assert.deepEqual(result.map(({name,price})=>({name,price})),[{name:'San Lorenzo',price:15000},{name:'Fernando de la Mora',price:null},{name:'Luque',price:null}]);
 assert.equal(result[0].departamento,'Central');assert.deepEqual(canonicalDeliveryCities([]),[]);assert.equal(normalizeDeliveryCityName(' San Lorenzo   Alrededores '),'San Lorenzo');
});

test('la administración decide el costo incluso en ciudades con aliases históricos',()=>{
 for(const price of [0,12000,31000,null]){
  for(const name of ['San Lorenzo','San Lorenzo Centro','Fernando de la Mora'])assert.equal(canonicalDeliveryCities([{name,price}])[0].price,price);
 }
});
