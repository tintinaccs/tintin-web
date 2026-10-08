const {test,expect}=require('@playwright/test');
const fixture={id:'qa-master',name:'Reloj de prueba',category:'relojes',price:150000,stock:2,imageUrl:'/assets-tintin/images/collections/col-relojes.webp',variants:[{Color:'Dorado',imageUrl:'/assets-tintin/images/collections/col-relojes.webp',stock:2},{Color:'Negro',imageUrl:'/assets-tintin/images/collections/col-collares.webp',stock:0}],variantInventory:[{variant:'Dorado',stock:2},{variant:'Negro',stock:0}]};
for(const width of [320,390,768,1440])test(`opciones importadas, fotos y agotado funcionan a ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/public-catalog?**',route=>{const url=new URL(route.request().url()),resource=url.searchParams.get('resource');if(resource==='products')return route.fulfill({json:url.searchParams.has('id')?{ok:true,resource,item:{id:fixture.id,data:fixture}}:{ok:true,resource,items:[{id:fixture.id,data:fixture}]}});if(resource==='collections')return route.fulfill({json:{ok:true,resource,items:[{id:'relojes',data:{name:'Relojes',active:true}}]}});return route.continue();});
 await page.goto('/product?id=qa-master',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window._renderProductDetail&&window.TintinCatalogPolicy?.variantStockLimit);
 await page.evaluate(f=>{Object.defineProperty(window,'PRODUCTS',{configurable:true,get:()=>[f],set(){}});window._renderProductDetail(f);document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');window.TintinLoader?.hide?.();},fixture);
 await expect(page.locator('.tt-variant-option')).toHaveCount(2);
 const black=page.getByRole('button',{name:'Negro — Agotado, podés verlo',exact:true});await expect(black).toBeEnabled();await black.click();
 await expect(black).toHaveAttribute('aria-pressed','true');await expect(page.locator('#btn-product-add-cart')).toBeDisabled();await expect(page.locator('#btn-product-buy-now')).toBeDisabled();
 await expect(page.locator('#gallery-main')).toHaveClass(/tt-stock-unavailable/);await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/col-collares/);
 await expect(page.locator('#gallery-main img')).toHaveCSS('filter','grayscale(1)');
 const placement=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();return{picture:r('gallery-main').bottom,options:r('product-variants').top,overflow:document.documentElement.scrollWidth>innerWidth};});expect(placement.options).toBeGreaterThanOrEqual(placement.picture);expect(placement.overflow).toBe(false);
 await expect(page.locator('.tt-wrist-guide')).not.toHaveAttribute('open');await page.locator('.tt-wrist-guide summary').click();await expect(page.locator('.tt-wrist-guide li')).toHaveCount(6);
 await page.getByRole('button',{name:'Dorado',exact:true}).click();await expect(page.locator('#btn-product-add-cart')).toBeEnabled();await expect(page.locator('#gallery-main')).not.toHaveClass(/tt-stock-unavailable/);
});

test('un mapa oculto recupera geometría y conserva coordenadas al mostrarlo y fallar tiles',async({page})=>{
 await page.route('**/tile.openstreetmap.org/**',route=>route.abort());
 await page.route('**/__map-master',route=>route.fulfill({contentType:'text/html',body:`<html><head><link rel="stylesheet" href="/js/vendor/leaflet/leaflet.css?v=leaflet-1.9.4-tintin-1"></head><body><div id="map" style="display:none;height:260px;width:320px"></div><script type="module">import{createLocationMap}from'/js/components/location/mapa-ubicacion.js';window.api=await createLocationMap({mapEl:document.getElementById('map')});window.api.setLocation({lat:-25.3,lng:-57.6,name:'Casa'});window.ready=true;</script></body></html>`}));
 await page.goto('/__map-master');await page.waitForFunction(()=>window.ready);await page.evaluate(()=>document.getElementById('map').style.display='block');
 await expect.poll(()=>page.locator('#map .leaflet-marker-icon').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('#map').getBoundingClientRect();return Math.abs(a.left+16-(b.left+b.width/2));})).toBeLessThan(3);
 expect(await page.evaluate(()=>window.api.getLocation())).toMatchObject({lat:-25.3,lng:-57.6,name:'Casa'});
 await expect(page.locator('.tt-map-status')).toContainText('Tu ubicación se conserva');await page.evaluate(()=>window.api.destroy());expect(await page.locator('#map').evaluate(el=>el._leaflet_id)).toBeUndefined();await expect(page.locator('#map .leaflet-pane')).toHaveCount(0);
});
