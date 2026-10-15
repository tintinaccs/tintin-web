// Component tests use explicit controlled persistence, not production App Check
// evidence. The complete-page suite independently checks real SDK/services.
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('js/components/welcome/tutorial-bienvenida.js','utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'');
async function mount(page,profile,{ready=true,failWrite=false,preview=false}={}){
  await page.route('https://welcome.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><header class="tt-header">Tintin</header><main>Inicio</main><nav id="tt-tabbar">Menú</nav></body></html>'}));
  await page.goto('https://welcome.test/index.html?welcome=1'+(preview?'&welcomePreview=1':''));
  await page.evaluate(({profile,ready,failWrite,preview})=>{
    window.fixture={profile,writes:0};
    window.auth={};window.db={};window.appCheckReady=Promise.resolve(ready);
    window.doc=(_db,...parts)=>parts.join('/');
    window.getDoc=async ref=>({exists:()=>true,data:()=>ref==='settings/welcomeTutorial'?{enabled:true,previewEnabled:true}:window.fixture.profile});
    window.runTransaction=async (_db,fn)=>{
      if(failWrite)throw Error('permission-denied');
      return fn({get:async()=>({exists:()=>true,data:()=>window.fixture.profile}),update:(_ref,patch)=>{window.fixture.profile={...window.fixture.profile,...patch};window.fixture.writes++;}});
    };
    window.serverTimestamp=()=> 'confirmed-test-timestamp';
    window.SUPER_ADMIN='owner@example.test';window.getUserRole=async()=>profile.role||'client';
    window.DEFAULT_WELCOME_STEPS=[{title:'Bienvenida a Tintin',text:'Cómo comprar',cta:'Empezar'}];
    window.WELCOME_VERSION='test';
    window.normalizeWelcomeConfig=config=>({enabled:true,previewEnabled:true,title:'Mensaje de bienvenida',steps:window.DEFAULT_WELCOME_STEPS,...config});
    window.subscribeAuthState=callback=>{window.authCallback=callback;callback({uid:'customer',email:preview?window.SUPER_ADMIN:'customer@example.test'});};
  },{profile,ready,failWrite,preview});
  await page.addScriptTag({content:source});
}
const fresh={role:'client',profileStatus:'active',welcomeTutorialPending:true,onboardingCompleted:false};

test('el formulario administrativo conserva comillas como texto sin crear atributos', async ({page}) => {
  const admin = fs.readFileSync('js/admin/content/control-bienvenida-admin.js', 'utf8');
  const helper = admin.match(/  function escapeHtml\(value\) \{[\s\S]*?\n  \}/)[0];
  const payload = 'Título" data-injected="yes\'><img src=x onerror=alert(1)>';
  await page.setContent('<main></main>');
  await page.evaluate(({helper, payload}) => {
    const escapeHtml = new Function(helper + ';return escapeHtml;')();
    document.querySelector('main').innerHTML = `<input value="${escapeHtml(payload)}"><textarea>${escapeHtml(payload)}</textarea>`;
  }, {helper, payload});
  await expect(page.locator('input')).toHaveValue(payload);
  await expect(page.locator('textarea')).toHaveValue(payload);
  await expect(page.locator('[data-injected],img')).toHaveCount(0);
});
test('primera guía confirmada: visible, centrada y cierre independiente de red en cuatro tamaños',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
    await page.setViewportSize(size);await mount(page,{...fresh});
    const dialog=page.locator('#tt-welcome-tutorial');await expect(dialog).toBeVisible();
    await expect(page.locator('.tt-welcome-card')).toHaveCSS('touch-action','pan-y');
    const box=await page.locator('.tt-welcome-card').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
    expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.tt-header')).visibility)).toBe('visible');
    const persisted=await page.evaluate(()=>window.fixture.profile);expect(persisted.welcomeTutorialSeen).toBe(true);
    // The close cannot depend on any subsequent App Check or DB response.
    await page.evaluate(()=>{window.appCheckReady=new Promise(()=>{});window.runTransaction=()=>new Promise(()=>{});});
    await page.locator('#tt-welcome-close').click();await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(()=>document.body.style.position)).toBe('');
    await mount(page,persisted);await expect(dialog).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('URL de bienvenida no habilita cuentas existentes, incompletas, bloqueadas ni admin',async({page})=>{
  for(const profile of [{role:'client',profileStatus:'active',createdAt:new Date().toISOString()}, {...fresh,welcomeTutorialSeen:true},{...fresh,welcomeTutorialFirstShownAt:'previous-confirmed-appearance'},{...fresh,profileStatus:'incomplete'},{...fresh,blocked:true},{...fresh,role:'admin'}]){
    await mount(page,profile);await page.waitForTimeout(300);
    await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
    await expect(page.locator('.tt-header')).toBeVisible();expect(await page.evaluate(()=>window.fixture.writes)).toBe(0);
  }
});
test('App Check no disponible o escritura rechazada conserva inicio y bienvenida pendiente',async({page})=>{
  for(const options of [{ready:false},{failWrite:true}]){
    await mount(page,{...fresh},options);await page.waitForTimeout(400);
    await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
    await expect(page.locator('main')).toBeVisible();await expect(page.locator('#tt-tabbar')).toBeVisible();
    expect(await page.evaluate(()=>window.fixture.profile.welcomeTutorialPending)).toBe(true);
  }
});
test('cambio de cuenta cierra la guía y restaura el scroll',async({page})=>{
  await mount(page,{...fresh});await expect(page.locator('#tt-welcome-tutorial')).toBeVisible();
  await page.evaluate(()=>window.authCallback(null));await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.position)).toBe('');
});

test('preview explícito de Super Admin no altera el onboarding de clientes',async({page})=>{
  await mount(page,{role:'superadmin',profileStatus:'active'},{preview:true});
  await expect(page.locator('#tt-welcome-tutorial')).toBeVisible();
  await page.locator('#tt-welcome-close').click();await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
  expect(await page.evaluate(()=>window.fixture.writes)).toBe(0);
});
