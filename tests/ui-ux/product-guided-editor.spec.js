const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const tabs=['Información','Fotos y opciones','Variantes','Precio y stock','Detalles','Publicación'];
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
const money=(page,id)=>page.locator(`[data-money-for="${id}"]`);
async function fields(page){await tab(page,'Información').click();await page.locator('#prod-name').fill('Anillo de prueba');await page.locator('#prod-category').selectOption('qa-tablet');await page.locator('#prod-description').fill('Producto local con datos de prueba.');await tab(page,'Precio y stock').click();await money(page,'prod-price').fill('35000');await page.locator('#prod-imageUrl').evaluate(input=>{input.value='https://img.test/original.jpg';input.dispatchEvent(new Event('change',{bubbles:true}));});}
for(const width of [320,390,768,1024,1440])test(`asistente integrado y guardado ${width}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true});
 await expect(page.locator('#prod-form-card')).toHaveAttribute('role','region');
 await expect(page.locator('#prod-form-card').getByRole('tab')).toHaveText(tabs);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.locator('#prod-name')).toBeFocused();
 await fields(page);await expect(money(page,'prod-price')).toHaveValue('35.000');await expect(page.locator('#prod-price')).toHaveValue('35000');
 for(const name of tabs){await tab(page,name).click();await expect(page.locator('.tt-product-tabpanel:visible')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if([390,1440].includes(width))await page.screenshot({path:`artifacts/product-guided-editor/${width}-${tabs.indexOf(name)+1}.png`,fullPage:true,animations:'disabled'});}
 await tab(page,'Información').click();await expect(page.locator('#prod-name')).toHaveValue('Anillo de prueba');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(tab(page,'Fotos y opciones')).toHaveAttribute('aria-selected','true');
 await tab(page,'Publicación').click();await page.locator('#prod-publicationStatus').selectOption('draft');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();expect(errors).toEqual([]);
});
test('asociaciones genéricas muestran todas las fotos y preservan portada e identidad',async({page})=>{
 await openProductSaveFixture(page,1024,900,{photos:true});
 await fields(page);await tab(page,'Fotos y opciones').click();
 await page.getByLabel('Característica de variante',{exact:true}).selectOption('Material');await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Acero');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await page.locator('#prod-images-extra').evaluate(input=>{input.value='https://img.test/second.jpg\nhttps://img.test/third.jpg';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Material: Acero',exact:true}).click();
 for(let index=1;index<=3;index++)await page.getByLabel(`Usar foto ${index} en Acero`,{exact:true}).check();
 await expect(page.locator('.tt-option-photo-title')).toHaveText('Fotos de Acero — 3 imágenes');
 await expect(page.locator('.tt-variant-media-copy')).toContainText('3 fotos');
 await page.getByRole('button',{name:'Ver foto 2',exact:true}).click();await expect(page.locator('.tt-photo-viewer img')).toHaveAttribute('src','https://img.test/second.jpg');
 await page.getByRole('button',{name:'Foto siguiente',exact:true}).click();await expect(page.locator('.tt-photo-viewer img')).toHaveAttribute('src','https://img.test/third.jpg');
});
test('inventario antiguo conserva claves, cantidades y precios heredados al editar',async({page})=>{
 const original={name:'Anillo legado',description:'Con historia',category:'qa-tablet',price:35000,priceBefore:45000,imageUrl:'https://img.test/gold.jpg',imagesExtra:['https://img.test/silver.jpg'],active:true,publicationStatus:'active',variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:1},{variant:'Plateado',stock:0}],stock:1,seoTitle:'Título histórico',variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/gold.jpg']},{Color:'Plateado',imageUrls:['https://img.test/silver.jpg']}]};
 await openProductSaveFixture(page,1024,900,{photos:true,initialRecords:[['products/legacy',original]]});
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('legacy');});
 await tab(page,'Precio y stock').click();await expect(page.getByLabel('Stock: Dorado',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Stock: Plateado',{exact:true})).toHaveValue('0');
 await expect(page.locator('.tt-inventory-total')).toContainText('1 unidades');await expect(page.getByRole('button',{name:'Usar precios y disponibilidad por combinación'})).toHaveCount(0);
 await tab(page,'Publicación').click();await expect(page.locator('.tt-seo-title')).toHaveText('Título histórico');await page.locator('#prod-save-btn').click();
 await expect.poll(()=>page.evaluate(()=>window.qaProductStore.get('products/legacy')?.variantCommerceVersion)).toBe(2);
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/legacy'));expect(saved.variantInventory.map(r=>[r.variant,r.stock])).toEqual([['Dorado',1],['Plateado',0]]);expect(saved.stock).toBe(1);expect(saved.seoTitle).toBe('Título histórico');
});
test('tres y dos fotos, portada, stock 1/0 y reapertura preservan todas las asociaciones',async({page})=>{
 const urls=Array.from({length:5},(_,i)=>`https://img.test/photo-${i+1}.webp`);
 const original={name:'Anillo de cinco fotos',category:'qa-tablet',description:'Prueba de relaciones',price:35000,stock:1,active:true,publicationStatus:'active',variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'gold-old',attributes:{Color:'Dorado'},stock:1},{variant:'silver-old',attributes:{Color:'Plateado'},stock:0}],imageUrl:urls[0],imagesExtra:urls.slice(1)};
 await openProductSaveFixture(page,390,844,{photos:true,workflow:true,initialRecords:[['products/five',original]]});await page.evaluate(()=>window.qaProductController.workspace.ready);await page.evaluate(()=>window.qaProductController.workspace.leave());await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('five');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();
 for(const i of [1,2,3])await page.getByLabel(`Usar foto ${i} en Dorado`,{exact:true}).check();
 const third=page.locator('.tt-unified-photo').filter({has:page.getByLabel('Usar foto 3 en Dorado',{exact:true})});await third.getByRole('button',{name:'Usar como primera foto de Dorado',exact:true}).click();
 await expect(page.locator('.tt-variant-media-copy').filter({hasText:'Color: Dorado'})).toContainText('3 fotos');
 await page.getByRole('button',{name:'Cerrar Fotos · Dorado',exact:true}).click();await page.getByRole('button',{name:'Fotos de Color: Plateado',exact:true}).click();for(const i of [4,5])await page.getByLabel(`Usar foto ${i} en Plateado`,{exact:true}).check();
 await expect(page.locator('.tt-variant-media-copy').filter({hasText:'Color: Plateado'})).toContainText('2 fotos');
 await tab(page,'Precio y stock').click();await expect(page.getByLabel('Stock: Dorado',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Stock: Plateado',{exact:true})).toHaveValue('0');await expect(page.locator('.tt-inventory-total')).toContainText('1 unidades');await expect(page.locator('.tt-commercial-row').filter({has:page.locator('legend',{hasText:'Plateado'})})).toContainText('Sin stock');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/five'));expect(saved.variantInventory).toEqual(original.variantInventory);expect(saved.variantMedia.find(row=>row.Color==='Dorado').imageUrls).toEqual([urls[2],urls[0],urls[1]]);expect(saved.variantMedia.find(row=>row.Color==='Plateado').imageUrls).toEqual(urls.slice(3));
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('five');});await page.evaluate(()=>window.qaProductController.workspace.ready);await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await expect(page.locator('.tt-unified-photo img').first()).toHaveAttribute('src',urls[2]);await expect(page.locator('.tt-option-photo-title')).toHaveText('Fotos de Dorado — 3 imágenes');
});
test('opciones antes del precio y stock sin control no se convierten en cantidades cero',async({page})=>{
 await openProductSaveFixture(page,768,900,{photos:true});await tab(page,'Precio y stock').click();await page.getByRole('button',{name:'No controlar stock',exact:true}).click();await tab(page,'Fotos y opciones').click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Plateado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await fields(page);await tab(page,'Precio y stock').click();await expect(page.getByLabel('Stock: Dorado',{exact:true})).toHaveValue('');await expect(page.getByLabel('Stock: Plateado',{exact:true})).toHaveValue('');await expect(page.locator('#prod-stock')).toHaveValue('');
 await tab(page,'Publicación').click();await page.locator('#prod-publicationStatus').selectOption('draft');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));expect(saved.stock).toBe(null);expect(saved.variantInventory.map(row=>row.stock)).toEqual([null,null]);
});
test('formato histórico de variantes como filas conserva fotos y cantidades al convertirse',async({page})=>{
 const original={name:'Anillo histórico',category:'qa-tablet',description:'Datos conservados',price:35000,stock:1,imageUrl:'https://img.test/gold-old.webp',imagesExtra:['https://img.test/silver-old.webp'],active:true,publicationStatus:'active',variants:[{Color:'dorado',imageUrl:'https://img.test/gold-old.webp'},{Color:'plateado',imageUrl:'https://img.test/silver-old.webp'}],variantInventory:[{variant:'dorado',stock:1},{variant:'plateado',stock:0}]};
 await openProductSaveFixture(page,390,844,{fullShell:true,photos:true,initialRecords:[['products/array',original]]});await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('array');});
 await tab(page,'Variantes').click();await expect(page.locator('.tt-variant-media-card')).toHaveCount(2);await expect(page.locator('.tt-variant-media-copy').filter({hasText:'Color: dorado'})).toContainText('1 foto');await expect(page.locator('.tt-variant-media-copy').filter({hasText:'Color: plateado'})).toContainText('1 foto');
 await tab(page,'Precio y stock').click();await expect(page.getByLabel('Stock: dorado',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Stock: plateado',{exact:true})).toHaveValue('0');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/array'));expect(saved.variantInventory.map(({variant,stock})=>({variant,stock}))).toEqual(original.variantInventory);expect(saved.variantMedia.find(row=>row.Color==='dorado').imageUrls).toEqual([original.imageUrl]);expect(saved.variantMedia.find(row=>row.Color==='plateado').imageUrls).toEqual(original.imagesExtra);
});

test('importes preservan cursor, entero canónico y bloqueo ante texto inválido',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await fields(page);
 const price=money(page,'prod-price');await price.fill('123456');await price.evaluate(input=>input.setSelectionRange(2,2));await price.press('7');
 await expect(price).toHaveValue('1.273.456');await expect(page.locator('#prod-price')).toHaveValue('1273456');expect(await price.evaluate(input=>input.selectionStart)).toBe(4);
 await price.fill('abc');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeVisible();await expect(price).toBeFocused();expect(await page.evaluate(()=>[...window.qaProductStore.keys()].some(key=>key.startsWith('products/')))).toBe(false);
 await price.fill('35000');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();expect(await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1').price)).toBe(35000);
});

for(const width of [320,390,768,1024,1440])test(`controles comerciales completos y legibles ${width}`,async({page})=>{
 await openProductSaveFixture(page,width,900,{fullShell:true,photos:true});await fields(page);await tab(page,'Fotos y opciones').click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();await tab(page,'Precio y stock').click();
 const stock=page.getByLabel('Stock: Dorado',{exact:true}),price=page.getByLabel('Precio: Dorado',{exact:true});await expect(stock).toBeVisible();await expect(price).toBeVisible();expect((await stock.boundingBox()).width).toBeGreaterThanOrEqual(64);expect((await price.boundingBox()).width).toBeGreaterThanOrEqual(96);
 expect(await page.locator('.tt-commercial-availability').evaluate(el=>el.getBoundingClientRect().width>=150)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

 test('un stock inválido abre su contexto y permite corregir sin perder existencias',async({page})=>{
 const original={name:'Stock validado',category:'qa-tablet',description:'Prueba de validación',price:35000,imageUrl:'https://img.test/gold.jpg',active:true,publicationStatus:'active',stock:1,variantCommerceVersion:2,variants:{Color:['Dorado']},variantInventory:[{variant:'stable-gold',attributes:{Color:'Dorado'},stock:1}]};
 await openProductSaveFixture(page,390,844,{photos:true,initialRecords:[['products/stock-context',original]]});await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('stock-context');});
 await tab(page,'Precio y stock').click();const stock=page.getByLabel('Stock: Dorado',{exact:true});await stock.fill('0.5');await tab(page,'Información').click();await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-error')).toBeVisible();await expect(tab(page,'Precio y stock')).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Ir al campo',exact:true}).click();await expect(stock).toBeFocused();expect(await page.evaluate(()=>window.qaProductStore.get('products/stock-context').stock)).toBe(1);
 await stock.fill('2');await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();const saved=await page.evaluate(()=>window.qaProductStore.get('products/stock-context'));expect(saved.stock).toBe(2);expect(saved.variantInventory).toEqual([{variant:'stable-gold',attributes:{Color:'Dorado'},stock:2}]);
 });
