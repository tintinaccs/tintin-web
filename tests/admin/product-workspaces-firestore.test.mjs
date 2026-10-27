import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { saveProductEditor } from '../../cloudflare/product-editor-domain.mjs';
import { productFingerprint } from '../../js/admin/products/maestro-productos-core.mjs';
import { productAdminState } from '../../js/admin/products/estado-administrativo-producto.mjs';
import { productIsPublished } from '../../js/core/store/estado-editorial-producto.mjs';
import { productEditorWorkspace } from '../../cloudflare/product-editor-workspaces.mjs';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const host=process.env.FIRESTORE_EMULATOR_HOST;
test('el borrador real del editor se confirma y recupera en Firestore sin listas anidadas', {skip:!host}, async()=>{
  assert.match(host,/^(127\.0\.0\.1|localhost):\d+$/);
  const project=process.env.GCLOUD_PROJECT || 'demo-tintin-interactions';
  assert.match(project,/^demo-/);
  const prefix=`projects/${project}/databases/(default)/documents/`;
  const root=`http://${host}/v1/${prefix.slice(0,-1)}`;
  const headers={authorization:'Bearer owner','content-type':'application/json'};
  const actor={uid:'qa-editor-'+randomUUID(),role:'superadmin'};
  const key='qa-product-'+randomUUID();
  const path=`productEditorWorkspaces/${actor.uid}/items/${key}`;
  const commit=async writes=>fetch(root+':commit',{method:'POST',headers,body:JSON.stringify({writes:writes.map(write=>({update:{name:prefix+write.path,fields:write.fields},...(write.currentDocument?{currentDocument:write.currentDocument}:{}),...(write.mergeFields?{updateMask:{fieldPaths:write.mergeFields}}:{})}))})});
  const io={
    async get(_env,path){const response=await fetch(root+'/'+path,{headers});if(response.status===404)return null;assert.equal(response.status,200,await response.clone().text());return response.json();},
    async commit(_env,writes){const response=await commit(writes);assert.equal(response.status,200,await response.clone().text());return response.json();}
  };
  // Es la estructura que genera serializeProductForm aun sin archivos elegidos.
  const snapshot={name:'Texto conservado',pendingPhotos:[['prod-image-widget',[]],['prod-gallery-widget',[0]]],pendingColorPhotos:[[0],[]],pendingUploads:false};
  const rejected=await commit([{path,fields:encodeFirestoreFields({snapshot})}]);
  assert.equal(rejected.status,400);
  const error=await rejected.json();
  assert.equal(error.error.status,'INVALID_ARGUMENT');
  assert.match(error.error.message,/nested (arrays|entity)/i);
  const initial=await productEditorWorkspace({},{action:'readProductWork',key},actor,io);
  const request={action:'saveProductWork',key,expectedRevision:0,baseExpected:initial.sourceExpected,changeId:randomUUID(),snapshot};
  const saved=await productEditorWorkspace({},request,actor,io);
  assert.equal(saved.revision,1);
  const persisted=decodeFirestoreFields((await io.get({},path)).fields);
  assert.equal(persisted.snapshot.name,'Texto conservado');
  assert.equal(persisted.snapshot.pendingUploads,false);
  assert.equal(Object.hasOwn(persisted.snapshot,'pendingPhotos'),false);
  assert.equal(Object.hasOwn(persisted.snapshot,'pendingColorPhotos'),false);
  assert.equal((await productEditorWorkspace({},request,actor,io)).duplicate,true);
  const pending=await productEditorWorkspace({},{...request,expectedRevision:1,changeId:randomUUID(),snapshot:{...snapshot,name:'Texto con archivo pendiente',pendingPhotos:[['prod-image-widget',['foto.png',123,456]]]}},actor,io);
  assert.equal(pending.revision,2);
  const recovered=await productEditorWorkspace({},{action:'readProductWork',key},actor,io);
  assert.equal(recovered.work.snapshot.pendingUploads,true);
  assert.equal(recovered.work.snapshot.name,'Texto con archivo pendiente');
  assert.equal(await io.get({},'products/'+key),null);
  // El mismo progreso es requisito de todos los guardados oficiales. Recorrer
  // también documentos históricos inactivos sin inventar un cuarto estado.
  const category='qa-collection-'+randomUUID();
  assert.equal((await commit([{path:'collections/'+category,fields:encodeFirestoreFields({name:'QA'})}])).status,200);
  const base={name:'Producto de prueba',category,price:30000,priceBefore:null,stock:4,oferta:false,destacado:false,description:'Descripción completa',imageUrl:'https://img.test/cover.webp',productTemplate:'default',seoTitle:'',seoDescription:''};
  for(const mode of ['inactive','active','inactive','active','archived','active','draft']){
    const source=await productEditorWorkspace({},{action:'readProductWork',key},actor,io);
    const work=await productEditorWorkspace({},{action:'saveProductWork',key,expectedRevision:source.revision,baseExpected:source.sourceExpected,changeId:randomUUID(),snapshot:{...snapshot,name:'Guardado '+mode}},actor,io);
    const currentDoc=await io.get({},'products/'+key);
    const before=currentDoc?decodeFirestoreFields(currentDoc.fields):null;
    const product={...base,name:'Guardado '+mode,active:mode==='active',...(mode==='inactive'?{}:{publicationStatus:mode})};
    const official={productId:key,expected:before?productFingerprint(before):null,changeId:randomUUID(),workspace:{key,revision:work.revision},product};
    // Un fallo previo al commit conserva el producto y permite reintentar.
    await assert.rejects(saveProductEditor({},official,actor,{...io,commit:async()=>{throw Error('gateway temporal');}}),/gateway temporal/);
    assert.deepEqual((await io.get({},'products/'+key))?.fields,currentDoc?.fields);
    assert.equal((await productEditorWorkspace({},{action:'readProductWork',key},actor,io)).work.closed,false);
    await saveProductEditor({},official,actor,io);
    const confirmed=decodeFirestoreFields((await io.get({},'products/'+key)).fields);
    assert.equal(confirmed.name,'Guardado '+mode);
    assert.equal(productAdminState(confirmed),mode);
    assert.equal(productIsPublished(confirmed),mode==='active');
    assert.equal(confirmed.stock,4);
    assert.equal(decodeFirestoreFields((await io.get({},path)).fields).closed,true);
    assert.equal((await saveProductEditor({},official,actor,io)).duplicate,true);
  }
});
