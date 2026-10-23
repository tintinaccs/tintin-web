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
 await page.goto('/'+path,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.TintinAccountMobileFixBooted);
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/control-busqueda|busqueda-productos|extension-revelado-marca/.test(r.name)))).toBe(false);
 if(width===1366)expect(await page.evaluate(()=>new Set(performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>r.name)).size)).toBeLessThanOrEqual(120);
 await page.route('**/control-busqueda.js?**',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('TIN-00042');
 await expect(page.locator('#search-results .tt-search-result-copy strong')).toHaveText(['Anillo corazón']);
 await expect.poll(()=>page.evaluate(()=>window.TintinBrandRevealExtensionBooted===true)).toBe(true);
 await page.locator('#btn-search-close').click();
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await expect(page.locator('#search-input')).toHaveValue('');
});
