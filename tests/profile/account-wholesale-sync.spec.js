const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/^import\s[\s\S]*?;\s*$/gm,'').replace(/^export /gm,'');
const identity=source('js/pages/profile/estado-canonico-perfil.mjs');
async function fixture(page,width,body){
 await page.setViewportSize({width,height:900});
 await page.route('**/*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxioAAAAASUVORK5CYII=','base64')}));
 await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/profile-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/css/admin/operaciones-admin.css"><link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"></head><body>'+body+'</body></html>'}));
 await page.goto('/profile-fixture');
 if(body.includes('section-mayoristas')){
  const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  const styles=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match=>'/'+match[1]);
  for(const href of styles)await page.addStyleTag({url:href});
  await page.evaluate(()=>{document.documentElement.classList.add('adm-auth-ready');document.querySelector('#section-mayoristas').classList.add('adm-main');});
 }
}
for(const width of [390,768,1440]){
 test('identidad atómica y sincronizada, cambio de cuenta y logout '+width,async({page})=>{
 await fixture(page,width,'<div id="tt-header-desktop-tablet"><div class="tt-header-actions"><button data-auth-account-button style="width:48px;height:48px;border:0;border-radius:50%">Cuenta</button></div></div><div id="account-panel"></div><a id="tabbar-cuenta">Cuenta</a><div id="perfil-avatar"></div><div id="perfil-nombre-display"></div>');
 await page.addScriptTag({content:identity+`
 const auth={currentUser:{uid:'u1',email:'user@example.com',photoURL:'https://provider.example/old.png'}};
 const db={};const AUTH_STATES={AUTHENTICATED:'authenticated',RESTORING:'restoring',UNKNOWN:'unknown'};
 const ROLES={CLIENT:'client',SUPERADMIN:'superadmin'};const SUPER_ADMIN='owner@example.com';
 const can=()=>false;const sanitizeImageUrl=value=>value;const recordAuthDiagnostic=()=>{};
 const readAuthHandoff=()=>null;const createAuthHandoff=()=>{};const clearAuthHandoff=()=>{};
 const logoutSession=async()=>{};const getSessionUser=()=>auth.currentUser;
 const subscribeSession=callback=>{window.sessionCallback=callback;};
 const doc=(_db,_collection,id)=>id;
 const onSnapshot=(ref,next)=>{window.profileCallbacks ||= {};window.profileCallbacks[ref]=next;return()=>{window.stopped ||= [];window.stopped.push(ref);};};
 window.fixtureAuth=auth;
 `+source('js/core/auth/navegacion-autenticacion.js')});
 await page.evaluate(()=>window.sessionCallback({status:'authenticated',user:window.fixtureAuth.currentUser}));
 await expect(page.locator('[data-auth-account-button] img')).toHaveCount(0);
 await expect(page.locator('#account-panel')).toContainText('Cargando tu cuenta');
 await page.evaluate(()=>window.profileCallbacks.u1({exists:()=>true,data:()=>({firstName:'Ana',lastName:'Ruiz',avatarURL:'/photo-custom.png',username:'ana',wholesaleStatus:'solicitado'})}));
 await expect(page.locator('[data-auth-account-button] img')).toHaveAttribute('src','/photo-custom.png');
 await expect(page.locator('#account-panel')).toContainText('Ana Ruiz');
 await expect(page.locator('#account-panel a[href="/perfil#mayorista"]')).toHaveCount(0);
 await page.evaluate(()=>window.profileCallbacks.u1({exists:()=>true,data:()=>({firstName:'Ana',lastName:'Nueva',avatarURL:'/photo-new.png',wholesaleStatus:'aprobado'})}));
 await expect(page.locator('#perfil-nombre-display')).toHaveText('Ana Nueva');
 await expect(page.locator('#perfil-avatar img')).toHaveAttribute('src','/photo-new.png');
 await expect(page.locator('#account-panel a[href="/perfil#mayorista"]')).toHaveCount(0);
 const dimensions=await page.locator('[data-auth-account-button]').evaluate(button=>({button:button.getBoundingClientRect().width,image:button.querySelector('img').getBoundingClientRect().width}));
 expect(dimensions.image).toBeCloseTo(dimensions.button,0);
 await page.evaluate(()=>{window.fixtureAuth.currentUser={uid:'u2',email:'two@example.com'};window.sessionCallback({status:'authenticated',user:window.fixtureAuth.currentUser});window.profileCallbacks.u1({exists:()=>true,data:()=>({avatarURL:'/wrong-user.png'})});});
 await expect(page.locator('[data-auth-account-button] img')).toHaveCount(0);
 await page.evaluate(()=>{window.fixtureAuth.currentUser=null;window.sessionCallback({status:'unauthenticated',user:null});});
 await expect(page.locator('#account-panel')).toContainText('Iniciar sesión');
 expect(await page.evaluate(()=>window.stopped)).toEqual(['u1','u2']);
 });
 test('mayoristas distingue nuevas, vistas y decisiones; usuarios en pestaña '+width,async({page})=>{
 await fixture(page,width,'<main id="section-mayoristas"></main>');
 await page.addScriptTag({content:identity+`
 const auth={currentUser:{uid:'admin',email:'owner@example.com'}};const db={};const SUPER_ADMIN='owner@example.com';
 const sanitizeImageUrl=value=>value;const apiFailureMessage=()=>'';
 const collection=(_db,name)=>name;const query=(collection)=>collection;const limit=()=>{};const orderBy=()=>{};const where=()=>{};
 const onSnapshot=(name,next)=>{window.snapshotCallbacks ||= {};window.snapshotCallbacks[name]=next;return()=>{};};
 const authenticatedFetch=async(_url,options)=>{window.sent=JSON.parse(options.body);return{ok:true,json:async()=>({ok:true,quote:{seenAt:'2026-10-05T12:00:00Z'}})};};
 `+source('js/admin/mayoristas/mayoristas-admin.js')+'\ninitWholesaleAdmin();'});
 await page.evaluate(()=>{
 const quote=(id,status,seenAt)=>({id,quoteNumber:id,userId:'client',customerName:'Ana Ruiz',userEmail:'ana@example.com',businessName:'Bella',whatsapp:'595912345678',city:'Luque',status,seenAt,items:[{name:'Aros',qty:10,retailUnitPrice:10000}],itemCount:10,createdAt:'2026-10-05T12:00:00Z',revision:1});
 window.snapshotCallbacks.wholesaleQuotes({docs:[quote('new','pendiente'),quote('seen','pendiente','2026-10-05'),quote('yes','aprobada'),quote('no','rechazada')].map(q=>({id:q.id,data:()=>q}))});
 window.snapshotCallbacks.users({docs:[{id:'client',data:()=>({firstName:'Ana',lastName:'Ruiz',avatarURL:'/customer.png',email:'ana@example.com',wholesaleStatus:'aprobado',wholesaleBusinessName:'Bella',phone:'0912345678'})}]});
 });
 await page.locator('[data-wholesale-filter]').selectOption('');
 for(const [id,color] of [['new','rgb(255, 243, 196)'],['seen','rgb(255, 255, 255)'],['yes','rgb(222, 244, 230)'],['no','rgb(253, 227, 229)']])await expect(page.locator('[data-open-quote="'+id+'"]').locator('xpath=ancestor::tr').locator('td').first()).toHaveCSS('background-color',color);
 await page.locator('[data-open-quote="new"]').click();
 await expect.poll(()=>page.evaluate(()=>window.sent)).toEqual({quoteId:'new',decision:'ver'});
 await expect(page.locator('[data-open-quote="new"]').locator('xpath=ancestor::tr').locator('td').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(page.locator('[data-wholesale-detail]')).toContainText('WhatsApp 595912345678');
 expect(await page.locator('[data-wholesale-detail]').evaluate(detail=>detail.closest('tr').previousElementSibling.querySelector('[data-open-quote]').dataset.openQuote)).toBe('new');
 await expect(page.locator('[data-wholesale-detail] .wholesale-avatar')).toHaveCount(1);
 if(width===768)await page.screenshot({path:path.resolve(root,'../../outputs/mayoristas-cotizaciones-768.png')});
 await page.locator('[data-wholesale-tab="users"]').click();
 await expect(page.locator('[data-wholesale-user-panel]')).toBeVisible();
 await expect(page.locator('[data-wholesale-quotes-panel]')).toBeHidden();
 await expect(page.locator('.wholesale-user-card')).toContainText('Ana Ruiz');
 await page.locator('[data-wholesale-user-search]').fill('nadie');
 await expect(page.locator('.wholesale-user-card')).toHaveCount(0);
 if(width===768){await page.locator('[data-wholesale-user-search]').fill('');await page.screenshot({path:path.resolve(root,'../../outputs/mayoristas-usuarios-768.png')});}
 });
}
test('perfil público no introduce pestaña mayorista al actualizar la cuenta',async({page})=>{
 const profile=fs.readFileSync(path.join(root,'perfil.html'),'utf8');
 expect(profile).not.toContain('id="perfil-wholesale-card"');
 const content=profile.slice(profile.indexOf('<div class="perfil-wrap">'),profile.indexOf('<div class="perfil-toast"'));
 await fixture(page,768,content);
 await page.addStyleTag({url:'/css/pages/perfil.css'});
 const code=source('js/quality/estabilidad-final-publica.js');
 await page.addScriptTag({content:code.slice(0,code.indexOf('\nfunction start()'))+'\ninjectStyles();enhanceProfile();'});
 await expect(page.locator('[data-profile-tab="datos"]')).toBeVisible();
 await expect(page.locator('[data-profile-tab="mayorista"]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{detail:{wholesaleApproved:true}})));
 await expect(page.locator('[data-profile-tab="mayorista"]')).toHaveCount(0);
});
