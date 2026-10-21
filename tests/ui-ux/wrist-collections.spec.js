const {test,expect}=require('@playwright/test');
const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[1366,768],[1440,900],[1920,1080]])test(`Pulseras reúne 13 pulseras y 9 brazaletes sin duplicar colecciones ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});await mockRuntime(page,{collections:[
  {id:'pulseras',data:{name:'Pulseras',visible:true,order:4}},
  {id:'brazaletes',data:{name:'Brazaletes',visible:true,order:7}},
  {id:'anillos',data:{name:'Anillos',visible:true,order:5}},
 ]});await page.goto('https://tintin.test/admin-commerce-fixture');
 await expect(page.locator('#tt-commerce-collections tbody tr')).toHaveCount(2);
 await page.evaluate(()=>{
  window.__productRows=Array.from({length:22},(_,i)=>({id:`wrist-${i}`,data:{name:`Accesorio ${i}`,category:i<13?'pulseras':'brazaletes',price:25000,stock:1,active:true}}));window.__publishProducts();
 });
 const row=page.locator('#tt-commerce-collections tr[data-id="pulseras"]');await expect(row.locator('td').nth(3)).toHaveText('22');
 await expect(page.locator('#tt-commerce-collections tr[data-id="brazaletes"]')).toHaveCount(0);
 await row.locator('td').nth(1).click();await expect(page.locator('#tt-commerce-drawer')).toContainText('22');
 await page.locator('[data-action="drawer-collection-products"]').click();
 await expect(page.locator('[data-filter="product-category"]')).toHaveValue('pulseras');
 await expect(page.locator('#tt-commerce-products .tt-commerce-footer')).toContainText('22');
 expect(await page.evaluate(()=>window.__productRows.filter(p=>p.data.category==='brazaletes').length)).toBe(9);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#tt-commerce-collections').screenshot({path:`artifacts/commerce/pulseras-${width}x${height}.png`});
});
