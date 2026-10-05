const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'js/pages/profile/mayorista-perfil.js'), 'utf8').replace(/^import .*;\r?\n/gm, '');
const helper = fs.readFileSync(path.join(root, 'js/core/auth/estado-perfil-sesion.mjs'), 'utf8').replace(/\r\n/g, '\n');
const deadlineStart = helper.indexOf('export function withDeadline');
const deadline = helper.slice(deadlineStart, helper.indexOf('\n}\n', deadlineStart) + 2).replace('export ', '');

for (const width of [390, 768, 1440]) test(`Mayoristas recupera envío y limpia la cuenta anterior a ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/**', route => route.abort());
  await page.clock.install();
  await page.setContent('<main style="max-width:800px;margin:auto"><section id="perfil-wholesale-card"><div id="perfil-wholesale-root"></div></section></main>');
  await page.addScriptTag({ content: deadline + `
    const AUTH_STATES={RESTORING:'restoring',UNKNOWN:'unknown'},db={},appCheckReady=Promise.resolve(true);
    let sessionUser; const getSessionUser=()=>sessionUser;
    const subscribeSession=fn=>window.sessionCallback=fn;
    const collection=()=>({}),where=()=>({}),limit=()=>({}),query=()=>({});
    const onSnapshot=(_,fn)=>{window.quoteCallbacks.push(fn);return()=>{};};window.quoteCallbacks=[];
    const authenticatedFetch=(_,init)=>{window.requestSignal=init.signal;return new Promise(()=>{});};
    const apiFailureMessage=()=>'';
  ` + source + `
    window.setWholesaleUser=uid=>{sessionUser=uid?{uid}:null;window.sessionCallback({status:'ready',user:sessionUser});};
    window.seedWholesaleLine=()=>{state.lines=[{id:'p1',name:'Aros',qty:10,variant:''}];renderLines();};
  ` });
  await page.evaluate(() => { window.setWholesaleUser('alice'); window.seedWholesaleLine(); });
  await page.getByRole('button', { name: 'Enviar cotización' }).click();
  await expect(page.getByRole('button', { name: 'Enviar cotización' })).toBeDisabled();
  await page.clock.runFor(15001);
  await expect(page.getByRole('button', { name: 'Enviar cotización' })).toBeEnabled();
  await expect(page.locator('[data-wholesale-message]')).toContainText('Revisá tu conexión');
  expect(await page.evaluate(() => window.requestSignal.aborted)).toBe(true);
  await expect(page.locator('[data-wholesale-lines]')).toContainText('Aros');
  await page.evaluate(() => window.setWholesaleUser('bob'));
  await expect(page.locator('[data-wholesale-lines]')).not.toContainText('Aros');
  await page.evaluate(() => window.quoteCallbacks[0]({docs:[{id:'alice-private',data:()=>({quoteNumber:'ALICE-PRIVATE',items:[]})}]}));
  await expect(page.locator('[data-wholesale-quotes]')).not.toContainText('ALICE-PRIVATE');
});
