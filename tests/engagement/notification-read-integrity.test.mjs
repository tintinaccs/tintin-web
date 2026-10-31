import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notificationIconKey, notificationIconSvg } from '../../js/components/notifications/presentacion-notificacion.mjs';
const core=fs.readFileSync(new URL('../../cloudflare/notificaciones-sociales.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../../functions/api/notifications.js',import.meta.url),'utf8');
function loadFunction(source,from,to,deps) {
 return new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${source.slice(source.indexOf(from),to?source.indexOf(to,source.indexOf(from)):undefined).replace(/^export /gm,'')}\nreturn ${from.match(/function (\w+)/)[1]};`)(deps);
}
test('lectura masiva pagina más de 3000 sin sobrescribir contenido de eventos',async()=>{
 const writes=[];
 const run=loadFunction(core,'export async function markAllNotificationsRead','export const socialNotificationClean',{
  MAX_MARK_ALL_DOCUMENTS:3000,clean:value=>String(value||''),
  listNotificationPage:async(_env,root,token)=>{
   assert.equal(root,'users/cliente/notifications');const index=Number(token||0);
   return {documents:Array.from({length:300},(_,i)=>({name:`projects/test/databases/(default)/documents/users/cliente/notifications/n${index*300+i}`,updateTime:'version-1',fields:{read:{booleanValue:false},body:{stringValue:'Contenido confirmado'}}})),nextPageToken:index<10?String(index+1):''};
  },safeId:x=>x,firestoreAdminCommit:async(_env,batch)=>writes.push(...batch),
 });
 const first=await run({}, {uid:'cliente'});assert.deepEqual(first,{count:3000,nextPageToken:'10'});
 const last=await run({}, {uid:'cliente',pageToken:first.nextPageToken});assert.deepEqual(last,{count:300,nextPageToken:''});
 assert.equal(writes.length,3300);
 for(const write of writes){assert.deepEqual(write.mergeFields,['read','updatedAt']);assert.deepEqual(write.currentDocument,{updateTime:'version-1'});assert.equal(write.fields.body,undefined);}
});
test('lectura individual protege la revisión y mantiene la ruta privada del UID',async()=>{
 let update;
 const run=loadFunction(core,'export async function markNotificationRead','function firestoreProjectId',{
  safeId:x=>x,firestoreAdminGet:async(_env,path)=>{assert.equal(path,'users/propietaria/notifications/aviso');return {updateTime:'version-real'};},
  encodeFirestoreFields:x=>x,firestoreAdminMerge:async(...args)=>{update=args;throw Object.assign(new Error('Cambió el evento'),{status:409});}
 });
 await assert.rejects(run({}, {uid:'propietaria',notificationId:'aviso'}),/Cambió/);
 assert.deepEqual(update[3],{updateTime:'version-real'});
});
test('el endpoint ignora UID ajeno y exige Super Admin para la bandeja global',async()=>{
 const writes=[];
 const run=loadFunction(api,'export async function onRequest',null,{
  originIsAllowed:()=>true,MAX_BODY_BYTES:16384,clean:value=>String(value||''),safeId:x=>x,
  jsonResponse:(body,status)=>Response.json(body,{status}),rateLimitErrorResponse:()=>null,statusFromError:(error,fallback)=>error.status||fallback,
  requireFirebaseUser:async()=>({uid:'cuenta-autenticada'}),requireSuperAdmin:async()=>{throw Object.assign(new Error('Sin permiso'),{status:403});},
  markNotificationRead:async(_env,input)=>writes.push(input),
 });
 const request=input=>({request:new Request('https://tintinaccs.com/api/notifications',{method:'POST',body:JSON.stringify(input)}),env:{}});
 assert.equal((await run(request({action:'notificationSeen',uid:'victima',notificationId:'aviso'}))).status,200);
 assert.equal(writes[0].uid,'cuenta-autenticada');
 assert.equal((await run(request({action:'adminNotificationSeen',notificationId:'global'}))).status,403);
 assert.equal(writes.length,1);
});
test('iconos distinguen los estados reales sin inventar eventos',()=>{
 const stages=['pendiente','preparando','listo','en_camino','entregado','cancelado'];
 const icons=stages.map(status=>notificationIconKey({kind:'order_status',status}));
 assert.equal(new Set(icons).size,stages.length);
 for(const key of icons)assert.match(notificationIconSvg(key),/<svg/);
 assert.equal(notificationIconKey({kind:'payment_status',paymentStatus:'pagado'}),'payment-confirmed');
 assert.equal(notificationIconKey({kind:'payment_status',paymentStatus:'pendiente'}),'payment-pending');
 assert.equal(notificationIconKey({kind:'welcome'}),'sparkle');
});
