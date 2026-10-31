const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const strip=source=>source.replace(/^import\s[\s\S]*?;\s*$/gm,'').replace(/^export /gm,'');
async function fixture(page,admin=false) {
 const rows=[{id:'order-1',kind:'order_status',status:'preparando',actorType:admin?'customer':'store',actorName:admin?'Ana Pérez':'Tintin Accesorios',orderId:'fixture-order',title:'Pedido en preparación',body:'Detalles de tu pedido',targetUrl:'/perfil#pedido-fixture-order',read:false,createdAt:'2026-10-30T23:00:00Z'},{id:'welcome',kind:'welcome',actorType:'store',actorName:'Tintin Accesorios',title:'Bienvenida',targetUrl:'/perfil',read:false,createdAt:'2026-10-30T22:00:00Z'}];
 await page.route('**/api/notifications',async route=>{
  const input=route.request().postDataJSON();
  const isRead=/Seen/.test(input.action);
  if(isRead) {
   await page.evaluate(input=>{window.fixtureWrites.push(input);},input);
   if(await page.evaluate(()=>window.fixtureFail))return route.fulfill({status:403,json:{ok:false,error:'Lectura rechazada'}});
   rows.forEach(row=>{if(input.action.endsWith('All')||row.id===input.notificationId)row.read=true;});
   await page.evaluate(rows=>{window.fixtureRows=rows;window.fixturePublish();},rows);
  }
  return route.fulfill({json:{ok:true}});
 });
 await page.route('**/notifications-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><div class="adm-topbar"><div class="adm-topbar-actions"></div></div><button data-nav-action="notifications"><span data-notification-badge></span>Actividad</button></body></html>'}));
 await page.goto('/notifications-fixture');
 await page.addStyleTag({content:read('css/core/montserrat.css')+'\n'+read('css/components/notifications/notificaciones-sociales.css')+'\n'+read('css/admin/notificaciones-admin.css')+'\n.tt-notifications-drawer{position:fixed;inset:0 0 0 auto;width:min(430px,100vw);height:100dvh;display:flex;flex-direction:column;background:white;overflow:hidden;}'});
 const prelude=`
 window.fixtureWrites=[];window.fixtureRows=${JSON.stringify(rows)};window.fixtureListeners=new Set();
 window.fixturePublish=()=>{for(const fn of fixtureListeners)fn({docs:fixtureRows.map(row=>({id:row.id,data:()=>structuredClone(row)}))});};
 const auth={currentUser:null},db={},appCheckReady=Promise.resolve(),SUPER_ADMIN='owner@example.invalid';
 const fixtureUser={uid:'fixture-user',email:${JSON.stringify(admin?'owner@example.invalid':'client@example.invalid')},getIdToken:async()=>'fixture-token'};
 const subscribeAuthState=fn=>{window.fixtureAuth=fn;queueMicrotask(()=>fn(fixtureUser));return()=>{};};
 const isSuperAdmin=()=>${admin},testOrderNumber=()=>null,recordAuthDiagnostic=()=>{};
 const createLiveActivityNotices=()=>({clear(){},update(){}});
 const waitForAdminAppCheck=async()=>true,recoverAdminSecurity=async()=>true,adminNotificationLink=()=>'/perfil';
 const collection=(_db,...parts)=>parts.join('/'),query=(ref)=>ref,orderBy=()=>{},limit=()=>{};
 const onSnapshot=(ref,next)=>{if(ref==='orders'){queueMicrotask(()=>next({docs:[]}));return()=>{};}fixtureListeners.add(next);queueMicrotask(()=>next({docs:fixtureRows.map(row=>({id:row.id,data:()=>structuredClone(row)}))}));return()=>fixtureListeners.delete(next);};
 `;
 const helpers=strip(read('js/components/notifications/presentacion-notificacion.mjs'))+'\nconst iconSvg=notificationIconSvg;';
 const source=strip(read(admin?'js/admin/notifications/notificaciones-admin.js':'js/components/notifications/notificaciones-clientes.js'));
 await page.addScriptTag({type:'module',content:prelude+helpers+source+(admin?'':'\ninitClientNotifications();')});
 await expect(page.locator(admin?'#adm-notifications-wrap':'#notifications-drawer')).toHaveCount(1);
 if(admin)await page.locator('#adm-notifications-button').click();
 else await page.evaluate(()=>{document.querySelector('#notifications-drawer').setAttribute('aria-hidden','false');document.querySelector('#notifications-drawer').classList.add('open');window.dispatchEvent(new CustomEvent('tintin:surface-change',{detail:{surface:'notifications',state:'open'}}));});
 await expect(page.locator(admin?'[data-adm-notification-read]':'[data-notification-read]')).toHaveCount(2);
 return rows;
}
for(const admin of [false,true])for(const [width,height] of [[320,568],[390,844],[768,1024],[1180,820],[1440,900]])test(`lectura voluntaria ${admin?'admin':'cliente'} ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await fixture(page,admin);
 const readSelector=admin?'[data-adm-notification-read]':'[data-notification-read]';
 const all=page.locator(admin?'#adm-notifications-mark-all':'#tt-notifications-mark-all');
 expect(await page.evaluate(()=>fixtureWrites)).toEqual([]);
 await page.evaluate(()=>fixturePublish());
 expect(await page.evaluate(()=>fixtureWrites)).toEqual([]);
 await expect(page.getByText('Al abrir, las novedades quedan vistas')).toHaveCount(0);
 if(admin)await expect(page.locator('.adm-notification-customer-avatar')).toContainText('AN');
 else {await expect(page.locator('.tt-notification-brand img')).toHaveCount(2);await expect(page.locator('[data-icon="preparing"]')).toHaveCount(1);}
 if(width===390)await page.screenshot({path:`artifacts/prompt-maestro/notifications-${admin?'admin':'client'}-unread-${width}.png`});
 await page.locator(readSelector).first().click();
 await expect(page.locator(readSelector)).toHaveCount(1);
 expect((await page.evaluate(()=>fixtureWrites))[0].notificationId).toBe('order-1');
 await all.click();await expect(page.locator(readSelector)).toHaveCount(0);
 expect((await page.evaluate(()=>fixtureWrites)).at(-1).action).toMatch(/SeenAll$/);
 await page.evaluate(()=>fixturePublish());await expect(page.locator(readSelector)).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/prompt-maestro/notifications-${admin?'admin':'client'}-${width}.png`});
});
for(const admin of [false,true])test(`fallo de lectura conserva sin leer ${admin?'admin':'cliente'}`,async({page})=>{
 await fixture(page,admin);await page.evaluate(()=>window.fixtureFail=true);
 await page.locator(admin?'[data-adm-notification-read]':'[data-notification-read]').first().click();
 await expect(page.getByRole('alert')).toContainText('No pudimos confirmar');
 await expect(page.locator(admin?'[data-adm-notification-read]':'[data-notification-read]')).toHaveCount(2);
});
