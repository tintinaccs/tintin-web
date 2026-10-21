const {test,expect}=require('@playwright/test');
const fs=require('fs');
const {removeFixtureScripts}=require('../../scripts/lib/html-layout-fixture.js');
const runtime=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8').replace(/^import[\s\S]*?;\s*/gm,'');
const pageSource=fs.readFileSync('checkout.html','utf8');
const clean=removeFixtureScripts(pageSource,{removeModulePreloads:true});
const sizes=[[320,568],[390,844],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[1366,768],[1440,900],[1920,1080]];
async function mount(page,{stock=0,offline=false,delay=0,deferReads=false}={}){
 await page.route('https://**',r=>r.abort());
 await page.route('**/__availability-test',r=>r.fulfill({contentType:'text/html',body:clean.replace('</body>',`<script type="module">
 import '../../js/quality/accesibilidad-global.js';
 import {inspectCheckoutAvailability,showCheckoutAvailabilityDialog} from '../../js/pages/checkout/disponibilidad-checkout.js';
 import {hasForwardValidation,replayValidatedForward} from '../../js/pages/checkout/validacion-avance.js';
 const AUTH_STATES={UNKNOWN:'unknown'}; const user={uid:'fixture',emailVerified:true};
 let activeUser=user; const getSessionUser=()=>activeUser; window.changeSession=()=>{activeUser={uid:'other'}};
 const waitForSession=async()=>({status:'authenticated',user:activeUser});const subscribeAuthState=()=>{};
 const db={};const doc=(_db,col,id)=>({col,id});
 let stock=${JSON.stringify(stock)};window.setStock=value=>{stock=value};
 const stockReadWaiters=[];window.releaseStockReads=()=>stockReadWaiters.splice(0).forEach(resolve=>resolve());
 const getDocFromServer=async ref=>{window.stockReads=(window.stockReads||0)+1;await new Promise(r=>${deferReads} ? stockReadWaiters.push(r) : setTimeout(r,${delay}));${offline ? "throw Error('offline');" : ''}return {exists:()=>true,data:()=>({stock,active:true})};};
 window.TintinCheckoutEmailBridgeLoading=true;window.TintinCheckoutState={clear(){window.stateCleared=true}};
 let cart=[{id:'p',name:'Anillo corazón',qty:1},{id:'q',name:'Otro producto',qty:1}];
 window.TintinCartRuntime={getCartLocal:()=>cart.map(i=>({...i})),setCartLocal:items=>{cart=items;window.cart=cart},awaitCartReady:async()=>{},formatPrice:n=>'Gs. '+n};window.cart=cart;
 ${runtime.replace('  function beginPaypalPayment(', '  window.fixtureBeginPaypal = beginPaypalPayment;\n  function beginPaypalPayment(')}
 document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');document.body.style.visibility='visible';
 document.getElementById('btn-step1-next').addEventListener('click',()=>window.advances=(window.advances||0)+1);
 window.fixtureReady=true;
 </script></body>`)}));
 await page.goto('/__availability-test',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixtureReady);
}
for(const [width,height] of sizes)test(`agotado bloquea el avance con diálogo accesible ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});await mount(page);
 await page.locator('#btn-step1-next').click();const dialog=page.locator('#ck-availability-dialog');
 await expect(dialog).toBeVisible();await expect(dialog).toContainText('se acaba de agotar');
 expect(await page.evaluate(()=>window.advances||0)).toBe(0);
 expect(await page.evaluate(()=>window.stateCleared)).toBe(true);
 await expect(dialog.getByRole('link',{name:'Ver catálogo'})).toBeFocused();
 const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(height);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const link of await dialog.getByRole('link').all()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(48);
 await dialog.getByRole('link',{name:'Cerrar y volver al inicio'}).focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('link',{name:'Ver catálogo'})).toBeFocused();
 await page.screenshot({path:`artifacts/commerce/stock-${width}x${height}.png`});
});
test('catálogo, cerrar y Escape salen del checkout inválido',async({page})=>{
 for(const action of ['catalog','close','escape']){
  await mount(page);await page.locator('#btn-step1-next').click();
  await expect(page.locator('#ck-availability-dialog')).toBeVisible();
  const target=action==='catalog'?'/catalogo':'/';
  await page.route(url=>url.pathname===target,route=>route.fulfill({contentType:'text/html',body:'Destino correcto'}));
  if(action==='escape') await page.keyboard.press('Escape');
  else await page.getByRole('link',{name:action==='catalog'?'Ver catálogo':'Cerrar y volver al inicio',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(target==='/'?'/$':'/catalogo$'));
 }
});
test('stock disponible avanza una sola vez y no abre diálogo',async({page})=>{
 await mount(page,{stock:2,delay:80});await page.locator('#btn-step1-next').dblclick();
 await expect.poll(()=>page.evaluate(()=>window.advances||0)).toBe(1);
 await expect(page.locator('#ck-availability-dialog')).toHaveCount(0);
});
test('fallo de red conserva los productos y permite reintentar',async({page})=>{
 await mount(page,{offline:true});await page.locator('#btn-step1-next').click();
 await expect(page.locator('#error-0')).toContainText('Tus productos siguen en el carrito');
 expect(await page.evaluate(()=>window.cart.length)).toBe(2);await expect(page.locator('#ck-availability-dialog')).toHaveCount(0);
 await page.locator('#btn-step1-next').click();await expect.poll(()=>page.evaluate(()=>window.stockReads)).toBeGreaterThanOrEqual(4);
});
test('respuesta de una sesión anterior no altera carrito ni abre diálogo',async({page})=>{
 await mount(page,{deferReads:true});await page.locator('#btn-step1-next').click();
 await expect.poll(()=>page.evaluate(()=>window.stockReads||0)).toBeGreaterThan(0);
 await page.evaluate(()=>{window.changeSession();window.releaseStockReads();});
 await expect(page.locator('#btn-step1-next')).not.toHaveAttribute('aria-busy','true');
 await expect(page.locator('#ck-availability-dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.cart.length)).toBe(2);
});

test('agotado en tiempo real usa la misma ventana; ignora otra cuenta',async({page})=>{
 await mount(page,{stock:2});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tintin:cart-stock-adjusted',{detail:{userId:'other',issues:[{name:'Anillo',available:0}]}})));
 await expect(page.locator('#ck-availability-dialog')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tintin:cart-stock-adjusted',{detail:{userId:'fixture',issues:[{name:'Anillo',available:0}]}})));
 await expect(page.locator('#ck-availability-dialog')).toBeVisible();await expect(page.locator('#ck-availability-dialog')).toContainText('Anillo');
});

test('la reserva propia conserva el resumen y PayPal recupera un pedido antes de cargar el módulo',async({page})=>{
 await mount(page,{stock:1});
 await page.evaluate(()=>window.fixtureBeginPaypal({orderId:'public_fixture_reserva',shortId:'TINPED01',userId:'fixture',total:100000,items:[{name:'Anillo corazón',quantity:1,price:100000}],inventoryPolicy:'reserve-on-checkout',inventoryState:'reserved'},{paymentMethod:'paypal'}));
 expect(await page.evaluate(()=>window.TintinCheckoutOrderInFlight)).toBe(true);
 await expect(page.locator('.ck-panel').nth(4)).toHaveClass(/active/);
 await expect(page.locator('#tt-paypal-checkout')).toBeVisible();
 await page.evaluate(()=>{
  window.dispatchEvent(new CustomEvent('tintin:cart-stock-adjusted',{detail:{userId:'fixture',issues:[{name:'Anillo corazón',available:0}]}}));
  window.dispatchEvent(new Event('tt_cart_updated'));
 });
 await expect(page.locator('#ck-availability-dialog')).toHaveCount(0);
 await expect(page.locator('.ck-panel').nth(4)).toHaveClass(/active/);
 const pointer=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tt_checkout_receipt_v1')));
 expect(pointer).toMatchObject({uid:'fixture',orderId:'public_fixture_reserva',paymentPending:true});
 expect(Object.keys(pointer).sort()).toEqual(['orderId','paymentPending','savedAt','uid']);
 await page.route('**/api/paypal-config',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:false})}));
 await page.route('**/js/pages/checkout/paypal-checkout.js?fixture=late',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('js/pages/checkout/paypal-checkout.js','utf8').replace(/^import[^\n]*\n/gm,'')}));
 await page.evaluate(()=>import('../../js/pages/checkout/paypal-checkout.js?fixture=late'));
 await expect(page.locator('#tt-paypal-status')).toHaveText('PayPal no está disponible todavía.');
 await expect(page.locator('.ck-panel').nth(4)).toHaveClass(/active/);
});
