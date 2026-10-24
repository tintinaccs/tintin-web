import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialDraft,commercialPatch,setCommercialOptionAvailability} from '../../js/admin/products/editor-comercial-core.mjs';
import {saveProductEditor,validateProductEditorPatch} from '../../cloudflare/product-editor-domain.mjs';
import {encodeFirestoreFields,decodeFirestoreFields} from '../../cloudflare/firebase-admin-ligero.js';
import {productFingerprint,productDuplicateData} from '../../js/admin/products/maestro-productos-core.mjs';
const source={name:'Anillo',category:'anillos',price:30000,priceBefore:null,active:true,oferta:false,destacado:false,variants:{Color:['Oro','Plata']},variantInventory:[{variant:'Oro',stock:3},{variant:'Plata',stock:0}],stock:3,privateLegacy:'preservado'};
const product=()=>commercialDraft(source);
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
