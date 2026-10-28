'use strict';
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const product={name:'Bolso de prueba',category:'qa-tablet',description:'Descripción conservada',price:180000,stock:5,imageUrl:'https://img.test/one.webp',imagesExtra:['https://img.test/two.webp'],variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:3},{variant:'Plateado',stock:2}],variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/one.webp']}],active:true,publicationStatus:'active',material:'Material confirmado'};
async function open(page,width=1440,initial=product){await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',initial]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);}
async function editPhotos(page,value,attribute='Color'){
 const toggle=page.getByRole('button',{name:'Opciones y variantes',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await page.getByRole('button',{name:`Fotos de ${attribute}: ${value}`,exact:true}).click();
 return page.getByRole('region',{name:`Fotos · ${value}`,exact:true});
}
for(const width of [320,390,600,768,1024,1440])test(`bloque contextual completo conserva fotos, datos y stock ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page,width);
 await expect(page.locator('#prod-form-card.tt-editor-composer')).toBeVisible();
 if(width>=1100){const photo=await page.locator('.tt-unified-photos').boundingBox(),controls=await page.locator('.tt-photo-product-controls').boundingBox();expect(photo.x+photo.width).toBeLessThanOrEqual(controls.x+1);}
 await expect(page.locator('.tt-photo-product-controls #prod-price')).toHaveCount(1);
 await expect(page.locator('.tt-photo-product-controls #prod-stock')).toHaveCount(1);
 await expect(page.locator('.tt-photo-product-controls #prod-variants-text')).toHaveCount(1);
 const option=await editPhotos(page,'Plateado');
 const photo1=option.getByRole('checkbox',{name:'Usar foto 1 en Plateado',exact:true}),photo2=option.getByRole('checkbox',{name:'Usar foto 2 en Plateado',exact:true});
 await photo1.check();await photo2.check();await expect(photo2).toBeFocused();
 await expect(page.getByRole('button',{name:'Asociar fotografías',exact:true})).toHaveCount(0);
 await expect(page.locator('.tt-photo-selection-bar')).toHaveCount(0);
 await expect(page.locator('.tt-work-status')).not.toHaveAttribute('data-state','pending');
 const body=page.locator('#prod-form-card .adm-card-body'),start=await body.evaluate(node=>node.scrollTop);
 await page.evaluate(()=>{window.qaPhotoNodes=[...document.querySelectorAll('.tt-option-photo-pick img')];window.qaColorNode=document.querySelector('[aria-label="Usar foto 2 en Plateado"]');});
 for(let i=0;i<10;i++){await photo2.uncheck();await photo2.check();}
 expect(Math.abs(await body.evaluate(node=>node.scrollTop)-start)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>window.qaPhotoNodes.every((node,index)=>node===document.querySelectorAll('.tt-option-photo-pick img')[index]))).toBe(true);
 expect(await page.evaluate(()=>window.qaColorNode===document.querySelector('[aria-label="Usar foto 2 en Plateado"]'))).toBe(true);
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
 await open(page);const option=await editPhotos(page,'Dorado');await option.getByRole('checkbox',{name:'Usar foto 2 en Dorado',exact:true}).check();
 await option.getByRole('checkbox',{name:'Usar foto 1 en Dorado',exact:true}).uncheck();await option.getByRole('checkbox',{name:'Usar foto 2 en Dorado',exact:true}).uncheck();
 await expect(page.locator('.tt-unified-photo')).toHaveCount(2);await expect(page.locator('#prod-imageUrl')).toHaveValue(product.imageUrl);
 await expect.poll(()=>page.evaluate(()=>{const rows=[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))?.[1]?.snapshot?.variantMedia;return Boolean(rows && rows.every(row=>!row.imageUrls?.length && !row.imageUrl));})).toBe(true);
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa').variantMedia)).toEqual(product.variantMedia);
 const snapshot=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(snapshot.variantMedia.find(row=>row.Color==='Dorado')?.imageUrls || []).toEqual([]);
});
test('automatizar un color conserva asociaciones ajenas, portada y versión pública',async({page})=>{
 await open(page);const option=await editPhotos(page,'Plateado');await option.getByRole('checkbox',{name:'Usar foto 2 en Plateado',exact:true}).check();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 await option.getByRole('checkbox',{name:'Usar foto 2 en Plateado',exact:true}).uncheck();
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
 const option=await editPhotos(page,'Dorado');await option.getByRole('checkbox',{name:'Usar foto 2 en Dorado',exact:true}).uncheck();
 await expect(page.locator('.tt-unified-photo')).toHaveCount(2);await expect(page.locator('#prod-images-extra')).toHaveValue('https://img.test/two.webp');
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const snapshot=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(snapshot.imageUrl).toBe(product.imageUrl);expect(snapshot.imagesExtra).toBe('https://img.test/two.webp');
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa'))).toEqual(historical);
});

test('precio y stock por combinación se editan junto a las fotos preservando IDs',async({page})=>{
 const v2={...product,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado'],Talle:['M']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado',Talle:'M'},stock:3,price:210000},{variant:'silver',attributes:{Color:'Plateado',Talle:'M'},stock:2,price:220000}]};
 await openProductSaveFixture(page,1440,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',v2]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 const option=await editPhotos(page,'Plateado');await option.getByLabel('Fotos de esta opción: Talle',{exact:true}).selectOption('M');await option.getByRole('checkbox',{name:'Usar foto 1 en Plateado / M',exact:true}).check();
 await page.locator('#prod-editor-section').selectOption('availability');
 await page.getByRole('spinbutton',{name:'Precio: Dorado / M',exact:true}).fill('215000');await page.getByRole('spinbutton',{name:'Stock: Dorado / M',exact:true}).fill('4');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.price).toBe(180000);expect(saved.stock).toBe(6);expect(saved.variantInventory.find(row=>row.variant==='gold')).toMatchObject({stock:4,price:215000});expect(saved.variantInventory.find(row=>row.variant==='silver')).toEqual(v2.variantInventory[1]);expect(saved.variantMedia.find(row=>row.Color==='Plateado' && row.Talle==='M').imageUrls).toContain(product.imageUrl);
});
test('agregar color desde el mismo bloque no distribuye stock de un producto simple',async({page})=>{
 const plain={...product,variants:{},variantInventory:undefined,variantMedia:[]};
 await openProductSaveFixture(page,390,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',plain]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('.tt-category-fields').getByRole('button',{name:'Agregar variante Color',exact:true}).click();
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Negro');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await expect(page.locator('#prod-stock')).toHaveValue('5');const option=await editPhotos(page,'Negro');await option.getByRole('checkbox',{name:'Usar foto 1 en Negro',exact:true}).check();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));expect(saved.stock).toBe(5);expect(saved.variantInventory).toBeUndefined();expect(saved.variants.Color).toEqual(['Negro']);expect(saved.variantMedia[0].imageUrls).toEqual([product.imageUrl]);
});
test('un reemplazo pendiente no se pierde al intentar cambiar asociaciones y quitar su foto lo cancela',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Reemplazar foto 1',exact:true}).click();
 await page.evaluate(()=>window.qaUploadFailure=true);
 await page.locator('.tt-photo-context input[type=file]').setInputFiles({name:'reemplazo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Opciones y variantes',exact:true}).click();await page.getByRole('button',{name:'Fotos de Color: Plateado',exact:true}).click();await expect(page.locator('.tt-unified-photos > [role=status]')).toContainText('reemplazo pendiente');await expect(page.locator('.tt-photo-context input[type=file]')).toHaveCount(1);
 await page.getByRole('button',{name:'Quitar foto 1',exact:true}).click();await page.evaluate(()=>{window.qaUploadFailure=false;return window.qaProductController.workspace.save();});await expect(page.locator('.tt-unified-photo')).toHaveCount(1);await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/two.webp');
});

test('un segundo atributo de color no mezcla sus valores con el color principal',async({page})=>{
 const multiple={...product,variants:{Color:['Dorado','Plateado'],'Color de correa':['Negro','Blanco']}};
 await openProductSaveFixture(page,1440,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',multiple]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 const option=await editPhotos(page,'Plateado');await option.getByLabel('Fotos de esta opción: Color de correa',{exact:true}).selectOption('Negro');await option.getByRole('checkbox',{name:'Usar foto 1 en Plateado / Negro',exact:true}).check();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const rows=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot.variantMedia);
 expect(rows.find(row=>row.Color==='Plateado' && row['Color de correa']==='Negro').imageUrls).toContain(product.imageUrl);
 expect(rows.some(row=>row['Color de correa']==='Plateado')).toBe(false);
 const secondary=await editPhotos(page,'Negro','Color de correa');await secondary.getByRole('checkbox',{name:'Usar foto 2 en Negro',exact:true}).check();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const updated=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot.variantMedia);
 expect(updated.find(row=>row['Color de correa']==='Negro' && !row.Color).imageUrls).toEqual(['https://img.test/two.webp']);
 expect(updated.find(row=>row.Color==='Dorado' && !row['Color de correa']).imageUrls).toEqual([product.imageUrl]);
 expect(updated.find(row=>row.Color==='Plateado' && row['Color de correa']==='Negro').imageUrls).toEqual([product.imageUrl]);
});

for(const [width,height] of [[320,640],[390,844],[844,390],[768,1024],[1024,768],[1180,820],[1366,768],[1920,1080],[2560,1440],[3840,2160]])test(`fotos y disponibilidad se editan debajo de su opción sin duplicados ${width}x${height}`,async({page},info)=>{
 const v2={...product,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado'],Talle:['S','M']},variantInventory:[
 {variant:'gold-s',attributes:{Color:'Dorado',Talle:'S'},stock:1,price:210000},
 {variant:'gold-m',attributes:{Color:'Dorado',Talle:'M'},stock:2,price:215000},
 {variant:'silver-s',attributes:{Color:'Plateado',Talle:'S'},stock:1,price:220000},
 {variant:'silver-m',attributes:{Color:'Plateado',Talle:'M'},stock:1,price:225000}]};
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openProductSaveFixture(page,width,height,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',v2]]});
 await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.evaluate(()=>{window.qaCanonicalGallery=document.querySelector('.tt-unified-photos');window.qaCanonicalInventory=document.querySelector('#prod-variant-stock');});
 await page.getByRole('button',{name:'Opciones y variantes',exact:true}).click();const photos=page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true});await photos.click();
 const panel=page.getByRole('region',{name:'Fotos · Dorado',exact:true});await expect(panel).toBeVisible();
 await expect(photos).toHaveAttribute('aria-expanded','true');await expect(panel.locator('.tt-unified-photos')).toHaveCount(1);
 await expect(page.locator('.tt-unified-photos')).toHaveCount(1);await expect(page.locator('#prod-editor-section')).toHaveValue('all');
 await panel.getByLabel('Fotos de esta opción: Talle',{exact:true}).selectOption('M');
 await panel.getByRole('checkbox',{name:'Usar foto 2 en Dorado / M',exact:true}).check();
 await expect(panel.getByRole('checkbox',{name:'Usar foto 2 en Dorado / M',exact:true})).toBeFocused();
 const image=await panel.locator('.tt-option-photo-pick img').first().boundingBox();expect(image.height).toBeLessThanOrEqual(100);
 await panel.screenshot({path:info.outputPath(`panel-fotos-${width}.png`)});
 await page.getByRole('button',{name:'Disponibilidad de Color: Dorado',exact:true}).click();
 const availability=page.getByRole('region',{name:'Disponibilidad · Dorado',exact:true});await expect(availability.locator('#prod-variant-stock')).toHaveCount(1);
 await expect(page.locator('#prod-option-inline')).toHaveCount(1);await expect(page.locator('.tt-unified-photos')).toHaveCount(1);
 await availability.getByLabel('Combinación disponible',{exact:true}).selectOption('gold-m');
 await availability.getByRole('spinbutton',{name:'Stock: Dorado / M',exact:true}).fill('4');
 await availability.getByRole('spinbutton',{name:'Precio: Dorado / M',exact:true}).fill('219000');
 await expect(availability.getByRole('spinbutton',{name:'Stock: Plateado / M',exact:true})).toHaveCount(0);
 await availability.getByRole('checkbox',{name:'Disponible: Dorado / M',exact:true}).uncheck();
 await expect(page.getByRole('region',{name:'Disponibilidad · Dorado',exact:true})).toBeVisible();
 await page.getByRole('region',{name:'Disponibilidad · Dorado',exact:true}).getByLabel('Combinación disponible',{exact:true}).selectOption('gold-m');
 await page.getByRole('checkbox',{name:'Disponible: Dorado / M',exact:true}).check();
 await page.getByRole('button',{name:'Cerrar Disponibilidad · Dorado',exact:true}).click();
 expect(await page.evaluate(()=>window.qaCanonicalGallery===document.querySelector('.tt-unified-photos') && window.qaCanonicalInventory===document.querySelector('#prod-variant-stock'))).toBe(true);
 await photos.click();await panel.getByLabel('Fotos de esta opción: Talle',{exact:true}).selectOption('M');
 await expect(panel.getByRole('checkbox',{name:'Usar foto 2 en Dorado / M',exact:true})).toBeChecked();
 await panel.getByRole('checkbox',{name:'Usar foto 2 en Dorado / M',exact:true}).press('Escape');await expect(panel).toHaveCount(0);await expect(photos).toBeFocused();
 expect(await page.locator('#prod-form-card').evaluate(card=>card.scrollWidth<=card.clientWidth+1)).toBe(true);
 await page.evaluate(()=>window.qaProductController.workspace.save());
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa'))).toEqual(v2);
 const work=await page.evaluate(()=>[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1].snapshot);
 expect(work.commercialDraft.variantInventory.find(row=>row.variant==='gold-m')).toMatchObject({stock:4,price:219000,active:true});
 expect(work.variantMedia.find(row=>row.Color==='Dorado' && row.Talle==='M').imageUrls).toEqual(['https://img.test/two.webp']);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.stock).toBe(7);expect(saved.variantInventory.find(row=>row.variant==='gold-m')).toMatchObject({stock:4,price:219000,active:true});
 expect(saved.variantInventory.find(row=>row.variant==='silver-m')).toEqual(v2.variantInventory[3]);
 expect(saved.variantMedia.find(row=>row.Color==='Dorado' && row.Talle==='M').imageUrls).toEqual(['https://img.test/two.webp']);
 expect(saved.variantMedia.find(row=>row.Color==='Dorado' && !row.Talle).imageUrls).toEqual([product.imageUrl]);
 expect(errors).toEqual([]);
});

test('disponibilidad legada usa las cantidades originales sin moverlas del serializer',async({page})=>{
 await open(page,390);await page.getByRole('button',{name:'Opciones y variantes',exact:true}).click();await page.getByRole('button',{name:'Disponibilidad de Color: Plateado',exact:true}).click();
 const panel=page.getByRole('region',{name:'Disponibilidad · Plateado',exact:true});await expect(panel.getByLabel('Combinación disponible',{exact:true})).toHaveValue('Stock de Plateado');
 await panel.getByRole('spinbutton',{name:'Stock de Plateado',exact:true}).fill('4');
 await expect(page.locator('#prod-stock')).toHaveValue('7');await expect(page.locator('#prod-variant-stock input')).toHaveCount(2);
 await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();
 await expect(page.getByRole('region',{name:'Disponibilidad · Plateado',exact:true})).toHaveCount(0);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa').variantInventory)).toEqual([{variant:'Dorado',stock:3},{variant:'Plateado',stock:4}]);
});

for(const mode of ['draft','active','inactive','archived'])test(`carga múltiple junto a la opción y guardado ${mode} usan una sola configuración`,async({page})=>{
 await open(page,390,mode==='inactive'?{...product,active:false}:product);const option=await editPhotos(page,'Plateado');
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;return canvas.toDataURL('image/png').split(',')[1];});
 await option.locator('input[multiple]').setInputFiles(['first.png','second.png'].map(name=>({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
 await expect(option.locator('.tt-editor-upload-item')).toHaveCount(2);
 await option.getByRole('button',{name:'Confirmar y subir fotos',exact:true}).click();
 await expect(option.locator('.tt-editor-upload-item')).toHaveCount(0);
 await expect(option.getByRole('checkbox',{name:'Usar foto 3 en Plateado',exact:true})).toBeChecked();
 await expect(option.getByRole('checkbox',{name:'Usar foto 4 en Plateado',exact:true})).toBeChecked();
 await option.getByRole('button',{name:'Usar como primera foto de Plateado',exact:true}).last().click();
 await expect(option.getByRole('checkbox',{name:'Usar foto 4 en Plateado',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Disponibilidad de Color: Plateado',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Stock de Plateado',exact:true}).fill('4');
 await expect(page.locator('[data-product-section=availability]')).toBeHidden();
 await page.locator('#prod-publicationStatus').evaluate((select,value)=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},mode);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const stored=await page.evaluate(()=>({official:window.qaProductStore.get('products/qa'),work:[...window.qaProductStore].find(([key])=>key.includes('productEditorWorkspaces/'))[1]}));
 if(mode==='draft'){
   expect(stored.official).toEqual(product);expect(stored.work.snapshot.variantStockEntries.find(row=>row.variant==='Plateado').stock).toBe('4');
   expect(stored.work.snapshot.variantMedia.find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/second.png','https://img.test/first.png']);
 }else{
   expect(stored.official.stock).toBe(7);expect(stored.official.active).toBe(mode==='active');
   expect(stored.official.variantMedia.find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/second.png','https://img.test/first.png']);
 }
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 const reopened=await editPhotos(page,'Plateado');await expect(reopened.getByRole('checkbox',{name:'Usar foto 3 en Plateado',exact:true})).toBeChecked();await expect(reopened.getByRole('checkbox',{name:'Usar foto 4 en Plateado',exact:true})).toBeChecked();
 expect(await page.locator('#prod-form-card').evaluate(card=>{const ids=[...card.querySelectorAll('[id]')].map(node=>node.id);return ids.length===new Set(ids).size;})).toBe(true);
});

test('guardar desde otra sección sube las fotos pendientes a su opción original',async({page})=>{
 await open(page,390);const photos=await editPhotos(page,'Dorado');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=40;return c.toDataURL('image/png').split(',')[1];});
 await photos.locator('input[multiple]').setInputFiles({name:'original-option.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(photos.locator('.tt-editor-upload-item')).toHaveCount(1);
 await page.getByRole('button',{name:'Disponibilidad de Color: Plateado',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Stock de Plateado',exact:true}).fill('4');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.stock).toBe(7);expect(saved.variantMedia.find(row=>row.Color==='Dorado').imageUrls).toEqual([product.imageUrl,'https://img.test/original-option.png']);
 expect(saved.variantMedia.find(row=>row.Color==='Plateado')?.imageUrls || []).toEqual([]);
});

test('la disponibilidad de una opción fuera de la primera página conserva todas las combinaciones',async({page})=>{
 const colors=Array.from({length:32},(_,index)=>'Color '+index);
 const large={...product,stock:32,variantCommerceVersion:2,variants:{Color:colors},variantMedia:[],variantInventory:colors.map((color,index)=>({variant:'key-'+index,attributes:{Color:color},stock:1}))};
 await open(page,390,large);await page.getByRole('button',{name:'Opciones y variantes',exact:true}).click();
 await page.getByRole('button',{name:'Disponibilidad de Color: Color 31',exact:true}).click();
 const inline=page.getByRole('region',{name:'Disponibilidad · Color 31',exact:true});await inline.getByRole('spinbutton',{name:'Stock: Color 31',exact:true}).fill('2');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa'));
 expect(saved.stock).toBe(33);expect(saved.variantInventory).toHaveLength(32);expect(saved.variantInventory.find(row=>row.variant==='key-31').stock).toBe(2);
 expect(saved.variantInventory.filter(row=>row.variant!=='key-31').every(row=>row.stock===1)).toBe(true);
});

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080],[3840,2160]])test(`acciones de miniaturas compactas y centradas ${width}x${height}`,async({page},info)=>{
 const three={...product,imagesExtra:['https://img.test/two.webp','https://img.test/three.webp'],variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/one.webp','https://img.test/two.webp','https://img.test/three.webp']}]};
 await open(page,width,three);await page.setViewportSize({width,height});const panel=await editPhotos(page,'Dorado');
 const middle=panel.locator('.tt-unified-photo').nth(1);await middle.scrollIntoViewIfNeeded();
 const geometry=await middle.evaluate(tile=>{const parent=tile.getBoundingClientRect();return [...tile.querySelectorAll('.tt-photo-order-actions button')].map(button=>{const box=button.getBoundingClientRect(),css=getComputedStyle(button),icon=button.querySelector('svg')?.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,width:box.width,height:box.height,radius:parseFloat(css.borderRadius),icon:icon?.width || 0,parentLeft:parent.left,parentRight:parent.right};});});
 expect(geometry).toHaveLength(3);
 for(const box of geometry){expect(box.left).toBeGreaterThanOrEqual(box.parentLeft);expect(box.right).toBeLessThanOrEqual(box.parentRight+1);expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBe(44);expect(box.radius).toBeLessThanOrEqual(8);expect(box.icon).toBe(20);expect(Math.abs(box.top-geometry[0].top)).toBeLessThanOrEqual(1);}
 await page.screenshot({path:info.outputPath(`opcion-${width}x${height}.png`)});
 await middle.getByRole('button',{name:'Usar como primera foto de Dorado',exact:true}).click();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa').variantMedia.find(row=>row.Color==='Dorado').imageUrls)).toEqual(['https://img.test/two.webp','https://img.test/one.webp','https://img.test/three.webp']);
});
