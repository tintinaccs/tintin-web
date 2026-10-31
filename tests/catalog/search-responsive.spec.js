const {test,expect}=require('@playwright/test');
const products=[
 {id:'ring',sku:'TIN-00042',name:'Anillo corazón',description:'Acero quirúrgico',category:'anillos',price:25000,priceBefore:35000,stock:2,active:true,variants:{Color:['Dorado']}},
 {id:'watch',name:'Reloj Sol',category:'relojes',price:180000,stock:2,active:true},
 {id:'empty',name:'Anillo agotado',category:'anillos',price:15000,stock:0,active:true},
];
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1180,820],[1366,768],[1920,1080]])test(`búsqueda tolerante y recuperación de filtros ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?products:[{id:'anillos',name:'Anillos',slug:'anillos',visible:true},{id:'relojes',name:'Relojes',slug:'relojes',visible:true}]).map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo',{waitUntil:'domcontentloaded'});
 const cards=page.locator('#cat-grid [data-product-id]');await expect(cards).toHaveCount(3);
 await page.locator('#cat-search').fill('anilo corazon');await expect(cards).toHaveCount(1);await expect(cards).toHaveAttribute('data-product-id','ring');
 await page.locator('#cat-search').fill('dorado');await expect(cards).toHaveCount(1);
 await page.locator('#cat-search').fill('TIN-00042');await expect(cards).toHaveCount(1);await expect(cards).toHaveAttribute('data-product-id','ring');
 await page.locator('#cat-search').fill('zzzzzzzz');await expect(page.locator('#cat-empty-reset')).toBeVisible();
 await page.locator('#cat-empty-reset').click();await expect(cards).toHaveCount(3);await expect(page.locator('#cat-search')).toHaveValue('');
 await expect(cards.last()).toHaveAttribute('data-product-id','empty');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 const searchHeight=(await page.locator('#search-panel').boundingBox()).height;
 await page.locator('#search-input').fill('TIN-00042');await expect(page.locator('#search-results .tt-search-result-copy strong')).toHaveText(['Anillo corazón']);
 await page.locator('#search-input').fill('anilo corazon');
 await expect(page.locator('#search-results .tt-search-result-copy strong')).toHaveText(['Anillo corazón']);
 await expect(page.locator('#search-results s')).toHaveText('Gs. 35.000');
 await expect(page.locator('#search-results')).toContainText('−29%');
 if(width<=1024)expect((await page.locator('#search-panel').boundingBox()).height).toBeCloseTo(searchHeight,0);
 await page.locator('#search-input').press('ArrowDown');await expect(page.locator('#search-input')).toHaveAttribute('aria-activedescendant',/tt-search-result-/);
 await page.screenshot({path:`artifacts/commerce/search-${width}x${height}.png`});
});

for(const [width,height,path] of [[390,844,'envios'],[844,390,'preguntas-frecuentes'],[1366,768,'envios']])test(`página informativa carga búsqueda al usarla y conserva texto temprano ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?products:[{id:'anillos',name:'Anillos',slug:'anillos',visible:true}]).map(({id,...data})=>({id,data}))}});
 });
 const decorativeRequests=[];
 page.on('request',request=>{if(request.url().includes('extension-revelado-marca.js'))decorativeRequests.push(request.url());});
 await page.goto('/'+path,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.TintinAccountMobileFixBooted);
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/control-busqueda|busqueda-productos|extension-revelado-marca/.test(r.name)))).toBe(false);
 if(width===1366)expect(await page.evaluate(()=>new Set(performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>r.name)).size)).toBeLessThanOrEqual(120);
 await page.route('**/control-busqueda.js?**',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('TIN-00042');
 await expect(page.locator('#search-results .tt-search-result-copy strong')).toHaveText(['Anillo corazón']);
 await expect(page.locator('#search-results a')).toHaveAttribute('href','/product?id=ring');
 expect(decorativeRequests).toHaveLength(0);
 expect(await page.evaluate(()=>window.TintinBrandRevealExtensionBooted===true)).toBe(false);
 // Ambas acciones en el mismo turno reproducen el cierre aún pendiente.
 await page.evaluate(()=>{
  document.querySelector('#btn-search-close').click();
  [...document.querySelectorAll('[aria-controls="search-panel"]')].find(el=>el.getClientRects().length).click();
 });
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 await expect(page.locator('#search-panel')).toBeVisible();
 await expect(page.locator('#search-panel')).toHaveAttribute('aria-hidden','false');
 await expect(page.locator('#search-input')).toBeVisible();
 await expect(page.locator('#search-input')).toBeFocused();
 await expect(page.locator('#search-input')).toHaveValue('');
 expect(decorativeRequests).toHaveLength(0);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('idle');
 await page.locator('[aria-controls="account-drawer"]:visible').first().click();
 await expect.poll(()=>page.evaluate(()=>window.TintinBrandRevealExtensionBooted===true)).toBe(true);
 expect(decorativeRequests).toHaveLength(1);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('idle');
 await page.locator('[aria-controls="account-drawer"]:visible').first().click();
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 expect(decorativeRequests).toHaveLength(1);
});

test('motor comercial v2 comparte precio y descuento entre tarjeta y búsqueda',async({page})=>{
 const fixture={id:'v2search',sku:'V2-FIXTURE',name:'Anillo Fixture V2',category:'anillos',price:100,priceBefore:120,stock:null,active:true,variantCommerceVersion:2,variants:{Color:['Plateado','Dorado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:0,price:150},{variant:'Dorado',attributes:{Color:'Dorado'},stock:null,price:250,priceBefore:300}]};
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  const rows=resource==='products'?[fixture]:[{id:'anillos',name:'Anillos',slug:'anillos',visible:true}];
  return route.fulfill({json:{ok:true,resource,items:rows.map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo');
 await expect(page.locator('#cat-grid .tt-card-price')).toContainText('250');
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('V2-FIXTURE');
 await expect(page.locator('#search-results .tt-search-result-copy')).toContainText('Gs. 250');
 await expect(page.locator('#search-results s')).toHaveText('Gs. 300');
});

// Test-only visual viewport: sends native event names through the controller's
// actual listeners. This does not certify an iOS virtual keyboard.
for (const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1024,768],[1180,820],[1440,900],[3840,2160]]) {
 test(`resultados completos, teclado y restauración ${width}×${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>{
   const viewport=new EventTarget();
   viewport.height=innerHeight;viewport.offsetTop=0;viewport.scale=1;
   Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
   window.__setKeyboard=(height,top=0)=>{viewport.height=height;viewport.offsetTop=top;viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));};
  });
  const rows=[{id:'exact',name:'ELIORA',price:25000,stock:0,active:true,category:'anillos'},...Array.from({length:30},(_,i)=>({id:'match-'+i,name:'Eliora accesorio '+String(i).padStart(2,'0')+' con nombre completo muy extenso para comprobar lectura sin recortes',price:35000,stock:2,active:true,category:'anillos'})),{id:'secret',name:'ELIORA privado',active:false,price:1,stock:2,category:'anillos'}];
  await page.route('**/api/public-catalog?**',route=>{
   const resource=new URL(route.request().url()).searchParams.get('resource');
   if(!['products','collections'].includes(resource))return route.continue();
   return route.fulfill({json:{ok:true,resource,items:(resource==='products'?rows:[{id:'anillos',name:'Anillos',visible:true}]).map(({id,...data})=>({id,data}))}});
  });
  await page.goto('/envios',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('body.tt-public-shell-mounted');
  await page.waitForFunction(()=>document.querySelector('#tt-navigation-coherence-css')?.sheet || document.querySelector('#tt-navigation-coherence-css')?.disabled);
  await expect(page.locator('#tt-loader')).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/tt-scroll-locked/);
  const opener=page.locator('[aria-controls="search-panel"]:visible').first();
  // La barra móvil permanece fija. En tablet/desktop el header se oculta al
  // bajar por diseño; iniciar arriba evita probar un click fuera de pantalla.
  if(width<768)await page.evaluate(()=>scrollTo(0,160));
  await expect(opener).toBeInViewport();
  await page.evaluate(()=>addEventListener('click',()=>{window.__searchOpenY=scrollY;},{capture:true,once:true}));
  await opener.click();
  const input=page.locator('#search-input'),results=page.locator('#search-results'),panel=page.locator('#search-panel');
  await expect(input).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
  await input.fill('  éliora  ');
  const links=results.locator('a');
  await expect(links).toHaveCount(31);
  await expect(results.locator('img')).toHaveCount(0);
  await expect(results.locator('.tt-search-result-image--empty')).toHaveCount(31);
  await expect(links.first()).toHaveAttribute('href','/product?id=exact');
  if(width<768)await expect(page.locator('#tt-tabbar')).toBeVisible();
  for(const available of [Math.min(height,320),height,Math.min(height,200)]) {
   await page.evaluate(h=>window.__setKeyboard(h,12),available);
   await expect.poll(()=>page.locator('html').evaluate(el=>el.style.getPropertyValue('--tt-panel-viewport-height'))).toBe(`${available}px`);
   await expect.poll(async()=>{const b=await panel.boundingBox();return b.y+b.height<=available+13;}).toBe(true);
   await expect(input).toBeFocused();
   if(width<768) {
    const nav=await page.locator('#tt-tabbar').boundingBox(),search=await panel.boundingBox();
    expect(nav.y+nav.height).toBeLessThanOrEqual(available+13);
    expect(search.y+search.height).toBeLessThanOrEqual(nav.y);
    await expect(page.locator('#tt-tabbar')).toBeVisible();
    const button=await page.locator('#tabbar-search').boundingBox();
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
   }
   expect((await results.boundingBox()).height).toBeGreaterThan(0);
   const {last,box,end}=await results.evaluate(el=>{
    el.scrollTop=el.scrollHeight;
    return {last:el.querySelector('a:last-child').getBoundingClientRect().toJSON(),box:el.getBoundingClientRect().toJSON(),end:el.scrollTop+el.clientHeight>=el.scrollHeight-1};
   });
   expect(last.height).toBeGreaterThan(0);
   expect(last.y+last.height).toBeLessThanOrEqual(box.y+box.height+1);
   // A wrapped card may be taller than the remaining keyboard area. Its
   // beginning and end must both be reachable through the same scroller.
   expect(end).toBe(true);
   // Padding and the last card's margin also consume scroll space. Even a
   // card shorter than the outer box can need two positions to read it all.
   const start=await results.evaluate(el=>{
    const item=el.querySelector('a:last-child');
    el.scrollTop+=item.getBoundingClientRect().top-el.getBoundingClientRect().top-el.clientTop;
    return {item:item.getBoundingClientRect().toJSON(),box:el.getBoundingClientRect().toJSON()};
   });
   expect(start.item.top).toBeGreaterThanOrEqual(start.box.top-1);
  }
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>!!document.activeElement.closest('#search-panel,#tt-tabbar,#tt-privacy-consent'))).toBe(true);
  await page.locator('#btn-search-clear').click();
  await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(results).toBeHidden();
  await input.fill('zzzzzzzz');await expect(results).toContainText('No encontramos resultados');
  await page.locator('#btn-search-close').click();
  await expect(panel).toHaveAttribute('aria-hidden','true');
  await expect(opener).toBeFocused();
  if(width<768)await expect(page.locator('#tt-tabbar')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBe(await page.evaluate(()=>Math.round(window.__searchOpenY)));
  await expect(page.locator('html')).not.toHaveClass(/tt-surface-locked/);
  await page.evaluate(()=>window.__setKeyboard(innerHeight));
  await opener.click();await expect(input).toHaveValue('');await page.keyboard.press('Escape');
 });
}

test('catálogo vacío y error tardío no dejan carga infinita ni reabren búsqueda cerrada',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  return route.fulfill({json:{ok:true,resource,items:[]}});
 });
 await page.goto('/envios',{waitUntil:'domcontentloaded'});
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('Eliora');
 await expect(page.locator('#search-results')).toContainText('No encontramos resultados');
 await page.locator('#btn-search-close').click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tintin:products-error',{detail:{error:'Test de red tardío'}})));
 await expect(page.locator('#search-panel')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('#search-results')).toBeHidden();
 await expect(page.locator('#tt-tabbar')).toBeVisible();
});

test('error de catálogo permite reintentar y conserva la consulta más reciente',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/__search-fixture-missing.jpg',route=>route.fulfill({status:404,body:''}));
 let fail=true;
 await page.exposeFunction('__recoverCatalog',()=>{fail=false;});
 await page.addInitScript(()=>document.addEventListener('pointerdown',event=>{
  if(event.target.closest?.('.tt-search-retry'))void window.__recoverCatalog();
 },true));
 await page.route('**/api/public-catalog?**',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(resource==='products'&&fail)return route.fulfill({status:502,json:{ok:false,error:'catalog_unavailable'}});
  if(resource==='products')await new Promise(resolve=>setTimeout(resolve,200));
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?products.map(p=>({...p,imageUrl:'https://tintinaccs.com/__search-fixture-missing.jpg'})):[{id:'anillos',name:'Anillos',visible:true}]).map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/envios',{waitUntil:'domcontentloaded'});
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('reloj');
 await expect(page.locator('#search-results')).toContainText('No pudimos cargar');
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await page.locator('#search-input').fill('anillo corazón');
 await expect(page.locator('#search-results .tt-search-result-copy strong')).toHaveText(['Anillo corazón']);
 await expect(page.locator('#search-results .tt-search-result-image--empty')).toHaveCount(1);
 await page.locator('#search-input').fill('anilo');
 await expect(page.locator('#search-results')).toContainText('Coincidencia aproximada');
 await page.keyboard.press('Escape');
 await expect(page.locator('#tt-tabbar')).toBeVisible();
});

test.describe('gesto táctil en viewport nativo',()=>{
 test.use({hasTouch:true});
 test('resultados admiten gesto real del navegador y conservan scroll ante el mismo catálogo',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const rows=[...products,...Array.from({length:30},(_,i)=>({id:'touch-'+i,name:'Anillo táctil '+i,category:'anillos',price:25000,stock:2,active:true}))];
  await page.route('**/api/public-catalog?**',route=>{
   const resource=new URL(route.request().url()).searchParams.get('resource');
   if(!['products','collections'].includes(resource))return route.continue();
   return route.fulfill({json:{ok:true,resource,items:(resource==='products'?rows:[{id:'anillos',name:'Anillos',visible:true},{id:'relojes',name:'Relojes',visible:true}]).map(({id,...data})=>({id,data}))}});
  });
  await page.goto('/envios',{waitUntil:'domcontentloaded'});
  await page.locator('#tabbar-search').click();
  await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
  await page.locator('#search-input').fill('anillo');
  const results=page.locator('#search-results');
  await expect(results.locator('a')).toHaveCount(32);
  await expect.poll(()=>results.evaluate(el=>{
   const box=el.getBoundingClientRect();
   return el.contains(document.elementFromPoint(box.x+box.width/2,box.bottom-30));
  })).toBe(true);
  const box=await results.boundingBox(),session=await page.context().newCDPSession(page);
  const x=box.x+box.width/2,y=box.y+box.height-30;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=8;step++){
   await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*24}]});
   await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>results.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await session.detach();
  expect(await results.evaluate(el=>{
   const scroll=el.scrollTop,first=el.firstElementChild;
   window.dispatchEvent(new CustomEvent('tintin:products-loaded',{detail:{products:window.PRODUCTS}}));
   return el.scrollTop===scroll&&el.firstElementChild===first;
  })).toBe(true);
  await expect(page.locator('#tt-tabbar')).toBeVisible();
  await page.screenshot({path:test.info().outputPath('busqueda-barra-visible.png')});
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/tt-surface-locked/);
 });
});


test('catálogo prioriza el nombre exacto y conserva el orden elegido explícitamente', async ({ page }) => {
 const rows=[{id:'prefix',name:'ELIORA accesorios',price:100,stock:2,active:true,category:'anillos'},{id:'exact',name:'ELIORA',price:200,stock:0,active:true,category:'anillos'}];
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?rows:[{id:'anillos',name:'Anillos',visible:true}]).map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo');
 await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(2);
 await page.locator('#cat-search').fill('  éliora  ');
 await expect(page.locator('#cat-grid [data-product-id]').first()).toHaveAttribute('data-product-id','exact');
 await page.locator('#cat-sort').selectOption('precio-asc');
 await expect(page.locator('#cat-grid [data-product-id]').first()).toHaveAttribute('data-product-id','prefix');
});

for (const width of [320,390,540,768]) test(`categorías mobile completas sin recortes ${width}`, async ({page}) => {
 const collections=['Relojes','Bolsos','Aros','Collares','Pulseras','Anillos','Tobilleras','Earcuff','Armcuff','Gafas','Joyeros',
  'Accesorios especiales para acompañarte todos los días'].map((name,index)=>({id:`collection-${index}`,slug:`collection-${index}`,name,visible:true,order:index}));
 await page.setViewportSize({width,height:844});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?products:collections).map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo',{waitUntil:'domcontentloaded'});
 const nav=page.locator('#cat-tabs-mobile'),buttons=nav.locator('button');
 await expect(buttons).toHaveCount(collections.length+1);
 // Contrato compacto: una sola fila deslizable + botón accesible que la despliega.
 const measure=()=>nav.evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {width:el.clientWidth,scrollWidth:el.scrollWidth,box:box.toJSON(),page:document.documentElement.scrollWidth,
   buttons:[...el.querySelectorAll('button')].map(button=>({rect:button.getBoundingClientRect().toJSON(),width:button.clientWidth,scrollWidth:button.scrollWidth}))};
 });
 const fade=await page.locator('#cat-tabs-shell').evaluate(el=>{const css=getComputedStyle(el,'::before');return {image:css.backgroundImage,pointerEvents:css.pointerEvents};});
 expect(fade.image).toContain('linear-gradient');
 expect(fade.pointerEvents).toBe('none');
 const more=page.locator('#cat-tabs-more');
 await expect(more).toBeVisible();
 await expect(more).toHaveAttribute('aria-expanded','false');
 await expect(more).toHaveAccessibleName('Ver todas las categorías');
 const compact=await measure();
 expect(compact.page).toBeLessThanOrEqual(width);
 // Una fila: a 320 px el nombre largo de prueba ocupa dos líneas dentro de su botón.
 expect(compact.box.height).toBeLessThanOrEqual(100);
 for(const {rect,width:buttonWidth,scrollWidth} of compact.buttons){
  expect(Math.abs(rect.top-compact.buttons[0].rect.top)).toBeLessThanOrEqual(1);
  expect(rect.width).toBeLessThanOrEqual(compact.width+1);
  expect(rect.top).toBeGreaterThanOrEqual(compact.box.top-1);
  expect(rect.bottom).toBeLessThanOrEqual(compact.box.bottom+1);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(scrollWidth).toBeLessThanOrEqual(buttonWidth+1);
 }
 await more.click();
 await expect(more).toHaveAttribute('aria-expanded','true');
 await expect(more).toHaveAccessibleName('Mostrar menos categorías');
 const geometry=await measure();
 expect(geometry.page).toBeLessThanOrEqual(width);
 expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);
 for(const {rect,width:buttonWidth,scrollWidth} of geometry.buttons){
  expect(rect.left).toBeGreaterThanOrEqual(geometry.box.left-1);
  expect(rect.right).toBeLessThanOrEqual(geometry.box.right+1);
  expect(rect.top).toBeGreaterThanOrEqual(geometry.box.top-1);
  expect(rect.bottom).toBeLessThanOrEqual(geometry.box.bottom+1);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(scrollWidth).toBeLessThanOrEqual(buttonWidth+1);
 }
 expect(geometry.buttons.at(-1).rect.top).toBeGreaterThan(geometry.buttons[0].rect.top);
 const last=buttons.last();
 await last.click();
 await expect(last).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#cat-titulo')).toHaveText(collections.at(-1).name);
 const filters=page.locator('#filter-toggle');
 await expect(filters).toHaveAccessibleName('Filtros');
 await filters.click();
 await expect(filters).toHaveAttribute('aria-expanded','true');
 await expect(filters).toHaveText('Ocultar filtros');
 await expect(page.getByLabel('Solo con stock')).toBeVisible();
 await filters.click();
 await expect(filters).toHaveAttribute('aria-expanded','false');
 await expect(filters).toHaveText('Filtros');
 await page.screenshot({path:test.info().outputPath(`categorias-completas-${width}.png`),fullPage:true});
});

test('favoritos conservan nombre accesible después de buscar y ordenar',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/public-catalog?**',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  return route.fulfill({json:{ok:true,resource,items:(resource==='products'?products:[{id:'anillos',name:'Anillos',slug:'anillos',visible:true},{id:'relojes',name:'Relojes',slug:'relojes',visible:true}]).map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(3);
 await page.locator('#cat-search').fill('TIN-00042');
 await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(1);
 await expect(page.locator('#cat-grid [data-favorite-id="ring"]')).toHaveAccessibleName('Guardar Anillo corazón en favoritos');
 await page.locator('#cat-sort').selectOption('precio-desc');
 await expect(page.locator('#cat-grid [data-favorite-id="ring"]')).toHaveAccessibleName('Guardar Anillo corazón en favoritos');
});
