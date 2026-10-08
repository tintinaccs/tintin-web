const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'checkout.html'),'utf8');
const leafletStylesheet=source.match(/<link[^>]*href="\/js\/vendor\/leaflet\/leaflet\.css[^>]*>/)[0];
const navigationStyles=[...fs.readFileSync(path.join(root,'js/components/navigation/compartido/recursos-navegacion.js'),'utf8').matchAll(/\['tt-[^']+', '(css\/[^']+)'/g)].map(([,href])=>`<link rel="stylesheet" href="/${href}">`).join('');
const goToStep=source.slice(source.indexOf('function goToStep(n)'),source.indexOf('function showError(stepIdx'));
const forwardValidation=fs.readFileSync('js/pages/checkout/validacion-avance.js','utf8').replace(/export function/g,'function');
const hardening=forwardValidation+fs.readFileSync(path.join(root,'js/pages/checkout/checkout-hardening.js'),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
for(const width of [390,768,1440]) test(`el avance y retorno siguen respondiendo a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.route('**/checkout-hardening.js',route=>route.fulfill({contentType:'text/javascript',body:`const AUTH_STATES={RESTORING:'restoring',UNKNOWN:'unknown'};const subscribeSession=fn=>fn({status:'authenticated',user:{uid:'fixture',emailVerified:true}});const waitForSession=async()=>{};const readCheckoutProfile=async()=>({blocked:false});const awaitCartReady=async()=>{};const getCartLocal=()=>[{id:'fixture-ring',lineId:'fixture-ring-gold',variant:'Dorado'}];const updateQty=async()=>{};const removeFromCart=async()=>{};${hardening}`}));
  await page.route('**/checkout',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div class="ck-body"><nav id="ck-steps">${Array.from({length:5},(_,i)=>`<button class="ck-step ${i===0?'active':''}" data-step="${i}">Paso ${i+1}</button>`).join('')}</nav>
    ${Array.from({length:5},(_,i)=>`<section class="ck-panel ${i===0?'active':''}"></section>`).join('')}
    <div id="ck-items"><div class="ck-item" data-id="fixture-ring"><div class="ck-item-cat">Anillos</div></div></div>
    <button id="btn-step1-next">Elegir cómo lo recibo</button><button id="btn-step2-back">Volver</button></div>
    <script>let currentStep=0;const orderData={};const sessionCanMakeCheckoutDecision=()=>true;const canEnterShippingStep=()=>true;const isCheckoutAuthorized=()=>true;
    ${goToStep}
    document.getElementById('btn-step1-next').onclick=()=>goToStep(1);document.getElementById('btn-step2-back').onclick=()=>goToStep(0);
    // Detecta un ciclo de microtareas sin permitir que congele el navegador del test.
    const NativeObserver=MutationObserver;window.__mutationBatches=0;window.MutationObserver=class extends NativeObserver{constructor(callback){super((records,observer)=>{if(++window.__mutationBatches>50){observer.disconnect();window.__observerLoop=true;return;}callback(records,observer);});}};
    </script><script type="module" src="/js/pages/checkout/estado-navegacion-checkout.js"></script><script type="module" src="/checkout-hardening.js"></script></body></html>`}));
  await page.goto('/checkout');
  await page.locator('#btn-step1-next').click();
  await expect(page.locator('.ck-panel').nth(1)).toHaveClass(/active/);
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>!!window.__observerLoop)).toBe(false);
  await page.getByRole('button',{name:'Volver',exact:true}).click();
  await expect(page.locator('.ck-panel').first()).toHaveClass(/active/);
  await page.getByRole('button',{name:'Ir al paso 2',exact:true}).click();
  await expect(page.locator('.ck-panel').nth(1)).toHaveClass(/active/);
  expect(await page.evaluate(()=>!!window.__observerLoop)).toBe(false);
});

const handler=source.slice(source.indexOf('function refreshPaymentOptions()'),source.indexOf('// Datos bancarios reales'));
for(const width of [320,768,1440]) test(`encomienda sólo transferencia y limpia efectivo previo (${width}px)`,async({page})=>{
 const fixture=source.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace('</body>',`<script>let efectivoAdminOn=true,transferenciaAdminOn=true;const orderData={shippingMethod:'delivery',paymentMethod:''};${handler}
 window.setShipping=(method)=>{orderData.shippingMethod=method;refreshPaymentOptions()};
 document.querySelectorAll('.ck-panel').forEach(el=>el.classList.toggle('active',el.id==='panel-3'));
 document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');refreshPaymentOptions();</script></body>`);
 await page.route('**/__encomienda-payment',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.setViewportSize({width,height:900});await page.goto('/__encomienda-payment');
 await page.locator('label[for="pay-efectivo"]').click();await expect(page.locator('#pay-efectivo')).toBeChecked();
 await page.evaluate(()=>window.setShipping('encomienda'));
 await expect(page.locator('#pay-option-efectivo')).toBeHidden();await expect(page.locator('#pay-efectivo')).toBeDisabled();await expect(page.locator('#pay-efectivo')).not.toBeChecked();
 await expect(page.locator('#pay-transferencia')).toBeEnabled();await page.locator('label[for="pay-transferencia"]').click();await expect(page.locator('#pay-transferencia')).toBeChecked();
 await expect(page.locator('.ck-pay-note')).toContainText('sólo transferencia bancaria antes del despacho');
 await page.evaluate(()=>window.setShipping('delivery'));await expect(page.locator('#pay-efectivo')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
const runtime=fs.readFileSync('js/pages/checkout/checkout-metodos-pago.js','utf8').replace(/import[\s\S]*?;/g,'');
for(const width of [320,768,1440]) test(`opciones reales del panel excluyen efectivo y PayPal en encomienda (${width}px)`,async({page})=>{
 const fixture=source.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace('</body>',`<script>let efectivoAdminOn=true,transferenciaAdminOn=true;const orderData={shippingMethod:'delivery',paymentMethod:''};${handler}
 window.setShipping=method=>{orderData.shippingMethod=method;refreshPaymentOptions()};
 document.querySelectorAll('.ck-panel').forEach(el=>el.classList.toggle('active',el.id==='panel-3'));document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');</script>
 <script type="module">import {normalizePaymentCatalog,paymentMethodLabel} from '../../js/orders/nucleo-metodos-pago.js';
 function onPublicSettings(callback){callback({paymentMethods:{efectivo:true,transferencia:true},paypal:{enabled:true}})}
 ${runtime}</script></body>`);
 await page.route('**/api/paypal-config',route=>route.fulfill({json:{enabled:true,clientId:'fixture-local'}}));
 await page.route('**/__encomienda-runtime',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.setViewportSize({width,height:900});await page.goto('/__encomienda-runtime');
 await expect(page.locator('#ck-payment-methods-runtime')).toBeVisible();
 await page.evaluate(()=>window.setShipping('delivery'));
 await page.locator('label[for="pay-runtime-efectivo"]').click();await expect(page.locator('#pay-runtime-efectivo')).toBeChecked();
 await page.evaluate(()=>window.setShipping('encomienda'));
 await expect(page.locator('[data-payment-method-id="efectivo"]')).toHaveCount(0);
 await expect(page.locator('[data-payment-method-id="paypal"]')).toHaveCount(0);
 await expect(page.locator('#ck-payment-methods-runtime input')).toHaveCount(1);
 await expect(page.locator('input[name="ck-pay"]:checked')).toHaveCount(0);
 await page.locator('label[for="pay-runtime-transferencia"]').click();await expect(page.locator('input[name="ck-pay"]:checked')).toHaveValue('transferencia');
 await expect(page.locator('#ck-encomienda-payment-policy')).toContainText('Sólo el costo del envío se paga a la transportadora al recibir');
 await page.screenshot({path:`../encomienda-runtime-${width}.png`,fullPage:true});
});

for(const width of [320,768,1440]) test(`el mapa real carga sus estilos firmados y cubre el contenedor (${width}px)`,async({page})=>{
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:pixel}));
 await page.route('**/__map-integrity',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head>${leafletStylesheet}</head><body><div id="map" style="height:260px;width:100%;display:none"></div><script type="module">import {createLocationMap} from '../../js/components/location/mapa-ubicacion.js';window.mapApi=await createLocationMap({mapEl:document.getElementById('map')});document.getElementById('map').style.display='block';window.mapApi.invalidateSize();window.mapApi.setLocation({lat:-25.3,lng:-57.6,name:'Punto de prueba'},{scroll:false});</script></body></html>`}));
 await page.setViewportSize({width,height:800});await page.goto('/__map-integrity');
 await expect(page.locator('.leaflet-tile-pane')).toHaveCSS('position','absolute');
 await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
 const boxes=await page.locator('#map').evaluate(el=>{const box=el.getBoundingClientRect();return {map:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},tiles:[...el.querySelectorAll('.leaflet-tile')].map(i=>{const b=i.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};})};});
 for(const x of [boxes.map.left+10,boxes.map.right-10])for(const y of [boxes.map.top+10,boxes.map.bottom-10])expect(boxes.tiles.some(t=>t.left<=x&&t.right>=x&&t.top<=y&&t.bottom>=y)).toBe(true);
});

for(const width of [320,390,767])for(const route of ['index.html','catalogo.html','checkout.html','login.html','perfil.html'])test(`halo centrado y visible en ${route} (${width}px)`,async({page})=>{
 const html=fs.readFileSync(path.join(root,route),'utf8');
 const styles=(html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g)||[]).filter(s=>!s.includes('https:')).join('');
 await page.route('**/__header-halo',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}${navigationStyles}</head><body><div style="position:fixed;inset:0;background:white;z-index:1000"></div><script type="module">import {renderMobileTabbar} from '../../js/components/navigation/movil/encabezado-movil.js';document.body.insertAdjacentHTML('beforeend',renderMobileTabbar());document.getElementById('tabbar-cart').classList.add('active');document.getElementById('cart-badge-mobile').classList.remove('hidden');document.getElementById('cart-badge-mobile').textContent='1';await import('../../js/components/navigation/movil/indicador-navegacion-movil.js');await import('../../js/quality/estabilidad-final-publica.js');document.body.insertAdjacentHTML('beforeend','<div id=product-detail></div>');await import('../../js/quality/estabilidad-producto.js');</script></body></html>`}));
 await page.setViewportSize({width,height:800});await page.goto('/__header-halo');
 const nav=page.locator('#tt-tabbar');await expect(nav).toHaveClass(/tt-mobile-nav-ready/);
 for(const compact of [false,true]){
  await nav.evaluate((el,compact)=>el.classList.toggle('tt-tabbar-compact',compact),compact);
  await expect(nav).toHaveCSS('min-height',compact?'58px':'70px');
  await expect(nav).toHaveCSS('padding-top',compact?'5px':'8px');
  await expect.poll(async()=>page.evaluate(()=>{const icon=document.querySelector('#tabbar-cart svg').getBoundingClientRect(),halo=document.querySelector('.tt-mobile-nav-halo').getBoundingClientRect();return Math.max(Math.abs((icon.left+icon.right-halo.left-halo.right)/2),Math.abs((icon.top+icon.bottom-halo.top-halo.bottom)/2));})).toBeLessThan(1);
  await expect(page.locator('#tabbar-cart')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  expect(await nav.evaluate(el=>{const box=el.getBoundingClientRect();return !!document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)?.closest('#tt-tabbar');})).toBe(true);
 }
 if(width===390&&route==='checkout.html')await page.screenshot({path:'../checkout-halo-corregido.png',clip:{x:0,y:660,width:390,height:140}});
});
