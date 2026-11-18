const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
// The entire collection pipeline uses the real handler with isolated in-memory
// Firestore dependencies. All non-fixture requests are blocked, including payments.
async function mount(page,{deferAuth=false}={}) {
 const {handleSiteActivity}=await import('../../functions/api/site-activity.js');
 const {encodeFirestoreFields,decodeFirestoreFields}=await import('../../cloudflare/firebase-admin-ligero.js');
 const documents=new Map(),calls=[];let revision=0;
 const deps={get:async(_e,p)=>documents.get(p)||null,commit:async(_e,writes)=>{for(const w of writes)documents.set(w.path,{fields:w.fields,updateTime:String(++revision)});},ipLimit:async()=>{},reserve:async()=>{},verifyToken:async()=>({uid:'account_one'})};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='activity.test')return route.abort();
  if(url.pathname==='/api/site-activity'){
   const body=route.request().postData();calls.push(JSON.parse(body));deps.now=()=>new Date(serverNow);const serverNow=await page.evaluate(()=>Date.now());
   const response=await handleSiteActivity({request:new Request(url,{method:'POST',headers:{origin:url.origin,authorization:'Bearer fixture'},body}),env:{}},deps);
   return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  }
  if(url.pathname==='/js/core/auth/coordinador-sesion.js')return route.fulfill({contentType:'text/javascript',body:`import {auth} from '../firebase/firebase.js';export const getSessionUser=()=>auth.currentUser;export const getSessionSnapshot=()=>({status:auth.currentUser?'authenticated':'unauthenticated'});export const subscribeSession=()=>()=>{};export const waitForSession=()=>${deferAuth ? 'new Promise(resolve=>window.qaResolveAuth=()=>{auth.currentUser={uid:"account_one",getIdToken:async()=>"fixture"};resolve({status:"authenticated",user:auth.currentUser});})' : 'Promise.resolve(getSessionSnapshot())'};`});
  if(url.pathname==='/js/core/firebase/firebase.js')return route.fulfill({contentType:'text/javascript',body:`export const appCheckReady=Promise.resolve(true);export const auth={currentUser:${deferAuth ? 'null' : '{uid:"account_one",getIdToken:async()=>"fixture"}'}};`});
  if(url.pathname==='/js/core/firebase/origen-funciones.js')return route.fulfill({contentType:'text/javascript',body:'export const apiUrl=name=>"/api/"+name;'});
  if(url.pathname.startsWith('/js/'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync('.'+url.pathname,'utf8')});
  return route.fulfill({contentType:'text/html',body:`<html><body><main><div class="ck-panel active"></div><div class="ck-panel"></div><div class="ck-panel"></div><div class="ck-panel"></div><div class="ck-panel"></div></main><script type="module">window.TINTIN_ENABLE_PUBLIC_ACTIVITY=true;await import('/js/analytics/actividad-sitio.js');window.qaReady=true;</script></body></html>`});
 });
 await page.context().addCookies([{name:'tt_privacy_choice',value:'v3.all',domain:'activity.test',path:'/'}]);
 await page.goto('https://activity.test/checkout',{waitUntil:'domcontentloaded'});
 if(deferAuth){await page.waitForFunction(()=>window.qaResolveAuth);expect(calls.length).toBe(0);expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tt_activity_pending_v1')).sessionId)).toBe('session_saved_fixture');await page.evaluate(()=>window.qaResolveAuth());}
 await page.waitForFunction(()=>window.qaReady);
 await expect.poll(()=>calls.filter(c=>c.kind==='presence').length).toBeGreaterThan(0);
 return {calls,documents,decodeFirestoreFields};
}
test('pasos y errores llegan a presencia e historial sin entradas de formulario ni búsquedas',async({page})=>{
 const state=await mount(page);
 await page.clock.install();
 await page.evaluate(()=>{document.querySelectorAll('.ck-panel').forEach((p,i)=>p.classList.toggle('active',i===3));});
 await page.clock.runFor(150);await page.clock.fastForward(21000);
 await expect.poll(()=>state.calls.some(c=>c.context?.step===3)).toBe(true);
 await page.evaluate(()=>window.TintinSiteActivity.record('checkout_error','server_timeout'));
 await page.clock.fastForward(21000);
 await expect.poll(()=>state.calls.some(c=>c.events?.some(e=>e.action==='checkout_error'&&e.context.reason==='network'))).toBe(true);
 await expect.poll(()=>{const row=[...state.documents.entries()].find(([p])=>p.startsWith('sitePresence/'));return row && state.decodeFirestoreFields(row[1].fields).context.status;}).toBe('error');
 const row=[...state.documents.entries()].find(([p])=>p.startsWith('sitePresence/'));
 const presence=state.decodeFirestoreFields(row[1].fields);
 expect(presence.context).toMatchObject({page:'checkout',step:3,status:'error',reason:'network'});
 await page.evaluate(()=>{window.TintinSiteActivity.record('checkout_confirm');window.TintinSiteActivity.record('order_confirmed');});
 await page.clock.fastForward(21000);
 await expect.poll(()=>state.calls.some(c=>c.events?.some(e=>e.action==='order_confirmed'&&!e.context.reason))).toBe(true);
 const session=[...state.documents.entries()].find(([p])=>p.includes('/sessions/'));
 expect(state.decodeFirestoreFields(session[1].fields).timeline.some(e=>e.action==='checkout_error')).toBe(true);
 await page.evaluate(()=>{history.replaceState({},'','/catalogo?cat=relojes&q=private@example.test&token=secret');document.body.classList.add('catalog-updated');});
 await page.clock.runFor(150);await page.clock.fastForward(21000);
 await expect.poll(()=>state.calls.some(c=>c.context?.category==='relojes')).toBe(true);
 expect(JSON.stringify(state.calls)).not.toContain('private@example.test');expect(JSON.stringify(state.calls)).not.toContain('secret');
});
for(const width of [390,1440])test(`historial por perfil muestra períodos, horas, páginas y paginación ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.route('**/__activity-history',r=>r.fulfill({contentType:'text/html',body:'<html><body><main></main></body></html>'}));
 await page.goto('/__activity-history');
 await page.evaluate(async()=>{
  const {createActivityHistory}=await import('../../js/admin/users/historial-actividad.mjs');
  const now=new Date('2026-11-17T15:00:00Z');window.qaDays=[];
  const node=createActivityHistory(document,{now:()=>now,loadPresence:async()=>[{page:'/checkout',context:{page:'checkout',step:3},lastSeen:now}],loadPage:async(day)=>{window.qaDays.push(day);return {items:day==='2026-11-17'?[{startedAt:now,lastSeen:now,context:{page:'checkout',step:3},timeline:[{at:+now,action:'checkout_error',context:{page:'checkout',step:3,status:'error',reason:'network'}}]}]:[],cursor:null};}});
  document.querySelector('main').append(node);
 });
 await expect(page.locator('main')).toContainText('Paso 4 de 5: Pago');
 await expect(page.locator('main')).toContainText('12:00:00');
 await expect(page.locator('main')).toContainText('Conexión o tiempo de espera');
 await page.getByLabel('Período de actividad').selectOption('month');
 await expect.poll(()=>page.evaluate(()=>window.qaDays.includes('2026-11-01'))).toBe(true);
 await page.getByLabel('Período de actividad').selectOption('week');
 await expect(page.getByRole('button',{name:'Actualizar',exact:true})).toBeEnabled();
 expect(await page.locator('main').evaluate(n=>n.scrollWidth<=innerWidth)).toBe(true);
});

test('retirar permiso detiene eventos pendientes y las escrituras de presencia',async({page})=>{
 const state=await mount(page);await page.clock.install();
 await page.evaluate(()=>{window.TintinSiteActivity.record('checkout_confirm');window.TintinActivityPrivacy.open();});
 await page.getByRole('button',{name:'Solo necesarias',exact:true}).click();
 const before=state.calls.length;
 await page.clock.fastForward(120000);
 expect(state.calls.length).toBe(before);
 expect(await page.evaluate(()=>sessionStorage.getItem('tt_activity_pending_v1'))).toBeNull();
});


test('restauración tardía conserva la sesión y acciones pendientes de la misma cuenta',async({page})=>{
 await page.addInitScript(()=>{
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  sessionStorage.setItem('tt_activity_session_v2',JSON.stringify({day:day+'_account_one',id:'session_saved_fixture'}));
  sessionStorage.setItem('tt_activity_pending_v1',JSON.stringify({sessionId:'session_saved_fixture',events:[{id:'event_saved_fixture',at:Date.now(),action:'cart_add',context:{page:'product',productId:'fixture_product'}}]}));
 });
 const state=await mount(page,{deferAuth:true});
 await expect.poll(()=>state.calls.some(c=>c.kind==='presence' && c.sessionId==='session_saved_fixture' && c.events.some(e=>e.id==='event_saved_fixture'))).toBe(true);
});

test('abrir y cerrar el carrito una vez produce una sola apertura',async({page})=>{
 const state=await mount(page);await page.clock.install();
 await page.evaluate(()=>{for(const [state,surface] of [['opening','cart'],['open','cart'],['closing','cart'],['idle','none']])window.dispatchEvent(new CustomEvent('tintin:surface-change',{detail:{state,surface}}));});
 await page.clock.fastForward(21000);
 await expect.poll(()=>state.calls.flatMap(c=>c.events||[]).filter(e=>e.action==='cart_open').length).toBe(1);
 expect(state.calls.flatMap(c=>c.events||[]).filter(e=>e.action==='panel_open')).toHaveLength(0);
});
