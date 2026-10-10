const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const login=fs.readFileSync('login.html','utf8');
const ensure=login.slice(login.indexOf('async function ensureProfileComplete'),login.indexOf('\nfunction isUnavailableAuthIdentity'));
fs.mkdirSync('artifacts/whatsapp-feedback',{recursive:true});
const showErrorFunction=login.slice(login.indexOf('function showError('),login.indexOf('function showActiveSessionState('));
const moduleRoot='/js/';
const script=`
import {getProfileCompletionPlan,buildMissingProfilePatch,isValidCustomerName} from '${moduleRoot}pages/profile/configuracion-inicial-perfil.mjs';
import {findCountryByCode,normalizePhone,isValidPhone,isRealisticPhone} from '${moduleRoot}components/forms/utilidades-telefono.js';
import {withDeadline} from '${moduleRoot}core/auth/estado-perfil-sesion.mjs';
const db={},SUPER_ADMIN='official@example.com',AUTH_NETWORK_DEADLINE_MS=1000;
const PROFILE_STATE={MISSING:'MISSING',INCOMPLETE:'INCOMPLETE',COMPLETE:'COMPLETE',ERROR:'ERROR'};
const PROFILE_ACTION={CREATE_THEN_COMPLETE_PROFILE:'create'};
const resolveProfileAction=()=> 'complete';
const doc=()=>({}),serverTimestamp=()=>new Date(),detectAuthMethod=()=> 'emailOtp';
const ensureUserProfile=async()=>{},clearProfileGateCache=()=>{},reservePhone=async()=>{},recordAuthDiagnostic=()=>{};
const logoutSession=async()=>{};
const hideLoginOverlay=()=>{},revealLoginSurface=()=>{},showOverlay=()=>{};
const hideMessages=()=>document.getElementById('login-error').classList.remove('show');
${showErrorFunction}
const populateCountrySelect=()=>{};
let stored={profileStatus:'incomplete'};
window.profileWrites=0;
const readProfileState=async()=>{const plan=getProfileCompletionPlan({profile:stored,user:{email:'isolated@example.com'},role:'client',superAdminEmail:SUPER_ADMIN});return{state:plan.skip?PROFILE_STATE.COMPLETE:PROFILE_STATE.INCOMPLETE,plan};};
const runTransaction=async(_db,fn)=>window.stallWrites?new Promise(()=>{}):fn({get:async()=>({exists:()=>true,data:()=>({...stored})}),set:(_ref,patch)=>{stored={...stored,...patch};window.profileWrites++;}});
${ensure}
document.documentElement.classList.remove('login-auth-pending','tt-color-scheme-pending','tt-store-gate-pending');
const user={uid:'isolated',email:'isolated@example.com',getIdToken:async()=> 'isolated'};
ensureProfileComplete(user,'client').then(()=>{window.registrationComplete=true;window.savedProfile=stored;});
`;
const html=removeFixtureScripts(login).replace('</body>',`<script type="module">${script}</script></body>`);
for(const width of [320,390,768,1024,1280,1440,1920]) test(`registro breve valida, explica duplicados y termina (${width}px)`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:900});
 let duplicate=false;
 await page.route('**/api/phone-availability',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({available:!duplicate,valid:true})}));
 await page.route('**/__brief-registration',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('/__brief-registration');
 const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone'),button=page.locator('#btn-save-profile');
 await expect(name).toBeVisible();expect((await page.locator('.login-shell').boundingBox()).y).toBeLessThan(100);await expect(page.locator('#login-profile-block input')).toHaveCount(2);
 await name.fill('María');await phone.fill('0912345678');await button.click();
 await expect(name).toHaveAttribute('aria-invalid','true');await expect(page.locator('#login-first-name-error')).toContainText('dos palabras');
 expect(await page.evaluate(()=>window.profileWrites)).toBe(0);
 await name.fill('María González');await expect(page.locator('#login-first-name-error')).toBeEmpty();
 if(width===390)await page.screenshot({path:'artifacts/whatsapp-feedback/registro-mobile.png',fullPage:true});
 duplicate=true;await button.click();
 await expect(page.locator('#login-phone-error')).toContainText('ya está registrado');expect(await page.evaluate(()=>window.profileWrites)).toBe(0);
 expect(await name.inputValue()).toBe('María González');await expect(phone).toBeFocused();
 duplicate=false;
 if(width===390){await page.evaluate(()=>window.stallWrites=true);await button.click();await expect(page.locator('#login-error')).toContainText('La conexión está tardando');await expect(page.locator('#login-error')).toBeFocused();await expect(button).toBeEnabled();expect(await phone.inputValue()).toBe('0912345678');await page.evaluate(()=>window.stallWrites=false);}
 await button.dblclick();await page.waitForFunction(()=>window.registrationComplete);
 expect(await page.evaluate(()=>window.profileWrites)).toBe(1);
 const stored=await page.evaluate(()=>window.savedProfile);expect(stored.name).toBe('María González');expect(stored.profileStatus).toBe('active');expect(stored.phone).toBe('+595912345678');
 expect('dob' in stored).toBe(false);expect('username' in stored).toBe(false);expect('savedLocation' in stored).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});

const product=fs.readFileSync('product.html','utf8');
for(const width of [320,390,768,1024,1280,1440,1920]) test(`ficha sin comunidad ni selección duplicada y con dos columnas desde tablet (${width}px)`,async({page})=>{
 const fixture=removeFixtureScripts(product).replace('</head>','<link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"><link rel="stylesheet" href="/css/pages/product/product-maintenance.css"></head>');
 await page.route('**/__product-layout',r=>r.fulfill({contentType:'text/html',body:fixture}));
 await page.setViewportSize({width,height:900});await page.goto('/__product-layout');
 await page.evaluate(()=>{document.documentElement.classList.remove('tt-store-gate-pending','tt-color-scheme-pending');document.body.classList.add('tt-product-maintenance');document.getElementById('product-loading').style.display='none';document.getElementById('product-grid').style.display='';document.getElementById('product-name').textContent='Reloj Anabella';document.getElementById('product-price').textContent='Gs. 120.000';});
 await page.evaluate(()=>{const img=document.createElement('img');img.src='/assets-tintin/images/collections/col-relojes.webp';img.alt='Reloj';img.style.cssText='width:100%;height:100%;object-fit:contain';document.getElementById('gallery-main').replaceChildren(img);const thumbs=document.getElementById('gallery-thumbs');thumbs.style.display='flex';thumbs.innerHTML='<button class="tt-gallery-thumb" aria-label="Ver imagen 1"><img class="tt-gallery-thumb-img" src="/assets-tintin/images/collections/col-relojes.webp" alt=""></button>';});
 await expect(page.locator('.tt-gallery-thumb')).toHaveCSS('border-radius','50%');
 if(width===768)await page.screenshot({path:'artifacts/whatsapp-feedback/producto-tablet.png',fullPage:true});
 await expect(page.locator('[data-share-product]')).toBeVisible();await expect(page.locator('#tinsel-root,#product-reviews,#btn-product-like,[data-open-community]')).toHaveCount(0);
 const boxes=await page.locator('#product-grid > *').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,right:r.right};}));
 expect(boxes).toHaveLength(2);expect(boxes[0].x).toBeGreaterThanOrEqual(16);expect(boxes[1].right).toBeLessThanOrEqual(width-15);
 if(width>=768){expect(Math.abs(boxes[0].y-boxes[1].y)).toBeLessThan(2);expect(boxes[1].x).toBeGreaterThan(boxes[0].x);}else{expect(boxes[1].y).toBeGreaterThan(boxes[0].y);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

for(const width of [320,768,1440]) test(`agotados en gris con raya blanca y WhatsApp visible durante el scroll (${width}px)`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const fixture=`<!doctype html><html><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"><style>body{margin:0}.tt-product-img{width:160px;height:160px}.tt-product-img img{width:100%;height:100%;object-fit:contain}main{min-height:2200px;padding:20px}.tt-wa-float{position:fixed;bottom:100px;right:20px;width:48px;height:48px;display:grid;place-items:center}.conflict{position:fixed;bottom:100px;right:20px;width:52px;height:52px}</style></head><body><main><article class="tt-stock-unavailable"><div class="tt-product-img"><img class="tt-product-img-real" src="/assets-tintin/images/collections/col-relojes.webp" alt="Agotado"></div></article><button class="conflict">Acción</button></main><a class="tt-wa-float" href="https://wa.me/595981299331" aria-label="WhatsApp">WA</a><script src="/js/quality/correccion-auditoria-pagina.js"></script></body></html>`;
 await page.route('**/__stock-whatsapp',r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto('/__stock-whatsapp');
 const image=page.locator('.tt-product-img-real');await expect(image).toHaveCSS('filter','grayscale(1)');
 const slash=await page.locator('.tt-product-img').evaluate(el=>{const s=getComputedStyle(el,'::after');return{background:s.backgroundColor,border:s.borderTopColor,width:s.borderTopWidth};});
 expect(slash).toEqual({background:'rgb(255, 255, 255)',border:'rgb(36, 36, 36)',width:'2px'});
 await page.waitForFunction(()=>Boolean(window.TintinWaOverlapGuard));
 for(const y of [0,450,1300,0]){
  await page.evaluate(y=>{scrollTo(0,y);window.TintinWaOverlapGuard.checkNow();},y);
  await expect(page.locator('.tt-wa-float')).toBeVisible();await expect(page.locator('.tt-wa-float')).toHaveCSS('opacity','1');
  const overlap=await page.evaluate(()=>{const a=document.querySelector('.tt-wa-float').getBoundingClientRect(),b=document.querySelector('.conflict').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});expect(overlap).toBe(false);
 }
});

for(const width of [390,768,1440]) test(`horario, texto y contraste de WhatsApp compartidos (${width}px)`,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const path of ['/contact','/about','/catalogo','/checkout','/product']){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  const footer=page.locator('.tt-footer');
  await expect(footer.locator('.tt-footer-hours')).toContainText('09:00 a 22:00');
  await expect(footer.locator('.tt-footer-wa-text')).toHaveText('Escribir por WhatsApp');
  await expect(footer.locator('.tt-footer-wa')).toHaveCSS('color','rgb(255, 255, 255)');
  if(path==='/contact')await expect(page.locator('.tt-contact-wa-link')).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(footer.locator('.tt-footer-wa-text')).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(footer.locator('.tt-footer-wa svg')).toHaveCSS('color','rgb(255, 255, 255)');
 }
});
