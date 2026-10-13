'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {mockRuntime,fixtureHtml}=require('./helpers/admin-commerce-fixture.cjs');
const ROOT=path.resolve(__dirname,'../..');
const seed=()=>['pendiente','preparando','listo','listo_retiro','en_camino','entregado','cancelado','rechazado','devuelto','incidencia'].map((status,i)=>({
  id:`order_fixture_${i}`,orderNumber:`TINPED${String(i+1).padStart(2,'0')}`,status,shippingMethod:status==='listo_retiro'?'retiro':'delivery',
  createdAt:{seconds:1791840000-i*60},lastChangeId:`initial_${i}`,inventoryRevision:1,
  userName:i===0?'Cliente de prueba con nombre y apellido extraordinariamente extensos':'Cliente QA '+i,userPhone:'0981123456',userEmail:'cliente@example.test',
  shipping:{method:status==='listo_retiro'?'retiro':'delivery',city:'San Lorenzo',address:'Dirección de prueba registrada, sin destino real',referencia:'Portón de prueba',mapLocation:{lat:-25.3,lng:-57.5}},
  paymentStatus:i===2?'parcial':'pendiente',paymentMethod:'transferencia',subtotal:35000,shippingCost:15000,total:50000,
  items:[{id:'product_1',name:'Pulsera con nombre muy extenso para comprobar los saltos de línea y variantes',variant:'Rosa Tintin',qty:1,price:35000}],notes:'Observación QA. No despachar.',
}));

async function open(page,orders=seed()) {
  await mockRuntime(page,{orders});
  await page.route('https://tintin.test/assets-tintin/fonts/*.woff2',route=>route.fulfill({status:200,contentType:'font/woff2',body:fs.readFileSync(path.join(ROOT,'assets-tintin/fonts/montserrat-latin-wght-normal.woff2'))}));
  await page.route('https://tintin.test/admin-commerce-fixture',route=>route.fulfill({status:200,contentType:'text/html',body:fixtureHtml().replace('</head>','<link rel="stylesheet" href="/css/admin/admin-color-tokens.css"><style>@font-face{font-family:Montserrat;src:url("/assets-tintin/fonts/montserrat-latin-wght-normal.woff2");font-weight:100 900}body{padding:16px}#section-productos,#section-colecciones{display:none}</style></head>')}));
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('[data-orders-status]')).toContainText('sincronizados');
  await expect(page.locator('.tt-order-card').first()).toHaveCSS('opacity','1');
  await expect.poll(()=>page.locator('.tt-order-card').evaluateAll(cards=>cards.filter(card=>card.getClientRects().length).every(card=>getComputedStyle(card).opacity==='1'))).toBe(true);
}
const VIEWPORTS=[[320,568],[360,640],[375,812],[390,844],[414,896],[430,932],[568,320],[667,375],[844,390],[932,430],[768,1024],[820,1180],[1024,768],[1180,820],[1280,800],[1366,768],[1440,900],[1920,1080],[2560,1440],[900,1180],[1023,800],[741,900],[1500,950],[2880,1620]];
for(const [width,height] of VIEWPORTS)test(`tablero y detalles utilizables en ${width}x${height}`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height});await open(page);
  await expect(page.locator('[data-stage-count="new"]')).toHaveText('1');
  await expect(page.locator('[data-stage-count="ready"]')).toHaveText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const mobile=width<=740 || (height<=500 && width<=1000);
  if(mobile){await expect(page.locator('.tt-order-stage-tabs')).toBeVisible();await expect(page.locator('[data-order-lane="preparing"]')).toBeHidden();await page.locator('[data-action="order-stage"][data-stage="ready"]').click();await expect(page.locator('[data-order-lane="ready"]')).toBeVisible();await page.locator('[data-action="order-stage"][data-stage="new"]').click();}
  else {await expect(page.locator('[data-order-lane="new"]')).toBeVisible();await expect(page.locator('[data-order-lane="done"]')).toBeVisible();}
  if(process.env.TINTIN_REVIEW_DIR && [320,768,1440,1920].includes(width)){fs.mkdirSync(process.env.TINTIN_REVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.TINTIN_REVIEW_DIR,`pedidos-${width}.png`),fullPage:true,animations:'disabled'});}
  const trigger=page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]');await trigger.click();
  const drawer=page.getByRole('dialog',{name:/Detalles del pedido/});await expect(drawer).toBeVisible();await expect(drawer).toContainText('Rosa Tintin');await expect(drawer).toContainText('Historial');
  await expect(drawer).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  const box=await drawer.boundingBox();expect(box.width).toBeLessThanOrEqual(width+1);expect(box.height).toBeLessThanOrEqual(height+1);
  expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  expect(await drawer.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await expect(drawer.getByRole('link',{name:'WhatsApp del cliente',exact:true})).toHaveAttribute('href',/^https:\/\/wa\.me\/595981123456/);
  await expect(drawer.getByRole('link',{name:'Google Maps',exact:true})).toHaveAttribute('href',/^https:\/\/www\.google\.com\/maps\?/);
  await expect(drawer.getByRole('link',{name:'Enviar a Fito',exact:true})).toHaveAttribute('href',/^https:\/\/wa\.me\/595982518206/);
  if(process.env.TINTIN_REVIEW_DIR && [320,1440].includes(width))await page.screenshot({path:path.join(process.env.TINTIN_REVIEW_DIR,`detalle-${width}.png`),animations:'disabled'});
  await drawer.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(drawer).toBeHidden();await expect(trigger).toBeFocused();expect(errors).toEqual([]);
});
test('tarjetas se mueven sin recarga ni duplicación y actualizan contadores',async({page})=>{
  await open(page);await page.locator('[data-order-card="order_fixture_0"] [data-action="order-advance"]').click();
  await expect(page.locator('[data-order-lane="preparing"] [data-order-card="order_fixture_0"]')).toBeVisible();await expect(page.locator('[data-stage-count="new"]')).toHaveText('0');await expect(page.locator('[data-stage-count="preparing"]')).toHaveText('2');
  expect(await page.locator('[data-order-card="order_fixture_0"]').count()).toBe(1);
  expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(1);
});
test('una actualización individual conserva las otras tarjetas, filtros y posición del tablero',async({page})=>{
  await page.setViewportSize({width:1280,height:800});await open(page);
  await page.evaluate(()=>{window.__untouched=document.querySelector('[data-order-card="order_fixture_1"]');document.querySelector('[data-orders-board]').scrollLeft=150;window.__orders[0].paymentStatus='pagado';window.__publishOrders();});
  expect(await page.evaluate(()=>window.__untouched===document.querySelector('[data-order-card="order_fixture_1"]'))).toBe(true);
  expect(await page.locator('[data-orders-board]').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
  await page.locator('[data-filter="order-search"]').fill('TINPED01');await expect(page.locator('[data-order-card]')).toHaveCount(1);
  await page.reload();await expect(page.locator('[data-filter="order-search"]')).toHaveValue('TINPED01');
});
test('falla de operación y clics rápidos no mueven ni duplican el pedido',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__failChange=true;window.__changeDelay=200;});
  const button=page.locator('[data-order-card="order_fixture_0"] [data-action="order-advance"]');await button.evaluate(el=>{el.click();el.click();el.click();});
  await expect(page.locator('#adm-toast')).toContainText('No se pudo confirmar');await expect(page.locator('[data-order-lane="new"] [data-order-card="order_fixture_0"]')).toBeVisible();
  expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(1);
});
test('dos sesiones: un borrador viejo no pisa la actualización de otra sesión',async({page,context})=>{
  const second=await context.newPage(), rows=seed();
  for(const target of [page,second])await target.exposeFunction('__commit',async(id,status,draft)=>{
    const order=rows.find(o=>o.id===id);
    if(draft.baseChangeId!==order.lastChangeId)return false;
    order.status=status;order.lastChangeId=draft.changeId || 'other_session';
    for(const session of [page,second])await session.evaluate(values=>{window.__orders=values;window.__publishOrders();},rows);
    return true;
  });
  await open(page,rows);await open(second,rows);await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();await page.getByLabel('Estado del pedido',{exact:true}).selectOption('confirmado');
  await second.locator('[data-order-card="order_fixture_0"] [data-action="order-advance"]').click();
  await expect(second.locator('[data-order-lane="preparing"] [data-order-card="order_fixture_0"]')).toBeVisible();
  await page.locator('[data-action="drawer-order-save"]').click();await expect(page.locator('#adm-toast')).toContainText('otra sesión');expect(rows[0].status).toBe('preparando');
  expect(rows[0].lastChangeId).not.toBe('initial_0');await second.close();
});
test('offline pausa acciones y conserva el estado hasta la sincronización',async({page,context})=>{
  await open(page);await context.setOffline(true);await expect(page.locator('[data-orders-status]')).toContainText('Sin conexión');await expect(page.locator('[data-order-card="order_fixture_0"] [data-action="order-advance"]')).toBeDisabled();await context.setOffline(false);await expect(page.locator('[data-orders-status]')).toContainText('sincronizados');
});
test('pedido nuevo ofrece apertura una sola vez; el historial inicial no dispara sonido',async({page})=>{
  await open(page);await expect(page.locator('[data-action="orders-sound"]')).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>{window.__orders.push({...window.__orders[0],id:'order_new_fixture',orderNumber:'TINPED99'});window.__publishOrders();});
  await expect(page.locator('[data-order-notice]')).toContainText('1 pedido(s) nuevo(s)');await page.locator('[data-order-notice] button').click();await expect(page.getByRole('dialog')).toContainText('TINPED99');await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.evaluate(()=>window.__publishOrders());await expect(page.locator('[data-order-card="order_new_fixture"]')).toHaveCount(1);
});
test('retiro usa listo para retirar y nunca ofrece enviarlo',async({page})=>{
  await open(page);await page.locator('[data-action="drawer-order"][data-id="order_fixture_3"]').click();expect(await page.getByLabel('Estado del pedido',{exact:true}).locator('option[value="en_camino"]').count()).toBe(0);await expect(page.getByLabel('Estado del pedido',{exact:true})).toContainText('Retirado');
});
test('histórico, cancelado y devolución siguen disponibles sin reactivar inventario',async({page})=>{
  await open(page);await page.locator('[data-tab="attention"]').click();await expect(page.locator('[data-order-card="order_fixture_6"]')).toBeVisible();await expect(page.locator('[data-order-card="order_fixture_8"]')).toBeVisible();expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(0);
});
test('mil pedidos: contadores completos y tarjetas limitadas por etapa',async({page})=>{
  const rows=Array.from({length:1000},(_,i)=>({...seed()[i%6],id:`order_large_${i}`,orderNumber:`TINPED${i}`}));await open(page,rows);
  await expect(page.locator('[data-orders-status]')).toContainText('1000 pedidos');expect(await page.locator('[data-order-card]').count()).toBeLessThanOrEqual(150);
  await expect(page.locator('#orders-tbody tr')).toHaveCount(0);
  await page.locator('[data-order-lane="new"] [data-action="order-show-more"]').click();expect(await page.locator('[data-order-lane="new"] [data-order-card]').count()).toBe(60);
});
test('teclado, movimiento reducido y zoom conservan navegación y cierre',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);await page.locator('[data-action="order-stage"][data-stage="new"]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-action="order-stage"][data-stage="preparing"]')).toBeFocused();
  await page.locator('[data-action="order-stage"][data-stage="new"]').click();await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.querySelector('#tt-commerce-drawer').contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('historial muestra fecha, responsable, transición y observación reales',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__auditRows=[{id:'audit_fixture',actorEmail:'admin@example.test',createdAt:{seconds:1791840000},before:{status:'pendiente'},after:{status:'preparando'},notes:'Preparación revisada en QA'}];});
  await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();
  await expect(page.locator('.tt-order-history')).toContainText('admin@example.test');await expect(page.locator('.tt-order-history')).toContainText('pendiente → preparando');await expect(page.locator('.tt-order-history')).toContainText('Preparación revisada en QA');
});
test('error de sincronización pausa cambios y permite recuperar sin duplicados',async({page})=>{
  await open(page);await page.evaluate(()=>window.__publishOrders('Sincronización interrumpida'));
  await expect(page.locator('[data-order-card="order_fixture_0"] [data-action="order-advance"]')).toBeDisabled();await page.locator('[data-orders-status-retry]').click();await expect(page.locator('[data-orders-status]')).toContainText('sincronizados');await expect(page.locator('[data-order-card="order_fixture_0"]')).toHaveCount(1);
});
test('perder la sesión cierra detalles y elimina datos personales visibles',async({page})=>{
  await open(page);await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();await page.evaluate(()=>window.__authCallback(null));
  await expect(page.locator('[data-order-card]')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#tt-commerce-orders')).not.toContainText('Cliente de prueba');
});

test('sonido requiere habilitación expresa y no repite el mismo aviso',async({page})=>{
 await open(page);await page.evaluate(()=>{window.__sounds=0;window.AudioContext=class{state='running';currentTime=0;destination={};async resume(){}createOscillator(){return{frequency:{},connect(){},start(){window.__sounds++},stop(){}}}createGain(){return{gain:{},connect(){}}}};});
 await page.locator('[data-action="orders-sound"]').click();await expect(page.locator('[data-action="orders-sound"]')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>{window.__orders.push({...window.__orders[0],id:'order_sound_fixture'});window.__publishOrders();window.__publishOrders();});expect(await page.evaluate(()=>window.__sounds)).toBe(1);
 await page.locator('[data-action="orders-sound"]').click();await page.evaluate(()=>{window.__orders.push({...window.__orders[0],id:'order_sound_off'});window.__publishOrders();});expect(await page.evaluate(()=>window.__sounds)).toBe(1);
});
test('una respuesta vieja de contactos no reemplaza los datos de la revisión nueva',async({page})=>{
 await open(page);let first,requests=0;
 await page.route('https://tintin.test/api/admin-order-mutation*',async route=>{
  requests++;if(requests===1){first=route;return;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,links:{customer:'https://wa.me/595981999999?text=Actual',map:'https://www.google.com/maps?q=-25.3,-57.5'}})});
 });
 await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();await expect.poll(()=>requests).toBe(1);
 await page.evaluate(()=>{window.__orders[0].lastChangeId='new_contacts_revision';window.__orders[0].userPhone='0981999999';window.__publishOrders();});
 const link=page.getByRole('dialog').getByRole('link',{name:'WhatsApp del cliente',exact:true});await expect(link).toHaveAttribute('href',/595981999999/);
 await first.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,links:{customer:'https://wa.me/595981111111?text=Viejo'}})});
 await expect(link).toHaveAttribute('href',/595981999999/);
});
for(const [width,height] of [[320,568],[768,1024],[1440,900]])test(`editor de pedido preserva listo y pago parcial en ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page);
 await page.evaluate(async()=>{await import('/js/admin/orders/pedidos-superadmin-crud.js');await window.TintinOrderAdmin.openAdvancedOrderEditor('order_fixture_2');});
 const modal=page.getByRole('dialog',{name:/CRUD completo/});await expect(modal).toBeVisible();await expect(page.locator('#tinped-status')).toHaveValue('listo');await expect(page.locator('#tinped-pay-status')).toHaveValue('parcial');
 expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);expect(await page.locator('#tinped-crud-form').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.locator('#tinped-name').fill('Cliente QA editado localmente');await expect(page.locator('#tinped-pay-status')).toHaveValue('parcial');
 await page.locator('#tinped-shipping-method').selectOption('retiro');expect(await page.locator('#tinped-status option[value="en_camino"]').count()).toBe(0);
 await page.locator('#tinped-modal-close').click();await expect(modal).toBeHidden();expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(0);
 await page.evaluate(async()=>{window.__orders[2].paymentStatus='error';await window.TintinOrderAdmin.openAdvancedOrderEditor('order_fixture_2');});
 await expect(page.locator('#tinped-pay-status')).toHaveValue('error');await page.keyboard.press('Escape');await expect(modal).toBeHidden();
});
