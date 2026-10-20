'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {mockRuntime,fixtureHtml}=require('./helpers/admin-commerce-fixture.cjs');
const ROOT=path.resolve(__dirname,'../..');
const seed=()=>['pendiente','preparando','listo','listo_retiro','en_camino','entregado','cancelado','rechazado','devuelto','incidencia'].map((status,i)=>({
  id:`order_fixture_${i}`,orderNumber:`TINPED${String(i+101).padStart(2,'0')}`,status,shippingMethod:status==='listo_retiro'?'retiro':'delivery',
  createdAt:{seconds:1791840000-i*60},lastChangeId:`initial_${i}`,inventoryRevision:1,
  userName:i===0?'Cliente de prueba con nombre y apellido extraordinariamente extensos':'Cliente QA '+i,userPhone:'0981123456',userEmail:'cliente@example.test',
  shipping:{method:status==='listo_retiro'?'retiro':'delivery',city:'San Lorenzo',address:'Dirección de prueba registrada, sin destino real',referencia:'Portón de prueba',mapLocation:{lat:-25.3,lng:-57.5}},
  paymentStatus:i===2?'parcial':'pendiente',paymentMethod:'transferencia',subtotal:35000,shippingCost:15000,total:50000,
  items:[{id:'product_1',name:'Pulsera con nombre muy extenso para comprobar los saltos de línea y variantes',variant:'Rosa Tintin',qty:1,price:35000}],notes:'Observación QA. No despachar.',
}));

async function open(page,orders=seed()) {
  await mockRuntime(page,{orders});
  await page.route('https://tintin.test/assets-tintin/fonts/*.woff2',route=>route.fulfill({status:200,contentType:'font/woff2',body:fs.readFileSync(path.join(ROOT,'assets-tintin/fonts/montserrat-latin-wght-normal.woff2'))}));
  await page.route('https://tintin.test/admin-commerce-fixture',route=>route.fulfill({status:200,contentType:'text/html',body:fixtureHtml().replace('</head>','<link rel="stylesheet" href="/css/admin/admin-color-tokens.css"><style>@font-face{font-family:Montserrat;src:url("/assets-tintin/fonts/montserrat-latin-wght-normal.woff2");font-weight:100 900}body{padding:0}#section-productos,#section-colecciones{display:none}</style></head>')}));
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
  expect(await page.locator('[data-orders-board]').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await expect(page.locator('.tt-order-stage-tabs')).toBeVisible();
  const stepColors=await page.locator('[data-action="order-stage"]').evaluateAll(elements=>elements.map(e=>getComputedStyle(e).backgroundColor));
  expect(new Set(stepColors).size).toBe(5);
  expect(await page.locator('.tt-order-stage-tabs').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  const mobile=width<=1180;
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
  await expect(page.locator('[data-order-lane="preparing"] [data-order-card="order_fixture_0"]')).toBeVisible();await expect(page.locator('[data-stage-count="new"]')).toHaveText('0');await expect(page.locator('[data-stage-count="preparing"]')).toHaveText('2');await expect(page.locator('[data-order-card="order_fixture_0"]')).toHaveAttribute('data-order-stage','preparing');
  expect(await page.locator('[data-order-card="order_fixture_0"]').count()).toBe(1);
  expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(1);
});
test('una actualización individual conserva las otras tarjetas, filtros y posición del tablero',async({page})=>{
  await page.setViewportSize({width:1280,height:800});await open(page);
  await page.evaluate(()=>{window.__untouched=document.querySelector('[data-order-card="order_fixture_1"]');document.querySelector('[data-orders-board]').scrollLeft=0;window.__orders[0].paymentStatus='pagado';window.__publishOrders();});
  expect(await page.evaluate(()=>window.__untouched===document.querySelector('[data-order-card="order_fixture_1"]'))).toBe(true);
  expect(await page.locator('[data-orders-board]').evaluate(e=>e.scrollLeft)).toBe(0);
  await page.locator('[data-filter="order-search"]').fill('TINPED101');await expect(page.locator('[data-order-card]')).toHaveCount(1);
  await page.reload();await expect(page.locator('[data-filter="order-search"]')).toHaveValue('TINPED101');
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
  await page.evaluate(()=>{window.__orders.push({...window.__orders[0],id:'order_new_paid',orderNumber:'TINPED100',status:'confirmado',paymentStatus:'pagado'});window.__publishOrders();});
  await page.locator('[data-order-notice] button').click();await expect(page.getByRole('dialog')).toContainText('TINPED100');await expect(page.getByRole('dialog')).toContainText('Pagado');
});
test('retiro usa listo para retirar y nunca ofrece enviarlo',async({page})=>{
  await open(page);await page.locator('[data-action="drawer-order"][data-id="order_fixture_3"]').click();expect(await page.getByLabel('Estado del pedido',{exact:true}).locator('option[value="en_camino"]').count()).toBe(0);await expect(page.getByLabel('Estado del pedido',{exact:true})).toContainText('Retirado');
});
test('histórico, cancelado y devolución siguen disponibles sin reactivar inventario',async({page})=>{
  await open(page);await page.locator('[data-tab="attention"]').click();await expect(page.locator('[data-order-card="order_fixture_6"]')).toBeVisible();await expect(page.locator('[data-order-card="order_fixture_8"]')).toBeVisible();expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(0);
});
test('mil pedidos: contadores completos y tarjetas limitadas por etapa',async({page})=>{
  const rows=Array.from({length:1000},(_,i)=>({...seed()[i%6],id:`order_large_${i}`,orderNumber:`TINPED${i+1000}`}));await open(page,rows);
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
 await page.evaluate(async()=>{await import('https://tintin.test/js/admin/orders/pedidos-superadmin-crud.js');await window.TintinOrderAdmin.openAdvancedOrderEditor('order_fixture_2');});
 const modal=page.getByRole('dialog',{name:/Editar pedido/});await expect(modal).toBeVisible();await expect(page.locator('#tinped-status')).toHaveValue('listo');await expect(page.locator('#tinped-pay-status')).toHaveValue('parcial');
 expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);expect(await page.locator('#tinped-crud-form').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.locator('#tinped-name').fill('Cliente QA editado localmente');await expect(page.locator('#tinped-pay-status')).toHaveValue('parcial');
 await page.locator('#tinped-shipping-method').selectOption('retiro');expect(await page.locator('#tinped-status option[value="en_camino"]').count()).toBe(0);
 page.once('dialog',dialog=>dialog.accept());await page.locator('#tinped-modal-close').click();await expect(modal).toBeHidden();expect(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='updateOrderStatus').length)).toBe(0);
 await page.evaluate(async()=>{window.__orders[2].paymentStatus='error';await window.TintinOrderAdmin.openAdvancedOrderEditor('order_fixture_2');});
 await expect(page.locator('#tinped-pay-status')).toHaveValue('error');await page.keyboard.press('Escape');await expect(modal).toBeHidden();
});

for (const width of [390,768,1366]) test(`actualización en vivo conserva el foco de acciones y enlaces del pedido en ${width}px`, async ({page})=>{
 await page.setViewportSize({width,height:900});await open(page);
 await page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]').click();
 const drawer=page.getByRole('dialog');
 await expect(drawer.getByRole('link',{name:'Google Maps',exact:true})).toBeVisible();
 for (const control of [drawer.locator('[data-action="drawer-order-delete"]'),drawer.getByRole('link',{name:'Google Maps',exact:true})]) {
  await control.focus();await expect(control).toBeFocused();
  await page.evaluate(()=>window.__publishOrders());
  await expect(control).toBeFocused();
 }
 const note=drawer.locator('[data-drawer-order-note]');
 await note.fill('Conservar este borrador');
 await note.evaluate(element=>element.setSelectionRange(3,9));
 await page.evaluate(()=>window.__publishOrders());
 await expect(note).toBeFocused();await expect(note).toHaveValue('Conservar este borrador');
 expect(await note.evaluate(element=>[element.selectionStart,element.selectionEnd])).toEqual([3,9]);
 await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);
 await expect(page.locator('[data-action="drawer-order"][data-id="order_fixture_0"]')).toBeFocused();
});

for (const mode of ['reset', 'today']) for (const width of [320, 768, 1440]) test('reinicio independiente ' + mode + ' confirmado y persistido en ' + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const { statisticsTodayStart } = await import('../../js/admin/statistics/modelo-reinicios.mjs');
  const dayStart = statisticsTodayStart().getTime();
  let saved = { resets: {}, lastChangeId: '' }, writes = [];
  await page.route('https://statistics-controls.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin-commerce-controls') {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON(); writes.push(input);
        saved = { resets: Object.fromEntries(input.metrics.map(key => [key, (input.mode === 'today' ? new Date(dayStart - 1).toISOString() : new Date().toISOString())])), lastChangeId: input.changeId };
      }
      return route.fulfill({ json: { ok: true, result: saved } });
    }
    if (url.pathname.endsWith('/firebase.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const auth={currentUser:{uid:"owner_fixture"}};' });
    if (url.pathname.endsWith('/cliente-api-autenticado.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const authenticatedFetch=(url, options)=>fetch(url,options);' });
    if (url.pathname.endsWith('/controles-estadisticas.js') || url.pathname.endsWith('/modelo-reinicios.mjs')) {
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, url.pathname.replace(/^\//, '')), 'utf8') });
    }
    return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><div class="adm-statistics-toolbar"></div><div id="statistics-data-status"></div><script type="module">
      import {ensureStatisticsControls,filterStatisticsRows} from 'https://statistics-controls.test/js/admin/statistics/controles-estadisticas.js';
      const rows=[{at:${dayStart - 1},total:200},{at:${dayStart + 1},total:100}];
      function render(){if(!ensureStatisticsControls(render,async options=>options.action({start(){},ok(){}})))return;window.amount=filterStatisticsRows('revenue',rows,row=>row.at).reduce((sum,row)=>sum+row.total,0);window.orders=filterStatisticsRows('orders',rows,row=>row.at).length;}
      render();</script>` });
  });
  await page.goto('https://statistics-controls.test/');
  await page.waitForFunction(() => window.amount === 300);
  await page.getByRole('button', { name: 'Reiniciar contadores' }).click();
  await page.getByRole('checkbox', { name: 'Facturación', exact: true }).check();
  await page.getByRole('button', { name: mode === 'today' ? 'Contar desde el inicio de hoy (Paraguay)' : 'Reiniciar seleccionados', exact: true }).click();
  await page.waitForFunction(expected => window.amount === expected, mode === 'today' ? 100 : 0);
  expect(await page.evaluate(() => window.orders)).toBe(2);
  expect(writes).toHaveLength(1); expect(writes[0].metrics).toEqual(['revenue']); expect(writes[0].mode).toBe(mode);
  await page.reload(); await page.waitForFunction(expected => window.amount === expected, mode === 'today' ? 100 : 0);
  await page.getByRole('button', { name: 'Reiniciar contadores' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(writes).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

for (const width of [320, 768, 1440]) test('devolución por línea, cancelación y validación en ' + width, async ({ page }, testInfo) => {
  await page.setViewportSize({width, height:900});
  await page.route('https://commerce-controls.test/**', route => {
    if (new URL(route.request().url()).pathname === '/selection.mjs') return route.fulfill({contentType:'text/javascript', body:fs.readFileSync(path.join(ROOT,'js/admin/orders/seleccion-devolucion.mjs'),'utf8')});
    return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><button id="open">Borrar</button><script type="module">import {chooseOrderTrash} from "https://commerce-controls.test/selection.mjs";window.pick=chooseOrderTrash;</script>'});
  });
  await page.goto('https://commerce-controls.test/');
  await page.waitForFunction(()=>Boolean(window.pick));
  const fixture=[{id:'order_test',orderNumber:'TINPEDQA',lastChangeId:'v1',inventoryState:'reserved',items:[{id:'product_one',name:'Pulsera QA',qty:2,price:100},{id:'product_two',name:'Reloj QA',qty:1,price:200}]}];
  await page.evaluate(orders=>{window.result=window.pick(orders);},fixture);
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollTop)).toBe(0);const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);await page.screenshot({path:testInfo.outputPath('stock-choice.png')});
  const quantity=page.getByRole('spinbutton',{name:'Unidades a devolver de Pulsera QA'});
  await expect(quantity).toHaveValue('0');await quantity.fill('3');
  await page.getByRole('button',{name:'Confirmar y mover a Borrados'}).click();await expect(dialog).toBeVisible();
  await quantity.fill('1');await page.getByRole('button',{name:'Confirmar y mover a Borrados'}).click();
  const result=await page.evaluate(()=>window.result);expect(result.selections.order_test.returnItems).toEqual([{index:0,qty:1},{index:1,qty:0}]);expect(result.selections.order_test.baseChangeId).toBe('v1');
  await page.evaluate(orders=>{window.result=window.pick(orders);},fixture);await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.result)).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]])test(`selección de pedidos reales flota sobre la navegación sin solaparse ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,[{...seed()[0],orderNumber:'TINPED26'}]);
 // Markup y CSS reales de la navegación inferior; sólo el controlador de pedidos usa datos locales.
 const nav=fs.readFileSync(path.join(ROOT,'admin.html'),'utf8').match(/<nav class="adm-mobile-tabs"[\s\S]*?<\/nav>/)[0];
 await page.addStyleTag({path:path.join(ROOT,'css/admin/admin.css')});
 await page.addStyleTag({path:path.join(ROOT,'css/admin/dashboard-control.css')});
 await page.evaluate(html=>document.body.insertAdjacentHTML('beforeend',html),nav);
 // Los controles de navegación móvil dejan cuatro primarios y Más.
 await page.evaluate(()=>document.querySelectorAll('#adm-mobile-tabs > button:not([data-mobile-primary]):not(#adm-mobile-more-toggle)').forEach(el=>el.hidden=true));
 await page.locator('[data-select-order="order_fixture_0"]').check();
 const bar=page.locator('[data-order-bulk]');await expect(bar).toBeVisible();await expect(bar).toContainText('1 seleccionado');
 await expect.poll(async()=>{const b=await bar.boundingBox(),nav=await page.locator('#adm-mobile-tabs').boundingBox();return !!b&&b.x>=11&&b.x+b.width<=width-11&&b.y>=0&&b.y+b.height<=(nav?nav.y-11:height-11);}).toBe(true);
 expect(await bar.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const filters=page.locator('.tt-order-toolbar');expect(await filters.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 for(const element of await bar.getByRole('button').all())expect((await element.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await expect(bar).toBeInViewport();
 if(process.env.TINTIN_REVIEW_DIR){fs.mkdirSync(process.env.TINTIN_REVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.TINTIN_REVIEW_DIR,`seleccion-pedidos-${width}x${height}.png`),fullPage:false});}
 await bar.getByRole('button',{name:'Limpiar selección'}).click();await expect(bar).toBeHidden();
 await page.locator('[data-select-order="order_fixture_0"]').check();
 await page.evaluate(()=>document.getElementById('section-pedidos').classList.remove('active'));await expect(bar).toBeHidden();
});

test('ocultar pruebas elimina tarjetas, búsquedas, importes y selección; mostrar restaura sólo el lote renombrado',async({page})=>{
 const original=seed()[0];
 const rows=Array.from({length:26},(_,i)=>({...original,id:`lot_${i+1}`,orderNumber:`TINPED${String(i+1).padStart(2,'0')}`,userName:i===25?'Cliente real':'Cliente ficticia',total:i===25?205000:999999}));
 await open(page,rows);
 await expect(page.locator('[data-order-card]')).toHaveCount(1);await expect(page.locator('[data-orders-status]')).toContainText('1 pedidos sincronizados');
 await expect(page.locator('[data-stage-count="new"]')).toHaveText('1');
 await expect(page.locator('[data-order-card="lot_26"]')).toContainText('TINPED26');
 await page.locator('[data-filter="order-search"]').fill('Cliente ficticia');await expect(page.locator('[data-order-card]')).toHaveCount(0);
 await page.locator('[data-filter="order-search"]').fill('');
 await page.getByRole('button',{name:'Mostrar pedidos de prueba',exact:true}).click();
 await expect(page.locator('[data-order-card]')).toHaveCount(26);await expect(page.locator('[data-order-card="lot_1"]')).toContainText('TINPEDPRUEBA01');await expect(page.locator('[data-order-card="lot_25"]')).toContainText('TINPEDPRUEBA25');
 await expect(page.locator('[data-select-order]')).toHaveCount(1);
 await page.reload();await expect(page.getByRole('button',{name:'Ocultar pedidos de prueba',exact:true})).toBeVisible();
 await page.locator('[data-select-order="lot_26"]').check();await expect(page.locator('[data-order-bulk]')).toBeVisible();
 await page.getByRole('button',{name:'Ocultar pedidos de prueba',exact:true}).click();
 await expect(page.locator('[data-order-card]')).toHaveCount(1);await expect(page.locator('[data-order-bulk]')).toBeHidden();
 expect(await page.evaluate(()=>window.__orders[0].orderNumber)).toBe('TINPED01');
 expect(await page.evaluate(()=>window.__orders[25].orderNumber)).toBe('TINPED26');
 expect(await page.evaluate(()=>window.__calls)).toEqual([]);
});

test('la barra respeta el área visible cuando el teclado reduce visualViewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,[{...seed()[0],orderNumber:'TINPED26'}]);
 await page.locator('[data-select-order="order_fixture_0"]').check();
 await page.evaluate(()=>{const viewport=new EventTarget();Object.assign(viewport,{offsetTop:0,height:444});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});dispatchEvent(new Event('resize'));});
 const bar=page.locator('[data-order-bulk]');
 await expect.poll(async()=>{const b=await bar.boundingBox();return b.y>=0&&b.y+b.height<=432;}).toBe(true);
 await page.getByRole('button',{name:'Limpiar selección',exact:true}).click();await expect(bar).toBeHidden();
});
