const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { parse, serialize } = require('parse5');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const markup = fs.readFileSync('envios.html', 'utf8');
const scripts = [];
function collect(node) {
  if (node.tagName === 'script' && node.childNodes?.some(child =>
    child.nodeName === '#text' && child.value.includes("onSnapshot(doc(db, 'settings', 'shippingRates')"))) {
    scripts.push(`<script type="module">${serialize(node)}</script>`);
  }
  node.childNodes?.forEach(collect);
}
collect(parse(markup));
if (scripts.length !== 1) throw new Error('Debe existir un único módulo real de tarifas en Envíos');
const fixture = removeFixtureScripts(markup).replace('</body>', `${scripts[0]}</body>`);

async function openShipping(page, ready = undefined) {
  await page.addInitScript(() => {
    window.__shippingCalls = 0;
    window.__appCheck = new Promise(resolve => { window.__resolveAppCheck = resolve; });
  });
  await page.route('**/js/core/firebase/firebase.js*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export const db={};export const appCheckReady=window.__appCheck;'
  }));
  await page.route('**/firebase-firestore.js', route => route.fulfill({
    contentType: 'application/javascript', body: `
      export const doc=(_db,...parts)=>parts.join('/');
      export function onSnapshot(path,next,error){window.__shippingCalls++;window.__shippingPath=path;window.__shippingNext=data=>next({exists:()=>data!==null,data:()=>data});window.__shippingError=()=>error(new Error('isolated-shipping-unavailable'));return()=>{};}`
  }));
  await page.route('**/js/core/store/configuracion-publica.js*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export function onPublicSettings(next){window.__generalNext=next;next({deliveryCities:[{name:"Asunción",price:15000}],encomiendaCities:[]});return()=>{};}'
  }));
  await page.route('**/__shipping-runtime', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('/__shipping-runtime');
  await page.waitForFunction(() => typeof window.__generalNext === 'function');
  if (ready !== undefined) await page.evaluate(value => window.__resolveAppCheck(value), ready);
}

test('Envíos espera App Check, comparte configuración y renderiza tarifas con su import real', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openShipping(page);
  expect(await page.evaluate(() => window.__shippingCalls)).toBe(0);
  await expect(page.locator('#envios-delivery-cities')).toContainText('Asunción');
  await page.evaluate(() => window.__resolveAppCheck(true));
  await page.waitForFunction(() => window.__shippingCalls === 1);
  expect(await page.evaluate(() => window.__shippingPath)).toBe('settings/shippingRates');
  await page.evaluate(() => window.__shippingNext({deliveryCities:[{name:'San Lorenzo Centro',price:1},{name:'San Lorenzo Alrededores',price:2},{name:'<img src=x onerror=alert(1)>',price:null}],encomiendaCities:[]}));
  await expect(page.locator('#envios-delivery-cities li')).toHaveCount(2);
  await expect(page.locator('#envios-delivery-cities')).toContainText('San Lorenzo');
  await expect(page.locator('#envios-delivery-cities')).toContainText('25.000');
  await expect(page.locator('#envios-delivery-cities')).toContainText('Consultar precio');
  await expect(page.locator('#envios-delivery-cities img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('App Check no disponible conserva el respaldo y no abre una lectura no autorizada', async ({ page }) => {
  await openShipping(page, false);
  await page.evaluate(() => window.__generalNext({deliveryCities:[{name:'Luque',price:18000}],encomiendaCities:[]}));
  await expect(page.locator('#envios-delivery-cities')).toContainText('Luque');
  expect(await page.evaluate(() => window.__shippingCalls)).toBe(0);
});

test('las tarifas ausentes reutilizan el respaldo y el error de lectura queda visible', async ({ page }) => {
  await openShipping(page, true);
  await page.waitForFunction(() => window.__shippingCalls === 1);
  await page.evaluate(() => {window.__shippingNext(null);window.__generalNext({deliveryCities:[{name:'Luque',price:18000}],encomiendaCities:[]});});
  await expect(page.locator('#envios-delivery-cities')).toContainText('Luque');
  await page.evaluate(() => window.__shippingError());
  await expect(page.locator('#envios-delivery-cities')).toContainText('Consultanos por WhatsApp');
});
