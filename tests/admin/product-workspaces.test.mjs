import test from 'node:test';
import assert from 'node:assert/strict';
import {productEditorWorkspace,productWorkSource,productWorkPath} from '../../cloudflare/product-editor-workspaces.mjs';
import {saveProductEditor} from '../../cloudflare/product-editor-domain.mjs';
import {productFingerprint} from '../../js/admin/products/maestro-productos-core.mjs';
import {encodeFirestoreFields as encode,decodeFirestoreFields as decode} from '../../cloudflare/firebase-admin-ligero.js';
const actor={uid:'qa-admin',role:'superadmin'},key='qa-product',path=productWorkPath(actor.uid,key);
const product={name:'Anillo',category:'anillos',price:30000,priceBefore:null,stock:4,active:true,oferta:false,destacado:false,description:'Descripción completa',imageUrl:'https://img.test/cover.webp',publicationStatus:'active',productTemplate:'default',seoTitle:'',seoDescription:''};
function store(initial={}){
 const docs=new Map(Object.entries(initial).map(([path,data])=>[path,{fields:encode(data),updateTime:'initial'}]));let sequence=0;const writes=[];
 const io={get:async(_,path)=>docs.get(path),listPage:async(_,path)=>({documents:[...docs].filter(([key])=>key.startsWith(path+'/')).map(([,doc])=>doc),nextPageToken:''}),commit:async(_,batch)=>{
  for(const write of batch){const doc=docs.get(write.path);if(write.currentDocument?.exists===false && doc || write.currentDocument?.updateTime && write.currentDocument.updateTime!==doc?.updateTime)throw Object.assign(Error('Conflicto CAS'),{status:409});}
  for(const write of batch){docs.set(write.path,{fields:encode({...decode(docs.get(write.path)?.fields || {}),...decode(write.fields)}),updateTime:String(++sequence)});writes.push(write);}
 }};return {docs,writes,io,data:path=>decode(docs.get(path)?.fields || {})};
}
async function draft(s,snapshot={name:'Incompleto'},who=actor){const source=await productWorkSource({},key,who,s.io);return productEditorWorkspace({},{action:'saveProductWork',key,expectedRevision:0,baseExpected:source.revision,changeId:'qa_change_000001',snapshot},who,s.io);}
test('nuevo incompleto es progreso privado, no producto ni inventario; reabrir y listar',async()=>{
 const s=store();await draft(s);assert.equal(s.docs.has('products/'+key),false);assert.equal(s.writes.length,2);assert.ok(s.writes[1].path.startsWith('auditLog/'));
 const read=await productEditorWorkspace({},{action:'readProductWork',key},actor,s.io);assert.equal(read.work.snapshot.name,'Incompleto');assert.equal(read.conflict,false);
 const list=await productEditorWorkspace({},{action:'listProductWork'},actor,s.io);assert.equal(list.items[0].key,key);assert.equal(list.items[0].productId,null);
});
test('reintento idempotente y dos pestañas: un único avance, revisión vieja rechazada',async()=>{
 const s=store();const saved=await draft(s);const body={action:'saveProductWork',key,expectedRevision:1,baseExpected:saved.work.baseExpected,changeId:'qa_change_000002',snapshot:{name:'Nuevo'}};
 await productEditorWorkspace({},body,actor,s.io);const duplicate=await productEditorWorkspace({},body,actor,s.io);assert.equal(duplicate.duplicate,true);assert.equal(s.writes.length,4);
 await assert.rejects(productEditorWorkspace({},{...body,changeId:'qa_change_000003'},actor,s.io),e=>e.status===409);
});
test('publicado conserva versión pública; publicar cierra progreso y audita atómicamente',async()=>{
 const s=store({['products/'+key]:{...product,historical:'conservar'},'collections/anillos':{name:'Anillos'}});await draft(s,{name:'Trabajo'});
 assert.equal(s.data('products/'+key).name,'Anillo');assert.equal(s.data('products/'+key).active,true);
 const result=await saveProductEditor({},{productId:key,expected:productFingerprint({...product,historical:'conservar'}),changeId:'qa_apply_000001',workspace:{key,revision:1},product:{...product,name:'Trabajo'}},actor,s.io);
 assert.equal(result.product.historical,'conservar');assert.equal(s.data(path).closed,true);assert.equal(s.writes.slice(-3).length,3);assert.equal(s.data('products/'+key).name,'Trabajo');
});
test('cambio público o inventario privado impide aplicar; el progreso sigue recuperable',async()=>{
 for(const privateChange of [false,true]){const s=store({['products/'+key]:product,'collections/anillos':{}});await draft(s);s.docs.set(privateChange?'productInventory/'+key:'products/'+key,{fields:encode(privateChange?{purchased:99}:{...product,stock:3}),updateTime:'other'});
 const read=await productEditorWorkspace({},{action:'readProductWork',key},actor,s.io);assert.equal(read.conflict,true);
 await assert.rejects(saveProductEditor({},{productId:key,expected:productFingerprint(privateChange?product:{...product,stock:3}),changeId:'qa_apply_000001',workspace:{key,revision:1},product},actor,s.io),e=>e.status===409);assert.equal(s.data(path).closed,false);}
});
test('nuevo sólo se publica completo y no duplica al reintentar aplicación',async()=>{
 const s=store({'collections/anillos':{}});await draft(s);const body={productId:key,expected:null,changeId:'qa_apply_000001',workspace:{key,revision:1},product};
 await assert.rejects(saveProductEditor({},{...body,product:{...product,description:''}},actor,s.io),e=>e.status===422);assert.equal(s.docs.has('products/'+key),false);
 await saveProductEditor({},body,actor,s.io);const count=s.writes.length;assert.equal((await saveProductEditor({},body,actor,s.io)).duplicate,true);assert.equal(s.writes.length,count);
});
test('writer V1 conserva la intención canónica de reposición sin alterar prioridad comercial',async()=>{
 const s=store({['products/'+key]:product,'collections/anillos':{}});
 await saveProductEditor({},{productId:key,expected:productFingerprint(product),changeId:'qa_stock_000001',restockOnly:true,product:{...product,stock:3}},actor,s.io);
 assert.ok(s.data('products/'+key).restockedAt);assert.equal(s.data('products/'+key).merchandisingUpdatedAt,undefined);assert.equal(s.data('products/'+key).active,true);
});
test('propietario y privilegios: sin acceso cruzado ni campos privados al bajar rol',async()=>{
 const s=store();await draft(s,{name:'Privado',internalNotes:'secreto'});
 const other=await productEditorWorkspace({},{action:'readProductWork',key},{uid:'other',role:'superadmin'},s.io);assert.equal(other.work,null);
 await assert.rejects(productEditorWorkspace({},{action:'readProductWork',key},{...actor,role:'admin'},s.io),e=>e.status===403);
 for(const role of ['customer','agent'])await assert.rejects(draft(store(),{}, {...actor,role}),e=>e.status===403);
 await assert.rejects(draft(store(),{internalNotes:'secret'},{...actor,role:'admin'}),e=>e.status===403);
});
test('permisos de crear/editar se revisan al leer y escribir; listar admite rol sólo editor',async()=>{
 const s=store({['products/'+key]:product,'rolePermissions/main':{admin:{productos:{crear:false,editar:true,ver:true}}}}),admin={...actor,role:'admin'};await draft(s,{},admin);
 assert.equal((await productEditorWorkspace({},{action:'listProductWork'},admin,s.io)).items.length,1);
 s.docs.set('rolePermissions/main',{fields:encode({admin:{productos:{ver:false}}})});await assert.rejects(productEditorWorkspace({},{action:'readProductWork',key},admin,s.io),e=>e.status===403);
});
test('descartar conserva tombstone e historial y no toca versión publicada ni archivos',async()=>{
 const s=store({['products/'+key]:product});const saved=await draft(s);await productEditorWorkspace({},{action:'discardProductWork',key,expectedRevision:1,baseExpected:saved.work.baseExpected,changeId:'qa_discard_0001'},actor,s.io);
 assert.equal(s.data(path).closed,true);assert.deepEqual(s.data('products/'+key),product);assert.equal((await productEditorWorkspace({},{action:'listProductWork'},actor,s.io)).items.length,0);
});
test('límites, campos desconocidos, URLs temporales e identidades inválidas',async()=>{
 for(const snapshot of [{secret:'bad'},{imageUrl:'blob:temporary'},{name:'x'.repeat(20001)},JSON.parse('{"name":{"__proto__":{}}}')])await assert.rejects(draft(store(),snapshot),e=>e.status===422);
 assert.throws(()=>productWorkPath('qa','../other'));assert.throws(()=>productWorkPath('','key'));
});

test('listado pagina sin truncar a100/1000, mantiene permisos y restringe siempre al dueño autenticado',async()=>{
 const s=store(),calls=[];
 const row=(key,extra={})=>({fields:encode({key,ownerUid:actor.uid,private:false,closed:false,snapshot:{name:key},updatedAt:'2026-10-26T10:00:00Z',...extra})});
 s.io.listPage=async(_,root,options)=>{
  calls.push({root,...options});
  return options.pageToken?{documents:[row('final'),row('ajeno',{ownerUid:'other'}),row('cerrado',{closed:true})],nextPageToken:''}:{documents:Array.from({length:100},(_,i)=>row('work_'+i)),nextPageToken:'opaque/next+=123'};
 };
 const first=await productEditorWorkspace({},{action:'listProductWork',ownerUid:'other'},actor,s.io);
 assert.equal(first.items.length,100);assert.equal(first.nextPageToken,'opaque/next+=123');assert.equal(first.limited,true);
 const last=await productEditorWorkspace({},{action:'listProductWork',pageToken:first.nextPageToken},actor,s.io);
 assert.deepEqual(last.items.map(x=>x.key),['final']);assert.equal(last.limited,false);
 assert(calls.every(x=>x.root===`productEditorWorkspaces/${actor.uid}/items` && x.pageSize===100));
 assert.equal(calls[1].pageToken,first.nextPageToken);assert.equal(s.writes.length,0);
 for(const pageToken of [42,{},'x'.repeat(4097),'bad\npage'])await assert.rejects(productEditorWorkspace({},{action:'listProductWork',pageToken},actor,s.io),e=>e.status===422);
});
