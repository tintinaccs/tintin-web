const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'login.html'),'utf8');
const handler=html.slice(html.indexOf('let _googleLoginToken'),html.indexOf('// ======== TOGGLE'));
const deadline=fs.readFileSync(path.join(root,'js/core/auth/estado-perfil-sesion.mjs'),'utf8').split('export function withDeadline')[1];
const overlay=html.slice(html.indexOf('function showOverlay()'),html.indexOf('function showError('));
const harness=`
${'function withDeadline'+deadline}
let explicitLoginInProgress=false,loginPersistenceReady=true,loginSessionGeneration=0;
const GOOGLE_POPUP_DEADLINE_MS=120000,AUTH_NETWORK_DEADLINE_MS=15000,googleRedirectWasExpected=false;
const auth={currentUser:null},provider={},authPersistenceReady=Promise.resolve();
let rejectPopup;window.__calls={popup:0,finish:0,show:0};
const layer=document.createElement('div');layer.id='auth-test-overlay';layer.hidden=true;layer.textContent='Preparando cuenta';layer.style.cssText='position:fixed;inset:0;background:#F8AACA;z-index:999999';document.body.appendChild(layer);
window.TintinLoader={show(){window.__calls.show++;layer.hidden=false;},hide(){layer.hidden=true;},beginWait(){},endWait(){},setText(){}};
function signInWithPopup(){window.__calls.popup++;return new Promise((resolve,reject)=>{rejectPopup=reject;});}
window.__rejectPopup=code=>rejectPopup({code});
function signInWithRedirect(){throw new Error('No redirect in this fixture');}
function finishGoogleLogin(){window.__calls.finish++;return Promise.resolve();}
function markGoogleRedirectPending(){}function clearGoogleRedirectPending(){}
function googleIdleLabel(){return 'Continuar con Google';}
function hideMessages(){document.getElementById('login-error').classList.remove('show');}
function showError(message){const e=document.getElementById('login-error');e.textContent=message;e.classList.add('show');}
function errMsg(code){return code;}
${overlay}
revealLoginSurface();
${handler}
`;
async function load(page,width){
  await page.setViewportSize({width,height:900});await page.clock.install();
  // HTML/CSS and actual handlers; original scripts and all business traffic
  // are blocked. No Firebase identity, OAuth window, email or profile write.
  await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().endsWith('/auth-loader-fixture.js')?harness:''}));
  await page.route('**/auth-loader-fixture',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-src 'none'"},body:html}));
  await page.goto('/auth-loader-fixture');await page.addScriptTag({url:'/auth-loader-fixture.js'});
}
for(const width of [390,768,1440]){
  test(`Google espera visible y una cancelación permite reintentar a ${width}px`,async({page})=>{
    await load(page,width);const button=page.locator('#btn-google');await button.click();
    await expect(button).toBeDisabled();await expect(button).toHaveAttribute('aria-busy','true');
    await expect(page.locator('#btn-google-label')).toHaveText('Esperando Google…');
    await expect(page.locator('#auth-test-overlay')).toBeHidden();
    await expect(page.locator('#login-email-input')).toBeVisible();
    await page.evaluate(()=>window.__rejectPopup('auth/popup-closed-by-user'));
    await expect(button).toBeEnabled();await expect(page.locator('#auth-test-overlay')).toBeHidden();
    await button.click();expect(await page.evaluate(()=>window.__calls.popup)).toBe(2);
    await page.evaluate(()=>window.__rejectPopup('auth/network-request-failed'));
    await expect(button).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('popup sin respuesta termina en un error visible, sin éxito ni navegación',async({page})=>{
  await load(page,390);await page.locator('#btn-google').click();await page.clock.runFor(120001);
  await expect(page.locator('#btn-google')).toBeEnabled();
  await expect(page.locator('#login-error')).toHaveText('auth/popup-timeout');
  await expect(page.locator('#auth-test-overlay')).toBeHidden();
  expect(await page.evaluate(()=>window.__calls.finish)).toBe(0);
});
