const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');
const devices = [
  ['móvil pequeño',320,568], ['móvil vertical',390,844], ['móvil horizontal',844,390],
  ['tablet compacta vertical',600,960], ['tablet compacta horizontal',960,600],
  ['tablet vertical',768,1024], ['tablet horizontal',1024,768],
  ['tablet grande vertical',820,1180], ['tablet grande horizontal',1180,820],
  ['laptop',1366,768], ['desktop',1920,1080], ['desktop amplio',2560,1440],
];
async function settle(page) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function contained(locator, width) {
  const boxes = await locator.evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden').map(n => {const b = n.getBoundingClientRect(); return {id:n.id || n.className,x:b.left,right:b.right};}));
  for (const box of boxes) { expect(box.x,box.id).toBeGreaterThanOrEqual(-1); expect(box.right,box.id).toBeLessThanOrEqual(width+1); }
}
for (const [name,width,height] of devices) {
  test(`panel completo: ${name} ${width}x${height}`, async ({page}, info) => {
    await load(page,width,'admin.html',{mobile:true,sidebar:true,guard:true}); await page.setViewportSize({width,height});
    await page.evaluate(() => {
      for (const [id,value] of Object.entries({'stat-users':'1.248','stat-orders-today':'24','stat-sales-month':'25.850.000 Gs.','stat-orders-total':'1.482','stat-visits-today':'368','stat-online-now':'12'})) document.getElementById(id).textContent=value;
    });
    await settle(page);
    // Una palabra de módulo no debe dividirse para hacerla entrar en una celda.
    const config = page.locator('.tt-dashboard-link[data-admin-open="configuracion"] strong');
    expect(await config.evaluate(n => {const r=document.createRange();r.selectNodeContents(n);return r.getClientRects().length;})).toBe(1);
    const cards = page.locator('.tt-dashboard-link');
    await contained(cards,width);
    const stats = await page.locator('#dash-stats .adm-stat').evaluateAll(nodes => nodes.map(n => {const b=n.getBoundingClientRect();return {x:b.x,y:b.y};}));
    if(width>=1680) expect(stats.every(s=>Math.abs(s.y-stats[0].y)<1)).toBe(true);
    if(width===1366) expect((await page.locator('.tt-dashboard-orders').boundingBox()).y).toBeLessThan(height);
    // Usar el espacio del monitor, con un contenedor centrado y acotado.
    if(width>=1920) {const b=await page.locator('.adm-content').boundingBox();expect(b.width).toBeGreaterThan(1500);expect(b.width).toBeLessThanOrEqual(1680);}
    await page.screenshot({path:info.outputPath(`dashboard-${width}x${height}.png`)});
    const ids = await page.locator('.adm-content > .adm-section').evaluateAll(nodes=>nodes.map(n=>n.id));
    expect(ids.length).toBeGreaterThan(20);
    for(const id of ids) {
      await page.evaluate(id=>document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id===id)),id);await settle(page);
      const section=page.locator('#'+id);await expect(section).toBeVisible();
      await contained(section.locator('.adm-card,.adm-table-wrap,.tt-admin-workspace-bar,.adm-field input,.adm-field select,.adm-field textarea'),width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id).toBe(true);
    }
  });
}
for(const width of [360,540,541,760,761,1000,1001,1100,1101,1279,1280,1679,1680]) {
  test(`accesos legibles en transición ${width}px`, async({page})=>{
    await load(page,width,'admin.html',{mobile:true,sidebar:true});
    await contained(page.locator('.tt-dashboard-hero,.tt-dashboard-link,.adm-topbar-actions'),width);
    const labels=await page.locator('.tt-dashboard-link strong').evaluateAll(nodes=>nodes.map(n=>{const r=document.createRange();r.selectNodeContents(n);return r.getClientRects().length;}));
    expect(labels).toEqual([1,1,1,1]);
  });
}

test.describe('interacción táctil y rotación',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('tablet conserva formulario y navegación al girar y fijar el lateral',async({page})=>{
    await load(page,768,'admin.html',{mobile:true,sidebar:true,guard:true});await page.setViewportSize({width:768,height:1024});
    await page.evaluate(()=>{document.getElementById('section-dashboard').classList.remove('active');document.getElementById('section-configuracion').classList.add('active');});
    const field=page.locator('#section-configuracion input[type="text"]').first();await field.fill('Borrador tablet');
    await page.locator('#adm-sidebar-toggle').tap();await expect(page.locator('#adm-sidebar-toggle')).toHaveAttribute('aria-pressed','true');
    for(const [width,height] of [[1024,768],[820,1180],[1180,820],[768,1024]]) {
      await page.setViewportSize({width,height});await settle(page);await expect(field).toHaveValue('Borrador tablet');await expect(field).toBeEditable();
      await contained(page.locator('#section-configuracion .adm-card,#section-configuracion .adm-input'),width);
      expect(await page.locator('.adm-main').evaluate(n=>n.inert)).toBe(false);
    }
  });
});
for(const [width,height] of [[390,844],[768,1024],[1024,768],[1920,1080]]) {
  test(`Imágenes comparte distribución a ${width}x${height}`,async({page},info)=>{
    await load(page,width,'admin-images.html');await page.setViewportSize({width,height});
    await page.evaluate(()=>{
      const header=document.getElementById('adm-header');header.style.display='flex';
      const grid=document.getElementById('adm-cards-grid');
      for(let i=0;i<6;i++){const card=document.createElement('div');card.className='adm-img-card';card.innerHTML='<div class="adm-card-label">Imagen de prueba</div><button class="adm-btn">Seleccionar</button>';grid.append(card);}
    });await settle(page);await contained(page.locator('.adm-img-card,.tt-admin-workspace-bar'),width);
    const heading=await page.locator('.tt-admin-workspace-bar').boundingBox();
    const grid=await page.locator('.adm-cards-grid').boundingBox();
    expect(Math.abs(heading.x-grid.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(heading.width-grid.width)).toBeLessThanOrEqual(1);
    await page.screenshot({path:info.outputPath(`imagenes-${width}.png`)});
  });
}


for(const width of [320,390,540])test('último control accesible sobre navegación móvil '+width,async({page})=>{
  await load(page,width,'admin.html',{mobile:true,sidebar:true});await page.setViewportSize({width,height:844});
  await page.evaluate(()=>{
    const area=document.getElementById('section-dashboard');
    const spacer=document.createElement('div');spacer.style.height='1600px';area.append(spacer);
    const button=document.createElement('button');button.id='qa-last-control';button.textContent='Última acción de prueba';button.style.minHeight='44px';area.append(button);
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#qa-last-control').evaluate(n=>n.scrollIntoView({block:'end',behavior:'instant'}));
  await expect.poll(()=>page.evaluate(()=>{
    const control=document.getElementById('qa-last-control').getBoundingClientRect();
    const nav=document.getElementById('adm-mobile-tabs').getBoundingClientRect();
    return control.bottom<=nav.top && nav.bottom<=innerHeight;
  })).toBe(true);
  await expect(page.locator('#qa-last-control')).toBeInViewport();
});
