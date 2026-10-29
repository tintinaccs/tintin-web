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
 await expect(page.locator('.tt-auto-reveal')).toHaveCount(3);
 expect(await page.evaluate(()=>({reads:window.reads.length,late:window.readAfterWrite}))).toEqual({reads:3,late:false});
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
