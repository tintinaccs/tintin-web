'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {mockRuntime,fixtureHtml}=require('./helpers/admin-commerce-fixture.cjs');
const root=path.resolve(__dirname,'../..');
const shell=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const adminSource=fs.readFileSync(path.join(root,'js/admin/admin-app.js'),'utf8');
const stockRenderer=adminSource.slice(adminSource.indexOf('let productVariantStockBaseline = null;'),adminSource.indexOf('function serializeProductForm()'));

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080]])test(`foto local visible y guardado espera subida en producto y colección ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height,`
 export const deleteMediaByUrlIfUnused=async()=>{};export const deleteMediaItem=async()=>{};
 export async function uploadImageToLibrary(file){window.uploadCount=(window.uploadCount||0)+1;await new Promise(resolve=>{window.releasePhoto=resolve;});if(window.failPhoto)throw Error('Subida de prueba fallida');return {url:'https://img.test/subida.png',mediaId:'foto'};}
 `);
 await page.locator('#prod-editor-section').selectOption('photos');
 const mount=adminSource.slice(adminSource.indexOf('const _formImageWidgets = new Map();'),adminSource.indexOf('let productColorPhotos = null;'));
 await page.evaluate(async source=>{
  const loadModule=url=>import(new URL(url,location.origin).href);
  const {attachImageUploadWidget}=await loadModule('/js/components/images/carga-imagenes.js');
  window.photoControllers=new Function('attachImageUploadWidget','openMediaLibraryPicker',source+';mountFormImageWidget("prod-image-widget","prod-imageUrl");return _formImageWidgets;')(attachImageUploadWidget,async()=>null);
  document.getElementById('coll-image')?.remove();document.getElementById('coll-image-widget')?.remove();
  const coll=document.createElement('section');coll.innerHTML='<input type=hidden id=coll-image><div id=coll-image-widget></div>';document.querySelector('#prod-form-card .adm-card-body').append(coll);
  window.photoControllers.set('coll-image-widget',attachImageUploadWidget(document.getElementById('coll-image-widget'),{label:'Portada de colección',onChange:url=>{document.getElementById('coll-image').value=url;}}));
 },mount);
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;canvas.getContext('2d').fillRect(0,0,40,40);return canvas.toDataURL('image/png').split(',')[1];});
 for(const [widget,field] of [['prod-image-widget','prod-imageUrl'],['coll-image-widget','coll-image']]){
  await page.locator('#'+widget+' input[type=file]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const preview=page.locator('#'+widget+' .tt-iuw-preview img');await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty('complete',true);
  await expect.poll(()=>preview.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#'+field)).toHaveValue('');
  if(widget==='prod-image-widget')await expect(page.locator('#prod-live-preview .tt-editor-cover img')).toHaveAttribute('src',/^blob:/);
  await page.evaluate(id=>{window.photoSaved=false;window.photoError='';window.photoSave=window.photoControllers.get(id).flush().then(()=>{window.photoSaved=true;}).catch(error=>{window.photoError=error.message;});},widget);
  await page.waitForFunction(()=>typeof window.releasePhoto==='function');expect(await page.evaluate(()=>window.photoSaved)).toBe(false);
  await page.evaluate(()=>{window.releasePhoto();delete window.releasePhoto;});await page.evaluate(()=>window.photoSave);
  expect(await page.evaluate(()=>window.photoError)).toBe('');await expect(page.locator('#'+field)).toHaveValue('https://img.test/subida.png');
 }
 expect(await page.evaluate(()=>window.uploadCount)).toBe(2);
 if(width===390){
  const widget=page.locator('#prod-image-widget');
  await widget.locator('input[type=file]').setInputFiles({name:'otra.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(widget.getByRole('button',{name:'Confirmar y subir',exact:true})).toBeEnabled();
  await page.evaluate(()=>{window.failPhoto=true;window.photoSave=window.photoControllers.get('prod-image-widget').flush().catch(error=>{window.photoError=error.message;});});
  await page.waitForFunction(()=>typeof window.releasePhoto==='function');
  await page.evaluate(()=>{window.releasePhoto();delete window.releasePhoto;});await page.evaluate(()=>window.photoSave);
  expect(await page.evaluate(()=>window.photoError)).toBe('Subida de prueba fallida');
  await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/subida.png');
  await expect(widget.locator('.tt-iuw-preview img')).toHaveAttribute('src',/^blob:/);
  await page.evaluate(()=>{window.failPhoto=false;});
  await widget.getByRole('button',{name:'Confirmar y subir',exact:true}).click();
  await page.waitForFunction(()=>typeof window.releasePhoto==='function');
  await page.evaluate(()=>{window.photoSave=window.photoControllers.get('prod-image-widget').flush();window.releasePhoto();delete window.releasePhoto;});await page.evaluate(()=>window.photoSave);
  expect(await page.evaluate(()=>window.uploadCount)).toBe(4);
 }
});
const inventorySource=fs.readFileSync(path.join(root,'js/core/store/inventario-variantes.mjs'),'utf8').replaceAll('export ','');
const loader=fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
const entryScroll=loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial'));

const formStart=shell.indexOf('<div class="adm-card" id="prod-form-card"');
const form=shell.slice(formStart,shell.indexOf('\n    </div>\n\n    <!-- ===================== COLECCIONES',formStart));
const promptStart=shell.indexOf('<div id="unsaved-modal"');
const prompt=shell.slice(promptStart,shell.indexOf('\n<!-- ═',promptStart));

async function openEditor(page,width,height,withImages=false,beforeOpen=null){
 await page.setViewportSize({width,height});await mockRuntime(page);
 if(withImages) await page.route('https://tintin.test/js/components/images/biblioteca-multimedia.js*',route=>route.fulfill({contentType:'text/javascript',body:typeof withImages==='string'?withImages:'export const deleteMediaByUrlIfUnused=()=>{window.__imageCleanup=(window.__imageCleanup||0)+1;throw Error("Sin escrituras");};export const deleteMediaItem=deleteMediaByUrlIfUnused;export const uploadImageToLibrary=deleteMediaByUrlIfUnused;'}));
 const html=fixtureHtml();const start=html.indexOf('<div class="adm-card" id="prod-form-card"');
 const full=html.slice(0,start)+form+html.slice(html.indexOf('</section>',start));
 await page.route('https://tintin.test/admin-commerce-fixture',route=>route.fulfill({contentType:'text/html',body:full}));
 await page.goto('https://tintin.test/admin-commerce-fixture');
 await page.addStyleTag({content:`@font-face{font-family:Montserrat;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root,'assets-tintin/fonts/montserrat-latin-wght-normal.woff2')).toString('base64')}) format('woff2');font-weight:100 900;font-style:normal}`});
 await page.evaluate(()=>document.fonts.ready);
 await page.addScriptTag({content:entryScroll});
 await expect(page.locator('[data-action="product-new"]')).toBeVisible();
 if(beforeOpen) await beforeOpen(page);
 await page.evaluate(()=>{
  window.prodNuevo=()=>{document.getElementById('prod-form-card').style.display='';};
  window.prodCancelForm=()=>{window.__calls.push(['prodCancelForm']);document.getElementById('prod-form-card').style.display='none';};
  window.prodGuardar=()=>window.__calls.push(['prodGuardar',document.getElementById('prod-name').value,document.getElementById('prod-price').value]);
 });
 await page.locator('[data-action="product-new"]').click();await expect(page.locator('#prod-editor-section')).toBeVisible();
}

async function openActions(page) {
 const actions=page.locator('#prod-editor-actions');
 await expect(actions).toBeVisible();
 return actions;
}

for(const [width,height] of [[320,568],[390,844],[667,375],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
 test(`editor minimal: botones, stock y tarjetas accesibles ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height);
  const card=page.locator('#prod-form-card');
  const bounds=await card.boundingBox();
  expect(bounds.x).toBe(0);expect(bounds.y).toBe(0);expect(bounds.width).toBe(width);expect(bounds.height).toBe(height);
  await expect(page.locator('.tt-product-editor-actions')).toHaveCount(0);
  await expect(page.locator('#prod-editor-actions')).toBeVisible();
  await expect(page.locator('#prod-save-btn')).toBeInViewport();await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeInViewport();
  await page.evaluate(()=>{
   const select=document.getElementById('prod-category');for(const [value,title]of [['relojes','Relojes'],['anillos','Anillos'],['collares','Collares']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}
  });
  await page.locator('#prod-category').selectOption('relojes');await expect(page.locator('#prod-category')).toHaveValue('relojes');
  await expect(card.locator('[data-product-section]')).toHaveCount(7);
  if(width<1200)await expect(page.locator('#prod-name')).toHaveCSS('font-size','16px');
  await openActions(page);await expect(page.locator('#prod-save-btn')).toBeInViewport();
  await page.getByRole('button',{name:'Stock: 10 unidades',exact:true}).click();
  await expect(page.locator('#prod-stock')).toHaveValue('10');await expect(page.locator('#prod-active')).toBeChecked();
  await page.getByLabel('Elegir cantidad: Stock',{exact:true}).selectOption('500');await expect(page.locator('#prod-stock')).toHaveValue('500');
  await page.getByRole('button',{name:'Stock: 0 unidades',exact:true}).click();
  await expect(page.locator('#prod-stock')).toHaveValue('0');await expect(page.locator('#prod-active')).toBeChecked();
  await page.getByRole('button',{name:'Sumar una unidad: Stock',exact:true}).click();await expect(page.locator('#prod-stock')).toHaveValue('1');await expect(page.locator('#prod-active')).toBeChecked();
  await page.locator('#prod-price').fill('70000');
  await card.locator('[data-product-section=prices]').getByRole('button',{name:'Ajustar Precio (Gs.) * en 5000 guaraníes',exact:true}).click();await expect(page.locator('#prod-price')).toHaveValue('75000');
  const general=page.getByRole('button',{name:'Producto',exact:true});
  await page.locator('#prod-name').fill('Reloj Alissia');await general.click();await expect(page.locator('#prod-name')).toBeHidden();
  await general.click();await expect(page.locator('#prod-name')).toHaveValue('Reloj Alissia');
  await page.getByRole('button',{name:'Detalles del producto',exact:true}).click();
  await page.getByRole('group',{name:'Sugerencias: Material',exact:true}).getByRole('button',{name:'Acero inoxidable',exact:true}).click();await expect(page.locator('#prod-material')).toHaveValue('Acero inoxidable');
  const geometry=await card.locator('input:not([type=hidden]),select,button,textarea').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>({id:el.id,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})));
  for(const box of geometry){expect(box.left,box.id).toBeGreaterThanOrEqual(-1);expect(box.right,box.id).toBeLessThanOrEqual(width+1);}
  await page.locator('#prod-editor-section').selectOption('all');
  await card.locator('.adm-card-body').evaluate(el=>el.scrollTop=0);await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`test-results/product-minimal-${width}x${height}.png`});
  expect(await page.evaluate(()=>window.__calls.filter(call=>call[0]==='prodGuardar'))).toEqual([]);
 });
}

test('variantes visuales conservan formatos previos y bloquean controles del total distribuido',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.getByLabel('Característica de variante',{exact:true}).selectOption('Color');
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Plateado');await page.keyboard.press('Enter');
 await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado\nColor: Plateado');
 await page.getByRole('button',{name:'Quitar Color: Dorado',exact:true}).click();await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Plateado');
 await page.evaluate(({renderer,inventory})=>{window.__stockEditor=new Function(inventory+'\n'+renderer+'\nreturn {renderProductVariantStock};')();document.getElementById('prod-stock').value='700';window.__stockEditor.renderProductVariantStock({variants:{Color:['Plateado']},variantInventory:[{variant:'Plateado',stock:700}],stock:700});},{renderer:stockRenderer,inventory:inventorySource});
 await expect(page.locator('#prod-stock')).toHaveValue('700');
 await expect(page.getByLabel('Elegir cantidad: Stock',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'No controlar stock',exact:true,includeHidden:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Agregar opción',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Restar una unidad: Stock de Plateado',exact:true}).click();
 await expect(page.locator('#prod-stock')).toHaveValue('699');await expect(page.getByLabel('Stock de Plateado',{exact:true})).toHaveValue('699');
});

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]]){
 test(`editor real por secciones conserva campos y acciones ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height);
  const card=page.locator('#prod-form-card'),section=page.locator('#prod-editor-section');
  await expect(page.locator('#prod-name')).toBeVisible();await expect(page.locator('#prod-price')).toBeVisible();
  await page.locator('#prod-name').fill('Anillo de prueba');
  await section.selectOption('prices');await page.locator('#prod-price').fill('45000');
  await section.selectOption('private');await expect(page.locator('#prod-cost-unit')).toBeVisible();
  // El selector de secciones no puede descubrir campos que el controlador oculte por rol.
  await page.locator('#prod-inventory-fields').evaluate(el=>el.style.display='none');
  await section.selectOption('all');await expect(page.locator('#prod-cost-unit')).toBeHidden();
  await expect(page.locator('#prod-name')).toHaveValue('Anillo de prueba');await expect(page.locator('#prod-price')).toHaveValue('45000');
  await expect(page.locator('#prod-name')).toHaveAccessibleName('Nombre *');
  const boxes=await card.locator('input:not([type=hidden]),textarea,select,button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,x:r.x,right:r.right,width:r.width};}).filter(r=>r.width>0));
  for(const box of boxes){expect(box.x,box.id).toBeGreaterThanOrEqual(0);expect(box.right,box.id).toBeLessThanOrEqual(width+1);}
  await openActions(page);
  const save=page.locator('#prod-save-btn');
  if(width<1200){
   await expect(card).toHaveAttribute('role','dialog');
   const rect=await card.boundingBox();expect(rect.x).toBe(0);expect(rect.y).toBe(0);expect(rect.width).toBe(width);expect(rect.height).toBe(height);
   const footer=await save.boundingBox();expect(footer.y).toBeGreaterThan(0);expect(footer.y+footer.height).toBeLessThanOrEqual(height);
   await save.focus();await expect(save).toBeFocused();
  }
  await save.click();expect(await page.evaluate(()=>window.__calls.at(-1))).toEqual(['prodGuardar','Anillo de prueba','45000']);
  await page.screenshot({path:`test-results/products-editor-phase1-${width}x${height}.png`});
  await openActions(page);await card.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(card).toBeHidden();await expect(page.locator('[data-action="product-new"]')).toBeFocused();
 });
}

for (const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1180,820],[844,390]]) {
 test(`la navegación autenticada no tapa las acciones del editor ${width}x${height}`,async({page})=>{
  const nav=shell.match(/<nav class="adm-mobile-tabs"[\s\S]*?<\/nav>/)[0];
  const guard=shell.match(/<style>[\s\S]*?<\/style>/g).find(style=>style.includes('html.adm-auth-ready #adm-sidebar'));
  expect(guard).toBeTruthy();
  await openEditor(page,width,height,false,async()=>{
   await page.evaluate(({nav,guard})=>{document.head.insertAdjacentHTML('beforeend',guard);document.body.insertAdjacentHTML('beforeend',nav);},{nav,guard});
  });
  const navigation=page.locator('#adm-mobile-tabs');
  await expect(navigation).toHaveCSS('visibility','hidden');
  await openActions(page);
  const save=page.locator('#prod-save-btn');
  await expect(save).toBeVisible();
  const hit=await save.evaluate(button=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#prod-save-btn')===button;});
  expect(hit).toBe(true);
  await page.locator('#prod-form-card').getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(navigation).toHaveCSS('visibility','visible');
 });
}

test('configurar stock por color exige cantidades explícitas y recalcula total y vista previa',async({page})=>{
 await openEditor(page,775,900);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.evaluate(({renderer,inventory})=>{
  window.__stockEditor=new Function(inventory+'\n'+renderer+'\nreturn {renderProductVariantStock,baseline:()=>productVariantStockBaseline};')();
  window.__stockEditor.renderProductVariantStock({stock:1});
 },{renderer:stockRenderer,inventory:inventorySource});
 await page.getByText('Editar opciones en texto',{exact:true}).click();await page.locator('#prod-variants-text').fill('Color: dorado, plateado');
 await expect(page.getByRole('button',{name:'Asignar stock por color u opción',exact:true})).toHaveCount(0);
 const quantities=page.locator('#prod-variant-stock input');await expect(quantities).toHaveCount(2);
 await expect(quantities.nth(0)).toHaveValue('');await expect(quantities.nth(1)).toHaveValue('');
 await quantities.nth(0).fill('1');await quantities.nth(1).fill('1');
 await expect(page.locator('#prod-stock')).toHaveValue('2');await expect(page.locator('#prod-stock')).toHaveAttribute('readonly','');
 await expect(page.locator('#prod-variants-text')).not.toHaveAttribute('readonly','');
 expect(await page.evaluate(()=>window.__stockEditor.baseline().expectedEntries)).toBe(null);
 expect(await page.evaluate(()=>window.__stockEditor.baseline().variants)).toEqual({Color:['dorado','plateado']});
 await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Azzura');
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('50000');
 await expect(page.locator('#prod-live-preview')).toContainText('2 unidades disponibles');
});

for(const [width,height] of [[390,844],[775,582],[1024,768]]){
 test(`editor modal no queda debajo de la navegación y la restaura al cerrar ${width}`,async({page})=>{
  let originalVisibility;
  await openEditor(page,width,height,false,async()=>{
   originalVisibility=await page.evaluate(()=>{
    const sidebar=document.createElement('aside');sidebar.className='adm-sidebar';sidebar.textContent='Navegación del panel';
    sidebar.style.cssText='position:fixed;inset:0 auto 0 0;width:84px;background:pink;z-index:300';document.body.append(sidebar);
    // El shell administrativo puede crear un contexto inferior al de su barra lateral.
    const main=document.querySelector('.adm-main');main.style.position='relative';main.style.zIndex='1';
    return getComputedStyle(sidebar).visibility;
   });
  });
  await expect(page.locator('.adm-sidebar')).toBeHidden();
  expect(await page.evaluate(()=>Boolean(document.elementFromPoint(20,20)?.closest('#prod-form-card')))).toBe(true);
  await openActions(page);await page.locator('#prod-form-card').getByRole('button',{name:'Cancelar',exact:true}).click();
  // En móvil vuelve a su estado normal plegado, sin quedar oculta por el editor.
  await expect(page.locator('html')).not.toHaveClass(/tt-product-editor-open/);
  await expect(page.locator('.adm-sidebar')).toHaveCSS('visibility',originalVisibility);
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
 const search=page.getByRole('searchbox',{name:'Buscar productos por nombre, SKU, colección o etiqueta'});await search.pressSequentially('Reloj',{delay:220});await expect(search).toBeFocused();await expect(search).toHaveValue('Reloj');
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
 await page.locator('tr[data-id="p-reloj"] .tt-commerce-thumb').scrollIntoViewIfNeeded();
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
 await page.evaluate(markup=>{if(document.getElementById('unsaved-modal'))return;const parsed=new DOMParser().parseFromString(markup,'text/html');document.body.append(parsed.getElementById('unsaved-modal'));},prompt);
 await page.addScriptTag({url:'/js/admin/proteccion-cambios-pendientes-admin.js'});
 await page.evaluate(()=>{
  window.AdminUnsaved.register('primary-editor',{root:'#prod-form-card',serialize:()=>JSON.stringify({name:document.getElementById('prod-name').value,price:document.getElementById('prod-price').value}),save:window.prodGuardar});
  window.prodCancelForm=()=>window.AdminUnsaved.requestNavigation(()=>{window.AdminUnsaved.unregister('primary-editor');document.getElementById('prod-form-card').style.display='none';});
 });
 await page.locator('#prod-editor-section').selectOption('prices');
 expect(await page.evaluate(()=>window.AdminUnsaved.isDirty('primary-editor'))).toBe(false);
 await page.locator('#prod-price').fill('15000');
 await openActions(page);await page.locator('#prod-form-card').getByRole('button',{name:'Cancelar',exact:true}).click();
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
  const tabs=document.createElement('nav');tabs.id='adm-mobile-tabs';tabs.textContent='Navegación';tabs.style.cssText='position:fixed;bottom:12px;left:12px;width:calc(100% - 24px);height:76px;background:white;z-index:430';document.body.append(tabs);
  window.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(30);
 await page.locator('[data-select-product="p-00"]').check();await page.locator('[data-action="products-page-next"]').click();
 await page.locator('[data-select-product="p-31"]').check();await expect(page.locator('.tt-product-selection')).toContainText('2 seleccionados');
 const bar=await page.locator('.tt-product-selection').boundingBox(),nav=await page.locator('#adm-mobile-tabs').boundingBox();expect(bar.y+bar.height).toBeLessThanOrEqual(nav.y);
 await page.locator('[data-action="products-page-prev"]').click();await expect(page.locator('[data-select-product="p-00"]')).toBeChecked();
 await page.locator('[data-action="products-clear-selection"]').click();await expect(page.locator('.tt-product-selection')).toBeHidden();
});

test('foto principal completa en editor real y rotación conserva borrador y acciones superiores',async({page})=>{
 await openEditor(page,390,844,true);await page.locator('#prod-name').fill('Borrador conservado');await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(async url=>{const {attachImageUploadWidget}=await import(url);attachImageUploadWidget(document.getElementById('prod-image-widget'),{label:'Imagen principal',value:'https://img.test/principal.webp'});},'/js/components/images/carga-imagenes.js?fixture');
 const image=page.locator('#prod-image-widget .tt-iuw-preview');await expect(image).toBeVisible();expect((await image.boundingBox()).width).toBeGreaterThan(250);await expect(image.locator('img')).toHaveCSS('object-fit','contain');
 await page.setViewportSize({width:844,height:390});await expect(page.locator('#prod-form-card')).toHaveCSS('height','390px');
 await expect(page.locator('#prod-name')).toHaveValue('Borrador conservado');await openActions(page);await expect(page.locator('#prod-save-btn')).toBeInViewport();
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

for (const [width,height] of [[320,700],[390,844],[600,900],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]]) {
 test(`vista previa conectada, cantidades y fotos sin desbordes ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(async renderer=>{
   const loadModule=url=>import(new URL(url,location.origin).href);
   const card=document.getElementById('prod-form-card');
   const put=(id,value)=>document.getElementById('prod-'+id).value=value;
   put('name','Anillo Amore');put('description','Un detalle que transforma tu día.');put('price','75000');put('price-before','100000');put('stock','3');
   put('imageUrl','https://img.test/coctel.webp');put('images-extra','https://img.test/banda.webp');put('material','Acero inoxidable');
   put('variants-text','Diseño de anillo: coctel, banda');
   const {variantInventoryEntries}=await loadModule('/js/core/store/inventario-variantes.mjs');
   const product={variants:{'Diseño de anillo':['coctel','banda']},variantInventory:[{variant:'coctel',stock:1},{variant:'banda',stock:2}],stock:3};
   new Function('variantInventoryEntries','product',renderer+';renderProductVariantStock(product);')(variantInventoryEntries,product);
   const {setProductPreviewMedia}=await loadModule('/js/admin/products/vista-previa-producto.js?v=tintin-20261024-editor-v2-3');
   setProductPreviewMedia(card,[{'Diseño de anillo':'coctel',imageUrls:['https://img.test/coctel.webp']},{'Diseño de anillo':'banda',imageUrls:['https://img.test/banda.webp']}]);
   card.dispatchEvent(new Event('input',{bubbles:true}));
  },stockRenderer);
  await page.locator('#prod-editor-section').selectOption('inventory');
  await expect(page.getByLabel('Stock de coctel',{exact:true})).toHaveValue('1');
  await page.getByLabel('Stock de banda',{exact:true}).fill('0');
  await expect(page.locator('#prod-stock')).toHaveValue('1');
  await expect(page.locator('.tt-editor-stock-row').last()).toContainText('Agotado');
  await expect(page.locator('.tt-editor-stock-row').last().locator('img')).toHaveAttribute('src',/banda.webp/);
  await page.locator('.tt-editor-preview-shell > summary').click();
  const preview=page.locator('#prod-live-preview');
  await expect(preview.locator('h2')).toHaveText('Anillo Amore');
  await expect(preview.locator('.tt-editor-preview-money')).toContainText('75.000');
  await expect(preview.locator('.tt-editor-preview-money')).toContainText('−25%');
  await preview.getByLabel('Vista previa: Diseño de anillo',{exact:true}).focus();
  await preview.getByLabel('Vista previa: Diseño de anillo',{exact:true}).selectOption('banda');
  await expect(preview.locator('.tt-editor-cover img')).toHaveAttribute('src',/banda.webp/);
  await expect(preview.locator('.tt-editor-preview-stock')).toHaveText('Agotado');
  await expect(preview.getByLabel('Vista previa: Diseño de anillo',{exact:true})).toBeFocused();
  await expect(page.locator('#prod-stock')).toHaveValue('1');
  await expect(page.locator('#prod-variants-text')).toHaveValue('Diseño de anillo: coctel, banda');
  await preview.getByLabel('Vista previa: Diseño de anillo',{exact:true}).selectOption('');
  await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('80000');
  await expect(preview.locator('.tt-editor-preview-money')).toContainText('80.000');
  await expect(preview.locator('.tt-editor-preview-money')).toContainText('−20%');
  await page.locator('#prod-editor-section').selectOption('all');
  const boxes=await page.locator('#prod-form-card input:not([type=hidden]),#prod-form-card button,#prod-form-card select,#prod-form-card textarea,#prod-live-preview').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({id:n.id,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})));
  for(const box of boxes){expect(box.left,box.id).toBeGreaterThanOrEqual(-1);expect(box.right,box.id).toBeLessThanOrEqual(width+1);}
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>window.__calls.filter(call=>call[0]==='prodGuardar'))).toEqual([]);
  await page.locator('#prod-editor-section').selectOption('inventory');
  await page.locator('#prod-form-card .adm-card-body').evaluate(el=>el.scrollTop=0);await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`test-results/product-editor-visual-${width}x${height}.png`});
 });
}

test('galería agrega varias fotos y quita la elegida sin borrar fotos pendientes ni cambiar la portada',async({page})=>{
 await openEditor(page,390,844,true);
 const mount=adminSource.slice(adminSource.indexOf('let productColorPhotos = null;'),adminSource.indexOf('let productVariantStockBaseline = null;'));
 await page.evaluate(async source=>{
  const loadModule=url=>import(new URL(url,location.origin).href);
  const {attachImageUploadWidget,attachMultiImageUploadWidget}=await loadModule('/js/components/images/carga-imagenes.js?fixture');
  const {attachColorPhotos}=await loadModule('/js/admin/products/fotos-por-color.js');
  const {sanitizeImageUrl}=await loadModule('/js/components/images/utilidades-imagenes.js');
  document.getElementById('prod-imageUrl').value='https://img.test/portada.webp';
  document.getElementById('prod-variants-text').value='Diseño: Coctel, Banda';
  let number=0;const library=async()=>window.__delayGalleryChoice ? new Promise(resolve=>{window.__resolveGalleryChoice=resolve;}) : `https://img.test/extra-${++number}.webp`;
  window.__remountGallery=new Function('attachImageUploadWidget','attachMultiImageUploadWidget','attachColorPhotos','openMediaLibraryPicker','sanitizeImageUrl','_formImageWidgets',source+';mountProductColorPhotos({variants:{Diseño:["Coctel","Banda"]}});return mountProductColorPhotos;')(attachImageUploadWidget,attachMultiImageUploadWidget,attachColorPhotos,library,sanitizeImageUrl,new Map());
 },mount);
 await page.locator('#prod-editor-section').selectOption('photos');
 const gallery=page.locator('#prod-gallery-widget');
 await expect(gallery).not.toHaveAttribute('open','');
 await expect(gallery.getByRole('button',{name:'Confirmar y subir fotos',exact:true})).toBeHidden();
 await gallery.locator('summary').click();
 await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/extra-1.webp\nhttps://img.test/extra-2.webp');
 await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/portada.webp');
 await expect(page.locator('.tt-editor-thumbnails button')).toHaveCount(3);
 await expect(page.locator('#prod-gallery-thumbs img')).toHaveCount(3);
 await page.getByRole('button',{name:'Quitar foto 3 del producto',exact:true}).click();
 await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/extra-1.webp');
 await expect(page.locator('.tt-editor-thumbnails button')).toHaveCount(2);
 await page.getByRole('button',{name:'Quitar foto 2 del producto',exact:true}).click();
 await expect(page.locator('#prod-images-extra')).toHaveValue('');
 await expect(page.locator('.tt-editor-thumbnails button')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__imageCleanup||0)).toBe(0);
 await page.locator('.tt-product-section-nav .tt-editor-preview-jump').click();
 await expect(page.locator('#prod-live-preview')).toBeFocused();
 await page.locator('#prod-live-preview').getByRole('button',{name:'Volver a editar'}).click();
 await expect(page.locator('#prod-editor-section')).toBeFocused();
 // Una selección pendiente del producto anterior nunca debe tocar el nuevo formulario.
 await page.evaluate(()=>{window.__delayGalleryChoice=true;window.__oldGalleryRoot=document.querySelector('#prod-gallery-widget .tt-iuw');});
 await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await page.evaluate(()=>{window.__remountGallery({variants:{Diseño:['Coctel','Banda']}});window.__resolveGalleryChoice('https://img.test/tardia.webp');});
 await page.waitForFunction(()=>window.__oldGalleryRoot.textContent.includes('El producto cambió'));
 await expect(page.locator('#prod-images-extra')).toHaveValue('');
});

for (const width of [1200,1440,1920]) test(`controles seleccionados conservan texto legible con el tema real ${width}`,async({page})=>{
 await openEditor(page,width,900);
 await page.addStyleTag({path:path.join(root,'css/core/tema-unificado-tintin.css')});
 for(const colors of [['#F8AACA','#222222'],['#222222','#FFFFFF']]) {
  await page.evaluate(([background,text])=>{document.documentElement.style.setProperty('--admin-color-button-primary-background',background);document.documentElement.style.setProperty('--admin-color-button-primary-text',text);},colors);
  const controls=page.locator('#prod-form-card [data-product-section=inventory] .tt-editor-choice[aria-pressed]');
  expect(await controls.count()).toBeGreaterThan(0);
  for (const button of await controls.all()) {
   await button.click();
   await expect(button).toHaveAttribute('aria-pressed','true');
   expect((await button.innerText()).trim()).not.toBe('');
   const contrast=await button.evaluate(el=>{
    const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
    const luminance=value=>rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const css=getComputedStyle(el),a=luminance(css.color),b=luminance(css.backgroundColor);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });
   expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
 }
});
for (const width of [320,390,768,1440]) test(`cambiar apartado reinicia el editor sin perder el borrador ${width}`,async({page})=>{
 await openEditor(page,width,800);
 const select=page.locator('#prod-editor-section');
 await select.selectOption('all');
 await page.locator('#prod-name').fill('Borrador conservado');
 await page.evaluate(()=>{document.querySelector('#prod-form-card .adm-card-body').scrollTop=700;scrollTo(0,500);});
 await select.selectOption('prices');
 await expect.poll(()=>page.locator('#prod-form-card .adm-card-body').evaluate(el=>el.scrollTop)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 await select.selectOption('all');
 await expect(page.locator('#prod-name')).toHaveValue('Borrador conservado');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const before=await page.evaluate(()=>{const body=document.querySelector('#prod-form-card .adm-card-body');body.scrollTop=250;scrollTo(0,250);return {window:scrollY,body:body.scrollTop};});
 await page.evaluate(()=>{const input=document.getElementById('prod-price');input.value='65000';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(await page.evaluate(()=>({window:scrollY,body:document.querySelector('#prod-form-card .adm-card-body').scrollTop}))).toEqual(before);
});

test('abrir conserva producto oculto y visibilidad manual independiente de la cantidad',async({page})=>{
 await openEditor(page,390,844);
 await page.evaluate(()=>{
  document.getElementById('prod-stock').value='7';
  document.getElementById('prod-active').checked=false;
  document.getElementById('prod-publicationStatus').value='draft';
  document.getElementById('prod-form-title').textContent='Editar producto';
 });
 await expect(page.locator('.tt-editor-stock-status')).toHaveText('7 unidades disponibles');
 await expect(page.locator('#prod-active')).not.toBeChecked();
 await page.getByRole('button',{name:'Stock: 1 unidades',exact:true}).click();
 await expect(page.locator('#prod-active')).not.toBeChecked();
 await page.locator('#prod-editor-section').selectOption('visibility');
 await page.locator('#prod-publicationStatus').selectOption('draft');
 await page.locator('#prod-editor-section').selectOption('prices');
 await page.locator('#prod-price').fill('50000');
 await expect(page.locator('#prod-active')).not.toBeChecked();
 await expect(page.locator('#prod-stock')).toHaveValue('1');
 await page.locator('#prod-editor-section').selectOption('inventory');
 await page.getByRole('button',{name:'Stock: 0 unidades',exact:true}).click();
 await expect(page.locator('#prod-active')).not.toBeChecked();
 await expect(page.locator('.tt-editor-stock-status')).toHaveText('Sin stock');
});

for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]])test(`editor ocupa el área bajo Productos sin barras anidadas ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height,false,async()=>{
  await page.evaluate(()=>{const header=document.createElement('header');header.className='adm-topbar';header.textContent='Productos';header.style.cssText='position:fixed;inset:0 0 auto;height:56px;box-sizing:border-box';document.body.prepend(header);});
 });
 const editor=page.locator('#prod-form-card');
 const header=await page.locator('.adm-topbar').boundingBox(),bounds=await editor.boundingBox();
 expect(bounds.x).toBe(0);expect(bounds.y).toBe(header.y+header.height);expect(bounds.width).toBe(width);expect(bounds.height).toBe(height-bounds.y);
 await expect(editor).toHaveCSS('border-radius','0px');
 await expect(editor).toHaveAttribute('role','dialog');
 await expect(editor).toHaveAttribute('aria-modal','true');
 const actions=editor.locator('#prod-editor-actions');
 await expect(actions).toBeVisible();
 const body=editor.locator('.adm-card-body');await body.evaluate(el=>el.scrollTop=el.scrollHeight);
 const contentBox=await body.boundingBox();expect(contentBox.y+contentBox.height).toBeGreaterThanOrEqual(height-1);
 const buttons=actions.locator('button');await expect(buttons).toHaveCount(2);
 for(const button of await buttons.all()){
  await expect(button).toBeInViewport();
  expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;})).toBe(true);
 }
 await buttons.first().focus();await page.keyboard.press('Tab');await expect(editor.locator('#prod-save-btn')).toBeFocused();
 await editor.locator('#prod-form-title').click();await expect(actions).toBeVisible();
 if(width===390||width===1440)await page.screenshot({path:test.info().outputPath(`editor-full-${width}.png`)});
 await editor.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(editor).toBeHidden();
 await expect(page.locator('[data-action="product-new"]')).toBeFocused();
});

for(const [width,height] of [[320,700],[768,1024],[1440,900]])test(`fotos por color ordenadas y editables ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height,true);
 await page.evaluate(async()=>{
  const load=url=>import(new URL(url,location.origin).href);
  const {attachColorPhotos}=await load('/js/admin/products/fotos-por-color.js');
  const {attachImageUploadWidget}=await load('/js/components/images/carga-imagenes.js');
  const main=document.getElementById('prod-imageUrl'),extra=document.getElementById('prod-images-extra'),variants=document.getElementById('prod-variants-text');
  const container=document.createElement('div');container.id='prod-color-photos';variants.parentElement.after(container);
  main.value='https://img.test/rosa.webp';extra.value='https://img.test/rojo.webp';variants.value='Color: rosa, rojo';
  window.__colorPhotos=attachColorPhotos({container:document.getElementById('prod-color-photos'),product:{imageUrl:main.value,imagesExtra:[extra.value],variants:{Color:['rosa','rojo']},variantMedia:[{Color:'rosa',imageUrl:main.value},{Color:'rojo',imageUrl:extra.value}]},mainInput:main,imagesInput:extra,variantsInput:variants,attachUpload:attachImageUploadWidget,openLibrary:async()=>'https://img.test/biblioteca.webp'});
 });
 await page.locator('#prod-editor-section').selectOption('photos');
 const colors=page.locator('#prod-color-photos');
 await expect(colors.locator('fieldset')).toHaveCount(2);
 await colors.getByRole('checkbox',{name:'Asignar foto 2 a rosa',exact:true}).check();
 await colors.getByLabel('Color personalizado de rosa',{exact:true}).fill('#cc99dd');
 const serialized=await page.evaluate(()=>window.__colorPhotos.serialize());
 expect(serialized.find(row=>row.Color==='rosa')).toMatchObject({colorHex:'#cc99dd',imageUrls:['https://img.test/rosa.webp','https://img.test/rojo.webp']});
 for(const box of await colors.locator('fieldset,input,select,button,img').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON()))){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);}
 await colors.locator('[data-photo-color="rojo"]').click();
 await colors.getByRole('button',{name:'Elegir foto de biblioteca para rojo',exact:true}).click();
 await expect(colors.getByRole('checkbox',{name:'Asignar foto 3 a rojo',exact:true})).toBeChecked();
 expect(await page.evaluate(()=>window.__calls.filter(call=>call[0]==='prodGuardar'))).toEqual([]);
});

test('stock maestro conserva cantidades y protege referencias existentes incluso con stock cero',async({page})=>{
 await openEditor(page,390,844);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.evaluate(({renderer,inventory})=>{
  document.getElementById('prod-variants-text').value='Color: Dorado, Plateado';
  window.__masterStock=new Function(inventory+'\n'+renderer+'\nreturn {renderProductVariantStock,baseline:()=>productVariantStockBaseline};')();
  window.__masterStock.renderProductVariantStock({stock:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:1},{variant:'Plateado',stock:1}]});
 },{renderer:stockRenderer,inventory:inventorySource});
 await expect(page.getByLabel('Stock de Dorado',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Stock de Plateado',{exact:true})).toHaveValue('1');
 await expect(page.locator('#prod-stock')).toHaveValue('2');
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Oro rosa');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await expect(page.getByLabel('Stock de Dorado',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Stock de Oro rosa',{exact:true})).toHaveValue('');
 await page.getByLabel('Stock de Oro rosa',{exact:true}).fill('0');await expect(page.locator('#prod-stock')).toHaveValue('2');
 await page.getByRole('button',{name:'Quitar Color: Dorado',exact:true}).click();
  await expect(page.locator('#prod-form-error')).toContainText('historial potencial');await expect(page.locator('#prod-variants-text')).toHaveValue(/Dorado/);
 await page.getByLabel('Stock de Dorado',{exact:true}).fill('0');await page.getByRole('button',{name:'Quitar Color: Dorado',exact:true}).click();
  await expect(page.getByLabel('Stock de Dorado',{exact:true})).toHaveValue('0');await expect(page.locator('#prod-variants-text')).toHaveValue(/Dorado/);await expect(page.locator('#prod-stock')).toHaveValue('1');
 expect(await page.evaluate(()=>window.__masterStock.baseline().expectedEntries)).toEqual([{variant:'Dorado',stock:1},{variant:'Plateado',stock:1}]);
 expect(await page.evaluate(()=>window.__calls.filter(call=>call[0]==='prodGuardar'))).toEqual([]);
});

test('portada por color es explícita, reordenable y conserva metadatos de variante',async({page})=>{
 await openEditor(page,1024,768,true);await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(async()=>{
  const moduleUrl=new URL('/js/admin/products/fotos-por-color.js',location.origin);const {attachColorPhotos}=await import(moduleUrl.href);
  const container=document.createElement('div');container.id='master-color-photos';document.querySelector('[data-product-section=photos] .tt-editor-section-fields').append(container);
  document.getElementById('prod-variants-text').value='Color: Dorado, Plateado';document.getElementById('prod-imageUrl').value='https://img.test/a.webp';document.getElementById('prod-images-extra').value='https://img.test/b.webp\nhttps://img.test/c.webp';
  window.__masterPhotos=attachColorPhotos({container,product:{imageUrl:'https://img.test/a.webp',imagesExtra:['https://img.test/b.webp','https://img.test/c.webp'],variants:{Color:['Dorado','Plateado']},variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/a.webp','https://img.test/b.webp'],sku:'GOLD',price:150000},{Color:'Plateado',imageUrls:['https://img.test/c.webp']}]},variantsInput:document.getElementById('prod-variants-text'),imagesInput:document.getElementById('prod-images-extra'),mainInput:document.getElementById('prod-imageUrl'),openLibrary:async()=>null});
 });
 const gold=page.locator('#master-color-photos fieldset').filter({has:page.locator('legend',{hasText:/^Dorado$/})});
 await gold.getByRole('button',{name:'Usar como primera foto de Dorado',exact:true}).nth(1).click();
 const saved=await page.evaluate(()=>window.__masterPhotos.serialize());const row=saved.find(row=>row.Color==='Dorado');
 expect(row.imageUrls).toEqual(['https://img.test/b.webp','https://img.test/a.webp']);expect(row.sku).toBe('GOLD');expect(row.price).toBe(150000);
 await gold.getByLabel('Color personalizado de Dorado',{exact:true}).fill('#cc99dd');
 expect((await page.evaluate(()=>window.__masterPhotos.serialize())).find(row=>row.Color==='Dorado').colorHex).toBe('#cc99dd');
 await gold.getByLabel('Aspecto del círculo de Dorado',{exact:true}).selectOption('dorado');
 const reset=(await page.evaluate(()=>window.__masterPhotos.serialize())).find(row=>row.Color==='Dorado');expect(reset.colorHex).toBeUndefined();expect(reset.swatch).toBe('dorado');expect(reset.sku).toBe('GOLD');
 expect(saved.find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/c.webp']);
 await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/a.webp');
 await gold.getByRole('button',{name:'Portada del producto: foto 2 de Dorado',exact:true}).click();await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/b.webp');
 expect((await page.evaluate(()=>window.__masterPhotos.serialize())).find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/c.webp']);
});

test('carga múltiple espera archivos, conserva fallidos y reintenta sin duplicar los subidos',async({page})=>{
 await openEditor(page,390,844,`
 export const deleteMediaByUrlIfUnused=async()=>{},deleteMediaItem=async()=>{};
 export async function uploadImageToLibrary(file){window.__masterAttempts??={};window.__masterAttempts[file.name]=(window.__masterAttempts[file.name]||0)+1;if(file.name==='dos.png' && !window.__retryMaster)throw Error('Red interrumpida');return {url:'https://img.test/'+file.name,mediaId:file.name};}
 `);await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(async()=>{const moduleUrl=new URL('/js/components/images/carga-imagenes.js',location.origin);const {attachMultiImageUploadWidget}=await import(moduleUrl.href);const container=document.createElement('div');container.id='master-multiple';document.querySelector('[data-product-section=photos] .tt-editor-section-fields').append(container);window.__masterUploaded=[];window.__bulk=attachMultiImageUploadWidget(container,{remaining:()=>2-window.__masterUploaded.length,onChange:url=>window.__masterUploaded.push(url)});});
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;return canvas.toDataURL('image/png').split(',')[1];});
 await page.locator('#master-multiple input[type=file]').setInputFiles(['uno.png','dos.png'].map(name=>({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
 await expect(page.locator('#master-multiple .tt-editor-upload-item')).toHaveCount(2);
 expect(await page.evaluate(()=>window.__bulk.pendingSignature().length)).toBeGreaterThan(1);
 const message=await page.evaluate(()=>window.__bulk.flush().then(()=>'',error=>error.message));expect(message).toBe('Red interrumpida');
 expect(await page.evaluate(()=>window.__masterUploaded)).toEqual(['https://img.test/uno.png']);await expect(page.locator('#master-multiple .tt-editor-upload-item')).toHaveCount(1);
 await page.evaluate(async()=>{window.__retryMaster=true;await window.__bulk.flush();});
 expect(await page.evaluate(()=>window.__masterUploaded)).toEqual(['https://img.test/uno.png','https://img.test/dos.png']);expect(await page.evaluate(()=>window.__masterAttempts)).toEqual({'uno.png':1,'dos.png':2});
 expect(await page.evaluate(()=>window.__bulk.hasPending())).toBe(false);await expect(page.locator('#master-multiple .tt-editor-upload-item')).toHaveCount(0);
});

test('salir con fotos masivas pendientes activa el guard real sin subir ni borrar imágenes',async({page})=>{
 await openEditor(page,390,844,true);await page.locator('#prod-editor-section').selectOption('photos');
 await page.evaluate(markup=>{if(document.getElementById('unsaved-modal'))return;const parsed=new DOMParser().parseFromString(markup,'text/html');document.body.append(parsed.getElementById('unsaved-modal'));},prompt);
 await page.addScriptTag({url:'/js/admin/proteccion-cambios-pendientes-admin.js'});
 const serializer=adminSource.slice(adminSource.indexOf('function serializeProductForm()'),adminSource.indexOf('window.prodNuevo ='));
 await page.evaluate(async source=>{
  const moduleUrl=new URL('/js/components/images/carga-imagenes.js',location.origin);const {attachMultiImageUploadWidget}=await import(moduleUrl.href);
  const container=document.createElement('div');container.id='master-guard-queue';document.querySelector('[data-product-section=photos] .tt-editor-section-fields').append(container);
  window.__guardQueue=attachMultiImageUploadWidget(container,{onChange:()=>{throw Error('No debe subir para salir');}});
  const serialize=new Function('_formImageWidgets','productColorPhotos','productEditorialData','productCommercialEditor',source+';return serializeProductForm;')(new Map([['prod-gallery-widget',window.__guardQueue]]),null,()=>({}),null);
  window.AdminUnsaved.register('primary-editor',{root:'#prod-form-card',serialize:()=>JSON.stringify(serialize()),save:()=>false});
  window.prodCancelForm=()=>window.AdminUnsaved.requestNavigation(()=>{window.__guardQueue.destroy();document.getElementById('prod-form-card').style.display='none';});
 },serializer);
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;return canvas.toDataURL('image/png').split(',')[1];});
 await page.locator('#master-guard-queue input[type=file]').setInputFiles({name:'pendiente.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(page.locator('#master-guard-queue .tt-editor-upload-item')).toHaveCount(1);
 expect(await page.evaluate(()=>window.AdminUnsaved.isDirty('primary-editor'))).toBe(true);
 await openActions(page);await page.locator('#prod-form-card').getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('#unsaved-modal')).toBeVisible();
 await page.locator('#unsaved-modal-stay').click();await expect(page.locator('#master-guard-queue .tt-editor-upload-item')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__imageCleanup || 0)).toBe(0);
});

for(const [width,height] of [[320,700],[390,844],[768,1024],[1024,768],[1280,720],[1440,900]])test(`panel completo mantiene título, acciones y cantidades sin solaparse ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height);
 for(const file of ['css/admin/admin.css','css/admin/espacio-modulos-admin.css','css/admin/dashboard-control.css','css/theme/sistema-superficies-tintin.css'])await page.addStyleTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.evaluate(({renderer,inventory})=>{
  document.body.classList.add('tt-admin-control');document.getElementById('section-productos').classList.add('tt-admin-workspace','active');
  document.getElementById('prod-form-title').textContent='Editar producto';
  window.__stockRegression=new Function(inventory+'\n'+renderer+'\nreturn {renderProductVariantStock};')();
  window.__stockRegression.renderProductVariantStock({stock:1,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:1},{variant:'Plateado',stock:0}]});
 },{renderer:stockRenderer,inventory:inventorySource});
 const title=await page.locator('#prod-form-title').boundingBox(),actions=await page.locator('#prod-editor-actions').boundingBox();
 expect(actions.y>=title.y+title.height-1 || actions.x>=title.x+title.width-1).toBe(true);
 await expect(page.locator('#prod-save-btn')).toBeInViewport();
 await page.locator('#prod-editor-section').selectOption('inventory');
 for(const row of await page.locator('#prod-variant-stock .tt-editor-stock-row').all()){
  const controls=row.locator('.tt-editor-stepper > *, .tt-editor-quantity-select');const boxes=await controls.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};}));
  const bounds=await row.boundingBox();
  for(const box of boxes){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.right).toBeLessThanOrEqual(bounds.x+bounds.width+1);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(a.right<=b.x+1 || b.right<=a.x+1 || a.bottom<=b.y+1 || b.bottom<=a.y+1).toBe(true);}
 }
 await page.getByRole('button',{name:'Sumar una unidad: Stock de Dorado',exact:true}).click();await expect(page.getByLabel('Stock de Dorado',{exact:true})).toHaveValue('2');
 await openActions(page);await expect(page.locator('#prod-save-btn')).toBeVisible();
 if(width===390||width===1440)await page.screenshot({path:test.info().outputPath('controles-'+width+'.png')});
 await page.keyboard.press('Escape');await expect(page.locator('#prod-form-card')).toBeHidden();await expect(page.locator('[data-action="product-new"]')).toBeFocused();
});

for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]])test(`editor estilo Shopify: columnas, estado, SEO y acciones ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height);
 const card=page.locator('#prod-form-card');
 await page.locator('#prod-name').fill('Reloj Alissia');
 await page.locator('#prod-price').fill('70000');
 await page.locator('#prod-description').fill('Acero inoxidable, para todos los días.');
 await page.locator('#prod-publicationStatus').selectOption('draft');
 await expect(card.locator('#prod-form-title')).toHaveText('Reloj Alissia');
 await expect(card.locator('.tt-product-editor-state')).toHaveText('Borrador');
 await page.locator('#prod-inventory-fields').evaluate(el=>el.style.display='none');
 await expect(card.locator('[data-product-section="private"]')).toBeHidden();
 const layout=card.locator('.tt-editor-layout'),main=card.locator('.tt-product-fields'),sidebar=card.locator('.tt-editor-sidebar');
 const boxes=await Promise.all([main.boundingBox(),sidebar.boundingBox()]);
 if(width>=1000){expect(boxes[1].x).toBeGreaterThanOrEqual(boxes[0].x+boxes[0].width);expect(boxes[0].width).toBeGreaterThan(boxes[1].width);}
 else{expect(Math.abs(boxes[1].x-boxes[0].x)).toBeLessThanOrEqual(1);expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y+boxes[0].height);}
 await expect(main.locator('#prod-description')).toHaveCount(1);
 await expect(sidebar.locator('#prod-category')).toHaveCount(1);
 await expect(sidebar.locator('#prod-publicationStatus')).toHaveCount(1);
 await sidebar.locator('.tt-product-editorial-seo > summary').click();
 await page.locator('#prod-seoTitle').fill('Reloj Alissia · Tintin');
 await expect(page.locator('#prod-seoTitle')).toHaveValue('Reloj Alissia · Tintin');
 await page.locator('#prod-name').fill('Reloj '+ 'A'.repeat(174));
 expect((await card.locator('#prod-form-title').boundingBox()).height).toBeLessThanOrEqual(54);
 await page.locator('#prod-name').fill('Reloj Alissia');
 await card.locator('.adm-card-body').evaluate(el=>el.scrollTop=el.scrollHeight);
 for(const button of await card.locator('#prod-editor-actions button').all())await expect(button).toBeInViewport();
 const dimensions=await card.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
 await page.locator('#prod-save-btn').click();
 expect(await page.evaluate(()=>window.__calls.filter(row=>row[0]==='prodGuardar'))).toEqual([['prodGuardar','Reloj Alissia','70000']]);
 const ids=await card.locator('input[id],select[id],textarea[id]').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(ids.length);
 if(width===390||width===1440){await card.locator('.adm-card-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:test.info().outputPath(`shopify-editor-${width}.png`)});}
});

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]])test(`editor guiado: fotos primero, contraste y borrador ${width}x${height}`,async({page})=>{
 await openEditor(page,width,height);
 const card=page.locator('#prod-form-card');
 expect(await card.locator('.tt-product-fields > [data-product-section]').first().getAttribute('data-product-section')).toBe('photos');
 await page.locator('#prod-name').fill('Pulsera conservada');
 const surfaces=await page.evaluate(()=>{const sample=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor;return [sample('#prod-form-card .adm-card-body'),sample('[data-product-section=general]'),sample('#prod-name')];});
 expect(new Set(surfaces).size).toBe(3);
 await card.locator('.tt-editor-guide summary').click();
 await page.getByRole('button',{name:'2. Información',exact:true}).click();
 await expect(page.locator('#prod-name')).toHaveValue('Pulsera conservada');
 await expect(page.locator('#prod-name')).toBeFocused();
 await expect(card.locator('[data-product-section=photos]')).toBeHidden();
 await page.getByRole('button',{name:'5. Revisar todo',exact:true}).click();
 await expect(card.locator('[data-product-section=photos]')).toBeVisible();
 expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 if(width===390||width===1440){await card.locator('.adm-card-body').evaluate(el=>el.scrollTop=0);await page.screenshot({animations:'disabled',path:test.info().outputPath(`editor-intuitivo-${width}.png`)});}
});

test('visión es opcional, aplica sólo la categoría elegida y descarta resultados de otra foto',async({page})=>{
 await openEditor(page,390,844);
 await page.evaluate(()=>{
  window.__visionWorkers=[];
  window.Worker=class {constructor(){window.__visionWorkers.push(this);}postMessage(){window.__visionLatest=this;}terminate(){this.terminated=true;}};
  const select=document.getElementById('prod-category');select.add(new Option('Carteras','carteras'));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=40;canvas.getContext('2d').fillRect(0,0,40,40);document.getElementById('prod-imageUrl').value=canvas.toDataURL();
 });
 await page.locator('.tt-editor-vision summary').click();
 expect(await page.evaluate(()=>window.__visionWorkers.length)).toBe(0);
 const before=await page.evaluate(()=>({material:document.getElementById('prod-material').value,stock:document.getElementById('prod-stock').value,variants:document.getElementById('prod-variants-text').value}));
 await page.getByRole('button',{name:'Analizar imagen principal',exact:true}).click();
 await page.waitForFunction(()=>window.__visionLatest);
 await page.evaluate(()=>window.__visionLatest.onmessage({data:{ok:true,suggestion:{key:'bag',label:'Cartera'}}}));
 await expect(page.getByRole('button',{name:'Usar categoría Carteras',exact:true})).toBeVisible();
 await expect(page.locator('#prod-category')).not.toHaveValue('carteras');
 await page.locator('#prod-category').evaluate(select=>select.disabled=true);
 await page.getByRole('button',{name:'Usar categoría Carteras',exact:true}).click();
 await expect(page.locator('#prod-category')).not.toHaveValue('carteras');
 await page.locator('#prod-category').evaluate(select=>select.disabled=false);
 await page.getByRole('button',{name:'Usar categoría Carteras',exact:true}).click();
 await expect(page.locator('#prod-category')).toHaveValue('carteras');
 const after=await page.evaluate(()=>({material:document.getElementById('prod-material').value,stock:document.getElementById('prod-stock').value,variants:document.getElementById('prod-variants-text').value}));expect(after).toEqual(before);
 await page.locator('#prod-editor-section').selectOption('specs');
 await expect(page.getByRole('group',{name:'Sugerencias: Material',exact:true}).getByRole('button',{name:'Cuero sintético',exact:true})).toBeVisible();
 await page.locator('#prod-editor-section').selectOption('photos');
 await page.getByRole('button',{name:'Analizar imagen principal',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancelar análisis',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancelar análisis',exact:true}).click();
 await expect(page.locator('.tt-editor-vision [role=status]')).toHaveText('Análisis cancelado. Podés seguir editando.');
 await page.evaluate(()=>window.__visionLatest.onmessage({data:{ok:true,suggestion:{key:'watch',label:'Reloj'}}}));
 await expect(page.locator('.tt-editor-vision .tt-editor-choices button')).toHaveCount(0);
});
