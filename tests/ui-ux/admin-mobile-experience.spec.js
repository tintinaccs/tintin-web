const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const app=fs.readFileSync('js/admin/admin-app.js','utf8');
const originalWorkspaceCss=fs.readFileSync('css/admin/espacio-modulos-admin.css','utf8').split('/* Teléfonos:')[0];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
for(const [width,height] of [[320,568],[390,844],[540,960],[768,1024],[844,390]])test(`campos, pestañas y acciones de todos los módulos ${width}x${height}`,async({page})=>{
 await load(page,width,'admin.html',{mobile:true,sidebar:true,guard:true});await page.setViewportSize({width,height});
 const ids=await page.locator('.adm-content > .adm-section').evaluateAll(nodes=>nodes.map(node=>node.id));
 let fields=0;
 for(const id of ids){
  await page.evaluate(id=>document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id===id)),id);await settle(page);
  const failures=await page.locator(`#${id} :is(input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=hidden]),select,textarea)`).evaluateAll(nodes=>nodes.filter(node=>!node.disabled&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden').map(node=>{
   const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {id:node.id,width:b.width,left:b.left,right:b.right,height:b.height,font:parseFloat(s.fontSize)};
  }));
  for(const box of failures){expect(box.left,id+box.id).toBeGreaterThanOrEqual(-1);expect(box.right,id+box.id).toBeLessThanOrEqual(width+1);expect(box.height,id+box.id).toBeGreaterThanOrEqual(44);expect(box.font,id+box.id).toBeGreaterThanOrEqual(16);}
  fields+=failures.length;
  const tabs=await page.locator(`#${id} :is(.correos-tabs,.ship-tabs,.user-tabs)`).evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>({w:node.clientWidth,scroll:node.scrollWidth})));
  for(const tabsBox of tabs)expect(tabsBox.scroll,id).toBeLessThanOrEqual(tabsBox.w+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id).toBe(true);
 }
 expect(ids.length).toBeGreaterThan(20);expect(fields).toBeGreaterThan(30);
});
for(const [width,height] of [[820,1180],[1024,768],[1440,900],[2560,1440]])test(`tablet y escritorio conservan su distribución ${width}x${height}`,async({page})=>{
 await load(page,width);await page.setViewportSize({width,height});
 await page.evaluate(()=>{document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-usuarios'));});await settle(page);
 const snapshot=()=>page.locator('#section-usuarios :is(table,thead,tr,td,.adm-input,.adm-select,.adm-btn)').evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node),b=node.getBoundingClientRect();return {tag:node.tagName,display:s.display,width:b.width,height:b.height,padding:s.padding,font:s.fontSize,radius:s.borderRadius};}));
 const current=await snapshot();
 await page.evaluate(()=>{for(const link of document.querySelectorAll('link[rel=stylesheet]'))if(link.href.includes('/espacio-modulos-admin.css'))link.disabled=true;});
 await page.addStyleTag({content:originalWorkspaceCss});await settle(page);
 expect(await snapshot()).toEqual(current);
});
for(const [width,height] of [[320,568],[390,420],[844,390]])test(`modales largos conservan cierre y campos al reducir el viewport ${width}x${height}`,async({page})=>{
 await load(page,width);await page.setViewportSize({width,height});
 for(const id of ['order-edit-overlay','client-ficha-overlay','tpl-edit-overlay','tpl-preview-overlay','promo-confirm-overlay']){
  await page.evaluate(id=>{const overlay=document.getElementById(id);overlay.style.display='block';const body=overlay.querySelector('[id$="body"]');if(body){const area=document.createElement('div');area.style.height='1000px';body.append(area);}},id);await settle(page);
  const overlay=page.locator('#'+id);const close=overlay.locator('button').first();await expect(close).toBeVisible();
  const b=await close.boundingBox();expect(b.height,id).toBeGreaterThanOrEqual(44);expect(b.x,id).toBeGreaterThanOrEqual(0);expect(b.x+b.width,id).toBeLessThanOrEqual(width);
  await overlay.evaluate(node=>node.scrollTop=node.scrollHeight);await settle(page);
  const sticky=await close.boundingBox();expect(sticky.y,id).toBeGreaterThanOrEqual(0);expect(sticky.y+sticky.height,id).toBeLessThanOrEqual(height);
  await overlay.evaluate(node=>node.style.display='none');
 }
});
async function mountNavigation(page){
 // Controlador de navegación real, sin Auth ni funciones comerciales.
 const source=app.slice(app.indexOf('let admHistoryIndex ='),app.indexOf('// ---- ACCESIBILIDAD DE MODALES OPERATIVOS'));
 await page.evaluate(source=>{
  const script=document.createElement('script');script.nonce='dGludGluLWZpeHR1cmU=';
  script.textContent=`let admSuppressHashSync=false;const SECTION_PERMISSION={},SECTION_LABELS={},SUPER_ADMIN='owner@example.test';
  const currentRole='superadmin',currentUser={email:SUPER_ADMIN},can=()=>true,canDo=()=>true,toast=()=>{},closeMobileMore=()=>{};
  const mobileMoreGrid=null,mobileMoreToggle=null,topbarTitle=document.querySelector('.adm-topbar-title');
  const navItems=document.querySelectorAll('.adm-nav-item,.adm-mobile-tab');
  const loadUsers=()=>{},renderGeneralStatistics=()=>{},loadOrders=()=>{},loadProductos=()=>{},loadColecciones=()=>{},loadAuditLog=()=>{},loadCorreos=()=>{},loadConfig=()=>{},loadImportar=()=>{},loadPermisosSection=()=>{},loadApariencia=()=>{};
  const consumeAdminDestination=()=>{},adminReturnStorage=()=>({});
  window.allowNavigation=true;window.AdminUnsaved={requestNavigation:async go=>{if(!window.allowNavigation)return false;go();return true;}};
  `+source;document.head.append(script);
 },source);
}
test('teléfono conserva Atrás/Adelante, enlace profundo y borrador al cancelar',async({page})=>{
 await load(page,390,'admin.html',{mobile:true});await mountNavigation(page);
 await page.evaluate(()=>{history.replaceState(null,'','/fixture?section=dashboard&source=pwa');});
 await page.evaluate(()=>document.querySelector('#adm-nav [data-section="usuarios"]').click());await expect(page.locator('#section-usuarios')).toBeVisible();
 await page.locator('#adm-mobile-tabs [data-section="productos"]').click();await expect(page.locator('#section-productos')).toBeVisible();
 await page.goBack();await expect(page.locator('#section-usuarios')).toBeVisible();
 await page.goForward();await expect(page.locator('#section-productos')).toBeVisible();
 await page.evaluate(()=>{document.getElementById('prod-name').value='Borrador móvil';window.allowNavigation=false;});
 await page.goBack();await expect(page.locator('#section-productos')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('section'))).toBe('productos');
 await expect(page.locator('#prod-name')).toHaveValue('Borrador móvil');
 await page.evaluate(()=>window.allowNavigation=true);await page.goBack();await expect(page.locator('#section-usuarios')).toBeVisible();
 await page.goBack();await expect(page.locator('#section-dashboard')).toBeVisible();
});
test('acciones masivas contextuales conservan todas las opciones al seleccionar',async({page})=>{
 await load(page,390);
 await page.evaluate(()=>document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-usuarios')));
 const toolbar=page.locator('#users-bulk-toolbar');await expect(toolbar).toBeHidden();
 await toolbar.evaluate(node=>{node.classList.add('show');node.querySelector('.adm-bulk-count').textContent='1 seleccionado';});
 await expect(toolbar).toBeVisible();await expect(toolbar.getByRole('combobox')).toBeVisible();
 await expect(toolbar.getByRole('button',{name:'Aplicar rol'})).toBeVisible();
 await expect(toolbar.getByRole('button',{name:'Bloquear',exact:true})).toBeVisible();
 await expect(toolbar.getByRole('button',{name:'Exportar CSV'})).toBeVisible();
 expect(await toolbar.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await toolbar.evaluate(node=>node.classList.remove('show'));await expect(toolbar).toBeHidden();
});

test('campos de módulos tardíos conservan tipografía táctil sin depender de adm-input',async({page})=>{
 await load(page,390);
 const source=fs.readFileSync('js/admin/content/control-bienvenida-admin.js','utf8');
 const css=source.match(/st\.textContent\s*=\s*`([\s\S]*?)`/)[1];
 await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  document.querySelectorAll('.adm-section').forEach(node=>node.classList.remove('active'));
  const section=document.createElement('section');section.id='section-welcome';section.className='adm-section active';
  section.innerHTML='<div class="tt-welcome-admin-field"><label for="welcome-title">Título de bienvenida</label><input id="welcome-title" value="Bienvenida a Tintin"></div><div class="tt-welcome-admin-field"><label for="welcome-copy">Mensaje</label><textarea id="welcome-copy">Mensaje de prueba sin escritura</textarea></div>';
  document.querySelector('.adm-content').append(section);
 });
 await expect(page.locator('#section-welcome')).toHaveClass(/tt-admin-workspace/);
 await expect(page.locator('#welcome-copy')).toHaveCSS('min-height','86px');
 for(const id of ['welcome-title','welcome-copy']){
  const field=page.locator('#'+id);await expect(field).toHaveCSS('font-size','16px');
  expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);await expect(field).toBeEditable();
 }
});
