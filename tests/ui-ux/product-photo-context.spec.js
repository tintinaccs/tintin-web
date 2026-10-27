'use strict';
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const product={name:'Bolso de prueba',category:'qa-tablet',description:'Descripción conservada',price:180000,stock:5,imageUrl:'https://img.test/one.webp',imagesExtra:['https://img.test/two.webp'],variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:3},{variant:'Plateado',stock:2}],variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/one.webp']}],active:true,publicationStatus:'active',material:'Material confirmado'};
async function open(page,width=1440){await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',product]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);}
for(const width of [320,390,600,768,1024,1440])test(`bloque contextual completo conserva fotos, datos y stock ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page,width);
 await expect(page.locator('#prod-form-card.tt-editor-composer')).toBeVisible();
 if(width>=1100){const photo=await page.locator('.tt-unified-photos').boundingBox(),controls=await page.locator('.tt-photo-product-controls').boundingBox();expect(photo.x+photo.width).toBeLessThanOrEqual(controls.x+1);}
 await expect(page.locator('.tt-photo-product-controls #prod-price')).toHaveCount(1);
 await expect(page.locator('.tt-photo-product-controls #prod-stock')).toHaveCount(1);
 await expect(page.locator('.tt-photo-product-controls #prod-variants-text')).toHaveCount(1);
 await page.getByRole('checkbox',{name:'Seleccionar foto 1',exact:true}).check();await page.getByRole('checkbox',{name:'Seleccionar foto 2',exact:true}).check();
 await expect(page.locator('.tt-photo-selection-bar')).toContainText('2 fotografías seleccionadas');
 await expect(page.locator('.tt-work-status')).not.toHaveAttribute('data-state','pending');
 await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).check();
 await expect(page.getByRole('button',{name:'Asociar fotografías',exact:true})).toHaveCount(0);
 await expect(page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true})).toBeFocused();
 const body=page.locator('#prod-form-card .adm-card-body'),start=await body.evaluate(node=>node.scrollTop);
 await page.evaluate(()=>{window.qaPhotoNodes=[...document.querySelectorAll('.tt-unified-photo > img')];window.qaColorNode=document.querySelector('[aria-label="Asociar color Plateado"]');});
 for(let i=0;i<10;i++){
   await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).uncheck();
   await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).check();
 }
 expect(Math.abs(await body.evaluate(node=>node.scrollTop)-start)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>window.qaPhotoNodes.every((node,index)=>node===document.querySelectorAll('.tt-unified-photo > img')[index]))).toBe(true);
 expect(await page.evaluate(()=>window.qaColorNode===document.querySelector('[aria-label="Asociar color Plateado"]'))).toBe(true);
 await page.getByRole('button',{name:'Editar selección',exact:true}).click();
 const positions=await page.evaluate(()=>({context:document.querySelector('.tt-photo-context').getBoundingClientRect().top,gallery:document.querySelector('.tt-unified-photo-grid').getBoundingClientRect().top}));expect(positions.context).toBeLessThan(positions.gallery);
 await page.screenshot({path:info.outputPath(`seleccion-${width}.png`),animations:'disabled'});
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('190000');
 await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Bolso editado junto a sus fotos');
 await page.locator('#prod-category').evaluate(select=>{select.add(new Option('Bags','bags'));select.value='bags';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(page.locator('.tt-category-fields')).toContainText('Bolsos y carteras');
 await page.locator('.tt-category-fields').getByRole('button',{name:'Tipo de bolso: bandolera.',exact:true}).click();
 await expect(page.locator('#prod-description')).toHaveValue(/Descripción conservada/);
 await expect(page.locator('#prod-description')).toHaveValue(/Tipo de bolso: bandolera\./);
 await expect(page.locator('#prod-material')).toHaveValue('Material confirmado');
 // Categoría QA válida para el contrato de persistencia; el cambio visual no sobrescribe valores.
 await page.locator('#prod-category').selectOption('qa-tablet');
 await page.locator('#prod-editor-section').selectOption('all');
 await expect(page.locator('#prod-save-btn')).toBeInViewport();
 expect(await page.locator('#prod-form-card').evaluate(card=>card.scrollWidth<=card.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`contexto-${width}.png`),animations:'disabled'});
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.stock).toBe(5);expect(saved.price).toBe(190000);expect(saved.variantInventory).toEqual(product.variantInventory);
 expect(saved.variantMedia.find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/one.webp','https://img.test/two.webp']);
 expect(saved.variantMedia.find(row=>row.Color==='Dorado').imageUrls).toEqual(['https://img.test/one.webp']);
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(page.locator('#prod-name')).toHaveValue('Bolso editado junto a sus fotos');await expect(page.locator('.tt-unified-photos')).toHaveCount(1);
 await expect(page.locator('#prod-price')).toHaveCount(1);await expect(page.locator('#prod-variants-text')).toHaveCount(1);expect(errors).toEqual([]);
});
test('quitar asociaciones de varias fotos conserva las fotos y las demás asociaciones',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
 await page.getByRole('checkbox',{name:'Asociar color Dorado',exact:true}).check();await page.getByRole('checkbox',{name:'Asociar color Dorado',exact:true}).uncheck();
 await expect(page.locator('.tt-unified-photo')).toHaveCount(2);await expect(page.locator('#prod-imageUrl')).toHaveValue(product.imageUrl);
 await expect.poll(()=>page.evaluate(()=>{const rows=[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))?.[1]?.snapshot?.variantMedia;return Boolean(rows && rows.every(row=>!row.imageUrls?.length && !row.imageUrl));})).toBe(true);
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa').variantMedia)).toEqual(product.variantMedia);
 const snapshot=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(snapshot.variantMedia.find(row=>row.Color==='Dorado')?.imageUrls || []).toEqual([]);
});
test('automatizar un color conserva asociaciones ajenas, portada y versión pública',async({page})=>{
 await open(page);await page.getByRole('checkbox',{name:'Seleccionar foto 2',exact:true}).check();
 await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).check();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).uncheck();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const snapshot=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(snapshot.variantMedia.find(row=>row.Color==='Dorado').imageUrls).toEqual([product.imageUrl]);
 expect(snapshot.variantMedia.find(row=>row.Color==='Plateado').imageUrls || []).toEqual([]);
 expect(snapshot.imageUrl).toBe(product.imageUrl);
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa'))).toEqual(product);
});
test('quitar un color conserva en galería una foto histórica sólo referenciada por variante',async({page})=>{
 const historical={...product,imagesExtra:[],variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/two.webp']}]};
 await openProductSaveFixture(page,390,844,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',historical]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('checkbox',{name:'Seleccionar foto 2',exact:true}).check();
 await page.getByRole('checkbox',{name:'Asociar color Dorado',exact:true}).uncheck();
 await expect(page.locator('.tt-unified-photo')).toHaveCount(2);await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/two.webp');
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const snapshot=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(snapshot.imageUrl).toBe(product.imageUrl);expect(snapshot.imagesExtra).toBe('https://img.test/two.webp');
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa'))).toEqual(historical);
});

test('precio y stock por combinación se editan junto a las fotos preservando IDs',async({page})=>{
 const v2={...product,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado'],Talle:['M']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado',Talle:'M'},stock:3,price:210000},{variant:'silver',attributes:{Color:'Plateado',Talle:'M'},stock:2,price:220000}]};
 await openProductSaveFixture(page,1440,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',v2]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('checkbox',{name:'Seleccionar foto 1',exact:true}).check();await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).check();await page.getByLabel('Asociación: Talle',{exact:true}).selectOption('M');await page.getByRole('button',{name:'Asociar fotografías',exact:true}).click();
 await page.locator('#prod-editor-section').selectOption('availability');
 await page.getByRole('spinbutton',{name:'Precio: Dorado / M',exact:true}).fill('215000');await page.getByRole('spinbutton',{name:'Stock: Dorado / M',exact:true}).fill('4');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.price).toBe(180000);expect(saved.stock).toBe(6);expect(saved.variantInventory.find(row=>row.variant==='gold')).toMatchObject({stock:4,price:215000});expect(saved.variantInventory.find(row=>row.variant==='silver')).toEqual(v2.variantInventory[1]);expect(saved.variantMedia.find(row=>row.Color==='Plateado' && row.Talle==='M').imageUrls).toContain(product.imageUrl);
});
test('agregar color desde el mismo bloque no distribuye stock de un producto simple',async({page})=>{
 const plain={...product,variants:{},variantInventory:undefined,variantMedia:[]};
 await openProductSaveFixture(page,390,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',plain]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('checkbox',{name:'Seleccionar foto 1',exact:true}).check();await page.locator('.tt-category-fields').getByRole('button',{name:'Agregar variante Color',exact:true}).click();
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Negro');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await expect(page.locator('#prod-stock')).toHaveValue('5');await page.getByRole('checkbox',{name:'Asociar color Negro',exact:true}).check();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));expect(saved.stock).toBe(5);expect(saved.variantInventory).toBeUndefined();expect(saved.variants.Color).toEqual(['Negro']);expect(saved.variantMedia[0].imageUrls).toEqual([product.imageUrl]);
});
test('un reemplazo pendiente no se pierde al intentar cambiar asociaciones y quitar su foto lo cancela',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Reemplazar foto 1',exact:true}).click();
 await page.locator('.tt-photo-context input[type=file]').setInputFiles({name:'reemplazo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Asociar foto 2',exact:true}).click();await expect(page.locator('.tt-unified-photos > [role=status]')).toContainText('reemplazo pendiente');await expect(page.locator('.tt-photo-context input[type=file]')).toHaveCount(1);
 await page.getByRole('button',{name:'Quitar foto 1',exact:true}).click();await page.evaluate(()=>window.qaProductController.workspace.save());await expect(page.locator('.tt-unified-photo')).toHaveCount(1);await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/two.webp');
});

test('un segundo atributo de color no mezcla sus valores con el color principal',async({page})=>{
 const multiple={...product,variants:{Color:['Dorado','Plateado'],'Color de correa':['Negro','Blanco']}};
 await openProductSaveFixture(page,1440,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',multiple]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('checkbox',{name:'Seleccionar foto 1',exact:true}).check();await page.getByRole('checkbox',{name:'Asociar color Plateado',exact:true}).check();await page.getByLabel('Asociación: Color de correa',{exact:true}).selectOption('Negro');await page.getByRole('button',{name:'Asociar fotografías',exact:true}).click();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const rows=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot.variantMedia);
 expect(rows.find(row=>row.Color==='Plateado' && row['Color de correa']==='Negro').imageUrls).toContain(product.imageUrl);
 expect(rows.some(row=>row['Color de correa']==='Plateado')).toBe(false);
});
