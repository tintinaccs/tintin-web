const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const ficha=fs.readFileSync('js/admin/users/ficha-usuario-admin.js','utf8').replace(/^import[\s\S]*?;\n/gm,'');
const app=fs.readFileSync('js/admin/admin-app.js','utf8');
const overlayA11y=app.slice(app.indexOf('(function setupAdminOverlayA11y()'),app.indexOf('// ---- MOBILE TAB LOGOUT ----'));
async function mountFicha(page,photo=false){
 await page.evaluate(({source,photo,overlayA11y})=>{
  window.qaUser={uid:'qa-user',name:'Cliente de prueba',email:'cliente@example.test',role:'client',photoURL:photo?'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="pink"/></svg>':''};
  const script=document.createElement('script');script.nonce='dGludGluLWZpeHR1cmU=';
  script.textContent=`const SUPER_ADMIN='owner@example.test', ROLE_LABELS={client:'Cliente'},ASSIGNABLE_ROLES=['client'];
  const auth={currentUser:{uid:'owner',email:SUPER_ADMIN}},db={};
  const subscribeAuthState=callback=>callback(auth.currentUser);
  const doc=()=>({}),collection=()=>({}),query=()=>({}),where=()=>({}),limit=()=>({});
  const getDoc=async()=>({exists:()=>true,id:'qa-user',data:()=>window.qaUser}),getDocs=async()=>({docs:[]});
  const ordersForView=value=>value,orderDisplayCode=value=>value.id;
  const sanitizeImageUrl=value=>value.startsWith('data:image/')?value:'';
  `+source+overlayA11y;
  document.head.append(script);
 },{source:ficha,photo,overlayA11y});
}
for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]])test(`ficha y foto accesibles ${width}x${height}`,async({page})=>{
 await load(page,width);await page.setViewportSize({width,height});
 await page.evaluate(()=>{
  document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-usuarios'));
  document.getElementById('users-tbody').innerHTML='<tr data-user-uid="qa-user"><td><input type="checkbox" class="user-row-check" data-id="qa-user"></td><td><span class="adm-tbl-avatar">CP</span></td><td>Cliente de prueba</td><td>cliente@example.test</td><td>0981</td><td><select><option>Cliente</option></select></td><td>Activo</td><td>0</td><td>0</td><td><div><button type="button">Bloquear</button></div></td></tr>';
 });
 await mountFicha(page);
 const overlay=page.locator('#client-ficha-overlay');
 await page.locator('.user-row-check').check();await expect(overlay).toBeHidden();
 await page.locator('#users-tbody select').selectOption({label:'Cliente'});await expect(overlay).toBeHidden();
 await page.locator('.adm-tbl-avatar').click();await expect(overlay).toBeVisible();
 await expect(overlay).toContainText('Cliente de prueba');await expect(overlay).toContainText('Cliente');
 await page.getByRole('button',{name:'Ampliar foto de perfil'}).click();
 await expect(page.locator('dialog')).toBeVisible();await expect(page.locator('.ficha-avatar-large')).toHaveText('CD');
 await page.keyboard.press('Escape');await expect(page.locator('dialog')).toHaveCount(0);await expect(overlay).toBeVisible();
 await page.getByRole('button',{name:'Cerrar ficha de cliente'}).click();await expect(overlay).toBeHidden();
 await page.locator('#users-tbody tr').focus();await page.keyboard.press('Enter');await expect(overlay).toBeVisible();
 await page.keyboard.press('Escape');await expect(overlay).toBeHidden();
 if(width<=1024){
  const wrap=page.locator('#section-usuarios .adm-table-wrap');
  expect(await wrap.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await expect(page.locator('#users-tbody td').nth(3)).toHaveAttribute('data-label',/Email|Correo/i);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('la foto real se amplía sin recortar y se cierra con X',async({page})=>{
 await load(page,390);await mountFicha(page,true);
 await page.evaluate(()=>window.openClientFichaByUid('qa-user'));
 await page.getByRole('button',{name:'Ampliar foto de perfil'}).click();
 const img=page.locator('.ficha-avatar-large img');await expect(img).toBeVisible();
 expect(await img.evaluate(node=>getComputedStyle(node).objectFit)).toBe('contain');
 await page.getByRole('button',{name:'× Cerrar',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);
});
for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1024,768]])test(`listas pobladas sin deslizamiento lateral ${width}x${height}`,async({page})=>{
 await load(page,width);await page.setViewportSize({width,height});
 const sections=await page.locator('.adm-content > .adm-section').evaluateAll(nodes=>nodes.map(node=>node.id));
 let checked=0;
 for(const id of sections){
  const count=await page.evaluate(id=>{
   document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id===id));
   let count=0;
   for(const table of document.getElementById(id).querySelectorAll('.adm-table-wrap table')){
    const headings=[...table.querySelectorAll('thead tr:last-child th')];if(!headings.length)continue;
    const body=table.tBodies[0]||table.createTBody();body.replaceChildren();
    const row=body.insertRow();
    headings.forEach((heading,index)=>{
     const cell=row.insertCell();cell.textContent=index===0?'Cliente con nombre y apellidos completos':'dato-muy-largo-para-comprobar-que-todos-los-campos-entran@example.test';
     if(index===headings.length-1){const button=document.createElement('button');button.className='adm-btn';button.textContent='Ver detalles del registro';cell.replaceChildren(button);}
    });count++;
   }return count;
  },id);
  if(!count)continue;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const overflow=await page.locator(`#${id} .adm-table-wrap`).evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&node.scrollWidth>node.clientWidth+1).map(node=>({html:node.outerHTML.slice(0,250),width:node.clientWidth,scroll:node.scrollWidth})));
  expect(overflow,id).toEqual([]);checked+=count;
 }
 expect(checked).toBeGreaterThan(8);
});
