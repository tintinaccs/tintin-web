const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const handler = html.slice(html.indexOf('let _googleLoginToken'), html.indexOf('// ======== TOGGLE'));
const deadline = 'function withDeadline' + fs.readFileSync(path.join(root, 'js/core/auth/estado-perfil-sesion.mjs'), 'utf8').split('export function withDeadline')[1];
const markers = html.slice(html.indexOf('const GOOGLE_REDIRECT_PENDING_KEY'), html.indexOf('// Este aviso no modifica Auth'));
const redirectInit = html.slice(html.indexOf('const googleRedirectWasExpected'), html.indexOf('// El loader de marca'));
const overlay = html.slice(html.indexOf('function showOverlay()'), html.indexOf('function showError('));
const returned = html.slice(html.indexOf('async function handleGoogleRedirectReturn'), html.indexOf('// Si ya está logueada'));
const harness = `
if(location.pathname==='/google-chooser-fixture'){
  document.getElementById('fixture-account').onclick=()=>{sessionStorage.setItem('fixture-selected','1');location.assign('/auth-return-fixture');};
}else{
${deadline}
const auth={currentUser:null},provider={},authPersistenceReady=Promise.resolve();
let loginPersistenceReady=true,loginSessionGeneration=0;
window.__calls={redirect:0,popup:0,finish:0};window.__popupMode="blocked";window.__redirectMode='navigate';
function recordAuthDiagnostic(){}
${markers}
function getRedirectResult(){const selected=sessionStorage.getItem('fixture-selected')==='1';sessionStorage.removeItem('fixture-selected');return Promise.resolve(selected?{user:{uid:'isolated-fixture'}}:null);}
${redirectInit}
const layer=document.createElement('div');layer.id='auth-test-overlay';layer.hidden=true;layer.textContent='Abriendo Google';layer.style.cssText='position:fixed;inset:0;background:#F8AACA;z-index:999999';document.body.appendChild(layer);
window.TintinLoader={show(){layer.hidden=false;},hide(){layer.hidden=true;},beginWait(){},endWait(){},setText(){}};
function signInWithPopup(){window.__calls.popup++;if(window.__popupMode==='success')return Promise.resolve({user:{uid:'isolated-popup'}});if(window.__popupMode==='pending')return new Promise(resolve=>{window.__resolvePopup=resolve;});return Promise.reject({code:window.__popupMode==='blocked'?'auth/popup-blocked':window.__popupMode});}
function signInWithRedirect(){window.__calls.redirect++;if(window.__redirectMode==='error')return Promise.reject({code:'auth/network-request-failed'});if(window.__redirectMode==='navigate')location.assign('/google-chooser-fixture');return new Promise(()=>{});}
function finishGoogleLogin(){window.__calls.finish++;window.TintinLoader.hide();const status=document.createElement('p');status.id='fixture-confirmed';status.textContent='Credencial de prueba confirmada';document.body.appendChild(status);return Promise.resolve();}
function googleIdleLabel(){return 'Continuar con Google';}
function hideMessages(){document.getElementById('login-error').classList.remove('show');}
function showError(message){const e=document.getElementById('login-error');e.textContent=message;e.classList.add('show');}
function errMsg(code){return code;}
${overlay}
revealLoginSurface();
${handler}
${returned}
if(googleRedirectWasExpected)void handleGoogleRedirectReturn(null);
}
`;
const csp = "default-src 'self'; script-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-src 'none'";
async function load(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install();
  // Real HTML/CSS and handlers, with SDK/business traffic blocked. The chooser
  // is explicitly synthetic: no Google account, email or profile is created.
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/auth-loader-fixture.js') ? harness : '' }));
  await page.route(/\/(?:auth-loader-fixture|auth-return-fixture|google-chooser-fixture)$/, route => {
    const chooser = route.request().url().endsWith('/google-chooser-fixture');
    const body = chooser ? '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"></head><body><h1>Selector externo de prueba</h1><button id="fixture-account">Elegir cuenta de prueba</button><script src="/auth-loader-fixture.js"></script></body></html>' : html.replace('</body>', '<script src="/auth-loader-fixture.js"></script></body>');
    return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': csp }, body });
  });
  await page.goto('/auth-loader-fixture');
}
for (const width of [390, 768, 1440]) {
  test(`Popup bloqueado usa un único redirect y retorno a ${width}px`, async ({ page, context }) => {
    let popups = 0; page.on('popup', () => popups++);
    await load(page, width); await page.locator('#btn-google').click();
    await expect(page).toHaveURL(/google-chooser-fixture$/);
    await page.getByRole('button', { name: 'Elegir cuenta de prueba' }).click();
    await expect(page).toHaveURL(/auth-return-fixture$/);
    await expect(page.locator('#fixture-confirmed')).toBeVisible();
    expect(popups).toBe(0); expect(context.pages().length).toBe(1);
    expect(await page.evaluate(() => window.__calls.finish)).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('tt_google_redirect_pending'))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('un fallo al abrir Google permite reintentar con el formulario visible', async ({ page }) => {
  await load(page, 768); await page.evaluate(() => { window.__redirectMode = 'error'; });
  await page.locator('#btn-google').click();
  await expect(page.locator('#btn-google')).toBeEnabled();
  await expect(page.locator('#login-error')).toHaveText('auth/network-request-failed');
  await expect(page.locator('#auth-test-overlay')).toBeHidden();
  await page.locator('#btn-google').click();
  await expect(page.locator('#btn-google')).toBeEnabled();
  expect(await page.evaluate(() => window.__calls.redirect)).toBe(2);
});
test('redirect sin respuesta libera el formulario en 15 segundos', async ({ page }) => {
  await load(page, 390); await page.evaluate(() => { window.__redirectMode = 'pending'; });
  await page.locator('#btn-google').click(); await page.clock.runFor(15001);
  await expect(page.locator('#btn-google')).toBeEnabled();
  await expect(page.locator('#login-error')).toContainText('Google está tardando');
  await expect(page.locator('#auth-test-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__calls.finish)).toBe(0);
});
test('volver con Atrás sin elegir cuenta devuelve controles y no relanza Google', async ({ page }) => {
  await load(page, 390); await page.locator('#btn-google').click();
  await expect(page).toHaveURL(/google-chooser-fixture$/); await page.goBack();
  await expect(page.locator('#btn-google')).toBeEnabled();
  await expect(page.locator('#login-error')).toContainText(/Google.*(?:no pudo completar|no se completó)/);
  await expect(page.locator('#auth-test-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__calls.redirect)).toBe(0);
});

test('popup resuelto termina una vez sin redirección', async ({ page }) => {
  await load(page, 768); await page.evaluate(() => { window.__popupMode = 'success'; });
  await page.locator('#btn-google').click();
  await expect(page.locator('#fixture-confirmed')).toBeVisible();
  expect(await page.evaluate(() => window.__calls)).toEqual({ popup: 1, redirect: 0, finish: 1 });
  await expect(page).toHaveURL(/auth-loader-fixture$/);
});
for (const code of ['auth/popup-closed-by-user', 'auth/network-request-failed']) {
  test(`${code} devuelve controles sin abrir otro flujo`, async ({ page }) => {
    await load(page, 390); await page.evaluate(code => { window.__popupMode = code; }, code);
    await page.locator('#btn-google').click();
    await expect(page.locator('#login-error')).toHaveText(code);
    await expect(page.locator('#btn-google')).toBeEnabled();
    expect(await page.evaluate(() => window.__calls.redirect)).toBe(0);
  });
}
test('elegir cuenta puede tardar sin disparar un redirect paralelo', async ({ page }) => {
  await load(page, 1440); await page.evaluate(() => { window.__popupMode = 'pending'; });
  await page.locator('#btn-google').click(); await page.clock.runFor(60000);
  await expect(page.locator('#btn-google')).toBeDisabled();
  await expect(page.locator('#auth-test-overlay')).toBeVisible();
  expect(await page.evaluate(() => window.__calls.redirect)).toBe(0);
  await page.evaluate(() => window.__resolvePopup({ user: { uid: 'late-popup' } }));
  await expect(page.locator('#fixture-confirmed')).toBeVisible();
  expect(await page.evaluate(() => window.__calls.finish)).toBe(1);
});