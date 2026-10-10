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
import {findCountryByCode,normalizePhone,isValidPhone,isRealisticPhone} from '${browserModule('../../js/components/forms/utilidades-telefono.js')}';
import {withDeadline} from '${browserModule('../../js/core/auth/estado-perfil-sesion.mjs')}';
const db={},SUPER_ADMIN='official@example.com',AUTH_NETWORK_DEADLINE_MS=1000;
const PROFILE_STATE={MISSING:'MISSING',INCOMPLETE:'INCOMPLETE',COMPLETE:'COMPLETE',ERROR:'ERROR'};
const PROFILE_ACTION={CREATE_THEN_COMPLETE_PROFILE:'create'},resolveProfileAction=()=> 'complete';
const doc=()=>({}),serverTimestamp=()=>new Date(),detectAuthMethod=()=> 'emailOtp';
const ensureUserProfile=async()=>{},clearProfileGateCache=()=>{},recordAuthDiagnostic=()=>{};
const logoutSession=async()=>{},hideLoginOverlay=()=>{},revealLoginSurface=()=>{},showOverlay=()=>{};
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

for (const width of [390, 768, 1440]) {
  test(`WhatsApp cancela la comprobación tardía y permite reintentar sin perder datos a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.route('**/__availability-recovery', route => route.fulfill({ contentType:'text/html', body:fixture }));
    await page.goto('/__availability-recovery');
    const name=page.locator('#login-profile-first-name'),phone=page.locator('#login-profile-phone'),button=page.locator('#btn-save-profile');
    await name.fill('María González');await phone.fill('0912345678');await button.click();
    await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);
    await expect(phone).toBeDisabled();await expect(button).toBeDisabled();
    await page.clock.fastForward(1000);
    await expect(button).toBeEnabled();await expect(phone).toBeEnabled();
    expect(await page.evaluate(()=>window.__aborted)).toBe(1);
    expect(await page.evaluate(()=>window.__writes)).toBe(0);
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
