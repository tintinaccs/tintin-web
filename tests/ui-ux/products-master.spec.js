'use strict';
const {test,expect}=require('@playwright/test');
const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');
async function start(page,width=390,height=844,config={}){
 await page.setViewportSize({width,height});await mockRuntime(page,config);await page.goto('https://tintin.test/admin-commerce-fixture');await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
 await page.addStyleTag({content:'@font-face{font-family:Montserrat;src:url("/assets-tintin/fonts/montserrat-latin-wght-normal.woff2") format("woff2");font-style:normal;font-weight:100 900;}body{font-family:Montserrat}'});await page.evaluate(()=>document.fonts.ready);
}
async function bulkBridge(page){
 await page.evaluate(async url=>{
  const {applyProductBulkTransaction}=await import(url);
  window.__bulkCalls=[];
  window.TintinProductAdmin={async applyBulkChanges(request){
   window.__bulkCalls.push(structuredClone(request));if(window.__failBulk)throw Error('Guardado rechazado por Firestore');
   const updates=[];await applyProductBulkTransaction({get:async id=>{const p=window.__productRows.find(p=>p.id===id);return {exists:()=>!!p,data:()=>structuredClone(p?.data)};},update:(id,patch)=>updates.push([id,patch])},request,[{slug:'aros'},{slug:'relojes'},{slug:'pulseras'}],id=>id,()=>123);
   updates.forEach(([id,patch])=>Object.assign(window.__productRows.find(p=>p.id===id).data,patch));window.__publishProducts();return {confirmed:true,ids:request.ids};
  }};
 },'/js/admin/products/maestro-productos-core.mjs?fixture');
}
async function nativeOrders(page){
 await page.evaluate(async url=>{
  window.__orderEdits=[];window.TintinInventoryIntegrity={async updateEditedOrder(id,patch){if(window.__rejectOrder)throw Error('El pedido cambió en otra sesión');window.__orderEdits.push({id,patch:structuredClone(patch)});return {confirmed:true};}};
  await import(url);
 },'/js/admin/orders/pedidos-superadmin-crud.js?master-fixture');
}
for(const [width,height]of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,900]])test(`edición masiva revisable y sin desbordes ${width}x${height}`,async({page})=>{
 await start(page,width,height);await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-select-product="p-pulsera"]').check();
 const toggle=page.locator('[data-action="products-bulk-panel"]');if(await toggle.isVisible())await toggle.click();
 await page.locator('[data-action="products-bulk-edit"]').click();const dialog=page.getByRole('dialog',{name:'Editar 2 productos'});await expect(dialog).toBeVisible();
 await page.getByLabel('Nuevo valor',{exact:true}).fill('60000');await expect(dialog).toContainText('85.000');await expect(dialog).toContainText('60.000');expect(await page.evaluate(()=>window.__bulkCalls.length)).toBe(0);
 const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
 for(const box of await dialog.locator('input,select,button').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{x:b.x,right:b.right,width:b.width};}).filter(b=>b.width))){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width+1);}
 await page.screenshot({path:`test-results/products-master-bulk-${width}x${height}.png`});
 await page.getByRole('button',{name:'Confirmar y aplicar (2)',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>window.__productRows.filter(p=>p.id==='p-reloj'||p.id==='p-pulsera').map(p=>p.data.price))).toEqual([60000,60000]);await expect(page.locator('.tt-product-selection')).toBeHidden();
});
test('un fallo de lote conserva selección, valores y posibilidad de reintentar',async({page})=>{
 await start(page,1440,900);await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-action="products-bulk-edit"]').click();await page.getByLabel('Nuevo valor',{exact:true}).fill('45000');
 await page.evaluate(()=>window.__failBulk=true);await page.getByRole('button',{name:'Confirmar y aplicar (1)',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Guardado rechazado');await expect(page.getByLabel('Nuevo valor',{exact:true})).toHaveValue('45000');
 expect(await page.evaluate(()=>window.__productRows.find(p=>p.id==='p-reloj').data.price)).toBe(85000);
 await page.evaluate(()=>window.__failBulk=false);await page.getByRole('button',{name:'Reintentar (1)',exact:true}).click();await expect(page.locator('[data-select-product="p-reloj"]')).not.toBeChecked();
});
test('vista previa fija rechaza un producto actualizado por otra sesión sin cambios parciales',async({page})=>{
 await start(page,1440,900);await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-select-product="p-pulsera"]').check();await page.locator('[data-action="products-bulk-edit"]').click();await page.getByLabel('Nuevo valor',{exact:true}).fill('40000');
 await page.evaluate(()=>{window.__productRows.find(p=>p.id==='p-pulsera').data.price=51000;window.__publishProducts();});await page.getByRole('button',{name:'Confirmar y aplicar (2)',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('cambió en otra sesión');
 expect(await page.evaluate(()=>window.__productRows.find(p=>p.id==='p-reloj').data.price)).toBe(85000);
});
test('SKU, tags e indicadores filtran datos reales; galería cambia de foto sin escrituras',async({page})=>{
 await start(page,1440,900);await page.evaluate(()=>{Object.assign(window.__productRows.find(p=>p.id==='p-reloj').data,{sku:'TIN-ACERO',tags:['regaloespecial'],imagesExtra:['https://img.test/segunda.webp']});window.__publishProducts();});
 await page.getByRole('searchbox',{name:'Buscar productos por nombre, SKU, colección o etiqueta'}).fill('regaloespecial');await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
 await page.getByRole('searchbox',{name:'Buscar productos por nombre, SKU, colección o etiqueta'}).fill('TIN-ACERO');await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
 await page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open').click();await page.getByRole('button',{name:'Ver foto 2',exact:true}).click();await expect(page.locator('.tt-commerce-product-preview > .tt-commerce-thumb img')).toHaveAttribute('src','https://img.test/segunda.webp');
 await page.keyboard.press('Escape');await page.locator('[data-action="products-reset-filters"]').click();await page.locator('[data-product-metric="missingphoto"]').click();await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);await expect(page.locator('#tt-commerce-products tbody')).toContainText('Aro Argolla');
 expect(await page.evaluate(()=>window.__calls.filter(call=>call[0]==='prodToggleActive').length)).toBe(0);
});
test('duplicar usa el controlador canónico, sin ejecutar un guardado automático',async({page})=>{
 await start(page,1440,900);await page.evaluate(()=>window.prodDuplicar=id=>window.__calls.push(['prodDuplicar',id]));await page.locator('tr[data-id="p-reloj"] .tt-commerce-product-open').click();await page.getByRole('button',{name:'Duplicar',exact:true}).click();expect(await page.evaluate(()=>window.__calls.at(-1))).toEqual(['prodDuplicar','p-reloj']);
});
for(const [width,height]of [[320,700],[844,390],[768,1024],[1440,900]])test(`vincular compra existente abre borrador canónico y guarda sólo al confirmar ${width}x${height}`,async({page})=>{
 await start(page,width,height);await nativeOrders(page);await page.locator('[data-select-product="p-pulsera"]').check();const toggle=page.locator('[data-action="products-bulk-panel"]');if(await toggle.isVisible())await toggle.click();await page.locator('[data-action="products-link-order"]').click();
 const link=page.getByRole('dialog',{name:'Vincular productos a una compra'});await expect(link).toBeVisible();await expect(link.getByText('Crear pedido nuevo',{exact:false})).toHaveCount(0);await page.getByLabel('Elegí un pedido',{exact:true}).selectOption('1024');await page.getByRole('button',{name:'Abrir pedido y agregar la selección',exact:true}).click();await expect(link).toHaveCount(0);
 const order=page.locator('#tinped-crud-overlay');await expect(order).toBeVisible();await expect(page.locator('#tinped-name')).toHaveValue('María González');expect(await page.evaluate(()=>window.__orderEdits.length)).toBe(0);
 const rows=page.locator('#tinped-items [data-item-row]');await expect(rows).toHaveCount(2);await expect(rows.nth(1).locator('[data-item-field="qty"]')).toHaveValue('2');
 for(const box of await order.locator('input,select,button,img').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width};}).filter(r=>r.width))){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width+1);}
 await rows.first().locator('[data-item-field="name"]').fill('Nombre revisado');await expect(rows.first().locator('[data-item-field="name"]')).toBeFocused();
 await page.screenshot({path:`test-results/products-master-order-${width}x${height}.png`});
 await page.locator('#tinped-save').click();await expect(order).toBeHidden();const edits=await page.evaluate(()=>window.__orderEdits);expect(edits).toHaveLength(1);expect(edits[0].id).toBe('1024');expect(edits[0].patch.baseChangeId).toBe('fixture_initial');expect(edits[0].patch.items[0].id).toBe('p-reloj');expect(edits[0].patch.items[1].qty).toBe(2);
});
test('cuenta sin permisos no abre edición masiva ni vinculación mediante botones inyectados',async({page})=>{
 await start(page,1440,900,{role:'viewer'});await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();
 for(const action of ['products-bulk-edit','products-link-order','product-duplicate']){await page.evaluate(action=>{const b=document.createElement('button');b.id='forbidden';b.dataset.action=action;b.dataset.id='p-reloj';b.textContent='Intentar';document.body.append(b);},action);await page.locator('#forbidden').click();await page.locator('#forbidden').evaluate(el=>el.remove());}
 await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.__bulkCalls.length)).toBe(0);
});
test('cerrar sesión retira el selector de compras y los datos del pedido abierto',async({page})=>{
 await start(page,1440,900);await nativeOrders(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-action="products-link-order"]').click();await page.evaluate(()=>window.__authCallback(null));await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('edición masiva ofrece colección, etiquetas y stock; Escape conserva selección sin escribir',async({page})=>{
 await start(page,390,844);await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-action="products-bulk-panel"]').click();await page.locator('[data-action="products-bulk-edit"]').click();
 await page.getByLabel('Qué querés cambiar',{exact:true}).selectOption('category');await page.getByLabel('Nuevo valor',{exact:true}).selectOption('aros');await expect(page.getByRole('dialog')).toContainText('Relojes → Aros');
 await page.getByLabel('Qué querés cambiar',{exact:true}).selectOption('stockDelta');await page.getByLabel('Nuevo valor',{exact:true}).fill('-2');await expect(page.getByRole('dialog')).toContainText('7 → 5');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('[data-select-product="p-reloj"]')).toBeChecked();expect(await page.evaluate(()=>window.__bulkCalls.length)).toBe(0);
});
test('código de compra exacto, error de concurrencia y reintento conservan pedido y borrador',async({page})=>{
 await start(page,390,844);await nativeOrders(page);await page.evaluate(()=>{window.__orders[0].orderNumber='TINPED42';window.__publishOrders();});
 await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-action="products-bulk-panel"]').click();await page.locator('[data-action="products-link-order"]').click();await page.getByLabel('O ingresá su código o ID exacto',{exact:true}).fill('tinped42');await page.getByRole('button',{name:'Abrir pedido y agregar la selección',exact:true}).click();
 await expect(page.locator('#tinped-name')).toHaveValue('María González');await page.evaluate(()=>window.__rejectOrder=true);await page.locator('#tinped-save').click();await expect(page.locator('#tinped-error')).toContainText('cambió en otra sesión');await expect(page.locator('#tinped-crud-overlay')).toBeVisible();expect(await page.evaluate(()=>window.__orderEdits.length)).toBe(0);
 await page.evaluate(()=>window.__rejectOrder=false);await page.locator('#tinped-save').click();expect(await page.evaluate(()=>window.__orderEdits[0].id)).toBe('1024');
});
test('variante y cantidades se revisan antes de guardar el pedido',async({page})=>{
 await start(page,390,844);await page.evaluate(()=>{Object.assign(window.__productRows[0].data,{variants:{Color:['Negro','Dorado']},variantInventory:[{variant:'Negro',stock:4},{variant:'Dorado',stock:3}]});window.__publishProducts();});await nativeOrders(page);
 await page.evaluate(()=>window.TintinOrderAdmin.openAdvancedOrderEditor('1024',{productIds:['p-reloj']}));
 await page.locator('#tinped-save').click();await expect(page.locator('#tinped-error')).toContainText('variante válida');expect(await page.evaluate(()=>window.__orderEdits.length)).toBe(0);
 for(const select of await page.locator('#tinped-items select[data-item-field="variant"]').all())await select.selectOption('Negro');
 const qty=page.locator('#tinped-items [data-item-field="qty"]').first();await qty.fill('100');await page.locator('#tinped-save').click();await expect(page.locator('#tinped-error')).toContainText('1 a 99');await qty.fill('2');await expect(qty).toBeFocused();await page.locator('#tinped-save').click();expect(await page.evaluate(()=>window.__orderEdits.length)).toBe(1);
});
test('el guard nativo permite seguir editando o descartar el borrador vinculado',async({page})=>{
 const fs=require('node:fs');const shell=fs.readFileSync('admin.html','utf8');const startAt=shell.indexOf('<div id="unsaved-modal"');const markup=shell.slice(startAt,shell.indexOf('\n<!-- ═',startAt));
 await start(page,390,844);await page.evaluate(markup=>{const doc=new DOMParser().parseFromString(markup,'text/html');document.body.append(doc.getElementById('unsaved-modal'));},markup);await page.addScriptTag({url:'/js/admin/proteccion-cambios-pendientes-admin.js'});await nativeOrders(page);
 await page.evaluate(()=>window.TintinOrderAdmin.openAdvancedOrderEditor('1024',{productIds:['p-reloj']}));await page.locator('#tinped-modal-close').click();await expect(page.locator('#unsaved-modal')).toBeVisible();
 const rect=await page.locator('#unsaved-modal-stay').boundingBox();expect(await page.evaluate(rect=>Boolean(document.elementFromPoint(rect.x+3,rect.y+3)?.closest('#unsaved-modal')),rect)).toBe(true);
 await page.locator('#unsaved-modal-stay').click();await expect(page.locator('#tinped-crud-overlay')).toBeVisible();await page.locator('#tinped-modal-close').click();await page.locator('#unsaved-modal-discard').click();await expect(page.locator('#tinped-crud-overlay')).toBeHidden();expect(await page.evaluate(()=>window.__orderEdits.length)).toBe(0);
});
test('perder la sesión elimina el editor de compra y sus datos del DOM',async({page})=>{
 await start(page,390,844);await nativeOrders(page);await page.evaluate(()=>window.TintinOrderAdmin.openAdvancedOrderEditor('1024',{productIds:['p-reloj']}));await expect(page.locator('#tinped-crud-overlay')).toBeVisible();await page.evaluate(()=>window.__authCallback(null));await expect(page.locator('#tinped-crud-overlay')).toHaveCount(0);await expect(page.locator('html')).not.toHaveClass(/tt-product-order-open/);
});

test('Activos cuenta el estado real incluso con stock agotado',async({page})=>{
 await start(page,1440,900);await expect(page.locator('[data-product-metric="active"]')).toContainText('2');
 await page.locator('[data-product-metric="active"]').click();await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(2);
 const row=page.locator('tr[data-id="p-pulsera"]');await expect(row.locator('.tt-commerce-badge').first()).toHaveText('Agotado');
 await expect(row.getByLabel('Estado de Pulsera Cuero Café',{exact:true})).toHaveValue('true');
 await expect(row.getByLabel('Stock de Pulsera Cuero Café',{exact:true})).toHaveValue('0');
});

test('inactivar varios usa un solo lote con revisión y confirmación explícita',async({page})=>{
 await start(page,1440,900);await bulkBridge(page);await page.locator('[data-select-product="p-reloj"]').check();await page.locator('[data-select-product="p-pulsera"]').check();await page.locator('[data-action="products-bulk-deactivate"]').click();
 await expect(page.getByLabel('Nuevo valor',{exact:true})).toHaveValue('false');expect(await page.evaluate(()=>window.__bulkCalls.length)).toBe(0);await page.getByRole('button',{name:'Confirmar y aplicar (2)',exact:true}).click();expect(await page.evaluate(()=>window.__bulkCalls.length)).toBe(1);expect(await page.evaluate(()=>window.__productRows.filter(p=>p.id==='p-reloj'||p.id==='p-pulsera').every(p=>p.data.active===false))).toBe(true);
});

test('cerrar una ficha antes del frame de apertura no deja el fondo bloqueado',async({page})=>{
 await start(page,1440,900);
 await page.evaluate(()=>{
  window.__originalRAF=window.requestAnimationFrame;window.__pendingFrames=[];
  window.requestAnimationFrame=callback=>{window.__pendingFrames.push(callback);return window.__pendingFrames.length;};
  document.querySelector('tr[data-id="p-reloj"] .tt-commerce-product-open').click();
  document.querySelector('#tt-commerce-drawer [data-action="drawer-close"]').click();
  window.requestAnimationFrame=window.__originalRAF;
  for(const callback of window.__pendingFrames)callback(performance.now());
 });
 await expect(page.locator('#tt-commerce-drawer')).toBeHidden();
 await expect(page.locator('#tt-commerce-drawer-backdrop')).not.toHaveClass(/open/);
 await page.locator('[data-action="products-reset-filters"]').click();
});
