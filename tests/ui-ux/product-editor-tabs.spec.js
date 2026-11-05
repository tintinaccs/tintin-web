const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const names=['Información','Fotos y opciones','Variantes','Precio y stock','Detalles','Publicación'];
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
for(const width of [320,768,1440])test(`último paso permite guardar borrador y publicar sin duplicar ${width}`,async({page})=>{
 await openProductSaveFixture(page,width,900,{photos:true,workflow:true});
 await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('#prod-name').fill('Trabajo desde el último paso');
 const key=await page.evaluate(()=>window.qaProductController.workspace.key);
 await tab(page,'Publicación').click();
 const finish=page.locator('.tt-studio-pagination button').last();
 await expect(finish).toBeEnabled();await expect(finish).toHaveText('Guardar borrador');
 await finish.click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(key=>window.qaProductStore.has('products/'+key),key)).toBe(false);
 await page.evaluate(key=>window.prodContinuarBorrador(key),key);await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(page.locator('#prod-name')).toHaveValue('Trabajo desde el último paso');
 await valid(page);await tab(page,'Publicación').click();await page.locator('#prod-publicationStatus').selectOption('active');
 await expect(finish).toHaveText('Guardar cambios');await finish.click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(key=>window.qaProductStore.get('products/'+key).publicationStatus,key)).toBe('active');
 expect(await page.evaluate(()=>window.qaProductWrites.filter(key=>key.startsWith('products/')).length)).toBe(1);
});
async function valid(page){
 await tab(page,'Información').click();await page.locator('#prod-name').fill('Producto de prueba');await page.locator('#prod-description').fill('Descripción de prueba');await page.locator('#prod-category').selectOption('qa-tablet');
 await page.locator('#prod-imageUrl').evaluate(input=>{input.value='https://img.test/real-product.jpg';input.dispatchEvent(new Event('change',{bubbles:true}));});
 await tab(page,'Precio y stock').click();await page.locator('[data-money-for="prod-price"]').fill('45000');
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
test('variantes y fotos se editan en su paso, stock en el suyo sin duplicar',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await valid(page);
 await tab(page,'Fotos y opciones').click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await tab(page,'Precio y stock').click();await page.getByLabel('Stock: Dorado',{exact:true}).fill('8');await expect(page.locator('#prod-stock')).toHaveValue('8');
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await page.getByLabel('Usar foto 1 en Dorado',{exact:true}).check();
 await expect(tab(page,'Variantes')).toHaveAttribute('aria-selected','true');await expect(page.locator('#prod-variant-stock')).toBeHidden();
 await tab(page,'Detalles').click();await page.locator('#prod-material').fill('Acero inoxidable');await tab(page,'Publicación').click();await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));expect(saved.stock).toBe(8);expect(saved.variantInventory[0].stock).toBe(8);expect(saved.variantInventory[0].attributes).toEqual({Color:'Dorado'});expect(saved.material).toBe('Acero inoxidable');expect(saved.variantMedia.find(row=>row.Color==='Dorado').imageUrls).toEqual(['https://img.test/real-product.jpg']);
});
test('teclado, movimiento reducido y validación contextual',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openProductSaveFixture(page,320,700);await tab(page,'Información').focus();await page.keyboard.press('ArrowRight');await expect(tab(page,'Fotos y opciones')).toBeFocused();await page.keyboard.press('End');await expect(tab(page,'Publicación')).toBeFocused();
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-error')).toBeVisible();await expect(tab(page,'Información')).toHaveAttribute('aria-selected','true');await expect(page.locator('#prod-name')).toHaveAttribute('aria-invalid','true');
 await page.getByRole('button',{name:'Ir al campo',exact:true}).click();await expect(page.locator('#prod-name')).toBeFocused();
 await page.locator('#prod-name').fill('Nombre corregido');await expect(page.locator('#prod-name')).not.toHaveAttribute('aria-invalid','true');
 expect(await page.locator('.tt-product-tabpanel:visible').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('permisos internos siguen ocultos al recorrer las seis pestañas',async({page})=>{
 await openProductSaveFixture(page,390,844);await page.locator('#prod-inventory-fields').evaluate(field=>field.style.display='none');
 for(const name of names){await tab(page,name).click();await expect(page.locator('#prod-cost-unit')).toBeHidden();await expect(page.locator('[data-money-for="prod-cost-unit"]')).toBeHidden();await expect(page.locator('#prod-internal-notes')).toBeHidden();}
 await expect(page.locator('#prod-cost-unit')).toHaveCount(1);
});
test('cerrar fotos restituye la galería general sin duplicarla',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await valid(page);await tab(page,'Fotos y opciones').click();await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await expect(page.getByRole('region',{name:'Fotos · Dorado',exact:true})).toBeVisible();
 await tab(page,'Fotos y opciones').click();await expect(page.locator('.tt-unified-photos')).toBeVisible();await expect(page.locator('.tt-unified-photos')).toHaveCount(1);await expect(page.getByRole('button',{name:'Precio y stock de Dorado',exact:true})).toHaveCount(0);
});

test('seleccionar color muestra primero su foto real y conserva la selección entre pestañas',async({page})=>{
 const product={name:'Fotos por color',description:'Prueba de asociaciones',category:'qa-tablet',price:45000,stock:null,active:true,publicationStatus:'active',imageUrl:'https://img.test/general.webp',imagesExtra:['https://img.test/dorado.webp'],variants:{Color:['Dorado']},variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/dorado.webp']}]};
 await openProductSaveFixture(page,390,844,{photos:true,initialRecords:[['products/existing',product]]});await page.evaluate(()=>{window.prodCancelForm();window.qaProductController.refresh();window.prodEditar('existing');});
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();
 await expect(page.locator('.tt-unified-photo img').first()).toHaveAttribute('src','https://img.test/dorado.webp');await expect(page.getByLabel('Usar foto 2 en Dorado',{exact:true})).toBeChecked();
 await tab(page,'Detalles').click();await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await expect(page.locator('.tt-unified-photo img').first()).toHaveAttribute('src','https://img.test/dorado.webp');await expect(page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true})).toHaveAttribute('aria-expanded','true');
});

test('abrir y cerrar la superficie antes de montar campos no provoca errores ni pierde foco',async({page})=>{
 const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');await page.locator('[data-action="product-new"]').click();await expect(page.locator('#prod-form-card')).toBeVisible();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('#prod-form-card')).toHaveAttribute('role','region');expect(errors).toEqual([]);
 await page.evaluate(()=>{document.getElementById('prod-form-card').style.display='none';});await expect(page.locator('[data-action="product-new"]')).toBeFocused();expect(errors).toEqual([]);
});

for(const width of [320,390,768,854,1024,1440])test(`referencia Studio: galería y controles canónicos sin recorte ${width}`,async({page},info)=>{
 const image='https://img.test/studio-gold.webp',silver='https://img.test/studio-silver.webp';
 const product={name:'Anillo de prueba',description:'Producto ficticio para revisión visual',category:'qa-tablet',price:50000,stock:10,active:true,publicationStatus:'active',imageUrl:image,imagesExtra:[silver],variants:{Color:['Dorado','Plateado']},variantMedia:[{Color:'Dorado',imageUrls:[image]},{Color:'Plateado',imageUrls:[silver]}],variantInventory:[{variant:'Dorado',stock:4},{variant:'Plateado',stock:6}]};
 await openProductSaveFixture(page,width,1000,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/studio',product]]});
 await page.route('https://img.test/studio-*.webp',route=>route.fulfill({contentType:'image/webp',body:require('node:fs').readFileSync('assets-tintin/images/collections/col-anillos.webp')}));
 await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('studio');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await tab(page,'Fotos y opciones').click();

 await expect(page.locator('.tt-studio-photo > img')).toHaveAttribute('src',image);
 await page.waitForFunction(()=>{const image=document.querySelector('.tt-studio-photo > img');return image.complete && image.naturalWidth>0;});
 await expect(page.locator('.tt-studio-photo figcaption')).toHaveText('Imagen del producto');
 await expect(page.locator('#prod-variant-stock')).toBeVisible();
 await expect(page.locator('#prod-variant-stock')).toHaveCount(1);
 const geometry=await page.locator('.tt-studio-photo-layout').evaluate(el=>{const visual=el.querySelector('.tt-studio-photo-visual').getBoundingClientRect(),side=el.querySelector('.tt-studio-photo-side').getBoundingClientRect();return {width:el.clientWidth,scroll:el.scrollWidth,visual:{x:visual.x,right:visual.right},side:{x:side.x,right:side.right}};});
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
 await expect(page.locator('.tt-studio-photo-side')).toBeHidden();
 await expect(page.locator('.tt-studio-pagination')).toContainText('Fotos y opciones · 2 de 6');
 await page.locator('.tt-studio-pagination').getByRole('button',{name:'Continuar a Variantes →',exact:true}).click();await expect(tab(page,'Variantes')).toHaveAttribute('aria-selected','true');
 await tab(page,'Fotos y opciones').click();await expect(page.locator('.tt-studio-photo > img')).toHaveAttribute('src',image);
 await tab(page,'Precio y stock').click();await expect(page.getByLabel('Stock: Dorado',{exact:true})).toBeVisible();await tab(page,'Fotos y opciones').click();
 await page.locator('#prod-form-card .adm-card-body').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:info.outputPath(`studio-reference-${width}.png`),animations:'disabled'});
});

const phase03Product={name:'Anillo fase 03',description:'Descripción completa de prueba.',category:'qa-tablet',price:50000,stock:10,active:true,publicationStatus:'active',imageUrl:'https://img.test/phase03.webp',imagesExtra:[],variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado'},stock:4,price:55000},{variant:'silver',attributes:{Color:'Plateado'},stock:6,price:60000}],variantMedia:[{Color:'Dorado',imageUrls:['https://img.test/phase03.webp']}]};
async function phase03Open(page,width,height=1000){
 await openProductSaveFixture(page,width,height,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/phase03',phase03Product]]});
 await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('.tt-work-back').click();
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('phase03');});await page.evaluate(()=>window.qaProductController.workspace.ready);
}
for(const width of [320,390,768,1024,1280,1440,1920])test(`fase03: fotografía, opciones e inventario conectados ${width}`,async({page},info)=>{
 await phase03Open(page,width);await tab(page,'Fotos y opciones').click();
 await expect(page.locator('#prod-variant-stock')).toBeVisible();await expect(page.locator('.tt-editor-variant-builder')).toBeVisible();
 const geometry=await page.locator('#prod-panel-photos').evaluate(panel=>{
  const areas=['photos','options','availability'].map(section=>panel.querySelector(`[data-product-section="${section}"]`).getBoundingClientRect());
  return {overflow:panel.scrollWidth>panel.clientWidth+1,areas:areas.map(r=>({top:r.top,left:r.left,right:r.right,bottom:r.bottom}))};
 });
 expect(geometry.overflow).toBe(false);
 if(width>=1440){expect(Math.max(...geometry.areas.map(r=>r.top))-Math.min(...geometry.areas.map(r=>r.top))).toBeLessThan(2);expect(geometry.areas[1].left).toBeGreaterThanOrEqual(geometry.areas[0].right);expect(geometry.areas[2].left).toBeGreaterThanOrEqual(geometry.areas[1].right);}
 if(width<=390){expect(geometry.areas[1].top).toBeGreaterThanOrEqual(geometry.areas[0].bottom);expect(geometry.areas[2].top).toBeGreaterThanOrEqual(geometry.areas[1].bottom);}
 const stock=page.getByLabel('Stock: Dorado',{exact:true});await stock.fill('9');
 await expect(page.locator('#prod-stock')).toHaveValue('15');await expect(page.getByLabel('Stock: Plateado',{exact:true})).toHaveValue('6');
 await tab(page,'Precio y stock').click();await expect(stock).toHaveValue('9');await expect(page.locator('#prod-variant-stock')).toHaveCount(1);
 await tab(page,'Fotos y opciones').click();await stock.scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath(`phase03-connected-${width}.png`),animations:'disabled'});
});

test('fase03: ampliar portada, teclado y retorno al control sin perder edición',async({page})=>{
 await phase03Open(page,390,844);await tab(page,'Fotos y opciones').click();
 const open=page.getByRole('button',{name:'Ampliar imagen seleccionada',exact:true});await open.click();
 const viewer=page.getByRole('dialog',{name:'Vista de fotografías',exact:true});await expect(viewer).toBeVisible();await expect(viewer.getByRole('button',{name:'Cerrar vista',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');expect(await viewer.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(viewer).toHaveCount(0);await expect(open).toBeFocused();await expect(page.locator('#prod-name')).toHaveValue(phase03Product.name);
});

test('fase03: no quitar una opción nueva con fotografías asociadas',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await valid(page);await tab(page,'Fotos y opciones').click();
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Dorado');await page.getByRole('button',{name:'Agregar opción',exact:true}).click();
 await tab(page,'Variantes').click();await page.getByRole('button',{name:'Fotos de Color: Dorado',exact:true}).click();await page.getByLabel('Usar foto 1 en Dorado',{exact:true}).check();
 await tab(page,'Fotos y opciones').click();await page.getByRole('button',{name:'Quitar Color: Dorado',exact:true}).click();
 await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado');await expect(page.locator('.tt-editor-control-error')).toContainText('fotografías');
 await page.getByLabel('Stock: Dorado',{exact:true}).fill('2');
 const availability=page.getByRole('checkbox',{name:'Habilitada para la venta: Dorado',exact:true});await availability.uncheck();
 await page.getByRole('button',{name:'Restaurar Color: Dorado',exact:true}).click();
 await expect(availability).toBeChecked();await expect(page.locator('.tt-editor-control-error')).toBeEmpty();
 expect(await page.evaluate(()=>window.qaProductController.serializeProductForm().variantMedia.some(row=>row.Color==='Dorado' && row.imageUrls?.length))).toBe(true);
});

test('fase03: descripción larga completa, edición y crecimiento con scroll interno explícito',async({page})=>{
 await phase03Open(page,390,844);
 const text=Array.from({length:90},(_,i)=>`Línea ${i+1}: información del producto con detalles completos.`).join('\n');
 const field=page.locator('#prod-description');await field.fill(text);await field.press('Control+End');await field.press('End');await field.press('Enter');await field.press('Z');
 await expect(field).toHaveValue(text+'\nZ');
 const geometry=await field.evaluate(el=>({overflow:getComputedStyle(el).overflowY,lastVisible:el.scrollTop+el.clientHeight>=el.scrollHeight-3,height:el.clientHeight}));
 expect(geometry.overflow).toBe('auto');expect(geometry.lastVisible).toBe(true);expect(geometry.height).toBeGreaterThanOrEqual(96);
 await page.evaluate(()=>window.qaProductController.workspace.save());await expect(field).toHaveValue(text+'\nZ');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('phase03');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(field).toHaveValue(text+'\nZ');
});

test('fase03: edición y guardado parcial conservan scroll, identidad y otra variante',async({page})=>{
 await phase03Open(page,390,844);await tab(page,'Fotos y opciones').click();
 const stock=page.getByLabel('Stock: Dorado',{exact:true});await stock.scrollIntoViewIfNeeded();
 const before=await stock.evaluate(el=>({scroll:scrollY,top:el.getBoundingClientRect().top}));expect(before.scroll).toBeGreaterThan(100);
 await stock.fill('7');await page.evaluate(()=>window.qaProductController.workspace.save());
 const after=await stock.evaluate(el=>({scroll:scrollY,top:el.getBoundingClientRect().top}));
 expect(after.scroll).toBeGreaterThan(100);expect(Math.abs(after.top-before.top)).toBeLessThan(4);
 await expect(page.getByLabel('Stock: Plateado',{exact:true})).toHaveValue('6');
 const snapshot=await page.evaluate(()=>window.qaProductController.serializeProductForm());
 expect(snapshot.commercialDraft.variantInventory.map(row=>[row.variant,row.stock,row.price])).toEqual([['gold',7,55000],['silver',6,60000]]);
 expect(await page.evaluate(()=>window.qaProductStore.get('products/phase03').stock)).toBe(10);
});

test('fase03: buscar y paginar treinta combinaciones conserva las ediciones',async({page})=>{
 const colors=Array.from({length:30},(_,i)=>'Color '+String(i+1).padStart(2,'0'));
 const product={...phase03Product,variants:{Color:colors},variantInventory:colors.map((color,i)=>({variant:'color-'+i,attributes:{Color:color},stock:1})),stock:30,variantMedia:[]};
 await openProductSaveFixture(page,1024,768,{photos:true,initialRecords:[['products/many',product]]});await page.evaluate(()=>{window.prodCancelForm();window.qaProductController.refresh();window.prodEditar('many');});
 await tab(page,'Fotos y opciones').click();await expect(page.locator('.tt-commercial-row')).toHaveCount(25);
 const search=page.getByRole('searchbox',{name:'Buscar combinación',exact:true});await search.fill('Color 26');await search.press('Tab');await expect(page.locator('.tt-commercial-row')).toHaveCount(1);
 await page.getByLabel('Stock: Color 26',{exact:true}).fill('11');await search.fill('');await search.press('Tab');await expect(page.locator('.tt-commercial-row')).toHaveCount(25);
 await page.locator('#prod-variant-stock').getByRole('button',{name:'Siguientes',exact:true}).click();await expect(page.locator('.tt-commercial-row')).toHaveCount(5);
 await expect(page.getByLabel('Stock: Color 26',{exact:true})).toHaveValue('11');await expect(page.locator('#prod-stock')).toHaveValue('40');
 await page.locator('#prod-variant-stock').getByRole('button',{name:'Anteriores',exact:true}).click();await expect(page.getByLabel('Stock: Color 01',{exact:true})).toHaveValue('1');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/many'));expect(saved.variantInventory.find(row=>row.variant==='color-25').stock).toBe(11);expect(saved.stock).toBe(40);
});

test('fase03: reemplazar portada tiene ancho completo en su columna y permite cancelar',async({page})=>{
 await phase03Open(page,1440,900);await tab(page,'Fotos y opciones').click();
 await page.getByRole('button',{name:'Reemplazar imagen seleccionada',exact:true}).click();
 const side=page.locator('.tt-studio-photo-side');await expect(side).toBeVisible();
 expect(await side.evaluate(el=>{const side=el.getBoundingClientRect(),visual=el.previousElementSibling.getBoundingClientRect();return Math.abs(side.width-visual.width)<2 && side.top>=visual.bottom;})).toBe(true);
 await page.getByRole('button',{name:'Cancelar reemplazo',exact:true}).click();await expect(side).toBeHidden();
 await expect(page.locator('#prod-imageUrl')).toHaveValue(phase03Product.imageUrl);await expect(page.getByLabel('Stock: Dorado',{exact:true})).toHaveValue('4');
});

test('fase03: recorta, gira y aplica una foto antes de reemplazarla',async({page})=>{
 await phase03Open(page,390,844);await tab(page,'Fotos y opciones').click();
 await page.getByRole('button',{name:'Reemplazar imagen seleccionada',exact:true}).click();
 const side=page.locator('.tt-studio-photo-side');
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const context=canvas.getContext('2d');context.fillStyle='#f8aaca';context.fillRect(0,0,80,100);context.fillStyle='#713c53';context.fillRect(80,0,80,100);return canvas.toDataURL('image/png').split(',')[1];});
 await side.locator('input[type=file]').setInputFiles({name:'producto-original.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await side.getByRole('button',{name:'Recortar o editar',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Recortar o editar foto',exact:true});await expect(editor).toBeVisible();
 await editor.getByRole('button',{name:'Cuadrada 1:1',exact:true}).click();
 await editor.getByRole('button',{name:'Girar derecha',exact:true}).click();
 await editor.getByLabel('Zoom', {exact:true}).fill('1.35');
 const geometry=await editor.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height+1);
 await editor.getByRole('button',{name:'Aplicar edición',exact:true}).click();await expect(editor).toHaveCount(0);
 await expect(side.locator('.tt-iuw-status')).toContainText('Edición aplicada');
 await side.getByRole('button',{name:'Confirmar y subir',exact:true}).click();
 await expect(page.locator('#prod-imageUrl')).toHaveValue(/producto-original-editada\.(webp|png)$/);
 await expect(page.getByLabel('Stock: Dorado',{exact:true})).toHaveValue('4');
});
