'use strict';
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
async function open(page,width=1366,height=768){await openProductSaveFixture(page,width,height,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);}
async function saveProgress(page){await page.evaluate(()=>window.qaProductController.workspace.save());await expect(page.locator('.tt-work-status')).toContainText('guardado en servidor');}
async function reopen(page,key,productId=null){await page.evaluate(({key,productId})=>window.prodContinuarBorrador(key,productId),{key,productId});await page.evaluate(()=>window.qaProductController.workspace.ready);}
test('crear incompleto, salir, recuperar, publicar, editar sin reemplazar público y recuperar cambios',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Borrador recuperable');
 await page.evaluate(()=>{document.getElementById('prod-imageUrl').value='https://img.test/cover.webp';document.getElementById('prod-imageUrl').dispatchEvent(new Event('change',{bubbles:true}));});
 const key=await page.evaluate(()=>window.qaProductController.workspace.key);
 await page.locator('.tt-work-back').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/')).length)).toBe(0);
 await reopen(page,key);await expect(page.locator('#prod-name')).toHaveValue('Borrador recuperable');await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/cover.webp');
 await page.locator('#prod-editor-section').selectOption('visibility');await page.locator('#prod-category').selectOption('qa-tablet');
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('30000');
 await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-description').fill('Descripción completa');
 await page.evaluate(()=>window.prodGuardar());await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(key=>window.qaProductStore.get('products/'+key).publicationStatus,key)).toBe('active');
 await reopen(page,key,key);await page.locator('#prod-name').fill('Cambio privado');await saveProgress(page);
 expect(await page.evaluate(key=>window.qaProductStore.get('products/'+key).name,key)).toBe('Borrador recuperable');
 await page.locator('.tt-work-back').click();await expect(page.locator('#prod-form-card')).toBeHidden();await reopen(page,key,key);await expect(page.locator('#prod-name')).toHaveValue('Cambio privado');
 await page.evaluate(()=>window.prodGuardar());expect(await page.evaluate(key=>window.qaProductStore.get('products/'+key).name,key)).toBe('Cambio privado');
});
test('fallo de red conserva trabajo pendiente, bloquea salida silenciosa y reintenta',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Trabajo sin red');await page.evaluate(()=>window.qaRejectSave=true);await page.locator('.tt-work-back').click();
 await expect(page.locator('.tt-work-exit-error')).toBeVisible();await expect(page.locator('#prod-form-card')).toBeVisible();
 await page.evaluate(()=>window.qaRejectSave=false);await saveProgress(page);await page.locator('.tt-work-back').click();await expect(page.locator('#prod-form-card')).toBeHidden();
});
test('publicación en vuelo bloquea doble acción y salida, sin duplicar producto',async({page})=>{
 await open(page);await page.evaluate(()=>{
  for(const [id,value] of Object.entries({'prod-name':'Único','prod-description':'Completa','prod-price':'30000','prod-category':'qa-tablet','prod-imageUrl':'https://img.test/cover.webp'}))document.getElementById(id).value=value;
  document.getElementById('prod-name').dispatchEvent(new Event('input',{bubbles:true}));window.qaHoldCommit=true;window.qaPendingCommit=window.prodGuardar();
 });
 await expect.poll(()=>page.evaluate(()=>typeof window.qaReleaseCommit)).toBe('function');await expect(page.locator('.tt-work-back')).toBeDisabled();
 expect(await page.evaluate(()=>window.prodGuardar())).toBe(false);await page.evaluate(()=>window.qaProductController.workspace.leave());await expect(page.locator('#prod-form-card')).toBeVisible();
 await page.evaluate(async()=>{window.qaReleaseCommit();await window.qaPendingCommit;});await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>window.qaProductWrites.filter(path=>path.startsWith('products/')).length)).toBe(1);
});
test('Borradores lista progreso privado y permite continuar sin inventario público ficticio',async({page})=>{
 await open(page);
 await page.route('https://tintin.test/api/admin-order-mutation*',async route=>{
  const items=await page.evaluate(()=>[...window.qaProductStore].filter(([path,row])=>path.startsWith('productEditorWorkspaces/') && !row.closed).map(([,row])=>({key:row.key,productId:row.productId,name:row.snapshot.name,revision:row.revision})));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,result:{items,limited:true}})});
 });
 await page.locator('#prod-name').fill('Desde listado');await saveProgress(page);await page.locator('.tt-work-back').click();
 // Volver queda sobre la barra autoexpandible al cerrarse el espacio. Retirar
 // el puntero como en una navegación normal, sin forzar clicks atravesando ella.
 await page.mouse.move(1300,700);await expect(page.locator('html')).not.toHaveClass(/adm-sidebar-peek/);
 await page.getByRole('button',{name:/Borradores privados \(1\)/}).click();
 await expect(page.getByRole('heading',{name:'Borradores privados de esta cuenta'})).toBeVisible();
 await expect(page.getByText('La lista de borradores está limitada.',{exact:false})).toBeVisible();
 await page.locator('[data-action="work-continue"]').click();await page.evaluate(()=>window.qaProductController.workspace.ready);await expect(page.locator('#prod-name')).toHaveValue('Desde listado');
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/')).length)).toBe(0);
});
test('conflicto de progreso no pisa otra pestaña y no publica',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Primera pestaña');await saveProgress(page);
 await page.evaluate(()=>{const key='productEditorWorkspaces/qa-admin/items/'+window.qaProductController.workspace.key;const work=window.qaProductStore.get(key);window.qaProductStore.set(key,{...work,revision:work.revision+1,snapshot:{...work.snapshot,name:'Otra pestaña'}});});
 await page.locator('#prod-name').fill('Cambio viejo');await page.locator('.tt-work-back').click();await expect(page.locator('.tt-work-status')).toContainText('otra pestaña');
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/')).length)).toBe(0);
});
test('fotos pendientes: fallo guarda texto, recuperar advierte y reintento/cancelación no pierde fotos previas',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Fotos recuperables');
 const gallery=page.locator('.tt-unified-photos');
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
 await gallery.locator('input[multiple]').setInputFiles({name:'pending.png',mimeType:'image/png',buffer});await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(1);
 await page.evaluate(()=>window.qaUploadFailure=true);await page.locator('.tt-work-back').click();await expect(page.locator('.tt-work-status')).toContainText('Texto guardado');await expect(page.locator('#prod-form-card')).toBeVisible();
 const key=await page.evaluate(()=>window.qaProductController.workspace.key);
 expect(await page.evaluate(key=>window.qaProductStore.get('productEditorWorkspaces/qa-admin/items/'+key).snapshot.pendingUploads,key)).toBe(true);
 await page.getByRole('button',{name:'Descartar cambios pendientes y volver',exact:true}).click();await reopen(page,key);await expect(page.locator('.tt-work-status')).toContainText('faltan archivos');
 await page.getByRole('button',{name:'Continuar sin las fotos pendientes',exact:true}).click();await page.evaluate(()=>window.qaUploadFailure=false);
 await gallery.locator('input[multiple]').setInputFiles({name:'retry.png',mimeType:'image/png',buffer});await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(1);await saveProgress(page);await expect(gallery.locator('.tt-unified-photo')).toHaveCount(1);
 await gallery.locator('input[multiple]').setInputFiles({name:'cancel.png',mimeType:'image/png',buffer});await gallery.getByRole('button',{name:'Quitar pendiente cancel.png',exact:true}).click();await saveProgress(page);await expect(gallery.locator('.tt-unified-photo')).toHaveCount(1);
});
test('archivar y restaurar exige acción explícita y no cambia stock',async({page})=>{
 await open(page);await page.evaluate(()=>{window.qaProductStore.set('products/existing',{name:'Publicado',category:'qa-tablet',price:30000,priceBefore:null,stock:4,active:true,oferta:false,destacado:false,description:'Completa',imageUrl:'https://img.test/cover.webp',publicationStatus:'active'});window.prodCancelForm();});
 // Actualiza las colecciones del controlador con el mismo origen ficticio.
 await page.evaluate(()=>{window.qaProductController.refresh();});await reopen(page,'existing','existing');
 await page.locator('#prod-publicationStatus').selectOption('archived');await saveProgress(page);
 expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').active)).toBe(true);
 await page.evaluate(()=>window.prodGuardar());expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').publicationStatus)).toBe('archived');
 await reopen(page,'existing','existing');await page.locator('#prod-publicationStatus').selectOption('active');await page.evaluate(()=>window.prodGuardar());
 expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').stock)).toBe(4);expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').active)).toBe(true);
});
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1366,768],[1920,1080]])test(`espacio dedicado ${width}x${height}`,async({page},info)=>{
 await open(page,width,height);await expect(page.locator('.tt-work-back')).toBeVisible();await expect(page.locator('#prod-save-btn')).toBeVisible();
 expect(await page.locator('#prod-form-card').evaluate(node=>Math.abs(node.getBoundingClientRect().left))).toBeLessThan(2);
 expect(await page.locator('.adm-sidebar').evaluate(node=>getComputedStyle(node).visibility)).toBe('hidden');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`phase4-${width}x${height}.png`)});
});

for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1920,1080]])test(`progreso y acciones con altura reducida ${width}x${height}`,async({page},info)=>{
 await open(page,width,height);await page.locator('#prod-name').fill('Trabajo con teclado');
 await page.setViewportSize({width,height:Math.max(300,Math.round(height*.6))});
 const save=page.locator('#prod-save-btn');await expect(save).toBeInViewport();
 expect(await save.evaluate(node=>{const box=node.getBoundingClientRect();return node.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));})).toBe(true);
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('45000');
 await page.locator('#prod-editor-section').selectOption('general');await expect(page.locator('#prod-name')).toHaveValue('Trabajo con teclado');
 await save.focus();await page.keyboard.press('Tab');
 expect(await page.locator('#prod-form-card').evaluate(card=>card.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Shift+Tab');await expect(save).toBeFocused();
 await saveProgress(page);await expect(page.locator('#prod-price')).toHaveValue('45000');
 await page.screenshot({path:info.outputPath(`keyboard-${width}.png`)});
 await page.setViewportSize({width,height});await expect(save).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for(const width of [320,390])test(`sección elegida legible sin recorte ${width}`,async({page},info)=>{
 await open(page,width,844);
 const select=page.locator('#prod-editor-section');
 for(const section of ['all','visibility']){
  await select.selectOption(section);
  const size=await select.evaluate(node=>{const style=getComputedStyle(node),context=document.createElement('canvas').getContext('2d');context.font=style.font;return {text:context.measureText(node.selectedOptions[0].textContent).width,available:node.getBoundingClientRect().width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-24};});
  expect(size.available).toBeGreaterThanOrEqual(size.text);
 }
 const guide=page.locator('.tt-editor-guide');await guide.locator('summary').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await guide.getByRole('button',{name:'3. Precio',exact:true}).click();await expect(page.locator('#prod-price')).toBeFocused();
 await guide.locator('summary').click();await select.selectOption('visibility');
 await page.screenshot({path:info.outputPath(`navigation-${width}.png`)});
});

for(const width of [1366,1920])test(`acciones compactas junto al título en escritorio ${width}`,async({page})=>{
 await open(page,width,1080);
 const back=await page.locator('.tt-work-back').boundingBox(),actions=await page.locator('#prod-editor-actions').boundingBox();
 expect(actions.width).toBeLessThanOrEqual(440);
 expect(Math.abs(actions.y-back.y)).toBeLessThan(8);
 await expect(page.locator('#prod-save-btn')).toBeInViewport();
});

test('Borradores carga páginas, conserva la lista tras fallo y reintenta el mismo cursor sin duplicar',async({page})=>{
 await open(page,390,844);
 const requests=[];let failPage=true;
 await page.route('https://tintin.test/api/admin-order-mutation*',async route=>{
  const body=route.request().postDataJSON();requests.push(body.pageToken || '');
  if(body.pageToken && failPage){failPage=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Red interrumpida'})});}
  const items=body.pageToken?[{key:'qa-first',name:'Primer borrador actualizado'},{key:'qa-second',name:'Segundo borrador'}]:[{key:'qa-first',name:'Primer borrador'}];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,result:{items,nextPageToken:body.pageToken?'':'page2',limited:!body.pageToken}})});
 });
 await page.locator('#prod-name').fill('Disparar actualización');await saveProgress(page);await page.locator('.tt-work-back').click();await page.mouse.move(380,700);
 await page.getByRole('button',{name:/Borradores privados \(1\)/}).click();
 const panel=page.getByRole('region',{name:'Progreso privado'});
 await expect(panel.locator('[data-action="work-continue"]')).toHaveCount(1);
 await panel.getByRole('button',{name:'Cargar más borradores',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('Red interrumpida');
 await expect(panel.locator('[data-action="work-continue"]')).toHaveCount(1);
 await panel.getByRole('button',{name:'Reintentar',exact:true}).click();
 await expect(panel.locator('[data-action="work-continue"]')).toHaveCount(2);
 await expect(panel.getByText('Primer borrador actualizado',{exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Cargar más borradores',exact:true})).toHaveCount(0);
 expect(requests.slice(-2)).toEqual(['page2','page2']);
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/')).length)).toBe(0);
});
