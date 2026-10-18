'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {mockRuntime,fixtureHtml}=require('./helpers/admin-commerce-fixture.cjs');
const root=path.resolve(__dirname,'../..');
const shell=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const formStart=shell.indexOf('<div class="adm-card" id="prod-form-card"');
const form=shell.slice(formStart,shell.indexOf('\n    </div>\n\n    <!-- ===================== COLECCIONES',formStart));
const promptStart=shell.indexOf('<div id="unsaved-modal"');
const prompt=shell.slice(promptStart,shell.indexOf('\n<!-- ═',promptStart));

async function openEditor(page,width,height){
 await page.setViewportSize({width,height});await mockRuntime(page);
 const html=fixtureHtml();const start=html.indexOf('<div class="adm-card" id="prod-form-card"');
 const full=html.slice(0,start)+form+html.slice(html.indexOf('</section>',start));
 await page.route('https://tintin.test/admin-commerce-fixture',route=>route.fulfill({contentType:'text/html',body:full}));
 await page.goto('https://tintin.test/admin-commerce-fixture');
 await expect(page.locator('[data-action="product-new"]')).toBeVisible();
 await page.evaluate(()=>{
  window.prodNuevo=()=>{document.getElementById('prod-form-card').style.display='';};
  window.prodCancelForm=()=>{window.__calls.push(['prodCancelForm']);document.getElementById('prod-form-card').style.display='none';};
  window.prodGuardar=()=>window.__calls.push(['prodGuardar',document.getElementById('prod-name').value,document.getElementById('prod-price').value]);
 });
 await page.locator('[data-action="product-new"]').click();await expect(page.locator('#prod-editor-section')).toBeVisible();
}

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]]){
 test(`editor real por secciones conserva campos y acciones ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height);
  const card=page.locator('#prod-form-card'),section=page.locator('#prod-editor-section');
  await expect(page.locator('#prod-name')).toBeVisible();await expect(page.locator('#prod-price')).toBeHidden();
  await page.locator('#prod-name').fill('Anillo de prueba');
  await section.selectOption('prices');await page.locator('#prod-price').fill('45000');
  await section.selectOption('inventory');await expect(page.locator('#prod-cost-unit')).toBeVisible();
  // El selector de secciones no puede descubrir campos que el controlador oculte por rol.
  await page.locator('#prod-inventory-fields').evaluate(el=>el.style.display='none');
  await section.selectOption('all');await expect(page.locator('#prod-cost-unit')).toBeHidden();
  await expect(page.locator('#prod-name')).toHaveValue('Anillo de prueba');await expect(page.locator('#prod-price')).toHaveValue('45000');
  await expect(page.locator('#prod-name')).toHaveAccessibleName('Nombre *');
  const boxes=await card.locator('input:not([type=hidden]),textarea,select,button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,x:r.x,right:r.right,width:r.width};}).filter(r=>r.width>0));
  for(const box of boxes){expect(box.x,box.id).toBeGreaterThanOrEqual(0);expect(box.right,box.id).toBeLessThanOrEqual(width+1);}
  const save=page.locator('#prod-save-btn');
  if(width<1200){
   await expect(card).toHaveAttribute('role','dialog');
   const rect=await card.boundingBox();expect(rect.x).toBe(0);expect(rect.y).toBe(0);expect(rect.width).toBe(width);expect(rect.height).toBe(height);
   const footer=await save.boundingBox();expect(footer.y).toBeGreaterThan(0);expect(footer.y+footer.height).toBeLessThanOrEqual(height);
   await page.locator('.tt-product-editor-actions button').last().focus();await page.keyboard.press('Tab');
   await expect(card.locator('.adm-card-head button')).toBeFocused();
  }
  await save.click();expect(await page.evaluate(()=>window.__calls.at(-1))).toEqual(['prodGuardar','Anillo de prueba','45000']);
  await page.screenshot({path:`test-results/products-editor-phase1-${width}x${height}.png`});
  await card.locator('.adm-card-head button').click();await expect(card).toBeHidden();await expect(page.locator('[data-action="product-new"]')).toBeFocused();
 });
}

test('selección persiste al filtrar; barra móvil, lista y foco de búsqueda operan sin perder datos',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');
 await page.locator('[data-select-product="p-reloj"]').check();
 const bar=page.locator('.tt-product-selection');await expect(bar).toBeInViewport();
 await page.locator('[data-action="products-filters"]').click();await page.getByLabel('Filtrar por colección',{exact:true}).selectOption('aros');
 await expect(bar).toContainText('1 fuera del filtro');await expect(page.locator('[data-select-product="p-aro"]')).toBeVisible();
 await page.locator('[data-action="products-reset-filters"]').click();await expect(page.locator('[data-select-product="p-reloj"]')).toBeChecked();
 await page.locator('[data-action="products-view-list"]').click();await expect(page.locator('[data-action="products-view-list"]')).toHaveAttribute('aria-pressed','true');
 const rows=await page.locator('#tt-commerce-products tbody tr').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().y));expect(rows[1]).toBeGreaterThan(rows[0]+50);
 const search=page.getByRole('searchbox',{name:'Buscar productos por nombre, colección o etiqueta'});await search.pressSequentially('Reloj',{delay:220});await expect(search).toBeFocused();await expect(search).toHaveValue('Reloj');
 await page.locator('[data-action="products-bulk-panel"]').click();await page.locator('[data-action="products-bulk-deactivate"]').click();
 expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='prodToggleActive'))).toEqual([['prodToggleActive','p-reloj',true]]);
});

test('ficha móvil a pantalla completa atrapa Tab, cierra con Escape y devuelve el foco',async({page})=>{
 await page.setViewportSize({width:844,height:390});await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');
 const opener=page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open');await opener.click();
 const drawer=page.locator('#tt-commerce-drawer');await expect(drawer).toHaveAttribute('role','dialog');await expect(drawer).toHaveClass(/open/);
 await expect.poll(async()=>Math.round((await drawer.boundingBox()).x)).toBe(0);
 const rect=await drawer.boundingBox();expect(rect.x).toBe(0);expect(rect.width).toBe(844);expect(rect.height).toBe(390);
 const controls=drawer.locator('button:visible');await controls.last().focus();await page.keyboard.press('Tab');await expect(controls.first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(drawer).toBeHidden();await expect(opener).toBeFocused();
});

test('foto vertical, horizontal y faltante no se recorta ni invade controles',async({page})=>{
 await page.setViewportSize({width:320,height:700});await mockRuntime(page);
 await page.route('https://img.test/**',route=>route.request().url().includes('rota') ? route.abort() : route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="120"><rect width="900" height="120" fill="pink"/></svg>'}));
 await page.goto('https://tintin.test/admin-commerce-fixture');
 await page.evaluate(()=>{window.__productRows[0].data.image='https://img.test/rota.webp';window.__publishProducts();});
 await expect(page.locator('tr[data-id="p-reloj"] .tt-commerce-thumb')).toContainText('Imagen no disponible');
 for(const row of await page.locator('#tt-commerce-products tbody tr').all()){
  const photo=await row.locator('.tt-commerce-thumb').boundingBox(),check=await row.locator('.tt-commerce-product-check').boundingBox(),menu=await row.locator('.tt-commerce-product-menu button').boundingBox();
  expect(check.width).toBeGreaterThanOrEqual(44);expect(menu.width).toBeGreaterThanOrEqual(44);expect(photo.y).toBeGreaterThanOrEqual(check.y+check.height);expect(photo.y).toBeGreaterThanOrEqual(menu.y+menu.height);
 }
 await expect(page.locator('tr[data-id="p-pulsera"] img')).toHaveCSS('object-fit','contain');
 await page.locator('#tt-commerce-products').screenshot({path:'test-results/products-phase1-mobile.png'});
});

test('la biblioteca queda sobre el editor y Escape cierra sólo la biblioteca',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(()=>{
  const overlay=document.createElement('div');overlay.className='tt-mlib-overlay';overlay.style.cssText='position:fixed;inset:0;background:white;z-index:9000';
  const close=document.createElement('button');close.className='tt-mlib-close';close.textContent='Cerrar';close.onclick=()=>overlay.remove();overlay.append(close);document.body.append(overlay);
 });
 await expect(page.getByRole('dialog',{name:'Elegir imagen de la biblioteca'})).toBeVisible();await expect(page.getByRole('button',{name:'Cerrar biblioteca'})).toBeFocused();
 expect(await page.evaluate(()=>document.elementFromPoint(20,20).closest('.tt-mlib-overlay')!==null)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('.tt-mlib-overlay')).toHaveCount(0);await expect(page.locator('#prod-form-card')).toBeVisible();
});

test('cancelar respeta el guard nativo: seguir editando conserva datos y descartar vuelve al listado',async({page})=>{
 await openEditor(page,390,844);
 await page.evaluate(markup=>{const parsed=new DOMParser().parseFromString(markup,'text/html');document.body.append(parsed.getElementById('unsaved-modal'));},prompt);
 await page.addScriptTag({url:'/js/admin/proteccion-cambios-pendientes-admin.js'});
 await page.evaluate(()=>{
  window.AdminUnsaved.register('primary-editor',{root:'#prod-form-card',serialize:()=>JSON.stringify({name:document.getElementById('prod-name').value,price:document.getElementById('prod-price').value}),save:window.prodGuardar});
  window.prodCancelForm=()=>window.AdminUnsaved.requestNavigation(()=>{window.AdminUnsaved.unregister('primary-editor');document.getElementById('prod-form-card').style.display='none';});
 });
 await page.locator('#prod-editor-section').selectOption('prices');
 expect(await page.evaluate(()=>window.AdminUnsaved.isDirty('primary-editor'))).toBe(false);
 await page.locator('#prod-price').fill('15000');
 await page.locator('.adm-card-head button[onclick="prodCancelForm()"]').click();
 const guard=page.locator('#unsaved-modal');await expect(guard).toBeVisible();
 const box=await page.locator('#unsaved-modal-stay').boundingBox();expect(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x+5,y+5)?.closest('#unsaved-modal')),box)).toBe(true);
 await page.locator('#unsaved-modal-stay').click();await expect(guard).toBeHidden();await expect(page.locator('#prod-price')).toHaveValue('15000');
 await page.keyboard.press('Escape');await expect(guard).toBeVisible();await page.locator('#unsaved-modal-discard').click();await expect(page.locator('#prod-form-card')).toBeHidden();
});

test('validación revela campos y pone el mensaje en foco sin perder valores',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-name').fill('Anillo');await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(()=>{const error=document.getElementById('prod-form-error');error.textContent='Ingresá un precio válido';error.style.display='block';});
 await expect(page.locator('#prod-form-error')).toBeFocused();await expect(page.locator('#prod-form-error')).toBeInViewport();await expect(page.locator('#prod-editor-section')).toHaveValue('all');await expect(page.locator('#prod-name')).toHaveValue('Anillo');await expect(page.locator('#prod-price')).toBeVisible();
});

test('selección entre páginas y barra sobre navegación sin tapar el último producto',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');
 await page.evaluate(()=>{
  window.__productRows=Array.from({length:32},(_,i)=>({id:`p-${String(i).padStart(2,'0')}`,data:{name:`Producto ${String(i).padStart(2,'0')}`,price:25000,stock:i,active:true}}));window.__publishProducts();
  const tabs=document.createElement('nav');tabs.id='adm-mobile-tabs';tabs.textContent='Navegación';tabs.style.cssText='position:fixed;bottom:0;left:0;width:100%;height:64px;background:white;z-index:430';document.body.append(tabs);
  window.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(30);
 await page.locator('[data-select-product="p-00"]').check();await page.locator('[data-action="products-page-next"]').click();
 await page.locator('[data-select-product="p-31"]').check();await expect(page.locator('.tt-product-selection')).toContainText('2 seleccionados');
 const bar=await page.locator('.tt-product-selection').boundingBox(),nav=await page.locator('#adm-mobile-tabs').boundingBox();expect(bar.y+bar.height).toBeLessThanOrEqual(nav.y);
 await page.locator('[data-action="products-page-prev"]').click();await expect(page.locator('[data-select-product="p-00"]')).toBeChecked();
 await page.locator('[data-action="products-clear-selection"]').click();await expect(page.locator('.tt-product-selection')).toBeHidden();
});

test('foto principal completa en editor real y rotación conserva borrador y pie de acciones',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-name').fill('Borrador conservado');await page.locator('#prod-editor-section').selectOption('photos');
 await page.route('https://tintin.test/js/components/images/biblioteca-multimedia.js*',route=>route.fulfill({contentType:'text/javascript',body:'export const deleteMediaByUrlIfUnused=()=>{throw Error("Sin escrituras");};export const deleteMediaItem=deleteMediaByUrlIfUnused;export const uploadImageToLibrary=deleteMediaByUrlIfUnused;'}));
 await page.evaluate(async url=>{const {attachImageUploadWidget}=await import(url);attachImageUploadWidget(document.getElementById('prod-image-widget'),{label:'Imagen principal',value:'https://img.test/principal.webp'});},'/js/components/images/carga-imagenes.js?fixture');
 const image=page.locator('#prod-image-widget .tt-iuw-preview');await expect(image).toBeVisible();expect((await image.boundingBox()).width).toBeGreaterThan(250);await expect(image.locator('img')).toHaveCSS('object-fit','contain');
 await page.setViewportSize({width:844,height:390});await expect(page.locator('#prod-form-card')).toHaveCSS('height','390px');
 await expect(page.locator('#prod-name')).toHaveValue('Borrador conservado');await expect(page.locator('#prod-save-btn')).toBeInViewport();
 await page.screenshot({path:'test-results/product-editor-photo-landscape.png'});
});

test('salir de Productos libera el scroll y regresar conserva el editor visible',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-name').fill('Borrador');
 await page.evaluate(()=>document.getElementById('section-productos').style.display='none');
 await expect(page.locator('html')).not.toHaveClass(/tt-product-editor-open/);
 await expect(page.locator('html')).not.toHaveCSS('overflow','hidden');
 await page.evaluate(()=>document.getElementById('section-productos').style.display='');
 await expect(page.locator('html')).toHaveClass(/tt-product-editor-open/);await expect(page.locator('#prod-name')).toHaveValue('Borrador');
});
