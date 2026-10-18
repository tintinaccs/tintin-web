'use strict';
const {test,expect}=require('@playwright/test');
const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');

for(const [width,height,columns,touch] of [[320,700,2,true],[390,844,2,true],[844,390,2,true],[768,1024,2,true],[820,1180,2,true],[1024,768,2,true],[1366,1024,2,true],[1280,800,3,false],[1440,900,3,false]]){
 test(`mosaico Productos y foto grande sin desborde ${width}x${height}`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});
  try{
   const page=await context.newPage();await mockRuntime(page);
   await page.goto('https://tintin.test/admin-commerce-fixture');
   const cards=page.locator('#tt-commerce-products tbody tr');await expect(cards).toHaveCount(3);
   const layout=await cards.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),image=el.querySelector('.tt-commerce-thumb').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,width:r.width,image:image.width};}));
   expect(new Set(layout.slice(0,columns).map(r=>Math.round(r.top))).size).toBe(1);
   if(columns===2)expect(layout[2].top).toBeGreaterThan(layout[0].top+20);
   for(const row of layout){expect(row.left).toBeGreaterThanOrEqual(0);expect(row.right).toBeLessThanOrEqual(width+1);expect(row.image).toBeGreaterThan(row.width*.7);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await expect(page.locator('tr[data-id="p-aro"]')).toContainText('Inactivo');
   await expect(page.locator('tr[data-id="p-reloj"]')).toContainText('Destacado');
   await page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open').click();
   const preview=page.locator('.tt-commerce-product-preview .tt-commerce-thumb');
   await expect(preview).toBeVisible();expect((await preview.boundingBox()).width).toBeGreaterThan(Math.min(200,width-80));
   await expect(preview.locator('img')).toHaveCSS('object-fit','contain');
   const photo=await preview.boundingBox();expect(photo.x).toBeGreaterThanOrEqual(0);expect(photo.x+photo.width).toBeLessThanOrEqual(width+1);
   await page.screenshot({path:`test-results/products-mosaic-${width}x${height}.png`});
  }finally{await context.close();}
 });
}

test.describe('acciones de Productos',()=>{
test.beforeEach(async({page})=>{await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);});

test('desactivar varios espera confirmación y se refleja en datos, indicadores y filtros',async({page})=>{
 await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-select-product="p-pulsera"]').check();
 await page.locator('[data-action="products-bulk-deactivate"]').click();
 await expect(page.locator('tr[data-id="p-reloj"]')).toContainText('Inactivo');
 await expect(page.locator('tr[data-id="p-pulsera"]')).toContainText('Inactivo');
 expect((await page.evaluate(()=>window.__calls)).filter(c=>c[0]==='prodToggleActive')).toEqual([['prodToggleActive','p-reloj',true],['prodToggleActive','p-pulsera',true]]);
 expect(await page.evaluate(()=>window.__productRows.every(p=>p.data.active===false))).toBe(true);
 await page.locator('[data-tab-module="products"][data-tab="inactive"]').click();await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
});

test('un fallo conserva pendientes seleccionados y no anuncia una finalización falsa',async({page})=>{
 await page.evaluate(()=>window.__failProductId='p-reloj');
 await page.locator('[data-select-product="p-pulsera"]').check();await page.locator('[data-select-product="p-reloj"]').check();
 await page.locator('[data-action="products-bulk-deactivate"]').click();
 await expect(page.locator('[data-select-product="p-pulsera"]')).not.toBeChecked();
 await expect(page.locator('[data-select-product="p-reloj"]')).toBeChecked();
 await expect(page.locator('#adm-toast')).toContainText('No se pudieron actualizar todos');
 expect(await page.evaluate(()=>window.__productRows.find(p=>p.id==='p-reloj').data.active)).toBe(true);
});

test('actualización remota preserva selección, muestra stock nuevo y poda eliminados',async({page})=>{
 await page.locator('[data-select-product="p-reloj"]').check();
 await page.evaluate(()=>{window.__productRows.find(p=>p.id==='p-reloj').data.stock=2;window.__publishProducts();});
 await expect(page.locator('[data-select-product="p-reloj"]')).toBeChecked();
 await expect(page.locator('tr[data-id="p-reloj"] .tt-commerce-stock')).toHaveText('2');
 await page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open').click();
 await page.evaluate(()=>{window.__productRows=window.__productRows.filter(p=>p.id!=='p-reloj');window.__publishProducts();});
 await expect(page.locator('#tt-commerce-drawer')).toBeHidden();
 await expect(page.locator('[data-select-product="p-reloj"]')).toHaveCount(0);
 await expect(page.locator('#tt-commerce-products .tt-commerce-bulkbar')).toBeHidden();
});

test('eliminar seleccionados envía sólo los IDs elegidos al flujo existente',async({page})=>{
 await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-select-product="p-aro"]').check();
 await page.locator('[data-action="products-bulk-delete"]').click();
 expect(await page.evaluate(()=>window.__calls.find(c=>c[0]==='bulkDelete'))).toEqual(['bulkDelete',['p-reloj','p-aro']]);
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
 await expect(page.locator('#tt-commerce-products tbody')).toContainText('Pulsera Cuero Café');
});

});

test('foto y ficha técnica usan los datos nuevos, con apertura por teclado y texto escapado',async({page})=>{
 await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
 await page.evaluate(()=>{Object.assign(window.__productRows.find(p=>p.id==='p-reloj').data,{imageUrl:'https://img.test/nueva.webp',material:'Acero inoxidable',measurements:'45 cm',care:'<img id="unsafe-product" src=x>',tags:['regalo','acero'],variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:2}]});window.__publishProducts();});
 await expect(page.locator('tr[data-id="p-reloj"] img')).toHaveAttribute('src','https://img.test/nueva.webp');
 await page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open').focus();await page.keyboard.press('Enter');
 const drawer=page.locator('#tt-commerce-drawer');await expect(drawer).toContainText('Acero inoxidable');await expect(drawer).toContainText('45 cm');await expect(drawer).toContainText('Dorado, Plateado');await expect(drawer).toContainText('Stock por variante');
 await expect(drawer.locator('#unsafe-product')).toHaveCount(0);await expect(drawer).toContainText('<img id="unsafe-product" src=x>');
});

test('solo lectura no expone edición ni permite activar varios mediante un botón inyectado',async({page})=>{
 await mockRuntime(page,{role:'viewer'});await page.goto('https://tintin.test/admin-commerce-fixture');
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
 await expect(page.locator('[data-action="product-new"]')).toHaveCount(0);
 await page.locator('[data-select-product="p-reloj"]').check();
 await page.evaluate(()=>{const button=document.createElement('button');button.dataset.action='products-bulk-deactivate';button.id='test-forbidden';button.textContent='Acción no permitida';document.body.append(button);});
 await page.locator('#test-forbidden').click();
 expect((await page.evaluate(()=>window.__calls)).filter(c=>c[0]==='prodToggleActive')).toEqual([]);
 await expect(page.locator('#adm-toast')).toContainText('No tenés permiso');
});

for(const width of [390,768,1440])test(`editor de foto principal grande y sin recortes en ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await mockRuntime(page);
 await page.route('https://tintin.test/js/components/images/biblioteca-multimedia.js*',route=>route.fulfill({contentType:'text/javascript',body:'export const deleteMediaByUrlIfUnused=()=>{throw Error("Sin escrituras");};export const deleteMediaItem=deleteMediaByUrlIfUnused;export const uploadImageToLibrary=deleteMediaByUrlIfUnused;'}));
 await page.goto('https://tintin.test/admin-commerce-fixture');
 await page.evaluate(async moduleUrl=>{
  const {attachImageUploadWidget}=await import(moduleUrl);
  const slot=document.createElement('div');slot.id='prod-image-widget';document.querySelector('#prod-form-card .adm-card-body').append(slot);
  attachImageUploadWidget(slot,{label:'Imagen principal',value:'https://img.test/principal.webp'});
  document.getElementById('prod-form-card').style.display='block';
 },'/js/components/images/carga-imagenes.js?fixture');
 const preview=page.locator('#prod-image-widget .tt-iuw-preview');await expect(preview).toBeVisible();
 expect((await preview.boundingBox()).width).toBeGreaterThan(180);await expect(preview.locator('img')).toHaveCSS('object-fit','contain');
   const photo=await preview.boundingBox();expect(photo.x).toBeGreaterThanOrEqual(0);expect(photo.x+photo.width).toBeLessThanOrEqual(width+1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/product-editor-image-${width}.png`});
});

// Formulario completo real; CSP impide Auth, SDK y cualquier escritura remota.
for(const width of [320,390,768,1440])test(`todos los campos del editor caben en ${width}`,async({page})=>{
 const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../..');const shell=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 await page.route('**/*',route=>{
  const url=new URL(route.request().url()),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(url.origin!=='https://tintin.test'||!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  const types={'.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
  const type=types[path.extname(file)];if(!type)return route.abort();
  return route.fulfill({contentType:type,body:fs.readFileSync(file)});
 });
 await page.setViewportSize({width,height:1000});
 await page.route('**/product-editor-fixture.html',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; object-src 'none'"},body:shell}));
 await page.goto('https://tintin.test/product-editor-fixture.html',{waitUntil:'load'});
 await page.addStyleTag({path:'css/admin/shopify-commerce-admin.css'});
 await page.evaluate(()=>{
  document.documentElement.classList.add('adm-auth-ready');
  document.querySelectorAll('.adm-section').forEach(el=>el.classList.remove('active'));
  const section=document.getElementById('section-productos');section.classList.add('active','tt-commerce-mounted');
  document.getElementById('prod-list-card').style.display='none';document.getElementById('prod-form-card').style.display='block';
 },'/js/components/images/carga-imagenes.js?fixture');
 await expect(page.locator('#prod-name')).toBeVisible();
 const layout=await page.locator('#prod-form-card input:not([type=hidden]),#prod-form-card select,#prod-form-card textarea,#prod-form-card button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,left:r.left,right:r.right,width:r.width};}).filter(r=>r.width>0));
 expect(layout.length).toBeGreaterThan(25);
 for(const field of layout){expect(field.left,field.id).toBeGreaterThanOrEqual(0);expect(field.right,field.id).toBeLessThanOrEqual(width+1);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
