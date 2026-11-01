const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const root=path.resolve(__dirname,'../..');
async function users(page,width) {
  const stubs={
    '/js/core/firebase/firebase.js': 'export const auth=window.__auth;export const db={};',
    '/js/core/auth/coordinador-sesion.js': 'export const subscribeAuthState=fn=>fn(window.__auth.currentUser);',
    '/js/core/auth/roles.js': "export const SUPER_ADMIN='owner@example.test';export const ROLE_LABELS={client:'Cliente'};",
    '/js/core/auth/contrato-cuentas-generado.js': "export const ASSIGNABLE_ROLES=['client'];",
    '/firebase-firestore.js': `export const collection=(...args)=>args;export const doc=(db,collection,uid)=>uid;export const query=(...args)=>args;export const where=(...args)=>args;export const limit=n=>n;export const getDocs=async()=>({docs:[]});export async function getDoc(uid){await new Promise(r=>setTimeout(r,uid==='slow'?120:0));return {id:uid,exists:()=>true,data:()=>window.__users[uid]||{name:'Solicitud anterior'}};}`,
  };
  await page.addInitScript(()=>{window.__auth={currentUser:{uid:'owner',email:'owner@example.test'}};window.__users={first:{uid:'first',name:'Primera cuenta QA',email:'primera@example.test',photoURL:'/assets-tintin/images/admin/app-icon-512.png'},second:{uid:'second',name:'Segunda cuenta QA',email:'segunda@example.test'}};});
  await load(page,width,'admin.html',{respond:async(route,url)=>{
    const stub=stubs[url.pathname] || (url.hostname==='www.gstatic.com'?stubs['/firebase-firestore.js']:null);
    if(stub) {await route.fulfill({contentType:'text/javascript',body:stub,headers:{'Access-Control-Allow-Origin':'*'}});return true;}
    if(['/js/admin/users/ficha-usuario-admin.js','/js/admin/users/perfil-usuario-superadmin.js','/js/components/images/utilidades-imagenes.js','/js/orders/pedidos-prueba.mjs'].includes(url.pathname)) {await route.fulfill({path:path.join(root,url.pathname),contentType:'text/javascript'});return true;}
    return false;
  }});
  await page.evaluate(async paths=>{
    await import(paths[0]);
    await import(paths[1]);
    await window.openClientFichaByUid('first');
  }, ['/js/admin/users/perfil-usuario-superadmin.js','/js/admin/users/ficha-usuario-admin.js']);
}
for(const width of [320,390,540,768,1440]) test('tarjeta legible conserva correo y acciones '+width,async({page},info)=>{
  await users(page,width);
  await page.evaluate(()=>{
    window.closeClientFicha();
    document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id==='section-usuarios'));
    const row=document.createElement('tr');row.dataset.userUid='first';
    row.innerHTML='<td><input class="user-row-check" data-id="first" type="checkbox" aria-label="Seleccionar Primera cuenta QA"></td><td><div class="adm-tbl-avatar"><img src="/assets-tintin/images/admin/app-icon-512.png" alt=""></div></td><td><strong>Primera cuenta QA</strong></td><td>nombre.apellido@correo-de-ejemplo.com</td><td>0981000000</td><td>Cliente</td><td>Activo</td><td>0</td><td>Gs. 0</td><td><div><button type="button" id="qa-original-block" class="adm-btn adm-btn-sm adm-btn-outline">Bloquear</button></div></td>';
    row.querySelector('#qa-original-block').addEventListener('click',()=>window.__originalAction=true);
    document.getElementById('users-tbody').replaceChildren(row);
  });
  if(width>768) {
    await expect(page.locator('#qa-original-block')).toBeVisible();
    await expect(page.getByRole('button',{name:'Acciones del usuario',exact:true})).toBeHidden();
    await expect(page.locator('#users-tbody td').nth(4)).toBeVisible();
    expect(await page.locator('#users-tbody tr').evaluate(n=>getComputedStyle(n).display)).toBe('table-row');
    return;
  }
  await expect(page.locator('#users-bulk-toolbar')).toBeHidden();
  await expect(page.locator('#check-all-users')).toBeVisible();
  expect((await page.locator('#check-all-users').boundingBox()).width).toBeGreaterThanOrEqual(22);
  await expect(page.getByRole('button',{name:'Ver ficha',exact:true})).toBeVisible();
  const row=page.locator('#users-tbody tr');
  await expect(row.locator('td').nth(4)).toBeHidden();
  const email=await row.locator('td').nth(3).boundingBox();
  const card=await row.boundingBox();
  expect(email.width).toBeGreaterThan(card.width*0.8);
  expect(email.height).toBeLessThan(60);
  await row.getByRole('button',{name:'Acciones del usuario',exact:true}).click();
  await row.getByRole('button',{name:'Mostrar más datos',exact:true}).click();
  await expect(row.locator('td').nth(4)).toBeVisible();
  await expect(row.locator('td').nth(7)).toBeVisible();
  await expect(row.locator('td').nth(8)).toBeVisible();
  await row.getByRole('button',{name:'Acciones del usuario',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('button',{name:'Acciones del usuario',exact:true})).toHaveAttribute('aria-expanded','false');
  await row.getByRole('button',{name:'Acciones del usuario',exact:true}).click();
  await page.locator('#qa-original-block').click();
  await row.getByRole('button',{name:'Ocultar datos adicionales',exact:true}).click();
  expect(await page.evaluate(()=>window.__originalAction)).toBe(true);
  await row.evaluate(n=>n.scrollIntoView({block:'center'}));
  await row.screenshot({path:info.outputPath(`tarjeta-usuario-${width}.png`)});
  await page.getByRole('button',{name:'Primera cuenta QA',exact:true}).click();
  await expect(page.locator('#client-ficha-body').getByRole('heading',{name:'Primera cuenta QA'})).toBeVisible();
});
