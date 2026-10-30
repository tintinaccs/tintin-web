const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const resources=fs.readFileSync('js/components/navigation/compartido/recursos-navegacion.js','utf8');
const css=['styles.min.css','css/core/tokens-tintin.css',...Array.from(resources.matchAll(/'([^']+\.css)'/g),m=>m[1]),'css/components/notifications/notificaciones-sociales.css'];
const cases=[['search','tabbar-search','search-panel'],['mobile-shop','tabbar-tienda','collections-sheet'],['notifications','tabbar-notifications','notifications-drawer'],['cart','tabbar-cart','cart-drawer'],['account','tabbar-cuenta','account-drawer']];
function fixture(pageName){
 const html=fs.readFileSync(pageName,'utf8');
 const pageStyles=(html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g)||[]).filter(s=>!s.includes('https:')).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${pageStyles}${css.map(p=>`<link rel="stylesheet" href="/${p}">`).join('')}</head><body class="tt-public-shell-mounted"><main id="background"><button id="background-button">Contenido</button></main><script type="module">
 import {renderMobileTabbar} from '../../js/components/navigation/movil/encabezado-movil.js';
 import {renderSearchPanel} from '../../js/components/navigation/compartido/panel-busqueda.js';
 import {renderCartDrawer} from '../../js/components/navigation/compartido/panel-carrito.js';
 import {renderCollectionsSheet} from '../../js/components/navigation/compartido/panel-colecciones.js';
 import {renderAccountDrawer} from '../../js/components/navigation/compartido/panel-cuenta.js';
 document.body.insertAdjacentHTML('beforeend',renderMobileTabbar()+renderSearchPanel()+renderCartDrawer()+renderCollectionsSheet()+renderAccountDrawer());
 document.getElementById('tabbar-notifications').hidden=false;
 document.getElementById('tabbar-tienda').setAttribute('aria-current','page');
 document.body.insertAdjacentHTML('beforeend','<div class="tt-shared-backdrop" id="backdrop" hidden></div><div class="tt-notifications-drawer" id="notifications-drawer" role="dialog" aria-modal="true" aria-hidden="true"><button id="btn-notifications-close">Cerrar alertas</button><div id="tt-notifications-list"></div></div>');
 await import('../../js/components/navigation/compartido/control-paneles.js');
 const controller=window.TintinSurfaceController;
 controller.connect({backdrop:document.getElementById('backdrop')});
 for(const [name,trigger,id] of ${JSON.stringify(cases)})controller.register(name,{element:document.getElementById(id),triggerSelector:'#'+trigger});
 document.body.dataset.ready='true';
 </script></body></html>`;
}
for(const width of [320,390,767])for(const pageName of ['index.html','catalogo.html','product.html','checkout.html','perfil.html'])test(`navegación delante y operable en ${pageName} ${width}px`,async({page})=>{
 await page.route('**/__navigation-front',r=>r.fulfill({contentType:'text/html',body:fixture(pageName)}));
 await page.setViewportSize({width,height:800});await page.goto('/__navigation-front');
 await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 for(const [name,trigger,id] of cases){
  if (name !== 'cart' && await page.locator('#cart-drawer').getAttribute('aria-hidden') === 'true') {
    await page.locator('#tabbar-cart').click();
    await expect(page.locator('#cart-drawer')).toHaveAttribute('aria-hidden','false');
  }
  await page.locator('#'+trigger).click();
  await expect(page.locator('#'+id)).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#'+id)).toHaveAttribute('aria-modal','false');
  await expect.poll(()=>page.evaluate(()=>window.TintinSurfaceController.state)).toBe('open');
  expect(await page.locator('#background').evaluate(el=>el.inert)).toBe(true);
  expect(await page.locator('#tt-tabbar').evaluate(el=>!!el.closest('[inert]'))).toBe(false);
  expect(await page.locator('#tt-tabbar .tt-tabbar-btn').evaluateAll(nodes=>nodes.filter(el=>getComputedStyle(el,'::before').opacity==='1').map(el=>el.id))).toEqual([trigger]);
  expect(await page.locator('#tt-tabbar .tt-tabbar-btn').evaluateAll(nodes=>nodes.filter(el=>el.offsetParent!==null).every(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.tt-tabbar-btn')===el;}))).toBe(true);
 }
 await page.locator('#tabbar-cuenta').focus();await page.keyboard.press('Tab');
 await expect(page.locator('#btn-account-close')).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#tabbar-cuenta')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#account-drawer')).toHaveAttribute('aria-hidden','true');
 expect(await page.locator('#background').evaluate(el=>el.inert)).toBe(false);
 expect(await page.locator('#tt-tabbar .tt-tabbar-btn').evaluateAll(nodes=>nodes.filter(el=>getComputedStyle(el,'::before').opacity==='1').map(el=>el.id))).toEqual(['tabbar-tienda']);
});
test('desktop conserva aislamiento modal y foco',async({page})=>{
 await page.route('**/__navigation-front',r=>r.fulfill({contentType:'text/html',body:fixture('index.html')}));
 await page.setViewportSize({width:1440,height:900});await page.goto('/__navigation-front');
 await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 await page.evaluate(()=>window.TintinSurfaceController.open('account'));
 await expect(page.locator('#account-drawer')).toHaveAttribute('aria-modal','true');
 expect(await page.locator('#tt-tabbar').evaluate(el=>el.inert)).toBe(true);
 await page.keyboard.press('Tab');await expect(page.locator('#btn-account-close')).toBeFocused();
 await page.keyboard.press('Escape');expect(await page.locator('#background').evaluate(el=>el.inert)).toBe(false);
});

for(const [width,height] of [[320,568],[390,844],[767,800],[844,390],[1440,900]])test(`aviso de checkout deja la navegación operable incluso al ocultarse ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.route('**/__navigation-front',r=>r.fulfill({contentType:'text/html',body:fixture('checkout.html')}));
 await page.goto('/__navigation-front');
 await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 const toastSource=fs.readFileSync('checkout.html','utf8').match(/function showCkToast\(message\) \{[\s\S]*?\n\}/)[0];
 await page.addScriptTag({content:toastSource});
 await page.clock.install();
 await page.evaluate(()=>showCkToast('Ya alcanzaste el máximo disponible de este producto'));
 const toast=page.locator('#ck-toast');
 await expect(toast).toBeVisible();
 const box=await toast.boundingBox();
 expect(box.x).toBeGreaterThanOrEqual(0);
 expect(box.x+box.width).toBeLessThanOrEqual(width);
 if(width<768){
  const nav=await page.locator('#tt-tabbar').boundingBox();
  expect(box.y+box.height).toBeLessThanOrEqual(nav.y-12);
  expect(await page.locator('#tabbar-search').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 }
 // A second notification extends its own lifetime; an old timeout must not
 // hide the replacement. The hidden message must stop taking pointer hits.
 await page.clock.fastForward(1600);
 await page.evaluate(()=>showCkToast('Ubicación guardada en tu cuenta.'));
 await page.clock.fastForward(1200);
 await expect(toast).toBeVisible();
 await expect(toast).toHaveText('Ubicación guardada en tu cuenta.');
 await page.clock.fastForward(1800);
 await expect(toast).toBeHidden();
 if(width<768){
  const point=await page.locator('#tabbar-search').boundingBox();
  await page.mouse.click(point.x+point.width/2,point.y+point.height/2);
  await page.clock.runFor(500);
  await expect(page.locator('#search-panel')).toHaveAttribute('aria-hidden','false');
 }
});
