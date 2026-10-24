'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const shell=fs.readFileSync('admin.html','utf8');
const headStyles=(shell.match(/<link[^>]+rel="stylesheet"[^>]*>/g)||[]).join('');
const start=shell.indexOf('<div class="adm-card" id="prod-form-card"');
const form=shell.slice(start,shell.indexOf('\n    </div>\n\n    <!-- ===================== COLECCIONES',start));
const source=fs.readFileSync('js/admin/admin-app.js','utf8');
const renderer=source.slice(source.indexOf('let productVariantStockBaseline = null;'),source.indexOf('function serializeProductForm()'));
const product={name:'Anillo',category:'anillos',price:30000,priceBefore:40000,active:true,variantCommerceVersion:2,variants:{Color:['Oro','Plata'],Talle:['M']},variantInventory:[{variant:'gold',attributes:{Color:'Oro',Talle:'M'},stock:3,price:45000},{variant:'silver',attributes:{Color:'Plata',Talle:'M'},stock:0}],stock:3};
async function openCommercialEditor(page,width,height,product) {
 await page.setViewportSize({width,height});const errors=[];page.on('pageerror',error=>errors.push(error.stack));
 await page.route('**/editor-v2-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${headStyles}<link rel="stylesheet" href="/css/admin/admin.css"><link rel="stylesheet" href="/css/admin/shopify-commerce-admin.css"></head><body>${form}</body></html>`}));
 await page.goto('/editor-v2-fixture');
 await page.evaluate(async({renderer,product})=>{
  const loadModule=url=>import(new URL(url,location.origin).href);
  const inventory=await loadModule('/js/core/store/inventario-variantes.mjs');
  const {commercialDraft}=await loadModule('/js/admin/products/editor-comercial-core.mjs');
  const {mountCommercialEditor}=await loadModule('/js/admin/products/editor-comercial-interfaz.js');
  const {enhanceProductEditor,syncProductSurfaces}=await loadModule('/js/admin/products/interfaz-productos-adaptable.js');
  window.prodGuardar=()=>{};window.prodCancelForm=()=>{};
  for(const [id,value] of Object.entries({'prod-name':product.name,'prod-price':product.price,'prod-price-before':product.priceBefore,'prod-variants-text':Object.entries(product.variants).map(([key,values])=>`${key}: ${values.join(', ')}`).join('\n')}))document.getElementById(id).value=value;
  const card=document.getElementById('prod-form-card');card.style.display='';enhanceProductEditor();syncProductSurfaces();
  const factory=new Function('variantInventoryEntries','reorderVariantInventory','commercialDraft','mountCommercialEditor',renderer+';return {render:renderProductVariantStock,get:()=>productCommercialEditor.get(),patch:base=>productCommercialEditor.patch(base)};');
  window.editor=factory(inventory.variantInventoryEntries,inventory.reorderVariantInventory,commercialDraft,mountCommercialEditor);window.editor.render(product);
  const patch=window.editor.patch;window.editor.patch=()=>patch({price:Number(document.getElementById('prod-price').value),priceBefore:document.getElementById('prod-price-before').value===''?null:Number(document.getElementById('prod-price-before').value)});
 },{renderer,product});
 await page.locator('#prod-editor-section').selectOption('inventory');
 return errors;
}

for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]])test(`editor comercial real: matriz, lote, orden y vista previa ${width}x${height}`,async({page})=>{
 const errors=await openCommercialEditor(page,width,height,product);
 await page.getByRole('spinbutton',{name:'Precio: Oro / M',exact:true}).fill('55000');
 await page.getByRole('checkbox',{name:'Seleccionar Plata / M',exact:true}).check();
 await page.getByRole('combobox',{name:'Campo para editar combinaciones seleccionadas'}).selectOption('stock');
 await page.getByRole('textbox',{name:'Valor para combinaciones seleccionadas'}).fill('2');
 await page.getByRole('button',{name:'Aplicar a seleccionadas'}).click();
 await expect(page.locator('#prod-stock')).toHaveValue('5');
 await page.getByRole('button',{name:'Invertir orden de atributos'}).click();
 await expect(page.getByRole('spinbutton',{name:'Precio: M / Oro',exact:true})).toHaveValue('55000');
 const patch=await page.evaluate(()=>window.editor.patch());expect(patch.variantInventory[0].variant).toBe('gold');expect(patch.stock).toBe(5);
 await page.getByRole('checkbox',{name:'Disponible: M / Oro',exact:true}).uncheck();
 expect(await page.evaluate(()=>window.editor.patch().variantInventory[0].active)).toBe(false);
 const overflow=await page.locator('#prod-form-card').evaluate(card=>card.scrollWidth>card.clientWidth+1);expect(overflow).toBe(false);
 const escaped=await page.locator('.tt-commercial-row input').evaluateAll(inputs=>inputs.filter(input=>{const r=input.getBoundingClientRect(),card=input.closest('fieldset').getBoundingClientRect();return r.left<card.left-1 || r.right>card.right+1 || r.top<card.top-1 || r.bottom>card.bottom+1;}).map(input=>input.getAttribute('aria-label')));
 expect(escaped).toEqual([]);
 const overlaps=await page.locator('#prod-variant-stock').evaluate(panel=>{const boxes=[...panel.children].map(child=>child.getBoundingClientRect()).filter(box=>box.width&&box.height);return boxes.slice(1).some((box,index)=>box.top<boxes[index].bottom-1);});expect(overlaps).toBe(false);
 expect(errors).toEqual([]);
 if(width===390 || width===1440){fs.mkdirSync('artifacts/editor-v2',{recursive:true});await page.locator('#prod-form-card').screenshot({path:`artifacts/editor-v2/editor-${width}.png`});}
});

test('reconocimiento real local: carteras, relojes y abstención sin API externa',async({page})=>{
 test.setTimeout(120000);
 const base=new URL(test.info().project.use.baseURL || 'http://127.0.0.1:4173').origin;
 const external=[],models=[];
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){external.push(url.origin);return route.abort();}if(url.pathname.startsWith('/assets-tintin/vision/'))models.push(url.pathname);return route.continue();});
 const policy=fs.readFileSync('_headers','utf8').split('# LOCAL_VISION_WORKER_CSP_START')[1].match(/Content-Security-Policy: ([^\n]+)/)[1];
 await page.route('**/vision-productos-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
 await page.route('**/vision-local-fixture',route=>route.fulfill({contentType:'text/html',headers:{'content-security-policy':"default-src 'self'; script-src 'self'; img-src 'self' data:; worker-src 'self'; connect-src 'self'"},body:'<!doctype html><div id="prod-form-card"><input id="prod-id"><input id="prod-imageUrl" type="hidden"><input id="prod-material" value="Dato confirmado"><input id="prod-stock" value="4"><textarea id="prod-variants-text">Color: Dorado</textarea><select id="prod-category"><option value="">Elegir</option><option value="carteras">Carteras</option><option value="relojes">Relojes</option></select><section data-product-section="photos"><div class="tt-editor-section-fields"></div></section></div>'}));
 await page.goto('/vision-local-fixture');
 await page.evaluate(async()=>{const url=new URL('/js/admin/products/vision-productos-interfaz.js',location.origin);const {mountLocalVision}=await import(url.href);mountLocalVision(document.getElementById('prod-form-card'));});
 await page.locator('.tt-editor-vision summary').click();expect(models).toHaveLength(0);
 for(const [image,label] of [['/assets-tintin/images/home/editorial-bolsos/editorial-bolsos-tablet.webp','Cartera'],['/assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp','Reloj']]) {
  await page.locator('#prod-imageUrl').evaluate((input,url)=>{input.value=url;input.dispatchEvent(new Event('input',{bubbles:true}));},image);
  await page.getByRole('button',{name:'Analizar imagen principal',exact:true}).click();
  await expect(page.locator('.tt-editor-vision [role=status]')).toContainText(`Podría ser: ${label}`,{timeout:60000});
 }
 await expect(page.locator('#prod-category')).toHaveValue('');await expect(page.locator('#prod-material')).toHaveValue('Dato confirmado');await expect(page.locator('#prod-stock')).toHaveValue('4');await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado');
 await page.locator('#prod-imageUrl').evaluate(input=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=224;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,224,224);input.value=canvas.toDataURL();input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'Analizar imagen principal',exact:true}).click();
 await expect(page.locator('.tt-editor-vision [role=status]')).toContainText('No pude reconocer',{timeout:60000});
 expect(models.length).toBeGreaterThan(0);expect(external).toEqual([]);
});


for(const [width,height] of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]])test(`retirar color conecta opciones, matriz y vista previa ${width}x${height}`,async({page})=>{
 const errors=await openCommercialEditor(page,width,height,product);
 await page.getByRole('button',{name:'Quitar Color: Oro',exact:true}).click();
 await expect(page.getByRole('button',{name:'Restaurar Color: Oro',exact:true})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Disponible: Oro / M',exact:true})).not.toBeChecked();
 let patch=await page.evaluate(()=>window.editor.patch());
 expect(patch.variantInventory[0]).toMatchObject({variant:'gold',stock:3,price:45000,active:false});
 expect(patch.variantInventory[1].active).not.toBe(false);
 const previewLink=page.getByRole('button',{name:'Ver vista previa',exact:true});
 if(await previewLink.isVisible())await previewLink.click();else await page.locator('.tt-editor-preview-shell > summary').click();
 await expect(page.getByLabel('Vista previa: Color',{exact:true}).locator('option')).toHaveText(['Todas las opciones','Plata']);
 await page.getByLabel('Vista previa: Color',{exact:true}).selectOption('Plata');
 await page.getByLabel('Vista previa: Talle',{exact:true}).selectOption('M');
 await expect(page.locator('.tt-editor-preview-money strong')).toHaveText('Gs. 30.000');
 await page.getByRole('button',{name:'Restaurar Color: Oro',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Disponible: Oro / M',exact:true})).toBeChecked();
 patch=await page.evaluate(()=>window.editor.patch());expect(patch.variantInventory[0]).toMatchObject({variant:'gold',stock:3,price:45000,active:true});
 await page.getByLabel('Vista previa: Color',{exact:true}).selectOption('Oro');
 await expect(page.locator('.tt-editor-preview-money strong')).toHaveText('Gs. 45.000');
 expect(errors).toEqual([]);
});

test('quitar color legado con matriz retira venta sin borrar stock ni identidad',async({page})=>{
 const legacy={...product,variantCommerceVersion:undefined,variants:{Color:['Oro','Plata'],Talle:['M']},variantInventory:[{variant:'Oro / M',stock:3},{variant:'Plata / M',stock:2}],stock:5};
 await openCommercialEditor(page,390,844,legacy);
 await page.getByRole('button',{name:'Quitar Color: Oro',exact:true}).click();
 await expect(page.getByRole('button',{name:'Restaurar Color: Oro',exact:true})).toBeVisible();
 const patch=await page.evaluate(()=>window.editor.patch());expect(patch.variantInventory[0]).toMatchObject({variant:'Oro / M',stock:3,active:false});expect(patch.stock).toBe(5);
 await page.getByRole('button',{name:'Restaurar Color: Oro',exact:true}).click();
 expect(await page.evaluate(()=>window.editor.patch().variantInventory[0].active)).toBe(true);
});


test('precio general y retiro de todas las opciones actualizan matriz, vista previa y restauración',async({page})=>{
 const errors=await openCommercialEditor(page,390,844,product);
 await page.locator('#prod-editor-section').selectOption('prices');
 await page.locator('#prod-price').fill('35000');
 await page.locator('#prod-editor-section').selectOption('inventory');
 await expect(page.locator('.tt-commercial-row').filter({has:page.getByRole('checkbox',{name:'Seleccionar Plata / M',exact:true})}).locator('small')).toHaveText('Precio efectivo: Gs. 35.000');
 await page.getByRole('button',{name:'Quitar Color: Oro',exact:true}).click();
 await page.getByRole('button',{name:'Quitar Color: Plata',exact:true}).click();
 await page.getByRole('button',{name:'Ver vista previa',exact:true}).click();
 await expect(page.locator('.tt-editor-preview-stock')).toHaveText('Agotado');
 await expect(page.getByLabel('Vista previa: Color',{exact:true}).locator('option')).toHaveText(['Todas las opciones']);
 await page.getByRole('button',{name:'Restaurar Color: Oro',exact:true}).click();
 await page.getByRole('button',{name:'Restaurar Color: Plata',exact:true}).click();
 expect(await page.evaluate(()=>window.editor.patch().variantInventory.every(row=>row.active))).toBe(true);
 expect(errors).toEqual([]);
});

test('paginación y edición masiva conservan selección y referencias entre páginas',async({page})=>{
 const variants={Color:Array.from({length:30},(_,index)=>`Color${index}`),Talle:['M']};
 const large={...product,priceBefore:null,variants,variantInventory:variants.Color.map((Color,index)=>({variant:`key${index}`,attributes:{Color,Talle:'M'},stock:1})),stock:30};
 const errors=await openCommercialEditor(page,1440,900,large);
 await page.getByRole('checkbox',{name:'Seleccionar Color0 / M',exact:true}).check();
 await expect(page.getByRole('button',{name:'Anteriores',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Siguientes',exact:true}).click();
 await page.getByRole('checkbox',{name:'Seleccionar Color29 / M',exact:true}).check();
 await page.getByRole('textbox',{name:'Valor para combinaciones seleccionadas'}).fill('47000');
 await page.getByRole('button',{name:'Aplicar a seleccionadas',exact:true}).click();
 const rows=await page.evaluate(()=>window.editor.patch().variantInventory);
 expect(rows[0]).toMatchObject({variant:'key0',price:47000,stock:1});expect(rows[29]).toMatchObject({variant:'key29',price:47000,stock:1});expect(rows[1].price).toBeUndefined();
 await expect(page.getByRole('button',{name:'Siguientes',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Anteriores',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Seleccionar Color0 / M',exact:true})).toBeChecked();
 await expect(page.getByRole('spinbutton',{name:'Precio: Color0 / M',exact:true})).toHaveValue('47000');
 expect(errors).toEqual([]);
});
