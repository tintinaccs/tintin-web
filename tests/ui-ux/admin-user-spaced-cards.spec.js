const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const root=path.resolve(__dirname,'../..');
async function users(page,width,options={}) {
  const stubs={
    '/js/core/firebase/firebase.js': 'export const auth=window.__auth;export const db={};',
    '/js/core/auth/coordinador-sesion.js': 'export const subscribeAuthState=fn=>fn(window.__auth.currentUser);',
    '/js/core/auth/cliente-api-autenticado.js': `export const authenticatedFetch=async(_url,options)=>{const data=JSON.parse(options.body);window.__customerProfileWrites.push(data);return new Promise((resolve,reject)=>{window.__finishCustomerProfileWrite=(success)=>{if(success){Object.assign(window.__users[data.uid],data,{lastChangeId:data.changeId});resolve({ok:true,json:async()=>({ok:true,result:{}})});}else reject(new Error('Sin conexión'));};});};export const apiFailureMessage=(_r,fallback)=>fallback;`,
    '/js/core/auth/roles.js': "export const SUPER_ADMIN='owner@example.test';export const ROLE_LABELS={client:'Cliente'};",
    '/js/core/auth/contrato-cuentas-generado.js': "export const ASSIGNABLE_ROLES=['client'];",
    '/firebase-firestore.js': `export const collection=(...args)=>args;export const doc=(db,collection,uid)=>uid;export const query=(...args)=>args;export const where=(...args)=>args;export const limit=n=>n;export const startAfter=c=>c;export const getDocs=async()=>({docs:[]});export async function getDoc(uid){await new Promise(r=>setTimeout(r,uid==='slow'?120:0));return {id:uid,exists:()=>true,data:()=>window.__users[uid]||{name:'Solicitud anterior'}};}`,
  };
  await page.addInitScript(()=>{window.__auth={currentUser:{uid:'owner',email:'owner@example.test'}};window.__customerProfileWrites=[];window.__users={first:{uid:'first',name:'Primera cuenta QA',email:'primera@example.test',phone:'+595981123456',photoURL:'/assets-tintin/images/admin/app-icon-512.png'},second:{uid:'second',name:'Segunda cuenta QA',email:'segunda@example.test'}};});
  await load(page,width,'admin.html',{pathname:options.pathname,transform:options.startup ? html=>html.replace('<script src="js/cargador-pagina.js', '<script nonce="dGludGluLWZpeHR1cmU=" src="js/cargador-pagina.js') : undefined,respond:async(route,url)=>{
    const stub=stubs[url.pathname] || (url.hostname==='www.gstatic.com'?stubs['/firebase-firestore.js']:null);
    if(stub) {await route.fulfill({contentType:'text/javascript',body:stub,headers:{'Access-Control-Allow-Origin':'*'}});return true;}
    if([...(options.startup?['/js/cargador-pagina.js','/js/quality/calidad-interfaz.js','/js/admin/users/gestion-usuarios-admin.js']:[]),'/js/admin/users/ficha-usuario-admin.js','/js/admin/users/perfil-usuario-superadmin.js','/js/components/images/utilidades-imagenes.js','/js/orders/pedidos-prueba.mjs','/js/admin/users/historial-actividad.mjs','/js/analytics/contexto-actividad.mjs','/js/orders/importes-pedido.mjs'].includes(url.pathname)) {await route.fulfill({path:path.join(root,url.pathname),contentType:'text/javascript'});return true;}
    if(options.startup && /\.m?js$/.test(url.pathname) && !['/js/admin/maestro/espacio-modulos-admin.js','/js/admin/maestro/registro-maestro.js','/js/admin/maestro/buscador-modulos-admin.js','/js/admin/datos/busqueda-admin.mjs'].includes(url.pathname)) { await route.fulfill({contentType:'text/javascript',body:'export const onPrivacyConsentChange=()=>()=>{};'});return true; }
    return false;
  }});
  if(options.startup) return;
  await page.evaluate(async paths=>{
    await import(paths[0]);
    await import(paths[1]);
    await window.openClientFichaByUid('first');
  }, ['/js/admin/users/perfil-usuario-superadmin.js','/js/admin/users/ficha-usuario-admin.js']);
}

test('reintentar un guardado de cliente conserva el identificador del cambio', async ({ page }) => {
  await users(page, 390);
  const form = page.locator('.ficha-edit-form');
  const save = form.getByRole('button', { name: 'Guardar cambios' });
  const name = form.getByRole('textbox', { name: 'Nombre', exact: true });
  await form.getByRole('button', { name: 'Editar' }).click();
  await name.fill('María');
  await save.click();
  await expect.poll(() => page.evaluate(() => window.__customerProfileWrites.length)).toBe(1);
  await page.evaluate(() => window.__finishCustomerProfileWrite(false));
  await expect(form.getByRole('status')).toHaveText('Sin conexión');
  await expect(name).toBeEditable();
  await save.click();
  await expect.poll(() => page.evaluate(() => window.__customerProfileWrites.length)).toBe(2);
  const writes = await page.evaluate(() => window.__customerProfileWrites);
  expect(writes[1]).toEqual(writes[0]);
  await expect(name).toHaveJSProperty('readOnly', true);
  await page.evaluate(() => window.__finishCustomerProfileWrite(true));
  await expect(form.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(name).toHaveValue('María');
});

test('guardar una ficha cerrada no interrumpe la ficha que se abrió después', async ({ page }) => {
  await users(page, 390);
  const ficha = page.locator('#client-ficha-body');
  await ficha.getByRole('button', { name: 'Editar' }).click();
  await ficha.getByRole('textbox', { name: 'Nombre', exact: true }).fill('María');
  await ficha.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(() => page.evaluate(() => window.__customerProfileWrites.length)).toBe(1);
  await page.getByRole('button', { name: 'Cerrar ficha de cliente' }).click();
  await page.evaluate(() => window.openClientFichaByUid('second'));
  await expect(ficha.getByRole('heading', { name: 'Segunda cuenta QA' })).toBeVisible();
  await page.evaluate(async () => {
    window.__finishCustomerProfileWrite(true);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(ficha.getByRole('heading', { name: 'Segunda cuenta QA' })).toBeVisible();
});
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
  const menuWidth=await row.getByRole('button',{name:'Acciones del usuario',exact:true}).evaluate(n=>n.getBoundingClientRect().width);
  expect(menuWidth).toBeGreaterThanOrEqual(44);
  expect(menuWidth).toBeLessThanOrEqual(46);
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

for(const pathname of ['/admin','/admin.html']) test('el arranque real activa la tarjeta sin importar su helper manualmente '+pathname,async({page})=>{
  await users(page,390,{startup:true,pathname});
  await page.evaluate(()=>{
    document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id==='section-usuarios'));
    document.getElementById('users-tbody').innerHTML='<tr data-user-uid="first"><td><input class="user-row-check" data-id="first" type="checkbox"></td><td><div class="adm-tbl-avatar">QA</div></td><td><strong>Primera cuenta QA</strong></td><td>nombre.apellido@correo-de-ejemplo.com</td><td>0981000000</td><td>Cliente</td><td>Activo</td><td>0</td><td>Gs. 0</td><td><div><button class="adm-btn">Bloquear</button></div></td></tr>';
  });
  const row=page.locator('#users-tbody tr');
  await expect(row).toHaveClass(/tt-admin-user-card/);
  expect(await page.evaluate(()=>window.TintinAdminUsersPhase8Booted)).toBe(true);
  const menu=await row.getByRole('button',{name:'Acciones del usuario',exact:true}).boundingBox();
  expect(menu.width).toBeGreaterThanOrEqual(44);expect(menu.width).toBeLessThanOrEqual(46);
  const email=await row.locator('td').nth(3).boundingBox();const card=await row.boundingBox();
  expect(email.width).toBeGreaterThan(card.width*0.8);
});
