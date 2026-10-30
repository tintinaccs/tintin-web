import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync('js/core/store/estado-productos.js','utf8');
const fetchHome=source.slice(source.indexOf('async function fetchHomeProducts('),source.indexOf('export function rerollHomeSelection'));
for(const staleFailure of [false,true])test(`una actualización tardía no sustituye Inicio reciente ni muestra errores viejos: fallo=${staleFailure}`,async()=>{
 let releaseOld;const oldBatch=new Promise((resolve,reject)=>{releaseOld=staleFailure?reject:resolve;});let reads=0;
 const window={PRODUCTS:[]};
 const context={window,homeRequestVersion:0,catalogVisibilityReady:Promise.resolve(),homeIndex:[],homeIndexSavedAt:0,homeSelection:null,HOME_CACHE_TTL:10000,ALL_CACHE_KEY:'all',ALL_CACHE_TTL:10000,HOME_CACHE_KEY:'home',document:{getElementById:()=>null},chooseHomeIds:()=>[],readCached:()=>null,normalizeList:x=>x,compactProduct:x=>x,mapProduct:(id,data)=>({id,...data}),writeCached:()=>{},publishHome:products=>(window.PRODUCTS=products),fetchPublicHomeIndex:async()=>[{id:++reads===1?'old':'new',data:{category:'anillos',destacado:true,available:true}}],fetchPublicProductsByIds:async ids=>ids.includes('old')?oldBatch:ids.map(id=>({id,data:{name:id,price:100}}))};
 vm.createContext(context);vm.runInContext(fetchHome,context);
 const old=context.fetchHomeProducts({force:true});await new Promise(resolve=>setImmediate(resolve));
 await context.fetchHomeProducts({force:true});assert.equal(window.PRODUCTS[0].id,'new');
 releaseOld(staleFailure?Error('respuesta vieja fallida'):[{id:'old',data:{name:'old',price:100}}]);await old;
 assert.equal(window.PRODUCTS[0].id,'new');assert.equal(context.homeSelection.featured[0],'new');
});
