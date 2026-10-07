const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const html=fs.readFileSync('checkout.html','utf8');
const access=html.slice(html.indexOf('function isCheckoutAuthorized()'),html.indexOf('// Espera a que el SDK'));
const navigation=html.slice(html.indexOf('function goToStep(n)'),html.indexOf('function showError(stepIdx'));
const next=html.slice(html.indexOf("document.getElementById('btn-step1-next').onclick"),html.indexOf('// ---- STEP 2: SHIPPING'));
const forwardValidation=fs.readFileSync('js/pages/checkout/validacion-avance.js','utf8').replace(/export function/g,'function');
const hardening=forwardValidation+fs.readFileSync('js/pages/checkout/checkout-hardening.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');

const secureSource=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8');
const secureGuard=secureSource.slice(secureSource.indexOf("  window.addEventListener('click', event => {"),secureSource.indexOf('  // Si el carrito cambia'));

async function fixture(page,{emptyCart=false,profile={blocked:false}}={}) {
  await page.route('**/checkout',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body>
    <section class="ck-panel active"></section><section class="ck-panel"></section>
    <button class="ck-step active"></button><button class="ck-step"></button>
    <div class="ck-error" id="error-0" role="alert"></div><button id="btn-step1-next">Elegir cómo lo recibo</button>
    <script>
    let currentUser=null,currentUserProfile=null,currentStep=0,sessionStatus='RESTORING';const AUTH_STATES={RESTORING:'RESTORING',UNKNOWN:'UNKNOWN',AUTHENTICATED:'AUTHENTICATED',UNAUTHENTICATED:'UNAUTHENTICATED'};
    const CHECKOUT_RESUME_KEY='tt_checkout_resume_step',orderData={},cart=${emptyCart?'[]':JSON.stringify([{id:'fixture',qty:1}])};let cartItems=cart;
    const listeners=[];let ready;const sessionReady=new Promise(resolve=>ready=resolve);
    const waitForSession=()=>sessionReady,waitForAuthReady=waitForSession,subscribeSession=fn=>{listeners.push(fn);fn({status:'RESTORING',user:null});};
    const readCheckoutProfile=async()=>(${JSON.stringify(profile)}),getCartLocal=()=>cart,awaitCartReady=async()=>{},updateQty=async()=>{},removeFromCart=async()=>{};
    window.resolveSession=user=>{currentUser=user;sessionStatus=user?'AUTHENTICATED':'UNAUTHENTICATED';listeners.forEach(fn=>fn({status:sessionStatus,user}));ready();};
    function showError(step,msg){document.getElementById('error-'+step).textContent=msg;}function hideErrors(){}
    window.__clickCount=0;window.addEventListener('click',event=>{if(++window.__clickCount>50){event.preventDefault();event.stopImmediatePropagation();window.__guardLoop=true;}},true);
    let orderCompleted=false;const ensureCartAvailable=async()=>cart;const forceBackToCart=message=>showError(0,message);
    ${access}${navigation}${next}${hardening}${secureGuard}
    </script></body></html>`}));
  await page.goto('/checkout');
}

for(const width of [320,360,375,390,414,430,768,820,1024,1366,1440]) {
  test(`primer intento sin sesión muestra acceso y conserva carrito (${width}px)`,async({page})=>{
    await page.setViewportSize({width,height:900});await fixture(page);
    await page.locator('#btn-step1-next').click();
    await page.evaluate(()=>document.getElementById('btn-step1-next').click());
    await expect(page.locator('#error-0')).toBeEmpty();
    await page.evaluate(()=>window.resolveSession(null));
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(()=>!!window.__guardLoop)).toBe(false);
    await expect(page.locator('#ck-login-required-overlay')).toHaveCount(1);
    await expect(page.locator('.ck-panel').first()).toHaveClass(/active/);
    await expect(page.locator('#ck-login-required-login')).toHaveAttribute('href','/login?from=checkout.html');
    expect(await page.evaluate(()=>sessionStorage.getItem('tt_checkout_resume_step'))).toBe('1');
    await page.locator('#ck-login-required-close').click();
    await page.locator('#btn-step1-next').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('sesión real restaurada permite envío sin mostrar un modal de invitado',async({page})=>{
  await fixture(page);await page.locator('#btn-step1-next').click();
  await page.evaluate(()=>window.resolveSession({uid:'customer',emailVerified:true}));
  await expect(page.locator('.ck-panel').nth(1)).toHaveClass(/active/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('las dos guardias no permiten avanzar con un carrito vacío',async({page})=>{
  await fixture(page,{emptyCart:true});await page.evaluate(()=>window.resolveSession(null));
  await page.locator('#btn-step1-next').click();
  await expect(page.locator('.ck-panel').first()).toHaveClass(/active/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__clickCount)).toBe(1);
});

test('la validación del carrito no saltea el bloqueo de perfil',async({page})=>{
  await fixture(page,{profile:{blocked:true}});
  await page.evaluate(()=>window.resolveSession({uid:'blocked',emailVerified:true}));
  await page.locator('#btn-step1-next').click();
  await expect(page.locator('#error-0')).toContainText(/bloqueada/);
  await expect(page.locator('.ck-panel').first()).toHaveClass(/active/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>!!window.__guardLoop)).toBe(false);
});
