const {test,expect}=require('@playwright/test');
const products=Array.from({length:14},(_,i)=>({id:'drawer-'+i,name:'Producto '+i,category:'relojes',price:25000,stock:8,active:true}));
async function setup(page,baseURL) {
 await page.context().addCookies([{name:'tt_privacy_choice',value:'v2.necessary',url:baseURL}]);
 await page.route('**/api/public-catalog?**',route=>{
  const url=new URL(route.request().url());const resource=url.searchParams.get('resource');
  if(!['products','collections'].includes(resource))return route.continue();
  const rows=resource==='products'?products:[{id:'relojes',name:'Relojes',visible:true}];
  return route.fulfill({json:{ok:true,resource,items:rows.map(({id,...data})=>({id,data}))}});
 });
 await page.goto('/catalogo',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.TintinCartRuntime?.addToCart && window.TintinSurfaceController?.registry.has('cart') && window.PRODUCTS?.length===14);
}
for(const [width,height] of [[390,844],[844,390],[768,1024],[1440,900]]) {
 test(`una apertura, catorce productos, foco y recarga ${width}×${height}`,async({page,baseURL})=>{
  await page.setViewportSize({width,height});await setup(page,baseURL);
  await page.locator('#cat-grid .tt-card-btn-cart').first().click();
  await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
  const drawer=page.locator('#cart-drawer');await expect(drawer).toBeVisible();
  expect((await drawer.boundingBox()).x).toBe(0);
  const close=page.locator('#btn-cart-close');await close.focus();
  await page.evaluate(async()=>window.TintinCartRuntime.addToCart({...window.PRODUCTS[1],qty:1}));
  await expect(close).toBeFocused();await expect(page.locator('#cart-body .tt-cart-item')).toHaveCount(2);
  await page.keyboard.press('Escape');await expect(drawer).not.toBeVisible();
  // Completar 14 líneas sin volver a abrir ni apilar notificaciones.
  await page.evaluate(async()=>{for(const p of window.PRODUCTS.slice(2))await window.TintinCartRuntime.addToCart({...p,qty:1});});
  await expect(drawer).not.toBeVisible();await expect(page.locator('#tt-cart-feedback')).toHaveCount(1);
  expect(await page.evaluate(()=>window.TintinCartRuntime.getCartLocal().reduce((n,p)=>n+p.qty,0))).toBe(14);
  await page.locator('[aria-controls="cart-drawer"]:visible').first().click();
  await expect(page.locator('#cart-body .tt-cart-item')).toHaveCount(14);
  const firstPlus=page.locator('#cart-body .tt-cart-qty-btn').nth(1);await firstPlus.focus();
  await page.evaluate(async()=>window.TintinCartRuntime.addToCart({...window.PRODUCTS[0],qty:1}));
  await expect(firstPlus).toBeFocused();
  expect(await page.locator('#cart-body').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await expect(page.locator('#cart-footer .tt-cart-checkout-btn')).toBeInViewport();
  await page.keyboard.press('Escape');await page.reload();
  await page.waitForFunction(()=>window.TintinCartRuntime?.getCartLocal().length===14);
  await page.evaluate(async()=>window.TintinCartRuntime.addToCart({...window.PRODUCTS[1],qty:1}));
  await expect(drawer).not.toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('tt_cart_auto_opened_v1'))).toBe('1');
  await page.evaluate(async()=>{await window.TintinCartRuntime.clearCart();await window.TintinCartRuntime.addToCart({...window.PRODUCTS[0],qty:1});});
  await expect(drawer).not.toBeVisible();
 });
}
test('doble toque y falta de red no producen líneas ni aperturas duplicadas',async({page,baseURL})=>{
 await setup(page,baseURL);
 const result=await page.evaluate(async()=>{
  const runtime=window.TintinCartRuntime;
  const failed=await runtime.addToCart({id:'missing-product',name:'No existe',price:1,qty:1});
  const before=sessionStorage.getItem('tt_cart_auto_opened_v1');
  const product={...window.PRODUCTS[0],qty:1};
  await Promise.all([runtime.addToCart(product),runtime.addToCart(product)]);
  return {failed:failed.changed,before,qty:runtime.getCartLocal()[0].qty};
 });
 expect(result).toEqual({failed:false,before:null,qty:1});
});
test('movimiento reducido, cierre con botón y fondo, y retorno del foco',async({page,baseURL})=>{
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page,baseURL);
 const trigger=page.locator('[aria-controls="cart-drawer"]:visible').first();
 await trigger.click();await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 expect(await page.locator('#cart-drawer').evaluate(el=>el.getAnimations().length)).toBe(0);
 await page.locator('#btn-cart-close').click();await expect(page.locator('#cart-drawer')).not.toBeVisible();
 await expect(trigger).toBeFocused();await trigger.click();
 await page.locator('#tt-shared-backdrop').click({position:{x:900,y:200}});
 await expect(page.locator('#cart-drawer')).not.toBeVisible();await expect(trigger).toBeFocused();
});
test('la primera adición espera el montaje del panel antes de consumir la apertura',async({page,baseURL})=>{
 await setup(page,baseURL);
 const before=await page.evaluate(async()=>{
  window.__cartConfig=window.TintinSurfaceController.registry.get('cart');
  window.TintinSurfaceController.registry.delete('cart');
  await window.TintinCartRuntime.addToCart({...window.PRODUCTS[0],qty:1});
  return sessionStorage.getItem('tt_cart_auto_opened_v1');
 });
 expect(before).toBeNull();
 await page.evaluate(()=>{window.TintinSurfaceController.registry.set('cart',window.__cartConfig);window.dispatchEvent(new CustomEvent('tintin:cart-surface-ready'));});
 await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
 expect(await page.evaluate(()=>sessionStorage.getItem('tt_cart_auto_opened_v1'))).toBe('1');
});
test('carrito mixto conserva modalidad bajo pedido y total de ambas líneas',async({page,baseURL})=>{
 await setup(page,baseURL);
 await page.evaluate(async()=>{
  const fixtures=window.PRODUCTS.map((p,i)=>i===0?{...p,description:'Producto bajo pedido, sujeto a confirmación de stock.'}:p);
  Object.defineProperty(window,'PRODUCTS',{configurable:true,get:()=>fixtures,set:()=>{}});
  for(const p of fixtures.slice(0,2))await window.TintinCartRuntime.addToCart({...p,qty:1});
 });
 await expect(page.locator('#cart-body .tt-cart-item')).toHaveCount(2);
 await expect(page.locator('.tt-cart-fulfilment')).toHaveText('Bajo pedido · sujeto a confirmación');
 await expect(page.locator('#tt-cart-order-note')).toBeVisible();
 await expect(page.locator('#cart-footer .tt-cart-subtotal')).toContainText('Gs. 50.000');
});
test('volver a un disparador deshabilitado restaura el foco en Mi carrito',async({page,baseURL})=>{
 await setup(page,baseURL);
 await page.evaluate(async()=>{
  const button=document.querySelector('#cat-grid .tt-card-btn-cart');
  button.disabled=true;
  await window.openCart(button);
 });
 await page.keyboard.press('Escape');
 await expect(page.locator('[aria-controls="cart-drawer"]:visible').first()).toBeFocused();
});
