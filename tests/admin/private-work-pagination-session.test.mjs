import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {readProductEditorResponse} from '../../js/admin/products/respuesta-editor-producto.mjs';
const source=fs.readFileSync('js/admin/shopify-commerce-admin.js','utf8');
const code=source.slice(source.indexOf('let privateWorkOwner='),source.indexOf("window.addEventListener('tintin:product-work-saved'"));
function harness(){
 const pending=[],state={user:{uid:'owner'},role:'superadmin'};
 const context=vm.createContext({state,readProductEditorResponse,document:{getElementById:()=>({classList:{contains:()=>true}})},renderProducts(){},authenticatedFetch:(_url,options)=>new Promise(resolve=>pending.push({body:JSON.parse(options.body),resolve:items=>resolve(Response.json({ok:true,result:{items,nextPageToken:''}}))}))});
 vm.runInContext(code,context);
 return {context,state,pending,load:()=>vm.runInContext('loadPrivateProductWorks()',context),items:()=>Array.from(vm.runInContext('privateWorks',context),x=>x.key)};
}
test('respuesta tardía de Super Admin no repuebla borradores tras cambiar rol en el mismo UID',async()=>{
 const h=harness(),old=h.load();
 h.state.role='admin';const fresh=h.load();
 h.pending[1].resolve([{key:'allowed'}]);await fresh;
 h.pending[0].resolve([{key:'private-superadmin'}]);await old;
 assert.deepEqual(h.items(),['allowed']);
});
test('cerrar sesión limpia listado y cursor, e ignora la respuesta anterior',async()=>{
 const h=harness(),old=h.load();h.state.user=null;await h.load();
 h.pending[0].resolve([{key:'private'}]);await old;
 assert.deepEqual(h.items(),[]);assert.equal(vm.runInContext('privateWorkNext',h.context),'');
});
