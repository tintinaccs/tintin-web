const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const links=[...read('product.html').matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
const styles=['css/components/navigation/compartido/paneles.css','css/components/navigation/compartido/coherencia-visual.css','css/components/notifications/notificaciones-sociales.css','css/components/navigation/compartido/superficie-notificaciones.css','css/pages/product/product-maintenance.css'].map(p=>`<link rel="stylesheet" href="/${p}">`).join('');
for(const width of [320,390,768,1024,1280,1440,1920])test(`paneles sólidos y catálogo completo en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/boutique-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${links}${styles}</head><body class="tt-public-shell-mounted"><main></main></body></html>`}));
  await page.goto('/boutique-fixture',{waitUntil:'load'});
  await page.evaluate(async()=>{
    const {renderCollectionsSheet}=await import(`${location.origin}/js/components/navigation/compartido/panel-colecciones.js`);
    const {renderCartDrawer}=await import(`${location.origin}/js/components/navigation/compartido/panel-carrito.js`);
    document.querySelector('main').innerHTML=renderCollectionsSheet()+renderCartDrawer()+`<aside id="notifications-drawer" class="tt-notifications-drawer" role="dialog" aria-label="Notificaciones"><div class="tt-notifications-head"><div class="tt-drawer-brand-heading"><h2>Notificaciones</h2></div><button type="button" id="btn-notifications-close" aria-label="Cerrar notificaciones">×</button></div><div class="tt-notifications-toolbar"><span class="tt-notifications-count">Todo al día</span><span class="tt-notifications-auto-read">Al abrir, las novedades quedan vistas</span></div><div class="tt-notifications-list">Sin novedades</div></aside>`;
  });
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
  await page.addScriptTag({content:`const getCart=()=>[],syncCartWithCatalog=()=>[];let cartPriceNotice=[];${read('tienda.js').slice(read('tienda.js').indexOf('function renderCart()'),read('tienda.js').indexOf('function setActiveTab'))}renderCart();`});
  await expect(page.locator('#cart-body .tt-cart-goto-btn')).toHaveAttribute('href','/catalogo');
  const panels=['#collections-sheet','#cart-drawer','#notifications-drawer'];
  for(const id of panels){
    await page.evaluate(id=>{document.querySelectorAll('[role="dialog"]').forEach(p=>{p.classList.toggle('open',p.matches(id));p.setAttribute('aria-hidden',String(!p.matches(id)));});},id);
    await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
    const g=await page.locator(id).evaluate(el=>{const r=el.getBoundingClientRect();const h=el.querySelector('[class$="header"],.tt-notifications-head').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,width:r.width,headWidth:h.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,blur:getComputedStyle(el).backdropFilter};});
    expect(g.right).toBeLessThanOrEqual(width+1);expect(g.left).toBeGreaterThanOrEqual(-1);expect(g.scrollWidth).toBeLessThanOrEqual(g.clientWidth+1);expect(g.headWidth).toBeGreaterThanOrEqual(g.width-2);expect(g.blur).toBe('none');
    if(width<768){expect(g.top).toBe(0);expect(g.width).toBe(width);}
  }
  await page.evaluate(()=>{document.querySelectorAll('[role="dialog"]').forEach(p=>{p.classList.toggle('open',p.id==='collections-sheet');p.setAttribute('aria-hidden',String(p.id!=='collections-sheet'));});});
  await expect(page.locator('.tt-sheet-handle')).toHaveCount(0);
  if(width===390)await page.screenshot({path:`artifacts/boutique-catalog-${test.info().project.name}.png`,fullPage:true});
  const catalog=page.getByRole('link',{name:'Ver todo el catálogo',exact:true});await expect(catalog).toHaveAttribute('href','/catalogo');
  await catalog.scrollIntoViewIfNeeded();await expect(catalog).toBeVisible();await catalog.click({trial:true});
});
const store=read('tienda.js');
const cardRenderer=store.slice(store.indexOf('const cardColorSelections'),store.indexOf('function renderProductsGrid'));
const cardMedia=store.slice(store.indexOf('function productVariantGroups'),store.indexOf('function _pdSyncVariantToImage'));
for(const width of [320,390,768,1024,1440])test(`tarjetas compactas y recomendaciones sin celda vacía en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/boutique-cards',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${links}${styles}</head><body class="tt-product-maintenance"><section class="tt-related-section"><div class="container"><div id="cards" class="tt-related-grid"></div></div></section></body></html>`}));
  await page.goto('/boutique-cards',{waitUntil:'load'});
  await page.addScriptTag({content:read('js/components/images/galeria-producto.js')});
  await page.addScriptTag({content:`const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const escapeAttribute=escapeHtml;const sanitizeClassicImageUrl=value=>value||'';const isInStock=()=>true,getProductImage=()=>'',priceMarkup=()=>'<span>Gs. 120.000</span>',heartIconMarkup=()=>'';${cardMedia}${cardRenderer}
  document.getElementById('cards').innerHTML=[1,2,3].map(id=>'<div class="tt-related-slot">'+renderProductCardMarkup({id,name:'Reloj de prueba',category:'Relojes',price:120000,stock:2,variants:{Color:['Dorado','Plateado']},imageUrl:'/assets-tintin/images/collections/col-relojes.webp'},{related:true})+'</div>').join('');`});
  const g=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.tt-related-slot')];const c=document.querySelector('.tt-product-card'),img=c.querySelector('.tt-product-img').getBoundingClientRect(),actions=[...c.querySelectorAll('.tt-product-actions .tt-btn')].map(n=>n.getBoundingClientRect());return{swatches:[...c.querySelectorAll(".tt-color-swatch")].map(n=>{const r=n.getBoundingClientRect();return{width:r.width,height:r.height};}),tops:nodes.map(n=>n.getBoundingClientRect().top),img:{width:img.width,height:img.height},height:c.getBoundingClientRect().height,actionTops:actions.map(r=>r.top),touch:actions.map(r=>r.height),pageOverflow:document.documentElement.scrollWidth>innerWidth,track:document.querySelector('#cards').scrollWidth>document.querySelector('#cards').clientWidth};});
  for(const swatch of g.swatches)expect(swatch.width).toBeCloseTo(swatch.height,1);expect(g.pageOverflow).toBe(false);expect(g.img.width).toBeCloseTo(g.img.height,0);expect(Math.max(...g.actionTops)-Math.min(...g.actionTops)).toBeLessThan(1);expect(Math.max(...g.tops)-Math.min(...g.tops)).toBeLessThan(1);expect(Math.min(...g.touch)).toBeGreaterThanOrEqual(44);if(width<600)expect(g.track).toBe(true);
  await expect(page.locator('.tt-product-actions a')).toHaveCount(3);
  if(width===390)await page.screenshot({path:`artifacts/boutique-cards-${test.info().project.name}.png`,fullPage:true});
});
for(const width of [1280,1440,1920])test(`dropdown de escritorio conserva acceso al catálogo y ancho en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/boutique-desktop',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es" class="tt-click-dropdown-ready"><head>${links}${styles}<link rel="stylesheet" href="/css/components/navigation/escritorio/encabezado-escritorio.css"></head><body class="tt-public-shell-mounted"></body></html>`}));
  await page.goto('/boutique-desktop',{waitUntil:'load'});
  await page.evaluate(async()=>{const {renderDesktopHeader}=await import(`${location.origin}/js/components/navigation/escritorio/encabezado-escritorio.js`);document.body.innerHTML=renderDesktopHeader();const panel=document.getElementById('tt-tienda-dropdown-panel');panel.classList.add('open');panel.setAttribute('aria-hidden','false');});
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
  const link=page.getByRole('link',{name:'Ver todo el catálogo →',exact:true});await expect(link).toHaveAttribute('href','/catalogo');await expect(link).toBeVisible();
  const rect=await page.locator('#tt-tienda-dropdown-panel').evaluate(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,scroll:n.scrollWidth,client:n.clientWidth};});expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(width);expect(rect.scroll).toBeLessThanOrEqual(rect.client+1);
});
