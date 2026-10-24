import {editorialFields,productIsPublished} from '../js/core/store/estado-editorial-producto.mjs';
import {decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet} from './firebase-admin-ligero.js';
import {firestoreAdminBatchCommit} from './firestore-admin-batch.js';
import {productFingerprint,applyProductBulkTransaction} from '../js/admin/products/maestro-productos-core.mjs';
import {commercialPatch} from '../js/admin/products/editor-comercial-core.mjs';

const PUBLIC_FIELDS = new Set(['name','sku','category','collection','price','priceBefore','stock','active','oferta','destacado','badge','description','imageUrl','imagesExtra','variantMedia','variants','variantInventory','variantCommerceVersion','tags','material','measurements','colorFinish','care','waterResistance','warranty','sizeFit','packageContents','publicationStatus','productTemplate','seoTitle','seoDescription']);
const fail = (message, status=422) => {throw Object.assign(new Error(message), {status, safe:true});};
const condition = doc => doc ? {updateTime:doc.updateTime} : {exists:false};

export function validateProductEditorPatch(before, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key=>!PUBLIC_FIELDS.has(key))) fail('Campos del producto no permitidos.');
  const next = {...before, ...input};
  for (const field of ['name','category']) if(typeof next[field] !== 'string' || !next[field].trim() || next[field].length > 180) fail('Nombre y categoría son obligatorios.');
  if(!Number.isInteger(next.price) || next.price<1 || next.price>1e9) fail('Precio general inválido.');
  if(next.priceBefore!=null && (!Number.isInteger(next.priceBefore) || next.priceBefore<=next.price || next.priceBefore>1e9)) fail('Precio anterior inválido.');
  for(const field of ['active','oferta','destacado']) if(typeof next[field]!=='boolean') fail('Disponibilidad del producto inválida.');
  for(const field of ['sku','description','material','measurements','colorFinish','care','waterResistance','warranty','sizeFit','packageContents']) if(next[field]!=null && (typeof next[field]!=='string' || next[field].length>(field==='description'?12000:1000))) fail('Texto de producto inválido.');
  const safeImage=value=>typeof value==='string' && value.length<=2048 && !/[<>\u0000-\u001f]/.test(value) && (/^https:\/\//.test(value) || /^\/(?!\/)/.test(value));
  if(next.imageUrl!=null && !safeImage(next.imageUrl))fail('Imagen principal inválida.');
  if(next.imagesExtra!=null && (!Array.isArray(next.imagesExtra) || next.imagesExtra.length>12 || next.imagesExtra.some(value=>!safeImage(value))))fail('Galería inválida.');
  if(next.variantMedia!=null && (!Array.isArray(next.variantMedia) || next.variantMedia.length>100 || next.variantMedia.some(row=>!row || typeof row!=='object' || Array.isArray(row) || row.imageUrl && !safeImage(row.imageUrl) || row.imageUrls && (!Array.isArray(row.imageUrls) || row.imageUrls.length>24 || row.imageUrls.some(value=>!safeImage(value))))))fail('Fotos de variantes inválidas.');
  if(next.tags!=null && (!Array.isArray(next.tags) || next.tags.length>30 || next.tags.some(value=>typeof value!=='string' || value.length>60)))fail('Etiquetas inválidas.');
  if(next.variantCommerceVersion!==2) fail('Este guardado requiere una matriz comercial v2.');
  // La validación canónica rechaza identidades duplicadas y conserva todas las
  // referencias previas, incluso las agotadas con reservas/historial potencial.
  let matrix;
  try {matrix=commercialPatch(before,next);} catch(error) {fail(error.message);}
  const patch={...input,...matrix};
  if(input.publicationStatus!=null){try{Object.assign(patch,editorialFields(input));}catch(error){fail(error.message);}}
  if(JSON.stringify({...before,...patch}).length>700000) fail('El producto supera el tamaño permitido.');
  return patch;
}

export async function saveProductEditor(env, body, actor, io={get:firestoreAdminGet,commit:firestoreAdminBatchCommit}) {
  if(!['admin','superadmin'].includes(actor?.role)) fail('No tenés permiso para guardar productos.',403);
  const id=body?.productId;
  if(typeof id!=='string' || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) fail('Identificador de producto inválido.');
  const document=await io.get(env,`products/${id}`);
  const before=decodeFirestoreFields(document?.fields || {});

  if(actor.role!=='superadmin') {
    const permissions=decodeFirestoreFields((await io.get(env,'rolePermissions/main'))?.fields || {});
    const action=document?'editar':'crear';
    if(permissions?.admin?.productos?.[action]!==undefined && permissions.admin.productos[action]!==true) fail('Tu rol no tiene permiso para esta acción.',403);
    if(document && productIsPublished(before)!==(body.product?.publicationStatus!=null?body.product.publicationStatus==='active':body.product?.active!==false) && permissions?.admin?.productos?.activarDesactivar!==undefined && permissions.admin.productos.activarDesactivar!==true) fail('Tu rol no tiene permiso para publicar productos.',403);
    if(body.inventory!=null) fail('El inventario privado requiere Super Admin.',403);
  }
  if(typeof body.changeId!=='string' || !/^[A-Za-z0-9_-]{10,80}$/.test(body.changeId))fail('Identificador de guardado inválido.');
  if(document && before.lastEditorChangeId===body.changeId)return {productId:id,product:before,duplicate:true};
  if(document ? body.expected!==productFingerprint(before) : body.expected!==null)fail('El producto cambió en otra sesión. Volvé a abrirlo antes de guardar.',409);
  if(document && before.variantCommerceVersion!==2 && before.variantInventory==null)fail('La conversión del stock agregado requiere revisar las reservas históricas antes de habilitar combinaciones.',409);
  const patch=validateProductEditorPatch(before,body.product);
  if(!/^[A-Za-z0-9_-]{1,180}$/.test(patch.category || before.category)) fail('Categoría inválida.');
  const category=await io.get(env,`collections/${patch.category || before.category}`);
  if(!category) fail('Seleccioná una colección existente.');
  const now=new Date();
  const data={...patch,lastEditorChangeId:body.changeId,updatedAt:now,merchandisingUpdatedAt:now,...(!document?{createdAt:now}:{})};
  const writes=[{path:`products/${id}`,fields:encodeFirestoreFields(data),mergeFields:Object.keys(data),currentDocument:condition(document)}];
  if(body.inventory!=null) {
    const inventory=body.inventory;
    if(!inventory || typeof inventory!=='object' || Object.keys(inventory).some(key=>!['costUnit','purchased','stockMinimum','internalNotes'].includes(key))) fail('Inventario privado inválido.');
    for(const key of ['costUnit','purchased','stockMinimum']) if(inventory[key]!=null && (!Number.isInteger(inventory[key]) || inventory[key]<0 || inventory[key]>1e9)) fail('Inventario privado inválido.');
    if(typeof inventory.internalNotes!=='string' || inventory.internalNotes.length>1000) fail('Notas internas inválidas.');
    const privateDoc=await io.get(env,`productInventory/${id}`);
    if(JSON.stringify(body.expectedInventory || {costUnit:null,purchased:null,stockMinimum:null,internalNotes:''})!==JSON.stringify(Object.fromEntries(['costUnit','purchased','stockMinimum','internalNotes'].map(key=>[key,decodeFirestoreFields(privateDoc?.fields || {})[key] ?? (key==='internalNotes'?'':null)])))) fail('El inventario privado cambió en otra sesión.',409);
    const privateData={...inventory,updatedAt:now};
    writes.push({path:`productInventory/${id}`,fields:encodeFirestoreFields(privateData),mergeFields:Object.keys(privateData),currentDocument:condition(privateDoc)});
  }
  writes.push({path:`auditLog/product_${crypto.randomUUID().replaceAll('-','')}`,fields:encodeFirestoreFields({action:document?'editar_producto':'crear_producto',targetType:'producto',targetId:id,targetLabel:patch.name || before.name,details:'Guardado comercial v2',actorId:actor.uid,actorEmail:actor.email || '',actorRole:actor.role,bulk:false,bulkCount:0,createdAt:now,productHistory:{productId:id,priceBefore:before.price??null,priceAfter:data.price??before.price,stockBefore:before.stock??null,stockAfter:data.stock}})});
  await io.commit(env,writes);
  return {productId:id,product:{...before,...data}};
}


export async function saveProductBulk(env,body,actor,io={get:firestoreAdminGet,commit:firestoreAdminBatchCommit}) {
  if(!['admin','superadmin'].includes(actor?.role))fail('No tenés permiso para esta edición masiva.',403);
  if(actor.role!=='superadmin'){
    const permissions=decodeFirestoreFields((await io.get(env,'rolePermissions/main'))?.fields || {}).admin?.productos || {};
    for(const action of ['accionesMasivas',body.field==='active'?'activarDesactivar':'editar'])if(permissions[action]!==undefined && permissions[action]!==true)fail('Tu rol no tiene permiso para esta edición masiva.',403);
  }
  let collections=[];
  if(body.field==='category'){
    if(typeof body.value!=='string' || !/^[A-Za-z0-9_-]{1,180}$/.test(body.value))fail('Categoría inválida.');
    if(!await io.get(env,`collections/${body.value}`))fail('Seleccioná una colección existente.');
    collections=[{slug:body.value}];
  }
  const documents=new Map(),writes=[],now=new Date();
  let changes;
  try {changes=await applyProductBulkTransaction({
    async get(id){const document=await io.get(env,`products/${id}`);documents.set(id,document);return {exists:()=>Boolean(document),data:()=>decodeFirestoreFields(document?.fields || {})};},
    update(id,data){writes.push({path:`products/${id}`,fields:encodeFirestoreFields(data),mergeFields:Object.keys(data),currentDocument:condition(documents.get(id))});}
  },body,collections,id=>id,()=>now);}catch(error){fail(error.message,/cambió|existe/.test(error.message)?409:422);}
  writes.push({path:`auditLog/product_bulk_${crypto.randomUUID().replaceAll('-','')}`,fields:encodeFirestoreFields({action:'editar_producto',targetType:'producto',targetId:'',targetLabel:'',details:`Edición masiva: ${body.field}`,actorId:actor.uid,actorEmail:actor.email || '',actorRole:actor.role,bulk:true,bulkCount:changes.length,createdAt:now,productHistory:changes.map(({id,before,patch})=>({productId:id,priceBefore:before.price??null,priceAfter:patch.price??before.price??null,stockBefore:before.stock??null,stockAfter:patch.stock??before.stock??null}))})});
  await io.commit(env,writes);
  return {changes};
}
