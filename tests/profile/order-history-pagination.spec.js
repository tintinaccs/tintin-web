const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const profile=fs.readFileSync('js/pages/profile/pedidos-perfil.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
const stats=fs.readFileSync('js/core/store/estadisticas-pedidos.js','utf8');
const statsCode=stats.slice(stats.indexOf('function normEmail'),stats.indexOf('async function getOrdersByField'))+stats.slice(stats.indexOf('export function calculateOrderStats'),stats.indexOf('export function buildUserStatsPayload')).replace('export ','');
for(const width of [320,768,1440])test(`historial carga detalles por página, conserva resumen global y enlaces profundos ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/404.html');
 await page.setContent('<link rel="stylesheet" href="/css/pages/perfil.css"><main id="perfil-orders-card"><span id="perfil-purchase-count"></span><span id="perfil-total-spent"></span><div id="perfil-orders-list"></div></main>');
 await page.addScriptTag({type:'module',content:`
 import {ordersForView} from '../../js/orders/pedidos-prueba.mjs';
 import {ORDER_LIFECYCLE_LABELS,orderStatusLabel,orderTimeline,customerOrderMessage} from '../../js/orders/ciclo-pedido.mjs';
 ${statsCode}
 const db={};const appCheckReady=Promise.resolve(true);window.TintinAppCheckStatus='enabled';
 const AUTH_STATES={RESTORING:'restoring',UNKNOWN:'unknown',AUTHENTICATED:'authenticated'};
 const actor={uid:'fixture-owner',email:'fixture@example.test',emailVerified:true,getIdToken:async()=> 'fixture'};
 const getSessionUser=()=>actor;
 const subscribeSession=fn=>{fn({status:'authenticated',user:actor});return()=>{};};
 const rows=Array.from({length:205},(_,i)=>({id:'order-'+String(i).padStart(3,'0'),total:100,status:'pendiente',items:[{name:'Anillo '+i,price:100,qty:1}],...(i===204?{updatedAt:'2026-10-29T00:00:00Z'}:{createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString()})}));
 const doc=(_db,col,id)=>({col,id});let revision;window.__activeOrders=new Set();window.__indexRequests=0;
 const onSnapshot=(ref,next)=>{if(ref.col==='users'){revision=next;queueMicrotask(()=>next({data:()=>({orderCount:rows.length})}));return()=>{};}
 window.__activeOrders.add(ref.id);let active=true;queueMicrotask(()=>{if(active)next({id:ref.id,exists:()=>true,data:()=>rows.find(row=>row.id===ref.id)});});return()=>{active=false;window.__activeOrders.delete(ref.id);};};
 const readAccountOrdersIndexPage=async({cursor,readTime})=>{window.__indexRequests++;const offset=Number(cursor)||0;return {items:rows.slice(offset,offset+100).map(({id,total,status,createdAt,updatedAt})=>({id,total,status,createdAt,updatedAt})),cursor:offset+100<rows.length?String(offset+100):'',readTime:readTime||'same'};};
 window.__newOrder=()=>{rows.push({id:'new-order',total:100,status:'pendiente',createdAt:'2026-10-30T00:00:00Z',items:[]});revision({data:()=>({orderCount:rows.length})});};
 history.replaceState(null,'','/perfil');
 ${profile}
 `});
 await expect(page.locator('#perfil-purchase-count')).toHaveText('205');
 await expect(page.locator('.perfil-order-row')).toHaveCount(5);
 expect(await page.evaluate(()=>window.__activeOrders.size)).toBe(5);
 expect(await page.evaluate(()=>window.__indexRequests)).toBe(3);
 await expect(page.locator('.perfil-order-row').first()).toHaveAttribute('data-order-id','order-204');
 const details=page.locator('#pedido-order-204 details');await details.locator('summary').click();
 await page.locator('[data-profile-orders-more]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('.perfil-order-row')).toHaveCount(15);
 await expect(page.locator('[data-profile-orders-more]')).toBeFocused();
 await expect(page.locator('#perfil-purchase-count')).toHaveText('205');
 await expect(details).toHaveAttribute('open','');
 await page.evaluate(()=>location.hash='#pedido-order-000');
 await expect(page.locator('#pedido-order-000')).toBeFocused();
 expect(await page.evaluate(()=>window.__activeOrders.size)).toBe(16);
 await page.evaluate(()=>window.__newOrder());
 await expect(page.locator('#perfil-purchase-count')).toHaveText('206');
 await expect(page.locator('#pedido-new-order')).toBeVisible();
 await expect(page.locator('#perfil-total-spent')).toContainText('20.600');
 await page.evaluate(()=>location.hash='#pedido-not-owned');
 expect(await page.evaluate(()=>window.__activeOrders.has('not-owned'))).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
