import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {profileOrdersFactory} from '../helpers/profile-orders-controller.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const fixtures=Array.from({length:205},(_,i)=>({id:'order-'+String(i).padStart(3,'0'),total:100,status:'pendiente',...(i===204?{updatedAt:'2026-10-29T00:00:00Z'}:{createdAt:new Date(2026,0,i+1).toISOString()})}));
function setup({readIndexPage,requestedId}={}) {
 const callbacks=new Map(),states=[],renders=[],stats=[],stopped=[];let revision;
 const controller=profileOrdersFactory()({
  readIndexPage:readIndexPage || (async({cursor,readTime})=>{const offset=Number(cursor)||0;return {items:fixtures.slice(offset,offset+100),cursor:offset+100<fixtures.length?String(offset+100):'',readTime:readTime||'snapshot-1'};}),
  subscribe:(id,next,fail)=>{callbacks.set(id,{next,fail});return()=>stopped.push(id);},
  subscribeRevision:(_user,next)=>{revision=next;return()=>{};},
  render:(rows,options)=>renders.push({rows,options}),onStats:value=>stats.push(value),onStatus:(...args)=>states.push(args),requestedId,
 });
 return {controller,callbacks,states,renders,stats,stopped,revision:()=>revision()};
}
test('índice paginado completo conserva fechas legacy y totales; detalles/listeners sólo para cinco pedidos',async()=>{
 const h=setup();await h.controller.start({uid:'owner',email:'owner@example.test'});
 assert.equal(h.stats.at(-1).totalOrders,205);assert.equal(h.stats.at(-1).totalSpent,20500);
 assert.equal(h.callbacks.size,5);assert.ok(h.callbacks.has('order-204'));
 for(const [id,cb] of h.callbacks)cb.next({...fixtures.find(x=>x.id===id),items:[{name:'Detalle sólo visible',price:100,qty:1}]});
 assert.equal(h.controller.orders.length,5);assert.equal(h.states.at(-1)[0],'ready');assert.equal(h.renders.at(-1).options.hasMore,true);
 h.controller.more();assert.equal(h.callbacks.size,15);
});
test('enlace profundo hidrata un pedido antiguo sin descargar todos los detalles intermedios',async()=>{
 const h=setup({requestedId:()=> 'order-000'});await h.controller.start({uid:'owner'});
 assert.equal(h.callbacks.size,6);assert.ok(h.callbacks.has('order-000'));
});
test('una página tardía de otra cuenta o de una revisión abortada no puede publicar datos ni totales',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const h=setup({readIndexPage:async({user})=>user.uid==='old'?pending:{items:[],cursor:'',readTime:'snapshot-new'}});
 const old=h.controller.start({uid:'old'});await h.controller.start({uid:'new'});
 release({items:[{id:'secret',total:999}],cursor:'',readTime:'snapshot-old'});await old;
 assert.equal(h.controller.orders.length,0);assert.equal(h.stats.at(-1).totalOrders,0);assert.equal(h.callbacks.size,0);
});
test('fallo de paginación no confirma un cero o total parcial; refresh posterior recupera',async()=>{
 let fail=true;
 const h=setup({readIndexPage:async({cursor})=>{if(!cursor)return {items:fixtures.slice(0,100),cursor:'next',readTime:'same'};if(fail)throw Error('red');return {items:fixtures.slice(100),cursor:'',readTime:'same'};}});
 await h.controller.start({uid:'owner'});assert.equal(h.stats.at(-1),null);assert.equal(h.states.at(-1)[0],'error');assert.notEqual(h.renders.at(-1).options.empty,true);
 fail=false;await h.controller.refresh();assert.equal(h.stats.at(-1).totalOrders,205);
});
test('cambios visibles recalculan sobre todo el índice y errores conservan las filas confirmadas',async()=>{
 const h=setup();await h.controller.start({uid:'owner'});const id=[...h.callbacks.keys()][0],cb=h.callbacks.get(id);
 cb.next({...fixtures.find(o=>o.id===id),status:'cancelado'});assert.equal(h.stats.at(-1).totalOrders,205);assert.equal(h.stats.at(-1).totalSpent,20400);
 cb.fail(Error('sin conexión'));assert.equal(h.stats.at(-1),null);assert.equal(h.controller.orders.length,1);assert.equal(h.states.at(-1)[0],'partial');
 cb.next({...fixtures.find(o=>o.id===id),status:'pendiente'});assert.equal(h.stats.at(-1).totalSpent,20500);
 const before=h.callbacks.get(id);await h.controller.start({uid:'other'});before.next({id:'foreign',total:999});assert.equal(h.controller.orders.length,0);
});
test('revisión de cuenta detiene listeners previos, conserva el límite visible y reconsulta el índice',async()=>{
 const h=setup();await h.controller.start({uid:'owner'});h.controller.more();h.revision();await flush();
 assert.equal(h.stopped.length,15);assert.equal(h.callbacks.size,15);
});
test('cursor repetido o readTime distinto se rechazan sin publicar estadísticas parciales',async()=>{
 for(const changed of [false,true]) {
  const h=setup({readIndexPage:async({cursor})=>({items:[],cursor:'again',readTime:changed&&cursor?'new':'same'})});
  await h.controller.start({uid:'owner'});assert.equal(h.stats.at(-1),null);assert.equal(h.states.at(-1)[0],'error');
 }
});
test('consulta oficial proyecta sólo resumen, pagina por ID y restringe el puente de correo a cuentas verificadas',()=>{
 const source=fs.readFileSync('js/pages/profile/indice-pedidos-perfil.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
 const c={};vm.createContext(c);vm.runInContext(source,c);
 const user={uid:'owner',email:'User@Example.test',emailVerified:true};const q=c.accountOrdersIndexQuery(user);
 assert.equal(q.limit,100);assert.equal(q.orderBy[0].field.fieldPath,'__name__');assert.equal(q.where.compositeFilter.filters.length,3);
 assert.ok(q.select.fields.some(f=>f.fieldPath==='updatedAt'));assert.ok(q.select.fields.some(f=>f.fieldPath==='payment.status'));
 assert.ok(!q.select.fields.some(f=>['items','shipping','invoice','userEmail'].includes(f.fieldPath)));
 const unverified=c.accountOrdersIndexQuery({...user,emailVerified:false});assert.equal(unverified.where.fieldFilter.field.fieldPath,'userId');
 assert.throws(()=>c.accountOrdersIndexQuery(user,'projects/p/databases/(default)/documents/users/other'),/Cursor/);
});
