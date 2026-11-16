import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {productSearchScore} from '../../js/core/store/busqueda-productos.mjs';
import {safeSearchTerm} from '../../js/analytics/privacidad-busqueda.mjs';
const products=JSON.parse(fs.readFileSync(new URL('./public-search-fixture.json',import.meta.url)));
test('datos públicos reales: nombre parcial, sinónimos, atributos y combinación de palabras',()=>{
 const cases={'AMIRA':'BOLSO AMIRA','cartera beige':'BOLSO ALONDRA','reloj dorado':'RELOJ GIANNA','reloj plateado':'RELOJ LUCIENNE','cadenitas doradas':'COLLAR AMULET'};
 for(const [query,name] of Object.entries(cases))assert.ok(productSearchScore(products.find(product=>product.name===name),query)>0,query);
});
test('códigos conservan ceros y separadores; exacto agotado supera mención en descripción',()=>{
 const exact={name:'Anillo',sku:'TIN-00042',stock:0};
 for(const q of ['TIN-00042','tin 00042','tin00042'])assert.equal(productSearchScore(exact,q),120,q);
 for(const q of ['TIN-00043','TIN-0042','TIN-000420'])assert.equal(productSearchScore(exact,q),0,q);
 assert.ok(productSearchScore(exact,'TIN-00042')>productSearchScore({name:'Otro',description:'TIN-00042'},'TIN-00042'));
 assert.ok(productSearchScore({name:'Aros',material:'Plata 925'},'aretes plata 925')>0);
 assert.equal(productSearchScore({name:'Aros',material:'Plata 9250'},'aros plata 925'),0);
});
test('términos personales no salen hacia GA4',()=>{
 for(const value of ['hola@example.com','0981 299 331','mi cédula 123456','dirección San Lorenzo'])assert.equal(safeSearchTerm(value),'');
 assert.equal(safeSearchTerm('cartera beige'),'cartera beige');
 assert.equal(safeSearchTerm('TIN-00042'),'TIN-00042');
});
