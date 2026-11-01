const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const values={'stat-users':'1.248','stat-orders-today':'24','stat-sales-month':'25.850.000 Gs.','stat-orders-total':'1.482','stat-visits-today':'368','stat-online-now':'12'};
for(const [width,height] of [[320,568],[390,844],[430,932],[540,960],[844,390]])test(`presentación móvil visible, compacta y sin perder controles ${width}x${height}`,async({page},info)=>{
 await load(page,width,'admin.html',{mobile:true,sidebar:true,guard:true});await page.setViewportSize({width,height});
 await page.evaluate(values=>{for(const[id,value]of Object.entries(values))document.getElementById(id).textContent=value;},values);await settle(page);
 const header=await page.locator('.adm-topbar').boundingBox();expect(header.height).toBeLessThanOrEqual(80);
 const boxes=await page.locator('.adm-topbar > *').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).display!=='none').map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};}));
 for(const box of boxes){expect(box.left).toBeGreaterThanOrEqual(-1);expect(box.right).toBeLessThanOrEqual(width+1);}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1).toBe(false);}
 expect(await page.locator('.adm-topbar').evaluate(n=>getComputedStyle(n,'::before').backgroundImage)).toBe('none');
 // App móvil (≤768): «Nuevo pedido» vive en Pedidos y la barra inferior «Más» reemplaza la hamburguesa.
 if(width<=540)await page.evaluate(()=>{document.body.dataset.admSection='pedidos';});
 await expect(page.getByRole('link',{name:'Nuevo pedido',exact:true})).toHaveAttribute('href','/checkout');
 if(width<=540)await page.evaluate(()=>{delete document.body.dataset.admSection;});
 if(width<=540)await expect(page.locator('#adm-mobile-more-toggle')).toBeVisible();
 else await expect(page.getByRole('button',{name:'Fijar barra lateral abierta'})).toBeVisible();
 await expect(page.locator('.tt-control-search')).toBeVisible();
 await expect(page.locator('.tt-dashboard-link')).toHaveCount(4);await expect(page.locator('#dash-stats .adm-stat')).toHaveCount(6);
 if(width===390){const last=await page.locator('#dash-stats .adm-stat').last().boundingBox(),nav=await page.locator('#adm-mobile-tabs').boundingBox();expect(last.y+last.height).toBeLessThan(nav.y);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Ver secciones'}).click();await expect(page.getByRole('dialog',{name:'Buscar módulos'})).toBeVisible();await page.keyboard.press('Escape');
 await page.evaluate(()=>{const wrap=document.createElement('div');wrap.className='adm-notifications-wrap';const button=document.createElement('button');button.className='adm-notifications-button';button.setAttribute('aria-label','Notificaciones');wrap.append(button);const actions=document.querySelector('.adm-topbar-actions');actions.insertBefore(wrap,actions.querySelector('.adm-topbar-btn'));document.getElementById('adm-topbar-title').textContent='Pedidos mayoristas';});
 await expect(page.getByRole('button',{name:'Notificaciones',exact:true})).toBeVisible();
 expect((await page.locator('.adm-topbar').boundingBox()).height).toBeLessThanOrEqual(width<=360?88:80);
 const actions=await page.locator('.adm-topbar-actions > *').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));
 for(const action of actions){expect(action.left).toBeGreaterThanOrEqual(-1);expect(action.right).toBeLessThanOrEqual(width+1);}
 await page.evaluate(()=>document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id==='section-usuarios')));await settle(page);
 const search=page.getByRole('button',{name:'Buscar registros',exact:true});await expect(search).toBeVisible();expect((await search.boundingBox()).width).toBe(44);await search.click();await expect(page.locator('#user-search')).toBeFocused();
 if(width===390)await page.screenshot({path:info.outputPath('usuarios-mobile-visual.png')});
});
for(const width of [768,1024,1440])test(`nueva presentación mantiene el escritorio y tablet ${width}`,async({page})=>{
 await load(page,width,'admin.html',{sidebar:true});
 const measure=()=>page.locator('.adm-topbar,.tt-dashboard-hero,.tt-dashboard-link,#dash-stats .adm-stat').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,w:b.width,h:b.height,font:s.fontSize,bg:s.background,border:s.borderRadius};}));
 const current=await measure();const original=fs.readFileSync('css/admin/dashboard-control.css','utf8').split('/* Evolución visual del panel existente')[0];
 await page.evaluate(css=>{const link=[...document.querySelectorAll('link[rel=stylesheet]')].find(link=>link.href.includes('dashboard-control.css'));const style=document.createElement('style');style.textContent=css;link.replaceWith(style);},original+'\n.tt-admin-workspace-search > svg{display:none}');
 await settle(page);expect(await measure()).toEqual(current);
});
test('la revelación tardía del guard mejora la tabla inicial sin esperar otra navegación',async({page})=>{
 await load(page,390);await page.evaluate(()=>{document.documentElement.classList.remove('adm-auth-ready');document.querySelectorAll('.adm-section').forEach(n=>n.classList.toggle('active',n.id==='section-usuarios'));document.getElementById('users-tbody').innerHTML='<tr><td colspan="10">Sin usuarios</td></tr>';document.querySelector('#users-tbody').closest('table').classList.remove('tt-admin-records');});await settle(page);
 await page.evaluate(()=>document.documentElement.classList.add('adm-auth-ready'));await expect(page.locator('#users-tbody').locator('..')).toHaveClass(/tt-admin-records/);await expect(page.locator('#users-tbody').locator('..')).toHaveCSS('display','block');
});
