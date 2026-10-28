const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../ui-ux/helpers/admin-panel-fixture.cjs');
const source = fs.readFileSync(path.join(__dirname, '../../js/admin/datos/busqueda-admin.mjs'), 'utf8')+'\n'+fs.readFileSync(path.join(__dirname, '../../js/admin/correos/correos-admin.js'), 'utf8').replace(/^import[^\n]*\n/gm,'');
const events = fs.readFileSync(path.join(__dirname, '../../js/admin/eventos-dinamicos-admin.mjs'), 'utf8');
for (const width of [390, 1440]) test(`Correos extraído conserva pestañas, datos vivos y cierre de escuchas ${width}`, async ({page}) => {
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await load(page,width);
  await page.evaluate(content => { const script=document.createElement('script'); script.nonce='dGludGluLWZpeHR1cmU='; script.type='module'; script.textContent=content; document.body.append(script); }, events.replace(/^export /gm,'')+'\n'+source.replace(/^export /gm,'')+`
    installAdminEvents();
    window.fixture={users:[{uid:'a',email:'a@example.test',name:'Primera',role:'client'}],orders:[],listeners:[],stopped:0,toasts:[],writes:[]};
    const noop=()=>{};
    const fixtureEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const batch=()=>({set:noop,update:noop,delete:noop,commit:async()=>{}});
    window.correos=iniciarCorreos({
      db:{},collection:(_,name)=>name,doc:(_,name,id)=>({name,id}),query:(ref)=>ref,orderBy:noop,limit:noop,
      getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),getDocsPaginated:async()=>({docs:[]}),
      setDoc:async(ref,data)=>fixture.writes.push(data),updateDoc:async()=>{},deleteDoc:async()=>{},addDoc:async()=>({id:'new'}),
      writeBatch:batch,serverTimestamp:()=>null,onSnapshot:(ref,callback)=>{fixture.listeners.push({ref,callback});return ()=>fixture.stopped++;},
      withAdminSiteChange:fn=>fn(),sendTestCustomerEmail:noop,sendTemplatedEmail:noop,sendBulkTemplatedEmail:noop,
      EMAIL_WEBHOOK_URL:'',ORDER_STATUS_LABELS:{},adminEventAttributes,addAdminBulkSelection:noop,rejectOversizedAdminBulkSelection:noop,
      batchUpdateChunked:noop,downloadCsv:noop,emailErrorMessage_:String,escapeHtmlAdmin:fixtureEscape,formatDate:()=>'',formatPrice:String,
      logAudit:noop,toast:message=>fixture.toasts.push(message),toJsDate_:value=>value?new Date(value):null,
      getCurrentUser:()=>fixture.user,getAllUsers:()=>fixture.users,getAllOrders:()=>fixture.orders
    });
    document.querySelectorAll('.adm-section').forEach(el=>el.classList.toggle('active',el.id==='section-correos'));
    await correos.loadCorreos();
  `);
  await expect.poll(async()=>{expect(errors).toEqual([]);return page.evaluate(()=>window.fixture?.listeners.length);}).toBe(4);
  expect(await page.evaluate(()=>fixture.toasts)).toEqual([]);
  await page.evaluate(()=>{fixture.user={email:'sesion-actual@example.test'};});
  await page.locator('[data-correos-tab="config"]').click();
  await page.locator('#btn-save-correos-config').click();
  await expect.poll(()=>page.evaluate(()=>fixture.writes.at(-1)?.updatedBy)).toBe('sesion-actual@example.test');
  const tabs=page.locator('#correos-tabs .correos-tab-btn');
  for(let i=0;i<await tabs.count();i++) {
    const tab=tabs.nth(i);const key=await tab.getAttribute('data-correos-tab');
    await tab.click();await expect(page.locator('#correos-panel-'+key)).toBeVisible();
  }
  await page.locator('[data-correos-tab="clientas"]').click();
  await expect(page.locator('#cli-tbody')).toContainText('Primera');
  await page.evaluate(()=>{fixture.users=[{uid:'b',email:'b@example.test',name:'Segunda',role:'client'}];fixture.orders=[{userId:'b',createdAt:new Date()}];correos.refreshCorreosClientasFromRealtime();});
  await expect(page.locator('#cli-tbody')).toContainText('Segunda');
  await expect(page.locator('#cli-tbody')).not.toContainText('Primera');
  await page.evaluate(()=>{correos.stopCorreosRealtimeListeners();correos.stopCorreosRealtimeListeners();});
  expect(await page.evaluate(()=>fixture.stopped)).toBe(4);
  await page.evaluate(()=>correos.loadCorreos());
  expect(await page.evaluate(()=>fixture.listeners.length)).toBe(8);
  expect(await page.evaluate(()=>fixture.toasts)).toEqual(['Configuración de correos guardada']);
  expect(errors).toEqual([]);
});
