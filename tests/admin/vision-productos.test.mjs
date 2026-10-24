import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {rankProductImage,suggestedCategory} from '../../js/admin/products/vision-productos-core.mjs';

test('visión no propone categorías inexistentes, deshabilitadas ni coincidencias parciales',()=>{
 const options=[{value:'x',textContent:'Carteras y zapatos'},{value:'archivada',textContent:'Carteras',disabled:true},{value:'bolsos',textContent:'Bolsos'}];
 assert.equal(suggestedCategory('bag',options),'bolsos');assert.equal(suggestedCategory('watch',options),'');assert.equal(suggestedCategory('other',options),'');
});
test('visión se abstiene ante señal vacía, ambigua o de otro objeto',()=>{
 const vector=new Array(512).fill(0);vector[0]=1;
 const labels=[{key:'watch',label:'Reloj',embedding:vector},{key:'bag',label:'Cartera',embedding:vector}];
 assert.equal(rankProductImage(new Float32Array(512),labels),null);assert.equal(rankProductImage(vector,labels),null);
 assert.equal(rankProductImage(vector,[{key:'other',label:'Otro',embedding:vector}]),null);
 assert.throws(()=>rankProductImage([NaN],labels));
});
test('assets locales íntegros, pesos MIT y cada archivo dentro del límite de Pages',()=>{
 const root='assets-tintin/vision/',manifest=JSON.parse(fs.readFileSync(root+'procedencia.json'));
 assert.equal(manifest.license,'MIT');const chunks=[];
 for(const [name,expected] of Object.entries(manifest.assets)) {
  const bytes=fs.readFileSync(root+name);assert.equal(bytes.length,expected.bytes);assert.ok(bytes.length<25*1024*1024);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  if(manifest.parts.includes(name))chunks.push(bytes);
 }
 assert.equal(crypto.createHash('sha256').update(Buffer.concat(chunks)).digest('hex'),manifest.modelSha256);
 assert.match(fs.readFileSync(root+'LICENSE-TinyCLIP.txt','utf8'),/MIT License/);
 const vendor='vendor/onnxruntime-web-1.22.0/';for(const name of fs.readdirSync(vendor))assert.ok(fs.statSync(vendor+name).size<25*1024*1024);
 const runtime=JSON.parse(fs.readFileSync(vendor+'PROCEDENCIA.json'));
 for(const [name,sha] of Object.entries(runtime.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(vendor+name)).digest('hex'),sha);
});
