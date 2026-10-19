const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'js/admin/notifications/enlace-pedido-push.js'),'utf8');
const orderId='fixture_order_123456';
async function load(page,width=390){
 await page.setViewportSize({width,height:844});
 await page.route('https://push.test/**',route=>route.fulfill({contentType:'text/html',body:'<main><section id="section-pedidos"></section></main>'}));
 await page.goto('https://push.test/admin.html?section=pedidos&order='+orderId);
 await page.evaluate(()=>{
  window.setInterval=fn=>{window.poll=fn;return 1;};window.clearInterval=()=>{window.poll=null;};
  window.opened=[];window.openOrderEdit=id=>window.opened.push(id);
  window.consumers=new Set();window.stopped=0;window.retries=0;
  window.publish=snapshot=>{window.snapshot=snapshot;for(const consume of window.consumers)consume(snapshot);};
  window.snapshot={uid:'admin_fixture',ready:false};
  window.TintinAdminOrders={get:id=>window.snapshot.ready?{id}:undefined,subscribe(consume){window.consumers.add(consume);consume(window.snapshot);return()=>{window.consumers.delete(consume);window.stopped++;};},retry(){window.retries++;}};
 });
 await page.addScriptTag({content:runtime});
}
for(const width of [320,768,1024,1440]){
 test(`push abre el pedido con snapshot tardío sin recargar a ${width}px`,async({page})=>{
  await load(page,width);
  await page.evaluate(()=>{for(let i=0;i<61;i++)window.poll?.();});
  await expect(page.locator('#push-order-status')).toContainText('todavía está cargando');
  expect(await page.evaluate(()=>sessionStorage.getItem('tt_push_pending_order'))).toContain(orderId);
  await page.evaluate(()=>window.publish({uid:'admin_fixture',ready:true}));
  expect(await page.evaluate(()=>window.opened)).toEqual([orderId]);
  expect(new URL(page.url()).searchParams.has('order')).toBe(false);
  expect(await page.evaluate(()=>window.consumers.size)).toBe(0);
  await page.evaluate(()=>window.publish({uid:'admin_fixture',ready:true}));
  expect(await page.evaluate(()=>window.opened)).toEqual([orderId]);
 });
}
test('error de red conserva destino, reintento y suscripción sin duplicarla',async({page})=>{
 await load(page);
 await page.evaluate(()=>window.publish({uid:'admin_fixture',ready:false,error:'unavailable'}));
 await page.getByRole('button',{name:'Reintentar abrir pedido'}).click();
 expect(await page.evaluate(()=>window.retries)).toBe(1);
 expect(await page.evaluate(()=>window.consumers.size)).toBe(1);
 await page.evaluate(()=>window.publish({uid:'admin_fixture',ready:true}));
 expect(await page.evaluate(()=>window.opened)).toEqual([orderId]);
});
test('no abre datos de una sesión sin confirmar',async({page})=>{
 await load(page);
 await page.evaluate(()=>window.publish({uid:'',ready:true}));
 expect(await page.evaluate(()=>window.opened)).toEqual([]);
 expect(await page.evaluate(()=>sessionStorage.getItem('tt_push_pending_order'))).toContain(orderId);
});

const {load: loadPanel}=require('./helpers/admin-panel-fixture.cjs');
const master=fs.readFileSync(path.join(root,'js/admin/notifications/notificaciones-push-maestro.js'),'utf8').replace(/^import .*;\r?$/gm,'');
async function loadTelemetry(page){
 await loadPanel(page,390);
 await page.evaluate(()=>{
  window.auth={currentUser:{uid:'superadmin_fixture',email:'admin@fixture.test',getIdToken:async()=> 'demo-token'}};
  window.SUPER_ADMIN='admin@fixture.test';
  window.subscribeAuthState=listener=>{listener(window.auth.currentUser);return()=>{};};
  window.apiUrl=name=>'/api/'+name;
  window.authenticatedFetch=(...args)=>window.fetch(...args);
  window.telemetryCalls=[];window.mockSettings={enabled:true,foregroundSound:'default'};window.mockDevices=[];
  window.fetch=async(url,init={})=>{
   window.telemetryCalls.push({url,method:init.method,body:init.body});
   const data=url.includes('push-config')?{enabled:true,vapidKey:'public-demo'}:{settings:window.mockSettings,devices:window.mockDevices,events:[]};
   return {ok:true,json:async()=>data};
  };
  window.timers=[];window.setInterval=fn=>{window.timers.push(fn);return window.timers.length;};
 });
 await page.evaluate(source=>{const script=document.createElement('script');script.nonce='dGludGluLWZpeHR1cmU=';script.textContent=source;document.body.append(script);},master);
 await expect(page.locator('#push-master-status')).toHaveText('Activo');
 await page.evaluate(()=>document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-notificaciones-push')));
}
test('telemetría push se actualiza y conserva las preferencias en edición',async({page})=>{
 await loadTelemetry(page);
 await page.locator('#push-master-sound').selectOption('custom');
 await page.locator('#push-master-sound-url').fill('https://fixture.test/borrador.mp3');
 await page.evaluate(()=>{window.mockSettings={enabled:false,foregroundSound:'none'};window.mockDevices=[{id:'fixture_device',deviceLabel:'Otro teléfono',enabled:true}];for(const tick of window.timers)tick();});
 await expect(page.locator('#push-master-devices')).toContainText('Otro teléfono');
 await expect(page.locator('#push-master-status')).toHaveText('Pausado');
 await expect(page.locator('#push-master-sound-url')).toHaveValue('https://fixture.test/borrador.mp3');
 await expect(page.locator('#push-master-sound')).toHaveValue('custom');
});
test('guardar preferencias push confirma el servidor y rehabilita el botón',async({page})=>{
 await loadTelemetry(page);
 await page.locator('#btn-push-master-save').click();
 await expect(page.locator('#push-master-notice')).toHaveText('Preferencias push guardadas.');
 await expect(page.locator('#btn-push-master-save')).toBeEnabled();
 expect(await page.evaluate(()=>window.telemetryCalls.filter(call=>call.method==='POST').map(call=>JSON.parse(call.body).action))).toEqual(['save-settings']);
});
