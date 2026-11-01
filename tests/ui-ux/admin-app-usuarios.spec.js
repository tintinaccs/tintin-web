// App móvil, Fase 3 · Usuarios: pulido de las tarjetas existentes (insignia
// legible, casilla grande, "⋯" centrado, sin etiqueta sobre los botones).
// Sin sesión ni datos reales: módulos de Firebase simulados como en admin-user-spaced-cards.
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
  await load(page,width,'admin.html',{mobile:true,sidebar:true,guard:true,respond:async(route,url)=>{
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

// Filas con el mismo HTML que genera renderUsers (admin-app.js): casilla dentro
// de label.adm-user-select, select de rol, insignia de estado y acciones.
const rows=page=>page.evaluate(()=>{
  window.closeClientFicha();
  document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id==='section-usuarios'));
  const mk=(uid,name)=>`<tr data-user-uid="${uid}"><td class="col-select"><label class="adm-user-select" aria-label="Seleccionar usuario"><input type="checkbox" class="user-row-check" data-id="${uid}"></label></td><td><div class="adm-tbl-avatar">QA</div></td><td><strong>${name}</strong></td><td style="font-size:12px;color:#713C53">correo.largo.de.prueba@example.test</td><td style="font-size:12px;color:#713C53">0981000000</td><td><select class="adm-select" style="width:auto;font-size:11px;padding:4px 8px"><option>Cliente</option><option>Admin</option></select></td><td><span class="adm-badge badge-entregado">Activo</span></td><td>3</td><td>Gs. 120.000</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="adm-btn adm-btn-sm adm-btn-outline">Bloquear</button></div></td></tr>`;
  document.getElementById('users-tbody').innerHTML=mk('first','Primera cuenta QA')+mk('second','Segunda cuenta QA');
});
for(const width of [320,390,540,768]) test(`Usuarios en modo app a ${width}px`,async({page})=>{
  await users(page,width);
  await rows(page);
  await expect(page.locator('#users-tbody .tt-admin-user-open').first()).toBeVisible();
  const m=await page.evaluate(()=>{
    const sec=document.getElementById('section-usuarios');
    const row=sec.querySelector('#users-tbody tr');
    const box=n=>n.getBoundingClientRect();
    const toggle=row.querySelector('.tt-admin-user-menu-toggle');
    return {
      app:document.documentElement.classList.contains('adm-app'),
      badge:parseFloat(getComputedStyle(row.querySelector('.adm-badge')).fontSize),
      check:box(row.querySelector('.adm-user-select input')),
      target:box(row.querySelector('.adm-user-select')),
      toggle:{align:getComputedStyle(toggle).alignItems,justify:getComputedStyle(toggle).justifyContent,h:box(toggle).height},
      actionsLabel:getComputedStyle(row.lastElementChild,'::before').content,
      fields:[...sec.querySelectorAll('#user-search,#user-sort,#users-tbody select')].map(n=>parseFloat(getComputedStyle(n).fontSize)),
      tiny:[...sec.querySelectorAll('*')].filter(n=>!n.closest('thead')&&n.getClientRects().length&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())&&parseFloat(getComputedStyle(n).fontSize)<11).map(n=>n.className||n.tagName),
      overflow:document.documentElement.scrollWidth>innerWidth,
    };
  });
  expect(m.app).toBe(true);
  expect(m.badge).toBeGreaterThanOrEqual(11);
  expect(m.check.width).toBeGreaterThanOrEqual(22);
  expect(Math.min(m.target.width,m.target.height)).toBeGreaterThanOrEqual(44);
  expect(m.toggle).toEqual({align:'center',justify:'center',h:expect.any(Number)});
  expect(m.toggle.h).toBeGreaterThanOrEqual(44);
  expect(['none','normal']).toContain(m.actionsLabel);
  for(const f of m.fields) expect(f).toBeGreaterThanOrEqual(16);
  expect(m.tiny).toEqual([]);
  expect(m.overflow).toBe(false);
});
for(const width of [820,1440]) test(`Usuarios conserva la tabla a ${width}px`,async({page})=>{
  await users(page,width);
  await rows(page);
  expect(await page.locator('#users-tbody tr').first().evaluate(n=>getComputedStyle(n).display)).toBe('table-row');
  await expect(page.locator('html')).not.toHaveClass(/\badm-app\b/);
});
