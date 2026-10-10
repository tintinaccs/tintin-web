const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('tienda.js','utf8');
const guard=source.slice(source.indexOf('function initWaFloatVisibility()'),source.indexOf('function initFaqAccordion()'));
for(const width of [320,390,768,1024,1280,1440,1920]) test(`WhatsApp permanece fijo y visible durante scroll en ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});
 await page.route('**/__wa-fixed',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/theme/paridad-segura-tintin.css"></head><body class="tt-public-shell-mounted"><main style="height:2600px"><button style="position:fixed;right:16px;bottom:104px;width:140px;height:56px">Contenido debajo</button></main><a href="https://wa.me/595981299331" class="tt-wa-float" id="wa-float" aria-label="WhatsApp">W</a><script>${guard};initWaFloatVisibility();</script><script src="/js/quality/correccion-auditoria-pagina.js"></script></body></html>`}));
 await page.goto('/__wa-fixed');
 const wa=page.locator('#wa-float');await expect(wa).toBeVisible();await expect(wa).toHaveCSS('position','fixed');await expect(wa).toHaveCSS('animation-name','none');
 const initial=await wa.boundingBox();
 if(width<768){
  await page.evaluate(()=>{
   const link=document.createElement('link');link.rel='stylesheet';link.href='/css/components/navigation/movil/encabezado-movil.css';document.head.appendChild(link);
   const nav=document.createElement('nav');nav.id='tt-tabbar';document.body.appendChild(nav);
  });
  await expect(wa).toHaveCSS('bottom','108px');
  const gap=await page.evaluate(()=>document.getElementById('tt-tabbar').getBoundingClientRect().top-document.getElementById('wa-float').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(12);
 }
 const fixed=await wa.boundingBox();
 for(const y of [200,700,1400,0]){
  await page.evaluate(y=>window.scrollTo(0,y),y);
  await expect(wa).toBeVisible();await expect(wa).toHaveCSS('opacity','1');
  expect(await wa.boundingBox()).toEqual(fixed);
  await expect(wa).not.toHaveAttribute('aria-hidden','true');
 }
});
