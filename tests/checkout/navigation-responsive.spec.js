const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'checkout.html'),'utf8');
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
