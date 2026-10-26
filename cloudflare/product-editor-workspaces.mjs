import {decodeFirestoreFields,encodeFirestoreFields,firestoreAdminGet,firestoreAdminListPage} from './firebase-admin-ligero.js';
import {firestoreAdminBatchCommit} from './firestore-admin-batch.js';
import {productFingerprint} from '../js/admin/products/maestro-productos-core.mjs';

// Progreso privado del formulario. Nunca es una fuente de precio/stock público.
const fields=new Set('name sku category price priceBefore stock imageUrl description material measurements colorFinish care waterResistance warranty sizeFit packageContents imagesExtra costUnit purchased stockMinimum internalNotes tags variants variantMedia pendingPhotos pendingColorPhotos pendingUploads editorial commercialDraft variantStock variantStockEntries badge collection active oferta destacado'.split(' '));
const privateFields=['costUnit','purchased','stockMinimum','internalNotes'];
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status,safe:true});};
const condition=document=>document?{updateTime:document.updateTime}:{exists:false};
export const productWorkPath=(uid,key)=>{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid || '') || !/^[A-Za-z0-9_-]{1,180}$/.test(key || ''))fail('Identidad del espacio de trabajo inválida.');
  return `productEditorWorkspaces/${uid}/items/${key}`;
};
export async function productWorkSource(env,key,actor,io){
  const document=await io.get(env,`products/${key}`),product=decodeFirestoreFields(document?.fields || {});
  const inventory=actor.role==='superadmin'?decodeFirestoreFields((await io.get(env,`productInventory/${key}`))?.fields || {}):null;
  const source=document?JSON.stringify({product:productFingerprint(product),inventory:inventory?Object.fromEntries(privateFields.map(key=>[key,inventory[key] ?? (key==='internalNotes'?'':null)])):null}):'new';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  return {document,product,revision:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')};
}
async function access(env,actor,existing,io){
  if(!['admin','superadmin'].includes(actor?.role))fail('No tenés permiso para trabajar con borradores.',403);
  if(actor.role==='superadmin')return;
  const permissions=decodeFirestoreFields((await io.get(env,'rolePermissions/main'))?.fields || {}).admin?.productos || {};
  if(permissions.ver===false || (existing===null ? permissions.crear===false && permissions.editar===false : permissions[existing?'editar':'crear']===false))fail('Tu rol no tiene permiso para este borrador.',403);
  return permissions;
}
function validateSnapshot(snapshot,actor){
  if(!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot) || Object.keys(snapshot).some(key=>!fields.has(key)))fail('Formulario de progreso inválido.');
  if(actor.role!=='superadmin' && privateFields.some(key=>Object.hasOwn(snapshot,key)))fail('Los campos privados requieren Super Admin.',403);
  const walk=(value,depth=0)=>{
    if(depth>12)fail('El progreso supera la profundidad admitida.');
    if(value==null || typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))fail('Número inválido.');return;}
    if(typeof value==='string'){if(value.length>20000 || /^(blob:|data:)/i.test(value))fail('Completá las cargas antes de guardar el progreso.');return;}
    if(typeof value!=='object' || Object.keys(value).length>2000)fail('El progreso supera el límite admitido.');
    for(const [key,item] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail('Campo de progreso inválido.');walk(item,depth+1);}
  };
  walk(snapshot);
  if(new TextEncoder().encode(JSON.stringify(snapshot)).length>450000)fail('El progreso supera el tamaño admitido.');
  return structuredClone(snapshot);
}
export async function productEditorWorkspace(env,body,actor,io={get:firestoreAdminGet,commit:firestoreAdminBatchCommit,listPage:firestoreAdminListPage}){
  if(!['admin','superadmin'].includes(actor?.role))fail('No tenés permiso para trabajar con borradores.',403);
  if(body.action==='listProductWork'){
    const permissions=await access(env,actor,null,io);
    const root=productWorkPath(actor.uid,'index').replace(/\/index$/,'');
    if(body.pageToken!=null && (typeof body.pageToken!=='string' || body.pageToken.length>4096 || /[\u0000-\u001f\u007f]/.test(body.pageToken)))fail('Página de borradores inválida.');
    const page=await io.listPage(env,root,{pageSize:100,pageToken:body.pageToken || ''});
    const works=page.documents.map(document=>decodeFirestoreFields(document.fields || {})).filter(work=>work.ownerUid===actor.uid && !work.closed && (!work.private || actor.role==='superadmin') && permissions?.[work.productId?'editar':'crear']!==false);
    return {items:works.map(work=>({key:work.key,productId:work.productId,name:work.snapshot?.name || 'Producto sin nombre',imageUrl:work.snapshot?.imageUrl || '',revision:work.revision,updatedAt:work.updatedAt,publicationStatus:'draft'})),nextPageToken:page.nextPageToken || '',limited:Boolean(page.nextPageToken)};
  }
  const path=productWorkPath(actor.uid,body.key),document=await io.get(env,path),work=decodeFirestoreFields(document?.fields || {});
  if(document && (work.ownerUid!==actor.uid || work.private && actor.role!=='superadmin'))fail('No tenés permiso para este progreso privado.',403);
  const source=await productWorkSource(env,body.key,actor,io);
  await access(env,actor,Boolean(source.document),io);
  if(body.action==='readProductWork')return {work:document && !work.closed?work:null,revision:work.revision || 0,sourceExpected:source.revision,conflict:Boolean(document && !work.closed && work.baseExpected!==source.revision)};
  if(!['saveProductWork','discardProductWork'].includes(body.action))fail('Acción de progreso inválida.');
  if(!/^[A-Za-z0-9_-]{10,80}$/.test(body.changeId || ''))fail('Identificador de guardado inválido.');
  if(document && work.lastChangeId===body.changeId)return {work,revision:work.revision,duplicate:true,conflict:work.baseExpected!==source.revision};
  if(!Number.isInteger(body.expectedRevision) || body.expectedRevision!==(work.revision || 0))fail('Este borrador cambió en otra pestaña. Reabrilo antes de continuar.',409);
  if(!/^[a-f0-9]{64}$/.test(body.baseExpected || ''))fail('Falta la versión de origen del borrador.');
  if(document && !work.closed && body.baseExpected!==work.baseExpected)fail('La versión de origen cambió. Reabrí el progreso.',409);
  const now=new Date(),closed=body.action==='discardProductWork';
  const next={schemaVersion:1,key:body.key,ownerUid:actor.uid,private:actor.role==='superadmin',productId:work.closed || !document?(source.document?body.key:null):work.productId,baseExpected:body.baseExpected,snapshot:closed?work.snapshot || {}:validateSnapshot(body.snapshot,actor),revision:(work.revision || 0)+1,lastChangeId:body.changeId,closed,createdAt:work.createdAt || now,updatedAt:now};
  await io.commit(env,[{path,fields:encodeFirestoreFields(next),mergeFields:Object.keys(next),currentDocument:condition(document)},{path:`auditLog/work_${crypto.randomUUID().replaceAll('-','')}`,fields:encodeFirestoreFields({action:'editar_producto',targetType:'producto',targetId:body.key,targetLabel:next.snapshot.name || '',details:closed?'Descartar progreso privado':'Guardar progreso privado',actorId:actor.uid,actorRole:actor.role,createdAt:now})}]);
  return {work:next,revision:next.revision,conflict:next.baseExpected!==source.revision};
}
