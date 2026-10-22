import test from 'node:test';
import assert from 'node:assert/strict';
import { productSearchScore,productSearchText } from '../../js/core/store/busqueda-productos.mjs';
const product={name:'Anillo corazón',category:'Anillos',description:'Acero quirúrgico',tags:['regalo'],sku:'A1234',variants:[{Color:'Dorado'}]};
test('búsqueda comparte acentos, palabras en distinto orden y datos reales de variantes',()=>{
 for(const q of ['corazon','quirurgico','dorado','regalo','corazón anillo','A1234']) assert.ok(productSearchScore(product,q)>0,q);
 assert.equal(productSearchScore({...product,tags:'regalo'},'regalo'),0);
 assert.ok(productSearchText(product).includes('dorado'));
});
test('tolera un error de escritura pero conserva precedencia de coincidencias exactas',()=>{
 for(const q of ['anilo','anilllo','anilol','anillo corazon','anillo coraazon']) assert.ok(productSearchScore(product,q)>0,q);
 assert.ok(productSearchScore(product,'anillo')>productSearchScore(product,'anilo'));
 for(const q of ['reloj','anlxlo','A1235','xy','']) assert.equal(productSearchScore(product,q),0,q);
});
test('catálogo grande mantiene el buscador acotado sin solicitudes adicionales',()=>{
 const products=Array.from({length:1000},(_,i)=>({...product,name:`Anillo corazón ${i}`}));
 const index=products.map(p=>[p,productSearchText(p)]);
 assert.equal(index.filter(([p,t])=>productSearchScore(p,'anilo',t)>0).length,1000);
});
