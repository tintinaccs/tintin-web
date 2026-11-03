import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync('js/components/images/resolucion-imagenes.js','utf8').replace(/^import\s[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,'').replace(/\bimport\(/g,'loadModule(');
function runtime(){const calls=[],writes=[];const io={db:{},doc:(_db,...parts)=>parts.join('/'),getDoc:async()=>({exists:()=>true,data:()=>({general:'https://example.invalid/fallback.jpg'})}),setDoc:async(...args)=>writes.push(args),serverTimestamp:()=> 'server-time',onSnapshot:()=>{calls.push('watch');}};
 const deps={sanitizeImageUrl:value=>typeof value==='string'?value:'',firstEligibleCollectionProduct:()=>null,loadModule:async path=>{calls.push(path);return path.includes('publicar-cambio')?{withAdminSiteChange:action=>action()}:io;}};
 const api=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${source};return {resolveDeviceImage,loadImageDefaults,saveImageDefaults,onImageDefaultsUpdate};`)(deps);return {api,calls,writes};}
test('resolver imágenes existentes no carga Firebase; defaults conservan lectura y guardado canónicos',async()=>{
 const {api,calls,writes}=runtime();api.resolveDeviceImage({desktop:'https://example.invalid/p.jpg'},'mobile');assert.equal(calls.length,0);
 assert.equal((await api.loadImageDefaults()).general,'https://example.invalid/fallback.jpg');
 await api.saveImageDefaults({product:'https://example.invalid/product.jpg'});assert.equal(writes.length,1);assert.equal(writes[0][0],'settings/imageDefaults');assert.equal(writes[0][1].updatedAt,'server-time');assert(calls.some(path=>path.includes('publicar-cambio-administrativo')));
});
test('cancelar antes de cargar el SDK no deja un listener sin consumidores',async()=>{
 const {api,calls}=runtime();const stop=api.onImageDefaultsUpdate(()=>{});stop();await new Promise(resolve=>setImmediate(resolve));assert(!calls.includes('watch'));
});
