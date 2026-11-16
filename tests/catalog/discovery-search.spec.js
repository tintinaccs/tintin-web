const {test,expect}=require('@playwright/test');
const products=Array.from({length:80},(_,i)=>({id:'discovery-'+i,name:i===79?'BOLSO BEIGE DE PRUEBA':'Reloj de prueba '+i,sku:i===79?'000-042':'',category:i===79?'bolsos':'relojes',variants:i===79?{Color:['Beige']}:null,price:25000,stock:i===79?0:2,active:true}));
for(const path of ['/','/catalogo','/product?id=discovery-0'])test(`buscador completo desde ${path}: referencia agotada y Enter`,async({page,baseURL})=>{
 await page.setViewportSize({width:390,height:844});
 await page.context().addCookies([{name:'tt_privacy_choice',value:'v2.necessary',url:baseURL}]);
 await page.route('**/api/public-catalog?**',route=>{
  const url=new URL(route.request().url()),resource=url.searchParams.get('resource');
  if(resource==='products'&&url.searchParams.has('id'))return route.fulfill({json:{ok:true,resource,item:{id:products[0].id,data:products[0]}}});
  if(!['products','collections'].includes(resource))return route.continue();
  const rows=resource==='collections'?[{id:'relojes',name:'Relojes',visible:true},{id:'bolsos',name:'Bolsos',visible:true}]:url.searchParams.has('view')?products.slice(0,4):products;
  return route.fulfill({json:{ok:true,resource,items:rows.map(({id,...data})=>({id,data}))}});
 });
 await page.goto(path,{waitUntil:'domcontentloaded'});
 await page.locator('[aria-controls="search-panel"]:visible').first().click();
 await page.locator('#search-input').fill('000042');
 await expect(page.locator('#search-results .tt-search-result-copy')).toContainText('BOLSO BEIGE DE PRUEBA');
 await expect(page.locator('#search-results .tt-search-result-copy')).toContainText('Agotado');
 await page.locator('#search-input').fill('cartera beige');
 await expect(page.locator('#search-results .tt-search-result-item')).toHaveCount(1);
 await page.locator('#search-input').press('Enter');
 await expect(page).toHaveURL(/\/catalogo\?q=cartera%20beige/);
 await expect(page.locator('#cat-search')).toHaveValue('cartera beige');
 await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(1);
});
