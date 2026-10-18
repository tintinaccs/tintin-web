import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin/admin-app.js','utf8');
const fn=source.slice(source.indexOf('window.prodToggleActive = async'),source.indexOf('\nasync function prodEliminar('));
for(const rejected of [false,true])test(`cambio de estado devuelve confirmación ${rejected?'fallida':'exitosa'} sin éxito inventado`,async()=>{
 const products=[{_docId:'product-test',name:'Producto de prueba',active:true}],calls=[];
 const deps={window:{},can:()=>true,currentRole:'superadmin',roleCanDo:()=>true,toast:()=>{},_allProducts:products,
  runAdminCrudOperation:async config=>{try{const value=await config.action({start(){},ok(){}});return{status:'green',value};}catch{return{status:'red'};}},
  withAdminSiteChange:async write=>write(),updateDoc:async(...args)=>{calls.push(['write',...args]);if(rejected)throw Error('Firestore no confirmó');},
  doc:(_db,collection,id)=>collection+'/'+id,db:{},serverTimestamp:()=>123,logAudit:async()=>calls.push(['audit']),pushProductsToSheets:async()=>calls.push(['sync']),renderProductosTable:()=>calls.push(['render'])};
 const toggle=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${fn};return window.prodToggleActive;`)(deps);
 const result=await toggle('product-test',true);
 assert.equal(result.status,rejected?'red':'green');assert.equal(products[0].active,rejected);
 assert.equal(calls.filter(c=>c[0]==='write').length,1);
 assert.equal(calls.filter(c=>c[0]==='sync').length,rejected?0:1);
});
