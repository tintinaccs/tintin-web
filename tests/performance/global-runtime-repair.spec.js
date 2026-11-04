const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

test('revelado mide candidatos una vez antes de escribir clases',async({page})=>{
 await page.setContent('<main><section style="height:100px"><h1>Catálogo</h1><div class="tt-card" style="width:100px;height:40px">Producto</div></section></main>');
 await page.evaluate(()=>{
  window.reads=[];window.wrote=false;window.readAfterWrite=false;
  const read=Element.prototype.getBoundingClientRect,add=DOMTokenList.prototype.add;
  Element.prototype.getBoundingClientRect=function(){if(this.matches('section,h1,.tt-card')){window.reads.push(this.tagName);if(window.wrote)window.readAfterWrite=true;}return read.call(this);};
  DOMTokenList.prototype.add=function(...names){if(names.includes('tt-auto-reveal'))window.wrote=true;return add.apply(this,names);};
 });
 await page.addScriptTag({content:fs.readFileSync('js/quality/revelado-desplazamiento-global.js','utf8')});
 await expect(page.locator('.tt-auto-reveal')).toHaveCount(1);
 expect(await page.evaluate(()=>({reads:window.reads.length,late:window.readAfterWrite}))).toEqual({reads:1,late:false});
});

test('mutaciones del carrito no remiden secciones de página',async({page})=>{
 await page.setContent('<main><section style="height:100px">Contenido</section></main><aside class="tt-cart-drawer"><span>Cantidad</span></aside>');
 await page.addScriptTag({content:fs.readFileSync('js/theme/alternancia-secciones.js','utf8')});
 await page.waitForTimeout(100);
 await page.evaluate(()=>{window.readCount=0;const original=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){window.readCount++;return original.call(this);};});
 await page.evaluate(async()=>{for(let i=0;i<5;i++){document.querySelector('aside span').textContent=String(i);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}});
 expect(await page.evaluate(()=>window.readCount)).toBe(0);
 // Una sección nueva sí debe incorporarse al flujo.
 await page.evaluate(()=>{const section=document.createElement('section');section.textContent='Nueva sección';document.querySelector('main').append(section);});
 await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
});

test('navegación móvil agrupa ráfagas y mide antes de escribir el halo',async({page})=>{
 await page.route('**/__mobile-halo-performance',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><nav id="tt-tabbar" style="display:flex;width:360px;height:60px"><i class="tt-mobile-nav-halo" style="width:42px;height:42px"></i><button class="tt-tabbar-btn active" style="width:60px;height:60px"><svg width="24" height="24"></svg>Inicio</button></nav>'}));
 await page.goto('/__mobile-halo-performance');
 await page.addScriptTag({type:'module',url:'/js/components/navigation/movil/indicador-navegacion-movil.js'});
 await expect(page.locator('#tt-tabbar')).toHaveClass(/tt-mobile-nav-ready/);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const result=await page.evaluate(async()=>{
  const nav=document.getElementById('tt-tabbar'),rect=Element.prototype.getBoundingClientRect,set=CSSStyleDeclaration.prototype.setProperty;
  nav.querySelector('button').style.width='72px';
  let reads=0,wrote=false,late=false;
  Element.prototype.getBoundingClientRect=function(){if(this===nav){reads++;if(wrote)late=true;}return rect.call(this);};
  const descriptors=['clientLeft','clientTop','offsetWidth','offsetHeight'].map(key=>[key,Object.getOwnPropertyDescriptor(HTMLElement.prototype,key)||Object.getOwnPropertyDescriptor(Element.prototype,key)]);
  for(const [key,d] of descriptors)if(d?.get)Object.defineProperty(HTMLElement.prototype,key,{configurable:true,get(){if(wrote)late=true;return d.get.call(this);}});
  CSSStyleDeclaration.prototype.setProperty=function(...args){if(this===nav.style)wrote=true;return set.apply(this,args);};
  for(let i=0;i<20;i++)dispatchEvent(new Event('orientationchange'));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {reads,late};
 });
 expect(result).toEqual({reads:1,late:false});
});

for(const width of [390,820,1440])test(`Inicio contiene el margen del hero sin desplazar body a ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.setContent('<style>:root{--header-h:88px}body{margin:0}.tt-hero{height:400px}</style><body class="tt-home-premium"><main><section class="tt-hero">Portada original</section></main></body>');
 await page.addStyleTag({content:fs.readFileSync('css/pages/home/ajuste-inicio.css','utf8')});
 const geometry=await page.evaluate(()=>({body:document.body.getBoundingClientRect().top,hero:document.querySelector('.tt-hero').getBoundingClientRect().top}));
 expect(geometry).toEqual({body:0,hero:width>=769?88:0});
});

for(const route of ['checkout','login','perfil'])test(`contenido transaccional permanece estático: ${route}`,async({page})=>{
 await page.route(`https://motion.test/${route}`,r=>r.fulfill({contentType:'text/html',body:'<main><section style="height:100px"><h1>Tu cuenta</h1><form><label>Nombre<input value="Mi borrador"></label><button>Continuar</button></form></section></main>'}));
 await page.goto(`https://motion.test/${route}`);
 await page.addScriptTag({content:fs.readFileSync('js/quality/revelado-desplazamiento-global.js','utf8')});
 await expect(page.locator('.tt-auto-reveal')).toHaveCount(0);
 await expect(page.locator('input')).toHaveValue('Mi borrador');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('button').dispatchEvent('pointerdown');
 await expect(page.locator('.tt-premium-pressed')).toHaveCount(0);
 expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});
test('activar movimiento reducido cancela el revelado ya iniciado',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setContent('<main><section style="height:1800px">Contenido</section><section id="later" style="height:200px"><h2>Colecciones</h2></section></main>');
 await page.addScriptTag({content:fs.readFileSync('js/quality/revelado-desplazamiento-global.js','utf8')});
 await expect(page.locator('#later')).toHaveClass(/tt-auto-reveal/);
 await page.locator('#later').scrollIntoViewIfNeeded();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('html')).toHaveClass(/tt-reveal-reduced-motion/);
 await expect(page.locator('#later')).toHaveClass(/tt-visible/);
 expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
 await expect(page.locator('#later h2')).toHaveText('Colecciones');
});
