'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {mockRuntime,fixtureHtml}=require('./helpers/admin-commerce-fixture.cjs');
const root=path.resolve(__dirname,'../..');
const shell=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const adminSource=fs.readFileSync(path.join(root,'js/admin/admin-app.js'),'utf8');
const stockRenderer=adminSource.slice(adminSource.indexOf('let productVariantStockBaseline = null;'),adminSource.indexOf('function serializeProductForm()'));
const inventorySource=fs.readFileSync(path.join(root,'js/core/store/inventario-variantes.mjs'),'utf8').replaceAll('export ','');
const loader=fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
const entryScroll=loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial'));

const formStart=shell.indexOf('<div class="adm-card" id="prod-form-card"');
const form=shell.slice(formStart,shell.indexOf('\n    </div>\n\n    <!-- ===================== COLECCIONES',formStart));
const promptStart=shell.indexOf('<div id="unsaved-modal"');
const prompt=shell.slice(promptStart,shell.indexOf('\n<!-- ═',promptStart));

async function openEditor(page,width,height,withImages=false,beforeOpen=null){
 await page.setViewportSize({width,height});await mockRuntime(page);
 if(withImages) await page.route('https://tintin.test/js/components/images/biblioteca-multimedia.js*',route=>route.fulfill({contentType:'text/javascript',body:'export const deleteMediaByUrlIfUnused=()=>{window.__imageCleanup=(window.__imageCleanup||0)+1;throw Error("Sin escrituras");};export const deleteMediaItem=deleteMediaByUrlIfUnused;export const uploadImageToLibrary=deleteMediaByUrlIfUnused;'}));
 const html=fixtureHtml();const start=html.indexOf('<div class="adm-card" id="prod-form-card"');
 const full=html.slice(0,start)+form+html.slice(html.indexOf('</section>',start));
 await page.route('https://tintin.test/admin-commerce-fixture',route=>route.fulfill({contentType:'text/html',body:full}));
 await page.goto('https://tintin.test/admin-commerce-fixture');
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

test('configurar stock por color exige cantidades explícitas y recalcula total y vista previa',async({page})=>{
 await openEditor(page,775,900);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.evaluate(({renderer,inventory})=>{
  window.__stockEditor=new Function(inventory+'\n'+renderer+'\nreturn {renderProductVariantStock,baseline:()=>productVariantStockBaseline};')();
  window.__stockEditor.renderProductVariantStock({stock:1});
 },{renderer:stockRenderer,inventory:inventorySource});
 await page.locator('#prod-variants-text').fill('Color: dorado, plateado');
 await page.getByRole('button',{name:'Distribuir stock por opción',exact:true}).click();
 const quantities=page.locator('#prod-variant-stock input');await expect(quantities).toHaveCount(2);
 await expect(quantities.nth(0)).toHaveValue('');await expect(quantities.nth(1)).toHaveValue('');
 await quantities.nth(0).fill('1');await quantities.nth(1).fill('1');
 await expect(page.locator('#prod-stock')).toHaveValue('2');await expect(page.locator('#prod-stock')).toHaveAttribute('readonly','');
 await expect(page.locator('#prod-variants-text')).toHaveAttribute('readonly','');
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
  await page.locator('#prod-form-card .adm-card-head button').click();
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

test('foto principal completa en editor real y rotación conserva borrador y pie de acciones',async({page})=>{
 await openEditor(page,390,844,true);await page.locator('#prod-name').fill('Borrador conservado');await page.locator('#prod-editor-section').selectOption('photos');
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
   const {setProductPreviewMedia}=await loadModule('/js/admin/products/vista-previa-producto.js?v=tintin-20261019-product-editor-1');
   setProductPreviewMedia(card,[{'Diseño de anillo':'coctel',imageUrls:['https://img.test/coctel.webp']},{'Diseño de anillo':'banda',imageUrls:['https://img.test/banda.webp']}]);
   card.dispatchEvent(new Event('input',{bubbles:true}));
  },stockRenderer);
  await page.locator('#prod-editor-section').selectOption('inventory');
  await expect(page.getByLabel('Stock de coctel',{exact:true})).toHaveValue('1');
  await page.getByLabel('Stock de banda',{exact:true}).fill('0');
  await expect(page.locator('#prod-stock')).toHaveValue('1');
  await expect(page.locator('.tt-editor-stock-row').last()).toContainText('Agotado');
  await expect(page.locator('.tt-editor-stock-row').last().locator('img')).toHaveAttribute('src',/banda.webp/);
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
  const {attachImageUploadWidget}=await loadModule('/js/components/images/carga-imagenes.js?fixture');
  const {attachColorPhotos}=await loadModule('/js/admin/products/fotos-por-color.js');
  const {sanitizeImageUrl}=await loadModule('/js/components/images/utilidades-imagenes.js');
  document.getElementById('prod-imageUrl').value='https://img.test/portada.webp';
  document.getElementById('prod-variants-text').value='Diseño: Coctel, Banda';
  let number=0;const library=async()=>window.__delayGalleryChoice ? new Promise(resolve=>{window.__resolveGalleryChoice=resolve;}) : `https://img.test/extra-${++number}.webp`;
  window.__remountGallery=new Function('attachImageUploadWidget','attachColorPhotos','openMediaLibraryPicker','sanitizeImageUrl','_formImageWidgets',source+';mountProductColorPhotos({variants:{Diseño:["Coctel","Banda"]}});return mountProductColorPhotos;')(attachImageUploadWidget,attachColorPhotos,library,sanitizeImageUrl,new Map());
 },mount);
 await page.locator('#prod-editor-section').selectOption('photos');
 const gallery=page.locator('#prod-gallery-widget');
 await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/extra-1.webp\nhttps://img.test/extra-2.webp');
 await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/portada.webp');
 await expect(page.locator('.tt-editor-thumbnails button')).toHaveCount(3);
 await expect(page.locator('#prod-gallery-thumbs img')).toHaveCount(2);
 page.once('dialog',dialog=>dialog.accept());await gallery.getByRole('button',{name:'Quitar',exact:true}).click();
 await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/extra-1.webp');
 await expect(page.locator('.tt-editor-thumbnails button')).toHaveCount(2);
 await page.getByRole('button',{name:'Quitar foto 1 de la galería',exact:true}).click();
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

for (const width of [1200,1440,1920]) test(`apartado seleccionado conserva texto legible con el tema real ${width}`,async({page})=>{
 await openEditor(page,width,900);
 await page.addStyleTag({path:path.join(root,'css/core/tema-unificado-tintin.css')});
 for(const colors of [['#F8AACA','#222222'],['#222222','#FFFFFF']]) {
  await page.evaluate(([background,text])=>{document.documentElement.style.setProperty('--admin-color-button-primary-background',background);document.documentElement.style.setProperty('--admin-color-button-primary-text',text);},colors);
  for (const button of await page.locator('.tt-editor-shortcuts button').all()) {
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
