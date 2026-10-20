import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {productCardPatch,productFingerprint,productDuplicateData,applyProductBulkTransaction,productBulkIds} from '../../js/admin/products/maestro-productos-core.mjs';
import {variantInventoryEntries} from '../../js/core/store/inventario-variantes.mjs';
import {sanitizeVariantData} from '../../js/core/auth/utilidades-seguridad.js';
const source=fs.readFileSync('js/admin/admin-app.js','utf8');
const block=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const code=[block('function productVariantStockConfiguration(','function renderProductVariantStock('),block('function serializeProductForm()','window.prodNuevo ='),block('function _prodNuevoNow()','window.prodEditar ='),block('function _prodEditarNow(','window.prodToggleActive ='),block('window.prodDuplicar =','window.TintinProductAdmin ='),block('window.TintinProductAdmin =','window.prodGuardar =')].join('\n');
function runtime(product={}){
 const fields=new Map(),variantInputs=[],writes=[],rows=new Map(),calls=[];
 const control=id=>{if(!fields.has(id)){let value='';fields.set(id,{id,get value(){return value;},set value(next){value=String(next ?? '');},checked:false,style:{},textContent:'',disabled:false,readOnly:false});}return fields.get(id);};
 const original={_docId:'source',name:'Anillo',sku:'SKU-1',category:'anillos',price:30000,stock:4,active:true,description:'Descripción',image:'https://img.test/original',tags:['regalo'],...product};rows.set('products/source',structuredClone(original));
 const apply=(ref,data)=>{const current={...rows.get(ref.path)};for(const [key,value]of Object.entries(data)){if(value?.__delete)delete current[key];else current[key]=structuredClone(value);}rows.set(ref.path,current);writes.push(ref.path);};
 let count=0;
 const ctx={window:{},document:{getElementById:control,querySelectorAll:selector=>selector==='#prod-variant-stock input'?variantInputs:[]},auth:{currentUser:{uid:'super'}},currentUser:{uid:'super'},navigator:{onLine:true},productMasterBusy:false,currentRole:'superadmin',can:()=>true,roleCanDo:()=>true,
  _allProducts:[original],_productSourceById:new Map([['source',structuredClone(original)]]),_allCollections:[{slug:'anillos'}],_productInventoryById:new Map([['source',{costUnit:100,purchased:5,stockMinimum:2,internalNotes:'Privado'}]]),productEditBaseline:null,productVariantStockBaseline:null,
  productCardPatch,productFingerprint,productDuplicateData,applyProductBulkTransaction,productBulkIds,variantInventoryEntries,productColorPhotos:{serialize:()=>[]},
  wristCategory:x=>x,sanitizeImageUrl:x=>typeof x==='string'&&x.startsWith('https://')?x:'',mountFormImageWidget:()=>{},mountProductColorPhotos:()=>{},
  renderProductVariantStock:product=>{variantInputs.length=0;ctx.productVariantStockBaseline=product?.variantInventory?{stock:product.stock,expectedEntries:variantInventoryEntries(product),entries:variantInventoryEntries(product),variants:product.variants}:null;for(const entry of product?.variantInventory || [])variantInputs.push({value:String(entry.stock)});},
  UnsavedGuard:{confirmLeave:fn=>fn(),track:()=>{},clear:()=>{}},toast:()=>{},db:{},collection:(_db,name)=>name,
  doc:(...args)=>args.length===1?{path:`products/new-${++count}`,id:`new-${count}`}:{path:args[1]+'/'+args[2],id:args[2]},
  serverTimestamp:()=>123,deleteField:()=>({__delete:true}),
  withAdminSiteChange:write=>write(),setDoc:async(ref,data)=>{if(ctx.failInventory && ref.path.startsWith('productInventory/'))throw Error('Inventario privado temporalmente sin conexión');apply(ref,data);},
  runTransaction:async(_db,fn)=>{const pending=[];const result=await fn({get:async ref=>({exists:()=>rows.has(ref.path),data:()=>structuredClone(rows.get(ref.path))}),update:(ref,data)=>pending.push([ref,data])});for(const args of pending)apply(...args);return result;},
  pushProductsToSheets:async()=>{calls.push('sheets');if(ctx.failSheets)throw Error('Sheets sin conexión');},logAudit:async()=>{calls.push('audit');if(ctx.failAudit)throw Error('Auditoría sin conexión');},applyProductFilters:()=>calls.push('filters'),loadProductos:()=>calls.push('render'),
  runAdminCrudOperation:async config=>{try{const value=await config.action({start(){},ok(){}});return{status:'green',value};}catch(error){calls.push(error.message);return{status:'red'};}},console};
 vm.createContext(ctx);vm.runInContext(code+'\nwindow.saveTest=prodGuardar;',ctx);
 return {ctx,fields,control,original,rows,writes,calls,variantInputs};
}
test('duplicar usa el formulario real: ID nuevo, inactivo, SKU vacío, fotos conservadas e inventario cero por variante',async()=>{
 const r=runtime({variants:{Color:['Oro']},variantInventory:[{variant:'Oro',stock:4}]});
 r.ctx.window.prodDuplicar('source');assert.equal(r.control('prod-id').value,'');assert.equal(r.control('prod-sku').value,'');assert.equal(r.control('prod-active').checked,false);assert.equal(r.control('prod-cost-unit').value,'');assert.equal(r.control('prod-imageUrl').value,'https://img.test/original');
 assert.equal(await r.ctx.window.saveTest(),true);const created=r.rows.get('products/new-1');assert.equal(created.name,'Anillo (copia)');assert.equal(created.active,false);assert.equal(created.stock,0);assert.deepEqual(created.variantInventory,[{variant:'Oro',stock:0}]);assert.equal(r.rows.get('products/source').stock,4);
});
test('fallo posterior a crear conserva ID; reintenta como edición sin duplicar ni perder stock por variante',async()=>{
 const r=runtime({variants:{Color:['Oro']},variantInventory:[{variant:'Oro',stock:4}]});r.ctx.window.prodDuplicar('source');r.variantInputs[0].value='2';r.ctx.failInventory=true;
 assert.equal(await r.ctx.window.saveTest(),false);assert.equal(r.control('prod-id').value,'new-1');assert.equal(r.rows.get('products/new-1').stock,2);
 r.ctx.failInventory=false;assert.equal(await r.ctx.window.saveTest(),true);assert.equal([...r.rows.keys()].filter(path=>path.startsWith('products/new-')).length,1);assert.equal(r.rows.get('products/new-1').stock,2);
});
test('editar no pisa cambios concurrentes ni un producto borrado',async()=>{
 for(const deleted of [false,true]){const r=runtime();r.ctx._prodEditarNow('source');r.control('prod-price').value='35000';if(deleted)r.rows.delete('products/source');else r.rows.get('products/source').stock=2;
 assert.equal(await r.ctx.window.saveTest(),false);assert.deepEqual(r.writes,[]);assert.equal(r.control('prod-save-btn').disabled,false);assert.equal(r.control('prod-price').value,'35000');}
});

test('editar compara el original guardado aunque la vista normalice categoría y variantes',async()=>{
 for(const [withVariants,legacyCategory] of [[false,true],[true,false],[true,true]]){
  const r=runtime({category:legacyCategory?'aros-legados':'anillos',...(withVariants?{variants:{' Color ':[' dorado ','plateado']},variantInventory:[{variant:'dorado',stock:3},{variant:'plateado',stock:1}]}:{})});
  r.ctx._allProducts=[{...r.original,category:'anillos',variants:sanitizeVariantData(r.original.variants || null)}];
  r.ctx._prodEditarNow('source');r.control('prod-price').value='35000';
  if(withVariants){r.variantInputs[0].value='1';r.variantInputs[1].value='1';}
  assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));
  const saved=r.rows.get('products/source');assert.equal(saved.price,35000);assert.equal(saved.stock,withVariants?2:4);
  if(withVariants){assert.deepEqual(saved.variantInventory,[{variant:'dorado',stock:1},{variant:'plateado',stock:1}]);assert.deepEqual(saved.variants,r.original.variants);}
 }
});

test('reintentar una edición confirmada tras fallar inventario no produce un falso conflicto',async()=>{
 const r=runtime({category:'aros-legados',variants:{' Color ':[' dorado ','plateado']},variantInventory:[{variant:'dorado',stock:3},{variant:'plateado',stock:1}]});
 r.ctx._allProducts=[{...r.original,category:'anillos',variants:sanitizeVariantData(r.original.variants)}];
 r.ctx._prodEditarNow('source');r.variantInputs[0].value='1';r.ctx.failInventory=true;
 assert.equal(await r.ctx.window.saveTest(),false);assert.equal(r.rows.get('products/source').stock,2);
 r.ctx.failInventory=false;assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));assert.equal(r.rows.get('products/source').stock,2);
});

test('orden de claves distinto en variantes no se confunde con un cambio concurrente',async()=>{
 const r=runtime({variants:{Color:['dorado'],Talle:['único']},variantInventory:[{variant:'dorado / único',stock:4}]});
 r.ctx._prodEditarNow('source');r.rows.get('products/source').variants={Talle:['único'],Color:['dorado']};r.variantInputs[0].value='2';
 assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));assert.equal(r.rows.get('products/source').stock,2);
});

test('editar variantes sigue rechazando cambios reales, incluso después de refrescar la lista',async()=>{
 for(const changed of ['stock','variants','variantInventory','price','deleted']){
  const r=runtime({variants:{Color:['dorado','plateado']},variantInventory:[{variant:'dorado',stock:3},{variant:'plateado',stock:1}]});
  r.ctx._prodEditarNow('source');r.variantInputs[0].value='1';
  const current=r.rows.get('products/source');
  if(changed==='deleted')r.rows.delete('products/source');
  else if(changed==='variants')current.variants.Color.push('rosa');
  else if(changed==='variantInventory')current.variantInventory[0].stock=2;
  else current[changed]+=1;
  r.ctx._productSourceById.set('source',structuredClone(current));
  assert.equal(await r.ctx.window.saveTest(),false);assert.deepEqual(r.writes,[]);assert.equal(r.variantInputs[0].value,'1');
 }
});
test('no puede duplicar sin permiso de creación',()=>{
 const r=runtime();r.ctx.can=()=>false;r.ctx.window.prodDuplicar('source');assert.equal(r.control('prod-name').value,'');assert.deepEqual(r.writes,[]);
});

test('distribuir stock total en colores guarda cantidades explícitas y admite reintento sin duplicar',async()=>{
 const r=runtime({stock:1});r.ctx._prodEditarNow('source');
 const draft=r.ctx.productVariantStockConfiguration('Color: dorado, plateado');
 r.ctx.productVariantStockBaseline={stock:1,expectedEntries:null,...draft};r.variantInputs.push({value:'1'},{value:'1'});
 r.ctx.failInventory=true;assert.equal(await r.ctx.window.saveTest(),false);
 const saved=r.rows.get('products/source');assert.equal(saved.stock,2);assert.deepEqual(saved.variants,{Color:['dorado','plateado']});assert.deepEqual(saved.variantInventory,[{variant:'dorado',stock:1},{variant:'plateado',stock:1}]);
 r.ctx.failInventory=false;assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));assert.equal(r.rows.get('products/source').stock,2);
});

test('distribución rechaza cantidades sin completar y cambios concurrentes del inventario original',async()=>{
 for(const conflict of [false,true]){
  const r=runtime({stock:1});r.ctx._prodEditarNow('source');
  const draft=r.ctx.productVariantStockConfiguration('Color: dorado, plateado');r.ctx.productVariantStockBaseline={stock:1,expectedEntries:null,...draft};
  r.variantInputs.push({value:conflict?'1':''},{value:'1'});
  if(conflict)r.rows.get('products/source').stock=3;
  assert.equal(await r.ctx.window.saveTest(),false);assert.deepEqual(r.writes,[]);assert.equal(r.rows.get('products/source').stock,conflict?3:1);
 }
});

test('distribución no inventa matrices, admite opciones únicas y rechaza atributos inseguros',()=>{
 const r=runtime();
 const draft=r.ctx.productVariantStockConfiguration('Color: dorado, dorado\nColor: plateado');assert.equal(draft.entries.length,2);assert.equal(draft.entries[0].stock,'');
 for(const text of ['', 'Color:', 'sin separador', 'Color: dorado\nTalle: pequeño', '__proto__: valor', 'Color: dorado/plateado', 'Color: '+Array.from({length:51},(_,i)=>'opcion'+i).join(',')])assert.throws(()=>r.ctx.productVariantStockConfiguration(text));
});

test('controlador masivo: permiso, sesión y conectividad se validan antes de escribir',async()=>{
 for(const deny of ['permission','session','offline']){const r=runtime();if(deny==='permission')r.ctx.can=()=>false;if(deny==='session')r.ctx.auth.currentUser=null;if(deny==='offline')r.ctx.navigator.onLine=false;
 await assert.rejects(r.ctx.window.TintinProductAdmin.applyBulkChanges({ids:['source'],field:'stockDelta',value:1,expected:{source:productFingerprint(r.original)}}));assert.deepEqual(r.writes,[]);}
});
test('controlador masivo confirma Firestore aunque fallen Sheets/auditoría; un reintento viejo no duplica stock',async()=>{
 const r=runtime();r.ctx.failSheets=true;r.ctx.failAudit=true;
 const request={ids:['source'],field:'stockDelta',value:1,expected:{source:productFingerprint(r.original)}};
 const result=await r.ctx.window.TintinProductAdmin.applyBulkChanges(request);assert.equal(result.confirmed,true);assert.equal(result.syncPending,true);assert.equal(result.auditPending,true);assert.equal(r.rows.get('products/source').stock,5);
 await assert.rejects(r.ctx.window.TintinProductAdmin.applyBulkChanges(request),/cambió/);assert.equal(r.rows.get('products/source').stock,5);assert.equal(r.ctx.productMasterBusy,false);
});

test('tarjeta guarda por el controlador real y rechaza stock ajeno o permisos insuficientes', async()=>{
 const r=runtime({variants:{Color:['Dorado','Plateado']},stock:3,variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:3}]});
 const request={id:'source',field:'stock',variant:'Dorado',value:500,expected:productFingerprint(r.original)};
 r.ctx.auth.currentUser.uid='otra';await assert.rejects(()=>r.ctx.window.TintinProductAdmin.updateCard(request),/sesión/);assert.equal(r.writes.length,0);r.ctx.auth.currentUser.uid='super';
 const transaction=r.ctx.runTransaction;r.ctx.runTransaction=(db,execute)=>transaction(db,tx=>execute({...tx,get:async ref=>{const snapshot=await tx.get(ref);r.ctx.auth.currentUser.uid='otra';return snapshot;}}));
 assert.equal((await r.ctx.window.TintinProductAdmin.updateCard(request)).status,'red');assert.equal(r.writes.length,0);r.ctx.auth.currentUser.uid='super';r.ctx.runTransaction=transaction;
 const saved=await r.ctx.window.TintinProductAdmin.updateCard(request);assert.equal(saved.status,'green');assert.equal(saved.value.fingerprint,productFingerprint(r.rows.get('products/source')));
 assert.equal(r.rows.get('products/source').stock,503);
 assert.deepEqual(r.rows.get('products/source').variantInventory,[{variant:'Dorado',stock:500},{variant:'Plateado',stock:3}]);
 assert.ok(r.calls.includes('sheets'));assert.ok(r.calls.includes('audit'));assert.ok(r.calls.includes('filters'));
 assert.equal((await r.ctx.window.TintinProductAdmin.updateCard({...request,value:0})).status,'red');
 assert.equal(r.rows.get('products/source').stock,503);
 r.ctx.can=()=>false;
 await assert.rejects(()=>r.ctx.window.TintinProductAdmin.updateCard(request),/permiso/);
});

test('nuevo inicia sin stock y editar conserva visibilidad y cantidades previas',()=>{
 const r=runtime({stock:700,active:false});
 r.ctx._prodNuevoNow();assert.equal(r.control('prod-stock').value,'0');assert.equal(r.control('prod-active').checked,false);assert.equal(r.control('prod-save-btn').textContent,'Guardar producto');
 r.ctx._prodEditarNow('source');assert.equal(r.control('prod-stock').value,'700');assert.equal(r.control('prod-active').checked,false);assert.equal(r.control('prod-save-btn').textContent,'Guardar cambios');assert.deepEqual(r.writes,[]);
});

test('nuevo con stock cero se guarda y se vuelve a editar con el mismo controlador',async()=>{
 const r=runtime();r.ctx._prodNuevoNow();
 r.control('prod-name').value='Producto sin stock';r.control('prod-category').value='anillos';r.control('prod-price').value='45000';
 assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));
 const saved=r.rows.get('products/new-1');assert.equal(saved.stock,0);assert.equal(saved.active,false);assert.equal(saved.price,45000);
 r.ctx._allProducts.push({...saved,_docId:'new-1'});r.ctx._productSourceById.set('new-1',structuredClone(saved));
 r.ctx._prodEditarNow('new-1');assert.equal(r.control('prod-stock').value,'0');assert.equal(r.control('prod-active').checked,false);
 r.control('prod-price').value='50000';assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));
 assert.equal(r.rows.get('products/new-1').stock,0);assert.equal(r.rows.get('products/new-1').price,50000);
 assert.equal([...r.rows.keys()].filter(key=>key.startsWith('products/new-')).length,1);
});


test('inventario legado sin variants no envía undefined al guardar stock cero',async()=>{
 const r=runtime({variantInventory:[{variant:'Oro',stock:4}]});
 r.ctx._prodEditarNow('source');r.variantInputs[0].value='0';r.control('prod-active').checked=false;
 assert.equal(await r.ctx.window.saveTest(),true,r.calls.join('; '));
 const saved=r.rows.get('products/source');assert.equal(saved.stock,0);assert.equal(saved.active,false);
 assert.equal(Object.hasOwn(saved,'variants'),false);
});
