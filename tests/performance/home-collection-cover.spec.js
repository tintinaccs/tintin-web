const {test,expect}=require('@playwright/test');
test('Inicio conserva la portada canónica de colección sin hidratar productos ajenos a sus fichas',async({page})=>{
 const origin=new URL(test.info().project.use.baseURL).origin;
 const products=[
  {id:'first',data:{name:'Primero',category:'anillos',price:1000,stock:1,active:true,collectionOrder:0,imageUrl:origin+'/__cover-first.svg'}},
  {id:'featured',data:{name:'Destacado',category:'anillos',price:1000,stock:1,active:true,destacado:true,collectionOrder:10,imageUrl:origin+'/__cover-featured.svg'}},
 ];
 let fullRequests=0;const batches=[];
 await page.route('**/__cover-*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="pink"/></svg>'}));
 await page.route('**/api/public-catalog?**',route=>{
  const params=new URL(route.request().url()).searchParams,resource=params.get('resource');
  if(resource==='storeGate')return route.fulfill({json:{ok:true,resource,exists:true,data:{storeOpen:true}}});
  if(resource==='collections')return route.fulfill({json:{ok:true,resource,items:[{id:'anillos',data:{name:'Anillos',visible:true}}]}});
  let items;
  if(params.get('view')==='home-index')items=products.map(({id,data})=>({id,data:{category:data.category,destacado:data.destacado===true,available:true,...(id==='first'?{collectionImage:data.imageUrl}:{})}}));
  else if(params.has('ids')){const ids=JSON.parse(params.get('ids'));batches.push(ids);items=products.filter(p=>ids.includes(p.id));}
  else{fullRequests++;items=products;}
  return route.fulfill({json:{ok:true,resource,items}});
 });
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tt-best-sellers-grid .tt-product-card')).toHaveCount(1);
 await expect(page.locator('.tt-collection-card__image').first()).toHaveAttribute('src',origin+'/__cover-first.svg');
 expect(fullRequests).toBe(0);expect(batches).toEqual([['featured']]);
 expect(await page.evaluate(()=>window.PRODUCTS.map(p=>p.id))).toEqual(['featured']);
 await page.evaluate(()=>window.TintinProductsStore.loadAll());
 products[0].data.imageUrl=origin+'/__cover-updated.svg';
 await page.evaluate(()=>window.TintinProductsStore.loadHome({force:true}));
 await expect(page.locator('.tt-collection-card__image').first()).toHaveAttribute('src',origin+'/__cover-updated.svg');
 expect(fullRequests).toBe(1);
 products[0].data.imageUrl=origin+'/__cover-new-search.svg';
 await page.evaluate(()=>window.TintinProductsStore.loadAll({force:true}));
 await expect(page.locator('.tt-collection-card__image').first()).toHaveAttribute('src',origin+'/__cover-new-search.svg');
 expect(fullRequests).toBe(2);
});
