const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const browserModule = modulePath => '/' + path.relative(process.cwd(), require.resolve(modulePath)).split(path.sep).join('/');
const login = fs.readFileSync('login.html', 'utf8');
const ensure = login.slice(login.indexOf('async function ensureProfileComplete'), login.indexOf('\nfunction isUnavailableAuthIdentity'));
const showError = login.slice(login.indexOf('function showError('), login.indexOf('function showActiveSessionState('));
const script = `
import {getProfileCompletionPlan,buildMissingProfilePatch,isValidCustomerName} from '${browserModule('../../js/pages/profile/configuracion-inicial-perfil.mjs')}';
import {findCountryByCode,normalizePhone,isValidPhone,isRealisticPhone,isNationalMobileInput} from '${browserModule('../../js/components/forms/utilidades-telefono.js')}';
import {withDeadline} from '${browserModule('../../js/core/auth/estado-perfil-sesion.mjs')}';
const db={},SUPER_ADMIN='official@example.com',AUTH_NETWORK_DEADLINE_MS=1000;
const PROFILE_STATE={MISSING:'MISSING',INCOMPLETE:'INCOMPLETE',COMPLETE:'COMPLETE',ERROR:'ERROR'};
const PROFILE_ACTION={CREATE_THEN_COMPLETE_PROFILE:'create'},resolveProfileAction=()=> 'complete';
const doc=()=>({}),serverTimestamp=()=>new Date(),detectAuthMethod=()=> 'emailOtp';
const ensureUserProfile=async()=>{},clearProfileGateCache=()=>{},recordAuthDiagnostic=()=>{};
const logoutSession=async()=>{},hideLoginOverlay=()=>{window.__loading=false;},revealLoginSurface=()=>{},showOverlay=()=>{window.__loading=true;};
const hideMessages=()=>document.getElementById('login-error').classList.remove('show');
const populateCountrySelect=()=>{};
${showError}
let stored={profileStatus:'incomplete'};
window.__calls=[];window.__aborted=0;window.__writes=0;window.__allowReservation=false;
window.fetch=async(_url,options)=>{
  window.__calls.push(JSON.parse(options.body));
  options.signal.addEventListener('abort',()=>window.__aborted++);
  if(window.__calls.length===1)return{ok:true,json:()=>new Promise(resolve=>{window.__resolveOld=()=>resolve({valid:true,available:false});})};
  return{ok:true,json:async()=>({valid:false,available:false})};
};
const reservePhone=async()=>{if(!window.__allowReservation)throw Object.assign(new Error('reservation-unavailable'),{code:'reservation-unavailable'});};
const readProfileState=async()=>{const plan=getProfileCompletionPlan({profile:stored,user:{email:'isolated@example.com'},role:'client',superAdminEmail:SUPER_ADMIN});return{state:plan.skip?PROFILE_STATE.COMPLETE:PROFILE_STATE.INCOMPLETE,plan};};
const runTransaction=async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({...stored})}),set:(_ref,patch)=>{stored={...stored,...patch};window.__writes++;}});
${ensure}
document.documentElement.classList.remove('login-auth-pending','tt-color-scheme-pending','tt-store-gate-pending');
const user={uid:'isolated',email:'isolated@example.com',getIdToken:async()=> 'isolated'};
ensureProfileComplete(user,'client').then(()=>{window.__complete=true;window.__saved=stored;});
`;
const fixture=removeFixtureScripts(login).replace('</body>',`<script type="module">${script}</script></body>`);

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`WhatsApp cancela la comprobación tardía y permite reintentar sin perder datos a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width===1024?600:900 });
    await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-09T12:01:00Z'));
    await page.route('**/__availability-recovery', route => route.fulfill({ contentType:'text/html', body:fixture }));
    await page.goto('/__availability-recovery');
    const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone'),button=page.locator('#btn-save-profile');
    await name.fill('María González');await phone.fill('0912345678');await button.click();
    await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);
    await expect(phone).toBeDisabled();await expect(button).toBeDisabled();
    expect(await page.evaluate(()=>window.__loading)).toBe(true);
    await page.clock.fastForward(1000);
    await expect(button).toBeEnabled();await expect(phone).toBeEnabled();
    expect(await page.evaluate(()=>window.__aborted)).toBe(1);
    expect(await page.evaluate(()=>window.__writes)).toBe(0);
    expect(await page.evaluate(()=>window.__loading)).toBe(false);
    expect(await phone.inputValue()).toBe('0912345678');expect(await name.inputValue()).toBe('María González');
    await expect(page.locator('#login-phone-error')).toBeEmpty();
    await phone.fill('0918765432');await page.evaluate(()=>{window.__resolveOld();window.__allowReservation=true;});
    await expect(page.locator('#login-phone-error')).toBeEmpty();
    await button.click();await page.waitForFunction(()=>window.__complete);
    const state=await page.evaluate(()=>({calls:window.__calls,writes:window.__writes,saved:window.__saved}));
    expect(state.calls).toEqual([{phone:'0912345678',country:'PY'},{phone:'0918765432',country:'PY'}]);
    expect(state.writes).toBe(1);expect(state.saved.phone).toBe('+595918765432');
    expect(state.saved.profileStatus).toBe('active');
  });
}

for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900]]) {
  test(`nombre y WhatsApp inválidos enfocan el error y permiten avanzar después en ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/__availability-recovery',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto('/__availability-recovery');
    const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone'),button=page.locator('#btn-save-profile');
    for(const invalid of ['Pedro','Jo Pérez','Pedro Pe']) {
      await name.fill(invalid);await phone.fill('0981123456');await button.click();
      await expect(name).toBeFocused();await expect(page.locator('#login-first-name-error')).toContainText('tres letras');
      expect(await page.evaluate(()=>window.__calls.length)).toBe(0);
    }
    await name.fill('Pedro González');await phone.fill('98112345');await button.click();
    await expect(phone).toBeFocused();await expect(page.locator('#login-phone-error')).toContainText('válido');
    await phone.fill('981123456');
    await page.evaluate(()=>{window.__calls.push({fixture:true});window.__allowReservation=true;});
    await button.click();await page.waitForFunction(()=>window.__complete);
    expect(await page.evaluate(()=>window.__saved.name)).toBe('Pedro González');
    expect(await page.evaluate(()=>window.__saved.phone)).toBe('+595981123456');
    expect(await page.evaluate(()=>window.__loading)).toBe(true);
  });
}

test('corrige un nombre corto precargado por Google y completa el registro',async({page})=>{
  await page.route('**/__short-provider',route=>route.fulfill({contentType:'text/html',body:fixture.replace("let stored={profileStatus:'incomplete'};","let stored={profileStatus:'incomplete',name:'Jo Smith'};")}));
  await page.goto('/__short-provider');
  const name=page.locator('#login-profile-first-name');await expect(name).toBeVisible();await expect(name).toHaveValue('Jo Smith');
  await name.fill('Pedro González');await page.locator('#login-profile-phone').fill('981123456');
  await page.evaluate(()=>{window.__calls.push({fixture:true});window.__allowReservation=true;});
  await page.locator('#btn-save-profile').click();await page.waitForFunction(()=>window.__complete);
  expect(await page.evaluate(()=>window.__saved.name)).toBe('Pedro González');
  expect(await page.evaluate(()=>window.__saved.profileStatus)).toBe('active');
});

const registrationViewports = [
  [320,568],[360,640],[375,812],[390,844],[414,896],[430,932],
  [844,390],[768,1024],[1024,768],[820,1180],[1180,820],
  [1280,720],[1440,900],[1920,1080],
];

async function openRegistration(page, provider, width, height) {
  await page.setViewportSize({width,height});
  const providerFixture = fixture.replace("detectAuthMethod=()=> 'emailOtp'", `detectAuthMethod=()=> '${provider}'`);
  await page.route('**/__registration-matrix', route => route.fulfill({contentType:'text/html',body:providerFixture}));
  await page.goto('/__registration-matrix');
  await page.evaluate(() => {
    window.__allowReservation = true;
    window.fetch = async (_url, options) => {
      window.__calls.push(JSON.parse(options.body));
      return {ok:true,json:async()=>({valid:true,available:true})};
    };
  });
}

test.describe('Continuar conserva el mismo contrato en Google y correo y en todas las orientaciones', () => {
  test.use({hasTouch:true});
  for (const provider of ['google','emailOtp']) for (const [width,height] of registrationViewports) {
    test(`registro ${provider} con touch y validación en ${width}x${height}`, async ({page}) => {
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await openRegistration(page,provider,width,height);
      const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone'),button=page.locator('#btn-save-profile');
      await name.fill('Pedro');await phone.fill('0981123456');await button.tap();
      await expect(name).toBeFocused();await expect(name).toHaveAttribute('aria-invalid','true');
      const invalidPosition=await name.boundingBox();
      expect(invalidPosition.y).toBeGreaterThanOrEqual(0);
      expect(invalidPosition.y+invalidPosition.height).toBeLessThanOrEqual(height);
      expect(await page.evaluate(()=>window.__writes)).toBe(0);
      await name.fill('Pedro González');await phone.fill('98112345');await button.tap();
      await expect(phone).toBeFocused();await expect(page.locator('#login-phone-error')).toContainText('válido');
      await phone.fill(provider==='google'?'0981123456':'981123456');
      await button.tap();await page.waitForFunction(()=>window.__complete);
      const saved=await page.evaluate(()=>({profile:window.__saved,writes:window.__writes,calls:window.__calls}));
      expect(saved.writes).toBe(1);expect(saved.calls).toHaveLength(1);
      expect(saved.profile.name).toBe('Pedro González');expect(saved.profile.phone).toBe('+595981123456');
      expect(saved.profile.profileStatus).toBe('active');
      for (const field of ['dob','username','savedLocation']) expect(saved.profile).not.toHaveProperty(field);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
      expect(errors).toEqual([]);
    });
  }
});

for (const provider of ['google','emailOtp']) for (const [width,height] of [[390,844],[1024,768],[1280,720]]) {
  test(`registro ${provider} avanza con Enter y valida desde el teclado en ${width}x${height}`,async({page})=>{
    await openRegistration(page,provider,width,height);
    const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone');
    await name.fill('Pedro');await name.press('Enter');
    await expect(name).toBeFocused();await expect(page.locator('#login-first-name-error')).toContainText('dos palabras');
    expect(await page.evaluate(()=>window.__writes)).toBe(0);
    await name.fill('Pedro González');await name.press('Enter');
    await expect(phone).toBeFocused();
    await phone.fill('981123456');await phone.press('Enter');
    await expect.poll(()=>page.evaluate(()=>window.__writes),{timeout:5000}).toBe(1);
    await page.waitForFunction(()=>window.__complete);
    expect(await page.evaluate(()=>window.__saved.profileStatus)).toBe('active');
  });
}
