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
