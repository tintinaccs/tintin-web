'use strict';
const { test, expect } = require('@playwright/test');

test('el importador exige confirmación y revisión fresca sin escribir el catálogo', async ({ page }) => {
  await page.route('**/js/core/firebase/firebase.js?*', route => route.fulfill({ contentType:'application/javascript', body:'export const db = {};' }));
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js', route => route.fulfill({ contentType:'application/javascript', body:'export const doc=()=>{throw new Error("Unexpected write")}; export const runTransaction=doc; export const serverTimestamp=doc;' }));
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><section id="preview"><div id="before"></div></section><script type="module">
    const applyUrl=new URL('/js/admin/aplicar-importacion-admin.js',location.href);
    const identityUrl=new URL('/js/core/store/shopify-import-identity.mjs',location.href);
    const {createCatalogApply}=await import(applyUrl.href);
    const {reconcileShopifyImportIdentities}=await import(identityUrl.href);
    const source={product:{name:'Reloj Aurora',price:150,stock:2,category:'relojes',importFingerprint:'shopify:reloj-aurora',sourceMetadata:{platform:'shopify',handle:'reloj-aurora'},variants:[]},errors:[],warnings:[]};
    const catalog=[{id:'old',name:'Reloj Aurora',price:100,shopifyHandle:'reloj-aurora-antiguo'}];
    const state={records:reconcileShopifyImportIdentities([source],catalog),collections:[],source:'shopify-csv',jobId:'',busy:false,backupAt:0};
    window.__state=state;window.__catalog=catalog;window.__allowed=true;window.__writes=0;window.__refreshes=0;
    const node=(tag,cls='',value='')=>{const element=document.createElement(tag);element.className=cls;element.textContent=value;return element};
    const totals=()=>({invalid:state.records.filter(record=>record.errors.length).length});
    let view;const renderPreview=()=>view.render(totals());
    const forbidden=()=>{window.__writes++;throw new Error('Unexpected write')};
    view=createCatalogApply({state,isSuperAdmin:()=>window.__allowed,apiJob:forbidden,authenticatedFetch:forbidden,saveLocalJob:forbidden,renderPreview,
      refreshCatalogIdentitySnapshot:async()=>{window.__refreshes++;state.records=reconcileShopifyImportIdentities(state.records,catalog);renderPreview();return totals()},toast:()=>{},node});
    view.mount(document.getElementById('preview'),document.getElementById('before'));renderPreview();window.__render=renderPreview;window.__ready=true;
  </script></body></html>`;
  await page.route('**/identity-review-fixture.html', route => route.fulfill({ contentType:'text/html',body:html }));
  await page.goto('/identity-review-fixture.html');
  await page.waitForFunction(() => window.__ready);
  const decision=page.getByRole('button',{name:'Confirmar otro producto: Reloj Aurora',exact:true});
  page.once('dialog',dialog=>dialog.dismiss());
  await decision.click();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
  expect(await page.evaluate(()=>window.__state.records[0].identityStatus)).toBe('REVIEW_REQUIRED');
  await page.evaluate(()=>{window.__allowed=false});
  await decision.click();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
  await page.evaluate(()=>{window.__allowed=true;window.__catalog[0].price=101});
  page.once('dialog',dialog=>dialog.accept());
  await decision.click();
  await page.waitForFunction(()=>window.__refreshes===1 && !window.__state.busy);
  expect(await page.evaluate(()=>window.__state.records[0].identityStatus)).toBe('REVIEW_REQUIRED');
  page.once('dialog',dialog=>dialog.accept());
  await decision.click();
  await page.waitForFunction(()=>window.__state.records[0].identityStatus==='NEW_CONFIRMED_DISTINCT');
  expect(await page.evaluate(()=>window.__writes)).toBe(0);
  expect(await page.evaluate(()=>window.__state.records[0].errors)).toEqual([]);
  expect(await page.evaluate(()=>window.__catalog[0].id)).toBe('old');
  await page.evaluate(()=>{window.__state.records=[];window.__render()});
  await expect(page.getByText('Identidades a confirmar',{exact:true})).toBeHidden();
});


test('resume reconciles existing identities and syncs committed same-job products with newly created IDs', async ({ page }) => {
  await page.route('**/js/core/firebase/firebase.js?*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const db = {};' }));
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const doc = (_db, _collection, id) => id;
    export const serverTimestamp = () => 'fixture-time';
    export const runTransaction = async (_db, handler) => handler({
      get: async id => ({ exists: () => window.__catalog.some(item => item.id === id), data: () => window.__catalog.find(item => item.id === id) }),
      set: (id, data) => { window.__writes.push(id); window.__catalog.push({ id, ...data }); },
    });
  ` }));
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><section id="preview"><div id="before"></div></section><script type="module">
    const applyUrl = new URL('/js/admin/aplicar-importacion-admin.js', location.href);
    const coreUrl = new URL('/js/core/store/shopify-import-core.mjs', location.href);
    const identityUrl = new URL('/js/core/store/shopify-import-identity.mjs', location.href);
    const { createCatalogApply } = await import(applyUrl.href);
    const { stableProductDocumentId } = await import(coreUrl.href);
    const { reconcileShopifyImportIdentities } = await import(identityUrl.href);
    const records = ['resumed', 'foreign', 'new'].map(name => ({ product: { name: 'PRUEBA ' + name, importFingerprint: 'shopify:qa-' + name, category: 'prueba', price: 1000, stock: 0, active: false }, errors: [], warnings: [] }));
    window.__ids = records.map(record => stableProductDocumentId(record.product.importFingerprint));
    window.__catalog = [{ id: window.__ids[0], importJobId: 'imp_resume_fixture' }, { id: window.__ids[1], importJobId: 'other-import' }];
    window.__writes = []; window.__pushes = []; window.__transitions = [];
    window.tintinPushProductsToSheets = async ids => { window.__pushes.push([...ids]); return true; };
    const state = { records, source: 'shopify-csv', jobId: 'imp_resume_fixture', job: { status: 'RUNNING' }, busy: false, backupAt: 1, collections: [{ id: 'prueba', slug: 'prueba', name: 'PRUEBA' }] };
    const node = (tag, cls = '', value = '') => { const element = document.createElement(tag); element.className = cls; element.textContent = value; return element; };
    const totals = () => ({ invalid: state.records.filter(record => record.errors.length).length });
    let view; const renderPreview = () => view.render(totals());
    view = createCatalogApply({ state, isSuperAdmin: () => true, apiJob: async body => { window.__transitions.push(body); return { ...state.job, status: body.status }; },
      authenticatedFetch: () => { throw new Error('Unexpected request'); }, saveLocalJob: async () => {}, ensureReadyJob: async () => {}, takeBackup: async () => {},
      refreshCatalogIdentitySnapshot: async () => { state.existingProducts = [...window.__catalog]; state.records = reconcileShopifyImportIdentities(state.records, state.existingProducts); renderPreview(); return totals(); },
      renderPreview, toast: () => {}, node });
    view.mount(document.getElementById('preview'), document.getElementById('before')); renderPreview(); window.__ready = true;
  </script></body></html>`;
  await page.route('**/import-resume-fixture.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/import-resume-fixture.html');
  await page.waitForFunction(() => window.__ready === true);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Importar al catálogo', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Google Sheets sincronizado');
  const result = await page.evaluate(() => ({ ids: window.__ids, writes: window.__writes, pushes: window.__pushes, final: window.__transitions.at(-1) }));
  expect(result.writes).toEqual([result.ids[2]]);
  expect(result.pushes).toEqual([[result.ids[0], result.ids[2]]]);
  expect(result.final).toMatchObject({ status: 'COMPLETED', processed: 3, created: 2, skipped: 1 });
  await expect(page.getByRole('button', { name: 'Importar al catálogo', exact: true })).toBeDisabled();
});
