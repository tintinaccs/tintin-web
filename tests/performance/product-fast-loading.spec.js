const {test,expect}=require('@playwright/test');
for(const width of [320,390,768,1024,1280,1440,1920]) {
  test(`ficha muestra texto real y adelanta sus dos lecturas con Firebase bloqueado en ${width}px`,async({page,context})=>{
    await page.setViewportSize({width,height:900});
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const requested=[];
    await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());
    await page.route('**/api/public-catalog?**',async route=>{
      const url=new URL(route.request().url());
      if(!['products','collections'].includes(url.searchParams.get('resource'))) return route.continue();
      if(url.searchParams.get('resource')==='products') requested.push(url.searchParams.get('id')?'single':'catalog');
      await new Promise(resolve=>setTimeout(resolve,350));
      const resource=url.searchParams.get('resource');
      const categories=['relojes','aros','collares','pulseras'];
      const products=categories.map((category,i)=>({id:i?'r'+i:'seo-prueba',data:{name:i?'Relacionado '+i:'Reloj SEO Prueba',category,active:true,price:150000,stock:i?2:0,imageUrl:'/assets-tintin/images/collections/col-relojes.webp'}}));
      await route.fulfill({json:resource==='collections'?{ok:true,resource,items:categories.map(id=>({id,data:{name:id,visible:true}}))}:url.searchParams.has('id')?{ok:true,resource,item:products[0]}:{ok:true,resource,items:products}});
    });
    await page.goto('/product?id=seo-prueba',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#product-name')).toBeVisible();
    await expect(page.locator('#product-name')).toHaveText('Reloj SEO Prueba');
    await expect(page.locator('#product-price')).toContainText('150.000');
    await expect(page.locator('#product-status')).toHaveText('Agotado');
    await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
    await expect.poll(()=>requested.filter(x=>x==='single').length).toBe(1);
    await expect.poll(()=>requested.filter(x=>x==='catalog').length).toBe(1);
    await expect(page.locator('#related-grid .tt-product-card')).toHaveCount(3);
    await expect(page.locator('#product-loading')).toBeHidden();
    await expect(page.locator('#product-name')).toHaveCSS('visibility','visible');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
for(const width of [390,1440]) test(`Otros productos pinta tres tarjetas sin otra lectura ni reiniciar la ficha en ${width}px`,async({page,context})=>{
  await page.setViewportSize({width,height:900});
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const categories=['relojes','aros','collares','pulseras'];
  const products=categories.map((category,i)=>({id:i?'related-'+i:'seo-prueba',data:{name:i?'Relacionado '+i:'Reloj SEO Prueba',category,active:true,stock:i?2:0,price:150000,imageUrl:'/assets-tintin/images/collections/col-relojes.webp'}}));
  products.push({id:'soldout',data:{...products[1].data,stock:0}});
  let single=0,catalog=0;
  await page.addInitScript(()=>{window.productPaints=[];window.relatedPaintAt=0;window.addEventListener('tintin:product-rendered',()=>window.productPaints.push(performance.now()));const observer=new MutationObserver(()=>{if(document.querySelectorAll('#related-grid .tt-product-card').length===3){window.relatedPaintAt=performance.now();observer.disconnect();}});observer.observe(document,{childList:true,subtree:true});});
  await page.route('**/api/public-catalog?**',async route=>{
    const url=new URL(route.request().url()),resource=url.searchParams.get('resource');
    if(!['products','collections'].includes(resource)) return route.continue();
    if(resource==='products'){if(url.searchParams.has('id'))single++;else catalog++;}
    await new Promise(resolve=>setTimeout(resolve,200));
    await route.fulfill({json:resource==='collections'?{ok:true,resource,items:categories.map(id=>({id,data:{name:id,visible:true}}))}:url.searchParams.has('id')?{ok:true,resource,item:products[0]}:{ok:true,resource,items:products}});
  });
  await page.goto('/product?id=seo-prueba',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#related-grid .tt-product-card')).toHaveCount(3);
  await expect(page.locator('#related-grid')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#related-grid .tt-stock-unavailable')).toHaveCount(0);
  for(const image of await page.locator('#related-grid img').all()) await expect(image).toHaveAttribute('loading','eager');
  await expect(page.locator('#related-grid')).not.toContainText('Preparando recomendaciones');
  await expect(page.locator('#product-name')).toHaveText('Reloj SEO Prueba');
  await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
  console.log('Producto '+width+'px',await page.evaluate(()=>({mainMs:Math.round(window.productPaints[0]),relatedMs:Math.round(window.relatedPaintAt),domReadyMs:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)})));
  expect(single).toBe(1);expect(catalog).toBe(1);
  expect(await page.evaluate(()=>window.productPaints.length)).toBe(1);
  await page.evaluate(()=>window._renderProductDetail(window.PRODUCTS.find(p=>p.id==='seo-prueba')));
  expect(await page.evaluate(()=>window.productPaints.length)).toBe(1);
  await page.evaluate(()=>window._renderProductDetail({...window.PRODUCTS.find(p=>p.id==='seo-prueba'),stock:3}));
  await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
  expect(await page.evaluate(()=>window.productPaints.length)).toBe(2);
});
