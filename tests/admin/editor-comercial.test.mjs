import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialDraft,commercialPatch,setCommercialOptionAvailability} from '../../js/admin/products/editor-comercial-core.mjs';
import {saveProductEditor,validateProductEditorPatch} from '../../cloudflare/product-editor-domain.mjs';
import {encodeFirestoreFields,decodeFirestoreFields} from '../../cloudflare/firebase-admin-ligero.js';
import {productFingerprint,productDuplicateData} from '../../js/admin/products/maestro-productos-core.mjs';
const source={name:'Anillo',category:'anillos',price:30000,priceBefore:null,active:true,oferta:false,destacado:false,variants:{Color:['Oro','Plata']},variantInventory:[{variant:'Oro',stock:3},{variant:'Plata',stock:0}],stock:3,privateLegacy:'preservado'};
const product=()=>commercialDraft(source);
test('mil combinaciones conservan valores al reordenar y rechazan crecimiento sin mutar el borrador',()=>{
 const variants=Object.fromEntries(['Color','Talle','Material'].map(key=>[key,Array.from({length:10},(_,i)=>`${key}${i}`)]));
 const draft=commercialDraft({price:30000,variants});
 assert.equal(draft.variantInventory.length,1000);
 const row=draft.variantInventory.at(-1);row.price=55000;row.stock=7;
 const snapshot=structuredClone(draft);
 const ordered=commercialDraft(draft,Object.fromEntries(Object.entries(variants).reverse().map(([key,values])=>[key,[...values].reverse()])),{});
 assert.deepEqual(ordered.variantInventory.find(item=>item.variant===row.variant),row);
 assert.throws(()=>commercialDraft(draft,{...variants,Color:[...variants.Color,'Otro']},{}),/1.000/);
 assert.deepEqual(draft,snapshot);
});
test('portada canónica actualiza o vacía el alias histórico sin revivir fotografías',()=>{
 const before={...product(),image:'https://img.test/old.webp'};
 const next=validateProductEditorPatch(before,{imageUrl:'https://img.test/fourth.webp'});
 assert.equal(next.image,'https://img.test/fourth.webp');
 const removed=validateProductEditorPatch(before,{imageUrl:null});assert.equal(removed.image,null);
 const noAlias=validateProductEditorPatch(product(),{imageUrl:'https://img.test/fourth.webp'});assert.equal(Object.hasOwn(noAlias,'image'),false);
});
const inventory={costUnit:100,purchased:2,stockMinimum:1,internalNotes:'Privado'};

test('retirar y restaurar una opción preserva cantidades, precios, fotos e identidades',()=>{
 const p=product();p.variantInventory[0].price=45000;p.variantMedia=[{Color:'Oro',imageUrl:'https://example.invalid/gold.png'}];
 const retired=setCommercialOptionAvailability(p,'Color','Oro',false);
 assert.equal(p.variantInventory[0].active,undefined);
 assert.deepEqual(retired.variantInventory[0],{...p.variantInventory[0],active:false});
 assert.deepEqual(retired.variantInventory[1],p.variantInventory[1]);assert.deepEqual(retired.variantMedia,p.variantMedia);
 assert.deepEqual(retired.variants,p.variants);assert.equal(retired.stock,p.stock);
 assert.deepEqual(setCommercialOptionAvailability(retired,'Color','Oro',true).variantInventory[0],{...p.variantInventory[0],active:true});
 assert.throws(()=>setCommercialOptionAvailability(p,'Color','Inexistente',false),/no existe/);
 assert.throws(()=>setCommercialOptionAvailability(p,'Color','Oro','false'),/inválida/);
});

test('opciones no guardadas se pueden quitar; las guardadas siguen protegidas contra borrado físico',()=>{
 const p=product();const extended=commercialDraft(p,{Color:['Oro','Plata','Negro']});
 const removed=commercialDraft(extended,p.variants,p);
 assert.deepEqual(removed.variantInventory,p.variantInventory);
 assert.throws(()=>commercialPatch(p,{variantInventory:p.variantInventory.slice(1)}),/Conservá/);
});

test('servidor acepta retirar venta por la ruta canónica sin permitir destruir historial',()=>{
 const p=product();const retired=setCommercialOptionAvailability(p,'Color','Oro',false);
 const patch=validateProductEditorPatch(p,{variantInventory:retired.variantInventory});
 assert.deepEqual(patch.variantInventory,retired.variantInventory);assert.equal(patch.stock,3);
 assert.throws(()=>validateProductEditorPatch(p,{variants:{Color:['Plata']},variantInventory:[p.variantInventory[1]]}));
});
function store(){const docs=new Map([['products/p1',{fields:encodeFirestoreFields(product()),updateTime:'v1'}],['collections/anillos',{fields:{},updateTime:'c1'}],['productInventory/p1',{fields:encodeFirestoreFields(inventory),updateTime:'i1'}]]);const writes=[];return {docs,writes,io:{get:async(_env,path)=>docs.get(path),commit:async(_env,list)=>writes.push(...list)}};}
const actor={uid:'super',role:'superadmin'};
function body(){const p=product();return {productId:'p1',changeId:'test_change_id_123',expected:productFingerprint(p),product:p,inventory:{...inventory},expectedInventory:{...inventory}};}
function editable(p){const {privateLegacy,...rest}=p;return rest;}

test('legacy convierte sin cambiar referencias, fotografías ni cero; reordenar mantiene precio y stock',()=>{
 const p=product();p.variantInventory[0].price=45000;p.variantInventory[1].stock=null;
 const next=commercialDraft(p,{Color:['Plata','Oro']});
 assert.equal(next.variantInventory[1].variant,'Oro');assert.equal(next.variantInventory[1].price,45000);assert.equal(next.stock,null);
 assert.equal(source.variantInventory[0].stock,3);
});
test('matriz valida precios y referencias sin permitir degradar o eliminar historial',()=>{
 const p=product();assert.throws(()=>commercialPatch(p,{...p,variantInventory:p.variantInventory.slice(1)}),/Conservá/);
 assert.throws(()=>commercialPatch(p,{...p,variantInventory:p.variantInventory.map(row=>({...row,price:2.5}))}),/Precio/);
 assert.throws(()=>commercialPatch(p,{...p,variantInventory:p.variantInventory.map(row=>({...row,stock:-1}))}),/Inventario/);
});
test('duplicado v2 conserva identidad local y fotos con stock cero y copia inactiva',()=>{
 const p=product();p.variantMedia=[{Color:'Oro',imageUrl:'https://img.test/oro.png'}];
 const copy=productDuplicateData(p);assert.equal(copy.active,false);assert.equal(copy.stock,0);assert.equal(copy.variantInventory[0].attributes.Color,'Oro');assert.deepEqual(copy.variantMedia,p.variantMedia);assert.equal(p.stock,3);
});
test('guardado público, privado y auditoría comparten commit CAS y preservan campos desconocidos',async()=>{
 const s=store(),request=body();request.product=editable(request.product);request.product.variantInventory[0].price=45000;
 const result=await saveProductEditor({},request,actor,s.io);
 assert.equal(s.writes.length,3);assert.deepEqual(s.writes[0].currentDocument,{updateTime:'v1'});assert.deepEqual(s.writes[1].currentDocument,{updateTime:'i1'});
 assert.equal(result.product.privateLegacy,'preservado');assert.equal(decodeFirestoreFields(s.writes[0].fields).variantInventory[0].price,45000);
 assert.equal(decodeFirestoreFields(s.writes[0].fields).costUnit,undefined);
});
test('conflicto comercial o privado rechaza antes de escribir',async()=>{
 for(const privateConflict of [false,true]){const s=store(),request=body();request.product=editable(request.product);if(privateConflict)request.expectedInventory.costUnit=1;else request.expected='viejo';await assert.rejects(saveProductEditor({},request,actor,s.io),error=>error.status===409);assert.equal(s.writes.length,0);}
});
test('permisos servidor rechazan agentes, inventario privado admin y acciones revocadas',async()=>{
 for(const role of ['agent','admin']){const s=store(),request=body();request.product=editable(request.product);await assert.rejects(saveProductEditor({},request,{uid:'x',role},s.io),error=>error.status===403);assert.equal(s.writes.length,0);}
 const s=store(),request=body();request.product=editable(request.product);delete request.inventory;delete request.expectedInventory;s.docs.set('rolePermissions/main',{fields:encodeFirestoreFields({admin:{productos:{editar:false}}})});await assert.rejects(saveProductEditor({},request,{uid:'admin',role:'admin'},s.io),error=>error.status===403);assert.equal(s.writes.length,0);
});
test('campos privados y cantidades inválidas nunca alcanzan el commit',()=>{
 const p=product();assert.throws(()=>validateProductEditorPatch(p,{...editable(p),internalNotes:'no'}),/no permitidos/);assert.throws(()=>validateProductEditorPatch(p,{...editable(p),price:0}),/Precio/);
});

test('edición masiva v2 valida todas las filas antes del commit y mantiene overrides',async()=>{
 const {saveProductBulk}=await import('../../cloudflare/product-editor-domain.mjs');
 const s=store(),p=product();
 const result=await saveProductBulk({},{ids:['p1'],expected:{p1:productFingerprint(p)},field:'price',value:35000},actor,s.io);
 assert.equal(result.changes[0].patch.price,35000);assert.equal(s.writes.length,2);assert.deepEqual(s.writes[0].currentDocument,{updateTime:'v1'});
 const failed=store();await assert.rejects(saveProductBulk({},{ids:['p1','missing'],expected:{p1:productFingerprint(p),missing:''},field:'price',value:35000},actor,failed.io));assert.equal(failed.writes.length,0);
});
test('opciones nuevas reciben identidades opacas que sobreviven al reordenamiento',()=>{
 const p=commercialDraft({...source,variantInventory:null},source.variants);
 assert.ok(p.variantInventory.every(row=>row.variant.startsWith('v_')));
 const next=commercialDraft(p,{Color:['Plata','Oro']});assert.equal(next.variantInventory[1].variant,p.variantInventory[0].variant);
});

test('un producto nuevo admite stock no controlado; una referencia histórica finita conserva su modo',()=>{
 const draft=commercialDraft({price:30000,variants:{Color:['Oro']}});
 assert.equal(commercialPatch({}, {...draft,variantInventory:draft.variantInventory.map(row=>({...row,stock:null}))}).stock,null);
 assert.throws(()=>commercialPatch(source,{...product(),variantInventory:product().variantInventory.map(row=>({...row,stock:null}))}),/control de stock/);
});

test('crear borradores y cambiar publicación respetan permisos separados de edición',async()=>{
 const {saveProductBulk}=await import('../../cloudflare/product-editor-domain.mjs');
 const s=store(),p=product();
 s.docs.set('rolePermissions/main',{fields:encodeFirestoreFields({admin:{productos:{crear:true,editar:false,activarDesactivar:true,accionesMasivas:true}}})});
 await saveProductBulk({},{ids:['p1'],expected:{p1:productFingerprint(p)},field:'active',value:false},{uid:'admin',role:'admin'},s.io);
 assert.equal(s.writes.length,2);
 const create=store();create.docs.set('rolePermissions/main',{fields:encodeFirestoreFields({admin:{productos:{crear:true,activarDesactivar:false}}})});
 await saveProductEditor({},{productId:'new1',expected:null,changeId:'create_draft_123',product:{...editable(p),active:false}},{uid:'admin',role:'admin'},create.io);
 assert.equal(create.writes.length,2);
});

test('quitar portada y galería no deja aliases públicos que revivan imágenes anteriores',()=>{
 const aliases=['image','img','photo','imageSrc','image_src','Image Src','Variant Image','Image','Imagen','Foto'];
 const before={...product(),images:['https://img.test/old-gallery.webp'],...Object.fromEntries(aliases.map(key=>[key,'https://img.test/old.webp']))};
 for(const imageUrl of ['',null,'https://img.test/new.webp']){
  const patch=validateProductEditorPatch(before,{imageUrl,imagesExtra:[]});
  for(const key of aliases)assert.equal(patch[key],imageUrl,key);
  assert.deepEqual(patch.images,[]);
 }
 assert.equal(Object.hasOwn(validateProductEditorPatch(product(),{imagesExtra:[]}), 'images'),false);
});

test('activación masiva valida publicación completa y colección sin escribir parcialmente',async()=>{
 const {saveProductBulk}=await import('../../cloudflare/product-editor-domain.mjs');
 const valid={...product(),active:false,publicationStatus:'draft',description:'Descripción completa',imageUrl:'https://img.test/main.webp'};
 for(const invalid of [{description:''},{imageUrl:''},{price:0},{priceBefore:1},{variantInventory:[]},{category:'missing'}]){
  const s=store(),bad={...valid,...invalid};
  s.docs.set('products/p1',{fields:encodeFirestoreFields(valid),updateTime:'v1'});
  s.docs.set('products/p2',{fields:encodeFirestoreFields(bad),updateTime:'v2'});
  await assert.rejects(saveProductBulk({},{ids:['p1','p2'],expected:{p1:productFingerprint(valid),p2:productFingerprint(bad)},field:'active',value:true},actor,s.io));
  assert.equal(s.writes.length,0,JSON.stringify(invalid));
 }
 const s=store();s.docs.set('products/p1',{fields:encodeFirestoreFields(valid),updateTime:'v1'});
 await saveProductBulk({},{ids:['p1'],expected:{p1:productFingerprint(valid)},field:'active',value:true},actor,s.io);
 assert.equal(s.writes.length,2);assert.equal(decodeFirestoreFields(s.writes[0].fields).publicationStatus,'active');
});

test('publicación individual conserva permiso propio; un lote exige acciones masivas y lectura',async()=>{
 const {saveProductBulk}=await import('../../cloudflare/product-editor-domain.mjs');
 for(const [ids,permissions,allowed] of [[['p1'],{accionesMasivas:false,activarDesactivar:true},true],[['p1','p2'],{accionesMasivas:false,activarDesactivar:true},false],[['p1'],{ver:false,activarDesactivar:true},false],[['p1'],{activarDesactivar:false},false]]){
  const s=store(),p=product();s.docs.set('rolePermissions/main',{fields:encodeFirestoreFields({admin:{productos:permissions}})});
  const run=saveProductBulk({},{ids,expected:{p1:productFingerprint(p),p2:productFingerprint(p)},field:'active',value:false},{uid:'admin',role:'admin'},s.io);
  if(allowed)await run;else {await assert.rejects(run,error=>error.status===403);assert.equal(s.writes.length,0);}
 }
});

test('dos editores concurrentes: sólo uno confirma y el reintento del ganador es idempotente',async()=>{
 const s=store();let commits=0;
 s.io.commit=async(_env,writes)=>{
  for(const write of writes){const current=s.docs.get(write.path);if(write.currentDocument?.updateTime && write.currentDocument.updateTime!==current?.updateTime)throw Object.assign(Error('CAS conflict'),{status:409});}
  commits++;
  for(const write of writes)s.docs.set(write.path,{fields:encodeFirestoreFields({...decodeFirestoreFields(s.docs.get(write.path)?.fields || {}),...decodeFirestoreFields(write.fields)}),updateTime:'v'+(commits+1)});
 };
 const request=name=>({...body(),changeId:'concurrent_'+name,product:{name},inventory:undefined});
 const requests=[request('primero'),request('segundo')];
 const results=await Promise.allSettled(requests.map(value=>saveProductEditor({},value,actor,s.io)));
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 assert.equal(results.find(row=>row.status==='rejected').reason.status,409);
 const winner=requests[results.findIndex(row=>row.status==='fulfilled')];
 assert.equal((await saveProductEditor({},winner,actor,s.io)).duplicate,true);assert.equal(commits,1);
});

test('una venta entre lectura y commit impide que el editor reponga stock obsoleto',async()=>{
 const s=store();
 s.io.commit=async(_env,writes)=>{
  const current=s.docs.get('products/p1'),sold=decodeFirestoreFields(current.fields);
  sold.variantInventory[0].stock--;sold.stock--;
  s.docs.set('products/p1',{fields:encodeFirestoreFields(sold),updateTime:'sale-v2'});
  assert.equal(writes[0].currentDocument.updateTime,'v1');
  throw Object.assign(Error('CAS conflict'),{status:409});
 };
 await assert.rejects(saveProductEditor({},{...body(),product:{price:35000}},actor,s.io),error=>error.status===409);
 const after=decodeFirestoreFields(s.docs.get('products/p1').fields);
 assert.equal(after.stock,2);assert.equal(after.variantInventory[0].stock,2);assert.equal(after.price,30000);assert.equal(s.writes.length,0);
});

test('commit de fotos legacy cita field paths con espacios sin tocar campos ajenos',async()=>{
 const s=store(),p={...product(),'Image Src':'https://img.test/old.webp','Variant Image':'https://img.test/old.webp'};
 s.docs.set('products/p1',{fields:encodeFirestoreFields(p),updateTime:'v1'});
 await saveProductEditor({},{...body(),expected:productFingerprint(p),inventory:undefined,product:{imageUrl:''}},actor,s.io);
 const write=s.writes[0];assert.ok(write.mergeFields.includes('`Image Src`'));assert.ok(write.mergeFields.includes('`Variant Image`'));
 assert.equal(write.mergeFields.includes('Image Src'),false);assert.equal(decodeFirestoreFields(write.fields)['Image Src'],'');
});
