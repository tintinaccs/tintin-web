const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const names=['Información','Fotos y colores','Variantes','Precio y stock','Detalles','Publicación'];
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
async function valid(page){
 await tab(page,'Información').click();await page.locator('#prod-name').fill('Producto de prueba');await page.locator('#prod-description').fill('Descripción de prueba');await page.locator('#prod-category').selectOption('qa-tablet');
 await page.locator('#prod-imageUrl').evaluate(input=>{input.value='https://img.test/real-product.jpg';input.dispatchEvent(new Event('change',{bubbles:true}));});
 await tab(page,'Precio y stock').click();await page.locator('#prod-price').fill('45000');
}
for(const width of [320,390,768,1024,1440])test(`seis pestañas conservan nodos, datos y geometría ${width}`,async({page})=>{
 await openProductSaveFixture(page,width,900,{photos:true});
 await expect(page.locator('#prod-form-card').getByRole('tab')).toHaveText(names);
 await valid(page);
 await page.locator('#prod-stock').fill('0');
 const original=await page.locator('#prod-name').evaluate(input=>{window.qaOriginalName=input;return true;});expect(original).toBe(true);
 for(const name of names){await tab(page,name).click();await expect(tab(page,name)).toHaveAttribute('aria-selected','true');await expect(page.locator('.tt-product-tabpanel:visible')).toHaveCount(1);
  const bounds=await page.locator('#prod-form-card').evaluate(card=>({width:card.clientWidth,scroll:card.scrollWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
  await expect(page.locator('#prod-save-btn')).toBeInViewport();
 }
 await tab(page,'Información').click();await expect(page.locator('#prod-name')).toHaveValue('Producto de prueba');expect(await page.locator('#prod-name').evaluate(input=>input===window.qaOriginalName)).toBe(true);await expect(page.locator('#prod-price')).toBeHidden();
 await tab(page,'Precio y stock').click();await expect(page.locator('#prod-stock')).toHaveValue('0');await expect(page.locator('#prod-price')).toHaveValue('45000');
 await page.screenshot({path:`artifacts/product-editor-tabs/precio-stock-${width}.png`,animations:'disabled'});
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));expect(saved.stock).toBe(0);expect(saved.price).toBe(45000);
 await page.evaluate(()=>window.prodEditar('qa-product-1'));await expect(page.locator('#prod-name')).toBeVisible();await expect(page.locator('#prod-name')).toHaveValue('Producto de prueba');
 for(const name of names){await tab(page,name).click();await page.screenshot({path:`artifacts/product-editor-tabs/${width}-${names.indexOf(name)+1}.png`,animations:'disabled'});}
});
test('edición inline de combinaciones, fotos por color y cantidades sin duplicar',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await valid(page);
 await tab(page,'Variantes').click();
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await page.getByText('Combinaciones · Editar aquí',{exact:true}).click();
 await expect(tab(page,'Variantes')).toHaveAttribute('aria-selected','true');await expect(page.locator('.tt-combination-inline #prod-variant-stock')).toBeVisible();
 await page.getByRole('button',{name:'Asignar stock por color u opción',exact:true}).click();await page.locator('#prod-variant-stock input[type=number]').fill('7');
 await tab(page,'Precio y stock').click();await expect(page.locator('#prod-stock')).toHaveValue('7');await expect(page.locator('[data-product-section=availability] #prod-variant-stock')).toBeVisible();
 await tab(page,'Fotos y colores').click();await page.getByRole('group',{name:'Fotos por color'}).getByRole('button',{name:'Dorado',exact:true}).click();
 await expect(page.getByLabel('Usar foto 1 en Dorado',{exact:true})).toBeVisible();await page.getByLabel('Usar foto 1 en Dorado',{exact:true}).check();
 await expect(page.locator('.tt-photo-context [aria-label="Precio y stock de Dorado"]')).toHaveAttribute('aria-expanded','true');await expect(tab(page,'Fotos y colores')).toHaveAttribute('aria-selected','true');await page.getByLabel('Stock de Dorado',{exact:true}).fill('8');await page.getByRole('button',{name:'Cerrar Disponibilidad · Dorado',exact:true}).click();
 await tab(page,'Detalles').click();await page.locator('#prod-material').fill('Acero inoxidable');await tab(page,'Fotos y colores').click();await expect(page.getByLabel('Usar foto 1 en Dorado',{exact:true})).toBeChecked();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));expect(saved.stock).toBe(8);expect(saved.variantInventory).toEqual([{variant:'Dorado',stock:8}]);expect(saved.material).toBe('Acero inoxidable');
});
test('teclado, movimiento reducido y validación contextual',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openProductSaveFixture(page,320,700);await tab(page,'Información').focus();await page.keyboard.press('ArrowRight');await expect(tab(page,'Fotos y colores')).toBeFocused();await page.keyboard.press('End');await expect(tab(page,'Publicación')).toBeFocused();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-error')).toBeVisible();await expect(tab(page,'Información')).toHaveAttribute('aria-selected','true');await expect(page.locator('#prod-name')).toHaveAttribute('aria-invalid','true');
 await page.getByRole('button',{name:'Ir al campo',exact:true}).click();await expect(page.locator('#prod-name')).toBeFocused();
 await page.locator('#prod-name').fill('Nombre corregido');await expect(page.locator('#prod-name')).not.toHaveAttribute('aria-invalid','true');
 expect(await page.locator('.tt-product-tabpanel:visible').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('permisos internos siguen ocultos al recorrer las seis pestañas',async({page})=>{
 await openProductSaveFixture(page,390,844);await page.locator('#prod-inventory-fields').evaluate(field=>field.style.display='none');
 for(const name of names){await tab(page,name).click();await expect(page.locator('#prod-cost-unit')).toBeHidden();await expect(page.locator('#prod-internal-notes')).toBeHidden();}
 await expect(page.locator('#prod-cost-unit')).toHaveCount(1);
});
test('cerrar fotos inline restituye colores y edición contextual en Fotos',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await valid(page);await tab(page,'Variantes').click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await expect(page.getByRole('region',{name:'Fotos · Dorado',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Precio y stock de Dorado',exact:true})).toBeHidden();
 await tab(page,'Fotos y colores').click();await page.getByRole('group',{name:'Fotos por color',exact:true}).getByRole('button',{name:'Dorado',exact:true}).click();await expect(page.locator('.tt-photo-context [aria-label="Precio y stock de Dorado"]')).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('region',{name:'Disponibilidad · Dorado',exact:true})).toBeVisible();await expect(page.locator('.tt-unified-photos')).toHaveCount(1);
});

test('seleccionar color muestra primero su foto real y conserva la selección entre pestañas',async({page})=>{
 const product={name:'Fotos por color',description:'Prueba de asociaciones',category:'qa-tablet',price:45000,stock:null,active:true,publicationStatus:'active',imageUrl:'https://img.test/general.webp',imagesExtra:['https://img.test/dorado.webp'],variants:{Color:['Dorado']},variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/dorado.webp']}]};
 await openProductSaveFixture(page,390,844,{photos:true,initialRecords:[['products/existing',product]]});await page.evaluate(()=>{window.prodCancelForm();window.qaProductController.refresh();window.prodEditar('existing');});
 await tab(page,'Fotos y colores').click();await page.getByRole('group',{name:'Fotos por color'}).getByRole('button',{name:'Dorado',exact:true}).click();
 await expect(page.locator('.tt-unified-photo img').first()).toHaveAttribute('src','https://img.test/dorado.webp');await expect(page.getByLabel('Usar foto 2 en Dorado',{exact:true})).toBeChecked();
 await tab(page,'Detalles').click();await tab(page,'Fotos y colores').click();await expect(page.locator('.tt-unified-photo img').first()).toHaveAttribute('src','https://img.test/dorado.webp');await expect(page.getByRole('group',{name:'Fotos por color'}).getByRole('button',{name:'Dorado',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('abrir y cerrar la superficie antes de montar campos no provoca errores ni pierde foco',async({page})=>{
 const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');await page.locator('[data-action="product-new"]').click();await expect(page.locator('#prod-form-card')).toBeVisible();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('#prod-form-card')).toHaveAttribute('role','dialog');expect(errors).toEqual([]);
 await page.evaluate(()=>{document.getElementById('prod-form-card').style.display='none';});await expect(page.locator('[data-action="product-new"]')).toBeFocused();expect(errors).toEqual([]);
});

for(const width of [320,390,768,854,1024,1440])test(`referencia Studio: galería y controles canónicos sin recorte ${width}`,async({page},info)=>{
 const image='https://img.test/studio-gold.webp',silver='https://img.test/studio-silver.webp';
 const product={name:'Anillo de prueba',description:'Producto ficticio para revisión visual',category:'qa-tablet',price:50000,stock:10,active:true,publicationStatus:'active',imageUrl:image,imagesExtra:[silver],variants:{Color:['Dorado','Plateado']},variantMedia:[{Color:'Dorado',imageUrls:[image]},{Color:'Plateado',imageUrls:[silver]}],variantInventory:[{variant:'Dorado',stock:4},{variant:'Plateado',stock:6}]};
 await openProductSaveFixture(page,width,1000,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/studio',product]]});
 await page.route('https://img.test/studio-*.webp',route=>route.fulfill({contentType:'image/webp',body:require('node:fs').readFileSync('assets-tintin/images/collections/col-anillos.webp')}));
 await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('studio');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await tab(page,'Fotos y colores').click();
 await page.getByRole('group',{name:'Fotos por color'}).getByRole('button',{name:'Dorado',exact:true}).click();
 await expect(page.locator('.tt-studio-photo > img')).toHaveAttribute('src',image);
 await page.waitForFunction(()=>{const image=document.querySelector('.tt-studio-photo > img');return image.complete && image.naturalWidth>0;});
 await expect(page.locator('.tt-studio-photo figcaption')).toHaveText('Imagen asociada a Dorado');
 await expect(page.locator('.tt-photo-context [aria-label="Precio y stock de Dorado"]')).toHaveAttribute('aria-expanded','true');
 await expect(page.getByLabel('Stock de Dorado',{exact:true})).toBeVisible();
 await expect(page.locator('#prod-variant-stock')).toHaveCount(1);
 const geometry=await page.locator('.tt-studio-photo-layout').evaluate(el=>{const visual=el.querySelector('.tt-studio-photo-visual').getBoundingClientRect(),side=el.querySelector('.tt-studio-photo-side').getBoundingClientRect();return {width:el.clientWidth,scroll:el.scrollWidth,visual:{x:visual.x,right:visual.right},side:{x:side.x,right:side.right}};});
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
 if(geometry.width>620 && width>=768)expect(geometry.side.x).toBeGreaterThanOrEqual(geometry.visual.right);
 await expect(page.locator('.tt-studio-pagination')).toContainText('Fotos y colores · 2 de 6');
 await page.locator('.tt-studio-pagination').getByRole('button',{name:'Continuar a Variantes →',exact:true}).click();await expect(tab(page,'Variantes')).toHaveAttribute('aria-selected','true');
 await tab(page,'Fotos y colores').click();await expect(page.locator('.tt-studio-photo > img')).toHaveAttribute('src',image);
 await page.getByRole('button',{name:'Precio y stock de Dorado',exact:true}).click();
 await page.locator('#prod-form-card .adm-card-body').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:info.outputPath(`studio-reference-${width}.png`),animations:'disabled'});
});
