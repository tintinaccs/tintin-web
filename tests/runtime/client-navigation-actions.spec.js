const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {installRuntimeErrorMonitor}=require('./runtime-error-monitor.js');
const testHash=createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
const applicationCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

// Discovery records actual DOM in each context; it never marks unexecuted
// controls as passed. This suite covers the signed-out branch of navigation.
let monitor,productionRequests;
test.beforeEach(async({page,context,request})=>{
  await request.post('/__test/reset');
  productionRequests=[];
  monitor=await installRuntimeErrorMonitor(page,context);
  await context.route('https://www.gstatic.com/firebasejs/10.14.1/**',async route=>{
    const response=await request.get('/__test/firebase-sdk/'+new URL(route.request().url()).pathname.split('/').pop());
    expect(response.ok()).toBe(true);
    await route.fulfill({response,headers:{'content-type':'text/javascript','access-control-allow-origin':'*'}});
  });
  await context.route(/https:\/\/(?:identitytoolkit|firestore|securetoken)\.googleapis\.com\//,route=>{productionRequests.push(route.request().url().split('?')[0]);return route.abort('blockedbyclient');});
  await context.route('https://tintinaccesorios.pages.dev/api/**',route=>{productionRequests.push(route.request().url().split('?')[0]);return route.abort('blockedbyclient');});
});
test.afterEach(async({page,context},testInfo)=>{
  await testInfo.attach('runtime-errors',{body:JSON.stringify({...monitor,productionRequests}),contentType:'application/json'});
  await page.close();
  await context.unrouteAll({behavior:'wait'});
  expect(monitor.errors).toEqual([]);
  expect(productionRequests).toEqual([]);
});

async function inventory(page,state,records){
  const controls=await page.locator('button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"]').evaluateAll(nodes=>nodes.map(node=>({
    tag:node.tagName.toLowerCase(),id:node.id||null,role:node.getAttribute('role'),
    label:node.getAttribute('aria-label')||node.textContent.trim()||node.getAttribute('placeholder')||node.name||'',
    href:node.getAttribute('href'),type:node.getAttribute('type'),ariaControls:node.getAttribute('aria-controls'),
    visible:!!(node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'),
    disabled:node.disabled===true,action:node.dataset.navAction||null
  })));
  records.push({state,url:page.url(),controls});
}
async function press(page,locator){
  if(test.info().project.use.hasTouch)await locator.tap();else await locator.click();
}
async function dismissConsent(page){
  const consent=page.getByRole('region',{name:'Cookies y preferencias de privacidad'});
  if(await consent.isVisible()){
    await press(page,consent.getByRole('button',{name:'Solo necesarias',exact:true}));
    await expect(consent).toBeHidden();
  }
}
const routes=['/','/catalogo','/collections','/product?id=runtime-watch','/about','/contact','/envios','/cambios-devoluciones','/preguntas-frecuentes','/privacidad','/terminos','/404.html','/login','/checkout'];
const cases=routes.map(route=>({route}));
for(const width of [768,1024])for(const route of ['/catalogo','/login'])cases.push({route,viewport:{width,height:width===768?1024:768}});
for(const {route,viewport} of cases)test(`acciones de navegación sin sesión: ${route}${viewport?' '+viewport.width+'px':''}`,async({page},testInfo)=>{
  const records=[];
  if(viewport)await page.setViewportSize(viewport);
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-tt-surfaces-ready','1');
  await dismissConsent(page);
  await inventory(page,'initial-guest',records);
  const actions=[
    {action:'search',panel:'#search-panel',close:'#btn-search-close'},
    {action:'cart',panel:'#cart-drawer',close:'#btn-cart-close'},
    {action:'account',panel:'#account-drawer',close:'#btn-account-close'}
  ];
  if(route==='/login'){
    // El contrato de login exige una pantalla independiente, no el shell.
    for(const item of actions)await expect(page.locator(`[aria-controls="${item.panel.slice(1)}"]:visible`)).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Continuar con Google',exact:true})).toBeVisible();
    const back=page.getByRole('link',{name:'Volver a la tienda',exact:true});
    await press(page,back);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[aria-controls="search-panel"]:visible').first()).toBeVisible();
    await inventory(page,'login-return-to-store',records);
  }else for(const item of actions){
    const trigger=page.locator(`[aria-controls="${item.panel.slice(1)}"]:visible`).first();
    await expect(trigger).toBeVisible();
    await press(page,trigger);
    const panel=page.locator(item.panel);
    await expect(panel).toHaveAttribute('aria-hidden','false');
    await expect(panel).toBeVisible();
    await inventory(page,`guest-${item.action}-open`,records);
    await press(page,page.locator(item.close));
    await expect(panel).toHaveAttribute('aria-hidden','true');
  }
  if(viewport&&route!=='/login'){
    await press(page,page.locator('#btn-menu-tablet'));
    await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden','false');
    await inventory(page,'tablet-menu-open',records);
    await press(page,page.locator('#btn-tablet-tienda'));
    await expect(page.locator('#tablet-cats')).toHaveClass(/open/);
    await inventory(page,'tablet-categories-open',records);
    await press(page,page.locator('#btn-tablet-cats-back'));
    await expect(page.locator('#tablet-cats')).not.toHaveClass(/open/);
    await press(page,page.locator('#btn-tablet-close'));
    await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden','true');
  }
  // Signed-out notifications are intentionally unavailable, not a dead button.
  await expect(page.locator('[data-nav-action="notifications"]:visible')).toHaveCount(0);
  fs.writeFileSync(testInfo.outputPath('actions.json'),JSON.stringify({route,role:'guest',project:testInfo.project.name,viewport:page.viewportSize(),applicationCommit,testHash,records},null,2));
  await testInfo.attach('action-discovery',{path:testInfo.outputPath('actions.json'),contentType:'application/json'});
});
