const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

for (const width of [390,1440]) test(`categoría legible y rastreable sin JavaScript · ${width}`,async({browser,baseURL})=>{
 const {visibleCatalog,renderCatalogHtml}=await import('../../cloudflare/catalogo-publico-seo.mjs');
 const products=Array.from({length:60},(_,i)=>({id:'initial-'+i,data:{name:'Reloj inicial '+i,category:'relojes',price:150000,stock:2}}));
 const catalog=visibleCatalog(products,[{id:'relojes',data:{name:'Relojes'}}]);
 const html=renderCatalogHtml(fs.readFileSync('catalogo.html','utf8'),new URL('https://tintinaccs.com/catalogo?cat=relojes'),catalog).html;
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});
 const page=await context.newPage();
 await page.route('**/__catalog-ssr',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto(baseURL+'/__catalog-ssr',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{level:1})).toHaveText('Relojes para mujer en Paraguay');
 await expect(page.locator('#cat-grid')).toBeVisible();
 await expect(page.locator('#cat-grid article')).toHaveCount(48);
 await expect(page.locator('#cat-grid article').first()).toBeVisible();
 await expect(page.locator('#cat-grid article').first()).toContainText('Gs. 150.000');
 await expect(page.getByRole('navigation',{name:'Páginas del catálogo'}).getByRole('link',{name:'2',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();
});
