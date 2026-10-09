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
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
${css.map(p=>`<link rel="stylesheet" href="/${p}">`).join('')}</head><body>
${steps}<div class="ck-body"></div><div id="nav-root"></div>
<script type="module">import {renderMobileTabbar} from '${navModule}';
document.getElementById('nav-root').innerHTML=renderMobileTabbar();
const badge=document.getElementById('cart-badge-mobile');badge.classList.remove('hidden');badge.textContent='1';
document.getElementById('tabbar-cart').classList.add('active');
await import('${indicatorModule}');</script></body></html>`;

for(const width of [320,390,480,767]) test(`círculo sólo del icono y pasos legibles en ${width}px`,async({page})=>{
  await page.route('**/__mobile-step-visual',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.setViewportSize({width,height:900});await page.goto('/__mobile-step-visual');
  await expect(page.locator('#tt-tabbar')).toHaveClass(/tt-mobile-nav-ready/);
  await page.evaluate(()=>document.fonts.ready);
  for(const six of [false,true]) for(const compact of [false,true]) {
    await page.evaluate(({six,compact})=>{
      document.getElementById('tabbar-notifications').hidden=!six;
      document.getElementById('tt-tabbar').classList.toggle('tt-tabbar-compact',compact);
    },{six,compact});
    await expect.poll(()=>page.evaluate(()=>{
      const nav=document.getElementById('tt-tabbar');const halo=nav.querySelector('.tt-mobile-nav-halo').getBoundingClientRect();
      const icon=nav.querySelector('.active svg').getBoundingClientRect();
      return Math.max(Math.abs(halo.x+halo.width/2-icon.x-icon.width/2),Math.abs(halo.y+halo.height/2-icon.y-icon.height/2));
    })).toBeLessThan(1);
    const geometry=await page.evaluate(()=>{
      const nav=document.getElementById('tt-tabbar'),halo=nav.querySelector('.tt-mobile-nav-halo').getBoundingClientRect();
      const label=nav.querySelector('.active > span:last-child').getBoundingClientRect();
      return {width:halo.width,height:halo.height,haloBottom:halo.bottom,labelTop:label.top};
    });
    expect(geometry.width).toBe(geometry.height);expect(geometry.width).toBeLessThanOrEqual(36);
    if(!compact) expect(geometry.haloBottom).toBeLessThanOrEqual(geometry.labelTop);
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
