'use strict';
const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { admin: policy } = require('../../config/csp-runtime.json');
const { openProductSaveFixture } = require('./helpers/product-save-fixture.cjs');

test('los eventos del editor renderizado son compatibles con la CSP publicada', async ({ page }) => {
  await openProductSaveFixture(page, 1366, 900, { fullShell: true, photos: true, workflow: true });
  await page.evaluate(() => window.qaProductController.workspace.ready);
  const handlers = await page.locator('body').evaluate(root => [...root.querySelectorAll('*')].flatMap(element =>
    [...element.attributes].filter(attribute => /^on[a-z]+$/i.test(attribute.name)).map(attribute => ({ tag: element.tagName, id: element.id, event: attribute.name, value: attribute.value }))));
  const missing = handlers.filter(handler => !policy.includes(`'sha256-${createHash('sha256').update(handler.value).digest('base64')}'`));
  expect(missing).toEqual([]);
});

test('las filas de productos con identificadores reales no generan handlers bloqueados', async ({ page }) => {
  const source=readFileSync('js/admin/admin-app.js','utf8');
  const helpers=source.slice(source.indexOf('function escapeHtmlAdmin('),source.indexOf('\n}',source.indexOf('function escapeHtmlAdmin('))+2);
  const {adminEventAttributes}=await import('../../js/admin/eventos-dinamicos-admin.mjs');
  const row=source.slice(source.indexOf('function productRowHtml('),source.indexOf('function renderProductosTable('));
  const render=Function('_selectedProducts','sanitizeImageUrl','can','currentRole','roleCanDo','adminEventAttributes',helpers+row+'return productRowHtml;')(new Set(),()=>'',()=>true,'superadmin',()=>true,adminEventAttributes);
  await page.setContent('<table><tbody>'+render({_docId:'fixture-real-id',name:'Producto de prueba',price:30000,stock:2,active:true})+'</tbody></table>');
  const handlers=await page.locator('body').evaluate(root=>[...root.querySelectorAll('*')].flatMap(element=>[...element.attributes].filter(attribute=>/^on[a-z]+$/.test(attribute.name)).map(attribute=>attribute.value)));
  expect(handlers.filter(value=>!policy.includes(`'sha256-${createHash('sha256').update(value).digest('base64')}'`))).toEqual([]);
});

test('acciones dinámicas conservan argumentos, propagación y selección con CSP estricta', async ({page})=>{
  await openProductSaveFixture(page,1366,900);
  await page.evaluate(async()=>{
    const module=await import('https://tintin.test/js/admin/eventos-dinamicos-admin.mjs');
    const meta=document.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content="script-src-attr 'none'";document.head.append(meta);
    window.qaCspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.qaCspViolations.push(event.effectiveDirective));
    window.qaActionCalls=[];
    for(const action of ['prodEditar','prodEliminar','updateUserRole','toggleClientSelected','toggleShipCitySelect','toggleOrderDetail'])window[action]=(...args)=>window.qaActionCalls.push({action,args:args.map(value=>value instanceof Element?value.id:value)});
    const root=document.createElement('section');root.id='qa-events';document.querySelector('#prod-form-card .adm-card-body').prepend(root);
    window.qaStopAdminEvents=module.installAdminEvents(root);
    if(module.installAdminEvents(root)!==window.qaStopAdminEvents)throw Error('Instalación duplicada');
    const tricky='Producto "doble" <img id="qa-injected" src=x onerror=alert(1)> & único';
    window.qaTrickyName=tricky;
    root.innerHTML=`<div ${module.adminEventAttributes('click','toggleOrderDetail',['detail'])}><div id="qa-stop"><button id="qa-edit" ${module.adminEventAttributes('click','prodEditar',['id-con-guion'])}><span>Editar</span></button><button id="qa-delete" ${module.adminEventAttributes('click','prodEliminar',['id',tricky])}>Eliminar</button></div></div><select id="qa-role" ${module.adminEventAttributes('change','updateUserRole',['uid',{control:'value'},'qa@example.invalid'])}><option>admin</option><option>agent</option></select><input id="qa-check" type="checkbox" ${module.adminEventAttributes('click','toggleClientSelected',['qa@example.invalid',{control:'checked'}])}><button id="qa-element" ${module.adminEventAttributes('click','toggleShipCitySelect',['interior',{control:'element'}])}>Elegir</button><button id="qa-unknown" data-admin-click="eval" data-admin-click-args='["alert(1)"]'>Ignorar</button>`;
    document.getElementById('qa-stop').addEventListener('click',event=>event.stopPropagation());
  });
  await page.locator('#qa-edit span').click();
  await page.locator('#qa-delete').click();
  await page.locator('#qa-role').selectOption('agent');
  await page.locator('#qa-check').check();
  await page.locator('#qa-element').click();
  await page.locator('#qa-unknown').click();
  expect(await page.evaluate(()=>window.qaActionCalls)).toEqual([
    {action:'prodEditar',args:['id-con-guion']},
    {action:'prodEliminar',args:['id',await page.evaluate(()=>window.qaTrickyName)]},
    {action:'updateUserRole',args:['uid','agent','qa@example.invalid']},
    {action:'toggleClientSelected',args:['qa@example.invalid',true]},
    {action:'toggleShipCitySelect',args:['interior','qa-element']},
  ]);
  await expect(page.locator('#qa-injected')).toHaveCount(0);
  expect(await page.evaluate(()=>window.qaCspViolations)).toEqual([]);
  await page.evaluate(()=>window.qaStopAdminEvents());
  await page.locator('#qa-edit').click();
  expect(await page.evaluate(()=>window.qaActionCalls.length)).toBe(5);
});

for(const mode of ['inactive','active','archived','draft'])test(`guardado del editor ${mode} conserva la visibilidad y el progreso`,async({page})=>{
  const product={name:'Producto inicial',category:'qa-tablet',price:30000,priceBefore:null,stock:4,active:mode!=='inactive',publicationStatus:'active',oferta:false,destacado:false,description:'Descripción completa',imageUrl:'https://img.test/cover.webp'};
  await openProductSaveFixture(page,390,844,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/existing',product]]});
  await page.evaluate(()=>window.qaProductController.workspace.ready);
  await page.evaluate(()=>window.qaProductController.workspace.leave());
  await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('existing');});
  await page.evaluate(()=>window.qaProductController.workspace.ready);
  await page.locator('#prod-publicationStatus').evaluate((select,value)=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},mode);
  await page.locator('#prod-name').fill('Cambios '+mode);
  await page.evaluate(()=>window.qaProductController.workspace.save());
  expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').name)).toBe('Producto inicial');
  if(mode!=='draft'){
    await page.evaluate(()=>window.qaHtmlResponse=true);
    await page.locator('#prod-save-btn').click();
    await expect(page.locator('.tt-work-status')).toHaveAttribute('data-state','error');
    await expect(page.locator('#prod-form-error')).toBeHidden();
    expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').name)).toBe('Producto inicial');
    const retry=page.getByRole('button',{name:'Reintentar',exact:true});
    await retry.evaluate(button=>button.addEventListener('click',()=>{window.qaHtmlResponse=false;},{capture:true,once:true}));
    await retry.click();
  }else await page.locator('#prod-save-btn').click();
  await expect(page.locator('#prod-form-card')).toBeHidden();
  const saved=await page.evaluate(()=>({product:window.qaProductStore.get('products/existing'),work:window.qaProductStore.get('productEditorWorkspaces/qa-admin/items/existing')}));
  expect(saved.product.name).toBe(mode==='draft'?'Producto inicial':'Cambios '+mode);
  expect(saved.product.active).toBe(mode==='active' || mode==='draft');
  expect(saved.work.closed).toBe(mode!=='draft');
  expect(saved.work.snapshot.name).toBe('Cambios '+mode);
});
