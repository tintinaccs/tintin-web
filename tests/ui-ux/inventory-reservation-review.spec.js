'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/admin/importacion-admin.js'), 'utf8');
const handler = source.slice(source.indexOf('  async function exportInventoryReservationReview('), source.indexOf('\n  function openLocalDb()'));

test('revisión protegida del panel lee reservas y descarga solo la proyección', async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><button id="review">Descargar revisión de reservas</button><script type="module">
    const reviewModuleUrl = new URL('/js/core/store/revision-reservas-inventario.mjs', location.href);
    reviewModuleUrl.searchParams.set('v', 'tintin-20261003-inventory-review-1');
    const { buildInventoryReservationReview } = await import(reviewModuleUrl.href);
    const PROJECT_ID='demo-tintin';const state={busy:false};window.__allowed=true;window.__reads=[];window.__downloads=[];window.__messages=[];
    const isSuperAdmin=()=>window.__allowed;
    const readCollection=async name=>{window.__reads.push(name);if(window.__fail)throw new Error('Lectura incompleta');return [{id:'o',inventoryState:'reserved',items:[{id:'p',qty:2}],userEmail:'PRIVATE_EMAIL',shipping:{address:'PRIVATE_ADDRESS'},payment:{secret:'PRIVATE_SECRET'}}]};
    const downloadJson=(name,data)=>window.__downloads.push({name,data});const toast=(text,error)=>window.__messages.push({text,error});const renderPreview=()=>{};
    ${handler}
    document.getElementById('review').addEventListener('click',exportInventoryReservationReview);window.__ready=true;
  </script></body></html>`;
  await page.route('**/reservation-review-fixture.html', route => route.fulfill({ contentType:'text/html', body:html }));
  await page.goto('/reservation-review-fixture.html');
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => { window.__allowed=false; });
  await page.getByRole('button', { name:'Descargar revisión de reservas', exact:true }).click();
  expect(await page.evaluate(() => window.__reads)).toEqual([]);
  await page.evaluate(() => { window.__allowed=true; });
  await page.getByRole('button', { name:'Descargar revisión de reservas', exact:true }).click();
  await page.waitForFunction(() => window.__downloads.length === 1);
  const data=await page.evaluate(() => window.__downloads[0].data);
  expect(data.readOnly).toBe(true);
  expect(data.summary.reservedQty).toBe(2);
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE_/);
  expect(await page.evaluate(() => window.__reads)).toEqual(['orders']);
  await page.evaluate(() => { window.__fail=true; });
  await page.getByRole('button', { name:'Descargar revisión de reservas', exact:true }).click();
  await page.waitForFunction(() => window.__messages.some(message => message.error));
  expect(await page.evaluate(() => window.__downloads.length)).toBe(1);
  await expect(page.getByRole('button', { name:'Descargar revisión de reservas', exact:true })).toBeEnabled();
});
