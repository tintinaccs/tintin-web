const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const checkout = fs.readFileSync('checkout.html','utf8');
const steps = checkout.slice(checkout.indexOf('<div class="ck-steps"'),checkout.indexOf('<div class="ck-body"'));
const resources = fs.readFileSync('js/components/navigation/compartido/recursos-navegacion.js','utf8');
const css = ['styles.css','css/core/tema-unificado-tintin.css',
  ...[...resources.matchAll(/'([^']+\.css)'/g)].map(m=>m[1]),
  'css/pages/checkout/checkout.css','css/pages/checkout/checkout-maintenance.css',
  'css/theme/superficies-solidas-interfaz.css'];
const navModule = '/js/components/navigation/movil/encabezado-movil.js';
const indicatorModule = '/js/components/navigation/movil/indicador-navegacion-movil.js';
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${css.map(p=>`<link rel="stylesheet" href="/${p}">`).join('')}</head><body>
${steps}<div class="ck-body"></div><div id="nav-root"></div>
<script type="module">import {renderMobileTabbar} from '${navModule}';
document.getElementById('nav-root').innerHTML=renderMobileTabbar();
const {applyGlobalLayout}=await import('../../js/components/navigation/compartido/apariencia-global.js');
applyGlobalLayout({header:{shopLabel:'TIENDA'}});
const badge=document.getElementById('cart-badge-mobile');badge.classList.remove('hidden');badge.textContent='1';
document.getElementById('tabbar-tienda').classList.add('active');
await import('${indicatorModule}');</script></body></html>`;

for(const width of [320,390,480,767]) test(`cápsula completa de icono y texto y pasos legibles en ${width}px`,async({page})=>{
  await page.route('**/__mobile-step-visual',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.setViewportSize({width,height:900});await page.goto('/__mobile-step-visual');
  await expect(page.locator('#tt-tabbar')).toHaveClass(/tt-mobile-nav-ready/);
  await expect(page.locator('#tabbar-tienda span:last-child')).toHaveText('Catálogo');
  await page.evaluate(()=>document.fonts.ready);
  for(const six of [false,true]) for(const compact of [false,true]) {
    await page.evaluate(({six,compact})=>{
      document.getElementById('tabbar-notifications').hidden=!six;
      document.getElementById('tt-tabbar').classList.toggle('tt-tabbar-compact',compact);
    },{six,compact});
    const geometry=await page.evaluate(()=>{
      const nav=document.getElementById('tt-tabbar'),active=nav.querySelector('.active');
      const box=active.getBoundingClientRect(),bar=nav.getBoundingClientRect();
      const content=[active.querySelector('svg'),active.querySelector('span:last-child')].map(el=>el.getBoundingClientRect());
      return {capsule:getComputedStyle(active,'::before').opacity,inside:content.every(r=>r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom),inner:Math.min(...content.map(r=>Math.min(r.left-box.left,box.right-r.right,r.top-box.top,box.bottom-r.bottom))),space:Math.min(box.left-bar.left,bar.right-box.right,box.top-bar.top,bar.bottom-box.bottom)};
    });
    expect(geometry.capsule).toBe('1');expect(geometry.inside).toBe(true);expect(geometry.inner).toBeGreaterThanOrEqual(3);expect(geometry.space).toBeGreaterThanOrEqual(6);
    await expect(page.locator('.tt-mobile-nav-indicator')).toBeHidden();
    await expect(page.locator('#tabbar-tienda span:last-child')).toBeVisible();
  }
  const labels=await page.locator('.ck-step-label').evaluateAll(nodes=>nodes.map(n=>{
    const s=getComputedStyle(n),r=n.getBoundingClientRect();return {background:s.backgroundColor,color:s.color,
      fontSize:parseFloat(s.fontSize),transform:s.textTransform,width:r.width,scrollWidth:n.scrollWidth};
  }));
  expect(labels).toHaveLength(5);
  for(const label of labels){expect(label.background).toBe('rgba(0, 0, 0, 0)');expect(label.color).not.toBe('rgb(255, 255, 255)');
    expect(label.fontSize).toBeGreaterThanOrEqual(10);expect(label.transform).toBe('none');expect(label.scrollWidth).toBeLessThanOrEqual(label.width+1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
