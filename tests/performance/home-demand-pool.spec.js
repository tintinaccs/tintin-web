const {test,expect}=require('@playwright/test');
const products=Array.from({length:60},(_,i)=>({id:'pool-'+i,data:{name:'Anillo '+i,category:'anillos',price:25000,stock:2,active:true,destacado:i>=56,description:'Descripción completa '.repeat(100)}}));
for(const [width,legacy] of [[390,false],[1440,false],[390,true]])test(`Inicio pide índice y hasta doce fichas; búsqueda completa sólo a demanda ${width}px legacy=${legacy}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{
  let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  localStorage.setItem('tt_cart',JSON.stringify([{id:'legacy-cart',name:'Guardado',price:15000,qty:2}]));
 });
 let fullReads=0,indexReads=0,failNextBatch=false;const batches=[];
 await page.route('**/api/public-catalog?**',route=>{
  const params=new URL(route.request().url()).searchParams,resource=params.get('resource');
  if(resource==='storeGate')return route.fulfill({json:{ok:true,resource,exists:true,data:{storeOpen:true}}});
  if(resource==='collections')return route.fulfill({json:{ok:true,resource,items:[{id:'anillos',data:{name:'Anillos',visible:true}}]}});
  let items=products;
  if(params.get('view')==='home-index') {indexReads++;items=products.map(({id,data})=>({id,data:{category:data.category,destacado:data.destacado}}));}
  else if(params.has('ids')) {if(failNextBatch){failNextBatch=false;return route.fulfill({status:503,json:{ok:false,error:'fixture-network'}});}const ids=JSON.parse(params.get('ids'));batches.push(ids);items=products.filter(product=>ids.includes(product.id));}
  else if(params.has('id'))return route.fulfill({json:{ok:true,resource,item:products.find(p=>p.id===params.get('id'))||null}});
  else fullReads++;
  return route.fulfill({json:{ok:true,resource,items,count:items.length}});
 });
 if(legacy)await page.route('**/index.html',async route=>{const response=await route.fetch();let html=await response.text();html=html.replace('</main>','<section><div id="products-grid"></div><button id="btn-home-random-products">Otra selección</button><section id="look-section"><div id="look-grid"></div><div id="look-actions"><button id="btn-otra-combo">Otra combinación</button></div></section></section></main>');await route.fulfill({response,body:html});});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#products-grid .tt-product-card')).toHaveCount(legacy?5:0);
 await expect(page.locator('#look-grid .tt-look-card')).toHaveCount(legacy?3:0);
 await expect(page.locator('#tt-best-sellers-grid .tt-product-card')).toHaveCount(4);
 expect(indexReads).toBe(1);expect(fullReads).toBe(0);expect(batches.length).toBe(1);expect(batches[0].length).toBeLessThanOrEqual(12);
 expect(await page.evaluate(()=>window.PRODUCTS.length)).toBeLessThanOrEqual(12);
 if(legacy) {
 const before=await page.evaluate(()=>window.TintinProductsStore.homeSelection.discovery);
 await page.locator('#btn-home-random-products').click();
 await expect.poll(()=>page.evaluate(()=>window.TintinProductsStore.homeSelection.discovery)).not.toEqual(before);
 expect(fullReads).toBe(0);expect(batches.every(ids=>ids.length<=12)).toBe(true);
 const oldLook=await page.evaluate(()=>window.TintinProductsStore.homeSelection.look);
 await page.locator('#btn-otra-combo').click();
 await expect.poll(()=>page.evaluate(()=>window.TintinProductsStore.homeSelection.look)).not.toEqual(oldLook);
 const confirmed=await page.evaluate(()=>window.TintinProductsStore.homeSelection.discovery);
 failNextBatch=true;
 await page.locator('#btn-home-random-products').click();
 await expect(page.locator('#home-selection-status')).toContainText('Volvé a intentar');
 expect(await page.evaluate(()=>window.TintinProductsStore.homeSelection.discovery)).toEqual(confirmed);
 await expect(page.locator('#btn-home-random-products')).toBeEnabled();
 await page.locator('#btn-home-random-products').click();
 await expect.poll(()=>page.evaluate(()=>window.TintinProductsStore.homeSelection.discovery)).not.toEqual(confirmed);
 await expect(page.locator('#home-selection-status')).toHaveText('');
 }
 const block=await page.evaluate(()=>window.TintinProductsStore.readHomeBlock({category:'anillos',count:8}));expect(block).toHaveLength(8);expect(fullReads).toBe(0);
 const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('tt_cart')));expect(cart.find(line=>line.id==='legacy-cart')?.qty).toBe(2);
 await page.evaluate(()=>scrollTo(0,0));
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('Anillo 59');
 await expect(page.locator('#search-results')).toContainText('Anillo 59');
 await expect.poll(()=>fullReads).toBe(1);
 expect(await page.evaluate(()=>window.PRODUCTS.length)).toBe(60);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
