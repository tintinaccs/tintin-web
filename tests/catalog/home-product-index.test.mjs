import test from 'node:test';
import assert from 'node:assert/strict';
import {homeProductIndex} from '../../cloudflare/indice-inicio.mjs';
import {chooseHomeIds} from '../../js/pages/catalog/politica-exhibicion-catalogo.js';
const product=(id,data={})=>({id,data:{name:'Anillo '+id,category:'anillos',active:true,price:25000,stock:2,...data}});
test('el índice conserva todo el pool elegible y destacados sin descripciones, fotos ni matrices comerciales',()=>{
 const items=Array.from({length:1501},(_,i)=>product(String(i),{destacado:i===1500,description:'X'.repeat(4000),imageUrl:'https://img.example/'+i,internalNotes:'privado'}));
 const index=homeProductIndex([...items,product('hidden',{active:false}),product('empty',{stock:0})]);
 assert.equal(index.length,1502);assert.equal(index.filter(p=>p.data.available).length,1501);assert.ok(index.some(p=>p.id==='1500'&&p.data.destacado));
 assert.ok(index.every(p=>Object.keys(p.data).sort().join(',')==='available,category,destacado'));
 assert.ok(JSON.stringify(index).length<JSON.stringify(items).length/20);
});
test('disponibilidad v2 proviene de la autoridad de variantes, incluso con stock agregado cero',()=>{
 const rows=homeProductIndex([product('v2',{stock:0,variantCommerceVersion:2,variants:{Color:['Oro']},variantInventory:[{variant:'key',attributes:{Color:'Oro'},stock:null,price:25000}]}),product('sold',{stock:0}),product('draft',{publicationStatus:'draft'})]);
 assert.equal(rows.find(p=>p.id==='v2').data.available,true);assert.equal(rows.find(p=>p.id==='sold').data.available,false);assert.ok(!rows.some(p=>p.id==='draft'));
});
test('selecciones estables, sin duplicados y con alcance a todo el índice al volver a sortear',()=>{
 const ids=Array.from({length:100},(_,i)=>'p'+i);const previous=['p95','p96','p97','p98','p99'];
 assert.deepEqual(chooseHomeIds(ids,5,previous),previous);assert.deepEqual(ids[0],'p0');
 let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const reached=new Set();
 for(let i=0;i<500;i++){const pick=chooseHomeIds(ids,5,previous,true,random);assert.equal(new Set(pick).size,5);pick.forEach(id=>reached.add(id));}
 assert.equal(reached.size,100);assert.deepEqual(chooseHomeIds([],5),[]);
});
