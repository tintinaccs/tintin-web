const {test,expect}=require('@playwright/test');
const {installRuntimeErrorMonitor}=require('./runtime-error-monitor.js');

let errors, productionRequests, browserDiagnostics;
test.beforeEach(async({page,context,request})=>{
  await request.post('/__test/reset');
  productionRequests=[];
  ({errors,browserDiagnostics}=await installRuntimeErrorMonitor(page,context));
  // Cache the unchanged official SDK bytes through the test host's environment proxy.
  // This avoids CDN/proxy CORS failures; Auth/Firestore still use real services.
  await context.route('https://www.gstatic.com/firebasejs/10.14.1/**',async route=>{
    const response=await request.get('/__test/firebase-sdk/'+new URL(route.request().url()).pathname.split('/').pop());
    expect(response.ok()).toBe(true);
    await route.fulfill({response,headers:{'content-type':'text/javascript','access-control-allow-origin':'*'}});
  });
  // SDK files are real. Any accidental access to production data/services fails.
  await context.route(/https:\/\/(?:identitytoolkit|firestore|securetoken)\.googleapis\.com\//,route=>{productionRequests.push(route.request().url().split('?')[0]);return route.abort('blockedbyclient');});
  await context.route('https://tintinaccesorios.pages.dev/api/**',route=>{productionRequests.push(route.request().url().split('?')[0]);return route.abort('blockedbyclient');});
});
test.afterEach(async({page,context},testInfo)=>{
  // Finish module transfers while the API fixture is still alive; never ignore route errors.
  await page.waitForLoadState('domcontentloaded');
  if (errors.length || productionRequests.length || testInfo.status!==testInfo.expectedStatus) await page.screenshot({path:testInfo.outputPath('runtime-failure.png'),fullPage:true});
  await page.close();
  await context.unrouteAll({behavior:'wait'});
  await testInfo.attach('runtime-errors',{body:JSON.stringify({errors,productionRequests,browserDiagnostics}),contentType:'application/json'});
  expect(errors,'errores JavaScript de la página completa').toEqual([]);
  expect(productionRequests,'el entorno de prueba nunca debe escribir en producción').toEqual([]);
});
async function state(request,email){const response=await request.get('/__test/state?email='+encodeURIComponent(email));expect(response.ok()).toBe(true);return response.json();}
async function otp(page,request,email,{invalid=false}={}){
  await page.goto('/login',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#btn-send-otp')).toBeVisible();
  await page.locator('#login-email-input').fill(email);
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/email-otp-send')&&r.request().method()==='POST');
  await page.locator('#btn-send-otp').click();expect((await sent).status()).toBe(200);
  await expect(page.locator('#login-otp-block')).toBeVisible();
  const mail=await state(request,email);expect(mail.code).toMatch(/^\d{6}$/);
  if(invalid){
    await page.locator('#login-otp-input').fill(mail.code==='000000'?'111111':'000000');
    const rejected=page.waitForResponse(r=>r.url().endsWith('/api/email-otp-verify'));
    await page.locator('#btn-verify-otp').click();expect((await rejected).status()).toBe(400);
    await expect(page.locator('#login-error')).toContainText('Código incorrecto');
    await expect(page.locator('#btn-verify-otp')).toBeEnabled();
  }
  await page.locator('#login-otp-input').fill(mail.code);
  const verified=page.waitForResponse(r=>r.url().endsWith('/api/email-otp-verify'));
  await page.locator('#login-otp-input').press('Enter');expect((await verified).status()).toBe(200);
  await expect(page.locator('#btn-save-profile')).toBeVisible();
  await expect(page.locator('#btn-save-profile')).toBeEnabled();
}
async function fillProfile(page){await page.locator('#login-profile-first-name').fill('María González');await page.locator('#login-profile-phone').fill('0981123456');}
async function continueProfile(page){const b=page.locator('#btn-save-profile');if(test.info().project.use.hasTouch)await b.tap();else await b.click();}

test('correo → OTP real → Continuar → perfil persistido → sesión conservada',async({page,request},testInfo)=>{
  if(testInfo.project.name.includes('mobile'))await page.setViewportSize({width:320,height:568});
  const email='success@example.test';await otp(page,request,email,{invalid:true});await fillProfile(page);
  const availability=page.waitForResponse(r=>r.url().endsWith('/api/phone-availability'));
  await expect(page.locator('#tt-privacy-consent')).toHaveCount(0);
  expect(await page.evaluate(()=>window.TintinActivityPrivacy.preferences.statistics)).toBe(false);
  await continueProfile(page);expect((await availability).status()).toBe(200);
  await expect(page).toHaveURL(/index\.html/);
  const saved=await state(request,email);
  expect(saved.profile).toMatchObject({name:'María González',phone:'+595981123456',profileStatus:'active',role:'client'});
  expect(saved.requests.filter(r=>r.path==='/api/phone-availability')).toHaveLength(1);
  await page.screenshot({path:testInfo.outputPath('correo-completado.png'),fullPage:true});
  await page.goto('/login',{waitUntil:'domcontentloaded'});await expect(page).toHaveURL(/index\.html/);
  expect((await state(request,email)).uid).toBe(saved.uid);
});

test('Continuar muestra nombre inválido y no envía solicitudes ni guarda',async({page,request})=>{
  const email='validation@example.test';await otp(page,request,email);
  await page.locator('#login-profile-first-name').fill('Pedro');await page.locator('#login-profile-phone').fill('0981123456');
  await continueProfile(page);
  await expect(page.locator('#login-first-name-error')).toContainText('nombre y apellido');
  await expect(page.locator('#login-profile-first-name')).toBeFocused();
  const saved=await state(request,email);expect(saved.profile.profileStatus).toBe('incomplete');expect(saved.requests.filter(r=>r.path==='/api/phone-availability')).toHaveLength(0);
});

test('sin conexión conserva datos, libera Continuar y permite un reintento real',async({page,context,request})=>{
  const email='offline@example.test';await otp(page,request,email);await fillProfile(page);
  await context.setOffline(true);await continueProfile(page);
  await expect(page.locator('#login-error')).toContainText('No tenés conexión');
  await expect(page.locator('#btn-save-profile')).toBeEnabled();
  await expect(page.locator('#login-profile-phone')).toHaveValue('0981123456');
  await context.setOffline(false);
  await page.locator('#login-profile-phone').press('Enter');await expect(page).toHaveURL(/index\.html/);
  expect((await state(request,email)).profile.profileStatus).toBe('active');
});

test('teléfono reservado por otra cuenta se rechaza sin activar el perfil',async({page,request})=>{
  const email='duplicate@example.test';await otp(page,request,email);await fillProfile(page);
  await request.post('/__test/seed',{data:{path:'phoneReservations/595981123456',data:{uid:'another-customer'}}});
  await continueProfile(page);
  await expect(page.locator('#login-phone-error')).toContainText('ya está registrado');
  await expect(page.locator('#btn-save-profile')).toBeEnabled();
  const saved=await state(request,email);expect(saved.profile.profileStatus).toBe('incomplete');expect(saved.profile.phone).toBe('');
});

test('Firestore deniega permisos y la interfaz permite recuperar el guardado',async({page,request})=>{
  const email='denied@example.test';await otp(page,request,email);await fillProfile(page);
  const initial=await state(request,email);
  await request.post('/__test/seed',{data:{path:'users/'+initial.uid,data:{blocked:true}}});
  await continueProfile(page);
  await expect(page.locator('#login-error')).toContainText('No pudimos guardar tus datos');
  await expect(page.locator('#btn-save-profile')).toBeEnabled();
  expect((await state(request,email)).profile.profileStatus).toBe('incomplete');
  // Recover only the blocked flag: timestamps and identity contract stay real.
  await request.post('/__test/seed',{data:{path:'users/'+initial.uid,data:{blocked:false}}});
  await page.locator('#login-profile-phone').press('Enter');
  await expect(page).toHaveURL(/index\.html/);
  expect((await state(request,email)).profile.profileStatus).toBe('active');
});

test('producto carga desde HTTP, carrito cambia y checkout avanza tras validar sesión',async({page,request})=>{
  const email='checkout@example.test';await otp(page,request,email);await fillProfile(page);await continueProfile(page);await expect(page).toHaveURL(/index\.html/);
  await page.goto('/product?id=runtime-watch',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#product-name')).toHaveText('Reloj Runtime');
  await page.locator('#btn-product-add-cart').click();
  await expect.poll(()=>page.evaluate(()=>window.TintinCartRuntime?.getCartLocal().reduce((n,i)=>n+i.qty,0))).toBe(1);
  await page.goto('/checkout',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.ck-item-name')).toContainText('Reloj Runtime');
  await page.locator('#btn-step1-next').click();
  await expect(page.locator('#panel-1')).toHaveClass(/active/);
  await expect(page.locator('#ck-login-required-overlay')).toHaveCount(0);
  // Stop before ordering/payment. No purchase is submitted.
});

test('favorito histórico muestra el precio actual del catálogo y lo conserva al recargar',async({page,request})=>{
  const email='favorite-price@example.test';await otp(page,request,email);await fillProfile(page);await continueProfile(page);await expect(page).toHaveURL(/index\.html/);
  const account=await state(request,email);
  const seeded=await request.post('/__test/seed',{data:{path:'users/'+account.uid+'/favorites/runtime-watch',data:{productId:'runtime-watch',name:'Nombre histórico',price:0,imageUrl:'/assets-tintin/images/general/logo.png'}}});
  expect(seeded.ok()).toBe(true);
  await page.goto('/perfil#favoritos',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#perfil-favorites-list')).toContainText('Reloj Runtime');
  await expect(page.locator('#perfil-favorites-list')).toContainText('150.000');
  await expect(page.locator('#perfil-favorites-list')).not.toContainText('Gs. 0');
  await page.reload();
  await expect(page.locator('#perfil-favorites-list')).toContainText('150.000');
});

test('cliente no puede elevar su rol ni abrir el panel administrativo',async({page,request})=>{
  const email='client-role@example.test';await otp(page,request,email);await fillProfile(page);await continueProfile(page);await expect(page).toHaveURL(/index\.html/);
  await page.waitForFunction(()=>window.__runtimeAuth?.currentUser && window.__runtimeDb);
  const code=await page.evaluate(async()=>{
    const {doc,updateDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    try{await updateDoc(doc(window.__runtimeDb,'users',window.__runtimeAuth.currentUser.uid),{role:'admin'});return 'unexpected-success';}catch(e){return e.code;}
  });
  expect(code).toBe('permission-denied');expect((await state(request,email)).profile.role).toBe('client');
  // Readiness del fixture permite probar el rechazo real del rol cliente,
  // sin confundir un fallo de App Check con autorización administrativa.
  await page.goto('/admin',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/perfil(?:\.html)?(?:[?#]|$)/);
  await expect(page.locator('#adm-sidebar')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/adm-auth-ready/);
});


test('cuenta muestra el perfil persistido, guarda cambios y los conserva al recargar',async({page,request},testInfo)=>{
  const email='account@example.test';await otp(page,request,email);await fillProfile(page);await continueProfile(page);await expect(page).toHaveURL(/index\.html/);
  await page.goto('/perfil',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#perfil-email-display')).toHaveText(email);
  await expect(page.locator('#perfil-nombre')).toHaveValue('María González');
  const consent=page.getByRole('region',{name:'Cookies y preferencias de privacidad'});
  await expect(consent).toBeVisible();
  await consent.getByRole('button',{name:'Solo necesarias',exact:true}).click();
  await expect(consent).toBeHidden();
  expect(await page.evaluate(()=>window.TintinActivityPrivacy.preferences.statistics)).toBe(false);
  await page.locator('#perfil-nombre').fill('María López');
  await expect(page.locator('#profile-panel-datos #btn-guardar-perfil')).toBeVisible();
  await page.locator('#btn-guardar-perfil').click();
  await expect(page.locator('#perfil-toast')).toContainText('Perfil actualizado');
  await expect(page.locator('#perfil-nombre-display')).toHaveText('María López');
  expect((await state(request,email)).profile).toMatchObject({name:'María López',phone:'+595981123456'});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#perfil-nombre')).toHaveValue('María López');
  await page.screenshot({path:testInfo.outputPath('perfil-guardado.png'),fullPage:true});
});

test('contrato real de persistencia de checkout: Firestore confirma y recarga factura/envío sin borrarlos al comprar sin factura',async({page,request})=>{
  const email='checkout-memory@example.test';await otp(page,request,email);await fillProfile(page);await continueProfile(page);
  await expect(page).toHaveURL(/index\.html/);
  const source=await (await request.get('/js/orders/pedido-checkout-seguro.js')).text();
  const block=source.slice(source.indexOf('  async function prefillCheckoutDefaults('),source.indexOf('  // Antes de cualquier avance'));
  const dependency=path=>source.split('\n').find(line=>line.includes(path)).split("'")[1];
  const dependencies={firebase:dependency('core/firebase/firebase.js'),session:dependency('core/auth/coordinador-sesion.js'),validators:dependency('validacion-documentos-py.js')};
  const draft={ci:'4123456',wantsInvoice:true,taxpayerType:'fisica',razonSocial:'María González',ruc:'4123456-7',departamento:'Central',selectedCity:'San Lorenzo',shippingMethod:'delivery',encomiendaMode:'',address:'Casa de María',referencia:'Portón blanco'};
  async function execute(action,draft){
    return page.evaluate(async({block,dependencies,action,draft})=>{
      const base=new URL('/js/orders/pedido-checkout-seguro.js',location.origin);
      const [{db},session,validators,sdk]=await Promise.all([import(new URL(dependencies.firebase,base).href),import(new URL(dependencies.session,base).href),import(new URL(dependencies.validators,base).href),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);
      await session.waitForSession();
      if(action==='prefill')for(const id of ['ck-ci','ck-taxpayer-type','ck-razon-social','ck-ruc']){const input=document.createElement('input');input.id=id;document.body.append(input);}
      const api=new Function('db','getSessionUser','doc','getDoc','setDoc','serverTimestamp','isValidCi','normalizeCi','isValidRuc','normalizeRuc','isValidRazonSocial','isValidTaxpayerType',"const text=value=>String(value||'').trim(); const CHECKOUT_DEFAULTS_FIELD='checkoutDefaults';let lastProfilePrefillUid='';"+block+'return {prefillCheckoutDefaults,persistCheckoutDefaults};')(db,session.getSessionUser,sdk.doc,sdk.getDoc,sdk.setDoc,sdk.serverTimestamp,validators.isValidCi,validators.normalizeCi,validators.isValidRuc,validators.normalizeRuc,validators.isValidRazonSocial,validators.isValidTaxpayerType);
      if(action==='persist')await api.persistCheckoutDefaults(draft);
      else {await api.prefillCheckoutDefaults(session.getSessionUser());return Object.fromEntries(['ck-ci','ck-taxpayer-type','ck-razon-social','ck-ruc'].map(id=>[id,document.getElementById(id).value]));}
    },{block,dependencies,action,draft});
  }
  await execute('persist',draft);
  const saved=await state(request,email);expect(saved.profile.checkoutDefaults.invoice).toMatchObject({taxpayerType:'fisica',razonSocial:draft.razonSocial,ruc:draft.ruc});
  expect(saved.profile.checkoutDefaults.shipping).toMatchObject({selectedCity:'San Lorenzo',referencia:'Portón blanco'});
  await page.reload();await expect(page.locator('header:visible,#tt-tabbar:visible').first()).toBeVisible();
  expect(await execute('prefill')).toMatchObject({'ck-ci':'4123456','ck-taxpayer-type':'fisica','ck-razon-social':draft.razonSocial,'ck-ruc':draft.ruc});
  await execute('persist',{...draft,wantsInvoice:false,ci:'',taxpayerType:'',razonSocial:'',ruc:''});
  expect((await state(request,email)).profile.checkoutDefaults.invoice).toMatchObject({taxpayerType:'fisica',razonSocial:draft.razonSocial,ruc:draft.ruc});
});
