import {createNotificationMoneyReader} from '../../js/components/notifications/importes-notificacion.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('js/components/notifications/notificaciones-clientes.js','utf8');
test('historial usa páginas autorizadas de100 y desuscribe todas al cambiar cuenta',()=>{
 const callbacks=[],limits=[],stops=[];let rendered;
 const c=vm.createContext({notificationMoney:createNotificationMoneyReader({readOrder:async()=>null,onChange(){}}),subscriptionGeneration:0,unsubscribe:null,subscribeRetryTimer:0,historyLimit:200,currentUser:{uid:'a'},notifications:[],subscribeRetryAttempt:0,subscribeAuthRecoveryAttempted:false,listenerFailed:false,isSuperAdmin:()=>false,collection:(...x)=>x,db:{},query:(...x)=>x,orderBy:()=>null,limit:n=>{limits.push(n);assert(n<=100);return n;},startAfter:x=>x,onSnapshot:(q,next)=>{callbacks.push(next);return ()=>stops.push(q);},testOrderNumber:()=>null,isVisibleCustomerNotification:()=>true,liveNotices:{clear(){},update(){}},render(){rendered=c.notifications;},window:{clearTimeout(){}},console,scheduleSubscriptionRecovery(){}});
 const code=source.slice(source.indexOf('function subscribe(user,'),source.indexOf('async function markVisibleNotificationsRead'));
 vm.runInContext(code,c);c.subscribe(c.currentUser);
 const docs=Array.from({length:100},(_,i)=>({id:'n'+i,data:()=>({kind:'order_status'})}));callbacks[0]({docs});
 assert.equal(callbacks.length,2);callbacks[1]({docs:[{id:'older',data:()=>({kind:'order_created'})}]});assert.equal(rendered.length,101);assert.deepEqual(limits,[100,100]);c.currentUser={uid:'b'};c.subscribe(c.currentUser);assert.equal(stops.length,2);callbacks[1]({docs});assert.equal(c.notifications.length,0);
});
test('BFCache tiene restauración explícita de auth y feed',()=>{assert.match(source,/pageshow[\s\S]*event.persisted[\s\S]*initClientNotifications\(\)/);});
test('dos ciclos BFCache desmontan y restauran la suscripción sin duplicar eventos',()=>{
 const handlers={};let authStops=0,feedStops=0,starts=0;
 const c=vm.createContext({notificationMoney:createNotificationMoneyReader({readOrder:async()=>null,onChange(){}}),subscriptionGeneration:0,initialized:true,subscribeRetryTimer:0,liveNotices:{clear(){}},unsubscribe:()=>feedStops++,authUnsubscribe:()=>authStops++,window:{addEventListener:(name,fn)=>handlers[name]=fn,clearTimeout(){}},initClientNotifications:()=>{starts++;c.initialized=true;c.authUnsubscribe=()=>authStops++;}});
 vm.runInContext(source.slice(source.indexOf("window.addEventListener('pagehide'")),c);
 for(let i=0;i<2;i++){handlers.pagehide();assert.equal(c.initialized,false);handlers.pageshow({persisted:true});}
 assert.equal(starts,2);assert.equal(authStops,2);assert.equal(feedStops,2);
});
test('una navegación pendiente no abre el pedido de la cuenta anterior',async()=>{
 let click,resolveRead;const window={addEventListener(){},location:{href:''}};
 const c=vm.createContext({notificationMoney:createNotificationMoneyReader({readOrder:async()=>null,onChange(){}}),window,currentUser:{uid:'a'},document:{addEventListener:(_name,fn)=>click=fn},safeTarget:x=>x,readNotification:()=>new Promise(resolve=>{resolveRead=resolve;}),setTimeout(){},markVisibleNotificationsRead(){}});
 vm.runInContext(source.slice(source.indexOf('function wireEvents()'),source.indexOf('export function initClientNotifications')),c);c.wireEvents();
 const card={dataset:{notificationId:'n',notificationTarget:'/perfil#pedido-a'}};
 click({preventDefault(){},target:{closest:selector=>selector==='[data-notification-id]'?card:null}});
 c.currentUser={uid:'b'};resolveRead();await new Promise(resolve=>setImmediate(resolve));assert.equal(window.location.href,'');
});
