const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const destinationRuntime=fs.readFileSync(path.join(root,'js/core/auth/destino-admin.mjs'),'utf8').replace(/^export /gm,'');
const runtime=destinationRuntime+'\n'+fs.readFileSync(path.join(root,'js/admin/notifications/enlace-pedido-push.js'),'utf8').replace(/^import .*;\r?$/gm,'');
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

async function loadRecordDestination(page, section, key, width=390) {
 await page.setViewportSize({width,height:844});
 await page.route('https://destination.test/**',route=>route.fulfill({contentType:'text/html',body:`<main><section class="adm-section active" id="section-${section}"></section></main>`}));
 await page.goto(`https://destination.test/admin?section=${section}&${key}=record_fixture_123`);
 await page.evaluate(()=>{
  window.calls=[];window.setInterval=fn=>{window.poll=fn;return 1;};window.clearInterval=()=>{window.poll=null;};
  window.openClientFichaByUid=async id=>{window.calls.push(['user',id]);return true;};
  window.TintinAdminEngagement={openNotificationTarget:async(kind,id)=>{window.calls.push([kind,id]);return true;}};
  window.TintinWholesaleOpenQuote=async id=>{window.calls.push(['quote',id]);return true;};
 });
 await page.addScriptTag({content:runtime});
}
for(const width of [320,768,1440]) for(const [section,key] of [['usuarios','user'],['me-gusta','like'],['resenas','review'],['resenas','report'],['mayoristas','quote']]) {
 test(`push ${key}: espera login y abre la ficha exacta una vez a ${width}px`,async({page})=>{
  await loadRecordDestination(page,section,key,width);
  expect(await page.evaluate(()=>window.calls)).toEqual([]);
  expect(await page.evaluate(()=>sessionStorage.getItem('tt_admin_return_target'))).toContain('record_fixture_123');
  await page.evaluate(()=>document.documentElement.classList.add('adm-auth-ready'));
  await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([[key,'record_fixture_123']]);
  expect(new URL(page.url()).searchParams.has(key)).toBe(false);
  expect(await page.evaluate(()=>sessionStorage.getItem('tt_admin_return_target'))).toBeNull();
  await page.evaluate(()=>window.poll?.());
  expect(await page.evaluate(()=>window.calls.length)).toBe(1);
 });
}

test('una ficha con error conserva el destino y permite reintentar sin otro login',async({page})=>{
 await loadRecordDestination(page,'usuarios','user');
 await page.evaluate(()=>{window.openClientFichaByUid=async()=>false;document.documentElement.classList.add('adm-auth-ready');});
 await expect(page.getByRole('button',{name:'Reintentar abrir ficha'})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('user')).toBe('record_fixture_123');
 await page.evaluate(()=>{window.openClientFichaByUid=async id=>{window.calls.push(['user',id]);return true;};});
 await page.getByRole('button',{name:'Reintentar abrir ficha'}).click();
 await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([['user','record_fixture_123']]);
});

test('un controlador que llega después del plazo abre la ficha sin perder el destino',async({page})=>{
 await loadRecordDestination(page,'usuarios','user');
 await page.evaluate(()=>{
  delete window.openClientFichaByUid;document.documentElement.classList.add('adm-auth-ready');
  for(let i=0;i<61;i++)window.poll?.();
 });
 await expect(page.getByRole('button',{name:'Reintentar abrir ficha'})).toBeVisible();
 await page.evaluate(()=>{
  window.openClientFichaByUid=async id=>{window.calls.push(['user',id]);return true;};
  window.dispatchEvent(new Event('tintin:admin-ficha-source'));
 });
 await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([['user','record_fixture_123']]);
});

test('no abre fichas si el guard denegó la sección ni retoma un pedido anterior',async({page})=>{
 await loadRecordDestination(page,'usuarios','user');
 await page.evaluate(()=>{
  sessionStorage.setItem('tt_push_pending_order',JSON.stringify({orderId:'old_order_123456',at:Date.now()}));
  document.querySelector('section').id='section-dashboard';document.documentElement.classList.add('adm-auth-ready');
 });
 await page.evaluate(()=>window.poll?.());
 expect(await page.evaluate(()=>window.calls)).toEqual([]);
 expect(new URL(page.url()).searchParams.get('user')).toBe('record_fixture_123');
});

test('retoma el destino tras navegar al login y volver sin from desde el proveedor',async({page})=>{
 await loadRecordDestination(page,'usuarios','user');
 await page.goto('https://destination.test/login');
 await page.addScriptTag({content:destinationRuntime});
 const target=await page.evaluate(()=>pendingAdminDestination(sessionStorage,location.origin));
 expect(target).toBe('/admin?section=usuarios&user=record_fixture_123');
 await page.goto('https://destination.test'+target);
 await page.evaluate(()=>{
  window.calls=[];window.openClientFichaByUid=async id=>{window.calls.push(id);return true;};
  document.documentElement.classList.add('adm-auth-ready');
 });
 await page.addScriptTag({content:runtime});
 await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual(['record_fixture_123']);
});

const {load: loadPanel}=require('./helpers/admin-panel-fixture.cjs');
test('el icono de notificación y ambas apps instaladas conservan rosa de muestra y logo blanco',async({page})=>{
 await loadPanel(page,390);
 for(const file of ['manifest.json','admin-manifest.json']) {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  expect(manifest.theme_color).toBe('#F8AACA');
  for(const icon of manifest.icons) expect(icon.src).toMatch(/assets-tintin\/images\/admin\/(?:push-icon-192|app-icon-512)\.png\?v=/);
 }
 const pixels=await page.evaluate(async()=>{
  const result=[];
  for(const name of ['push-icon-192.png','app-icon-512.png','push-badge-96.png']) {
   const image=new Image();image.src='/assets-tintin/images/admin/'+name;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const context=canvas.getContext('2d');context.drawImage(image,0,0);
   const data=context.getImageData(0,0,image.width,image.height).data;
   let white=0;for(let i=0;i<data.length;i+=4)if(data[i]>250&&data[i+1]>250&&data[i+2]>250&&data[i+3]>200)white++;
   result.push({name,corner:[...data.slice(0,4)],white});
  }
  return result;
 });
 for(const image of pixels){expect(image.white).toBeGreaterThan(100);expect(image.corner).toEqual(image.name.includes('badge')?[0,0,0,0]:[248,170,202,255]);}
});
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]]) {
 test(`marca push y encabezado difuminado sin cruces a ${width}x${height}`,async({page})=>{
  await loadPanel(page,width);
  await page.setViewportSize({width,height});
  await page.locator('#adm-topbar-title').evaluate(node=>{node.textContent='Pedidos mayoristas';});
  const logo=page.locator('.tt-control-brand');
  await expect(logo).toBeVisible();
  await expect(page.locator('.adm-topbar-title .tt-control-brand')).toBeVisible();
  await expect.poll(()=>logo.evaluate(node=>node.naturalWidth)).toBe(192);
  const geometry=await page.locator('.adm-topbar').evaluate(node=>{
   const items=[...node.children].filter(item=>getComputedStyle(item).display!=='none').map(item=>{const r=item.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
   const style=getComputedStyle(node);
   return {blur:style.backdropFilter,background:style.backgroundImage,border:style.borderBottomWidth,items,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  expect(geometry.blur).toContain('blur(18px)');
  expect(geometry.background).toContain('linear-gradient');
  expect(geometry.border).toBe('0px');
  expect(geometry.overflow).toBe(false);
  for(let i=0;i<geometry.items.length;i++)for(let j=i+1;j<geometry.items.length;j++){
   const a=geometry.items[i],b=geometry.items[j];
   if(a.width&&a.height&&b.width&&b.height) expect(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1).toBe(false);
  }
 });
}
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
