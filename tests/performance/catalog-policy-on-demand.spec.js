const {test,expect}=require('@playwright/test');

for(const route of ['/contact','/envios'])test(`catálogo bajo demanda conserva sus validaciones en ${route}`,async({page})=>{
  let catalogRequests=0;
  await page.route(/https:\/\/(?:identitytoolkit|firestore|securetoken)\.googleapis\.com\//,r=>r.abort('blockedbyclient'));
  await page.route('**/api/public-catalog?**',r=>{
    catalogRequests++;
    const resource=new URL(r.request().url()).searchParams.get('resource');
    const items=resource==='collections'?[{id:'aros',name:'Aros',slug:'aros',visible:true}]:[
      {id:'visible-fixture',name:'Aro de prueba',price:35000,stock:2,active:true,category:'aros',imageUrl:'/assets/og-cover.jpg'},
      {id:'inactive-fixture',name:'Aro inactivo',price:35000,stock:2,active:false,category:'aros',imageUrl:'/assets/og-cover.jpg'},
    ];
    return r.fulfill({json:{ok:true,resource,items:items.map(({id,...data})=>({id,data}))}});
  });
  await page.addInitScript(()=>{
    window.fixturePolicyAtPublication=[];
    window.addEventListener('tintin:products-loaded',()=>{
      window.fixturePolicyAtPublication.push(Boolean(window.TintinCatalogPolicy));
    },true);
  });
  const response=await page.goto(route,{waitUntil:'domcontentloaded'});
  expect(response.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-tt-surfaces-ready','1');
  expect(catalogRequests).toBe(0);
  await page.locator('[aria-controls="search-panel"]:visible').first().click();
  await expect.poll(()=>page.evaluate(()=>window.fixturePolicyAtPublication.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.fixturePolicyAtPublication.every(Boolean))).toBe(true);
  expect(await page.evaluate(()=>window.PRODUCTS.map(item=>item.id))).toEqual(['visible-fixture']);
  expect(catalogRequests).toBeGreaterThan(0);
});
