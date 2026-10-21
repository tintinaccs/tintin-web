const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
const {removeFixtureScripts}=require('../../scripts/lib/html-layout-fixture.js');
const html=removeFixtureScripts(fs.readFileSync(path.resolve(__dirname,'../../admin.html'),'utf8'),{removeModulePreloads:true});
for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[820,1180],[1180,820],[1366,768],[1920,1080]]){
 test(`operaciones y clientes con márgenes y controles legibles a ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.route('**/__local-responsive',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.route('**/js/core/auth/cliente-api-autenticado.js?*',route=>route.fulfill({contentType:'text/javascript',body:`export async function authenticatedFetch(){return Response.json({ok:true,revision:'fixture',checkedAt:'2026-10-20T12:00:00Z',contacts:[],customers:[{id:'fixture',name:'Clienta de ejemplo con nombre largo',hasWebAccount:true,orderCount:2,totalPurchased:150000,totalPaid:50000,lastPurchase:'2026-10-20',email:'clienta@example.invalid',phone:'0981123456',city:'San Lorenzo',address:'Dirección de ejemplo para revisar márgenes'}],webOrders:[],entries:[{id:'LOCAL_fixture',kind:'sale',year:2026,month:10,customerName:'Clienta de ejemplo',total:50000,paymentStatus:'pagado',lines:[],notes:'Registro de prueba visual sin escrituras'}]});}` }));
  await page.goto('/__local-responsive');
  await page.evaluate(()=>{document.documentElement.classList.add('adm-auth-ready');document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-ventas-locales'));});
  await page.addScriptTag({type:'module',url:'/js/admin/comercio-local-admin.js'});
  await expect(page.locator('#local-ledger .local-record')).toHaveCount(1);
  for(const section of ['ventas-locales','clientes-compraron','espejos-sheets']){
   await page.evaluate(id=>document.querySelectorAll('.adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-'+id)),section);
   const card=page.locator('#section-'+section+'>.adm-card');await expect(card).toBeVisible();
   const rect=await card.boundingBox();expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.right||rect.x+rect.width).toBeLessThanOrEqual(width+1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const padding=await card.evaluate(node=>parseFloat(getComputedStyle(node).paddingLeft));expect(padding).toBeGreaterThanOrEqual(16);
  }
 });
}
