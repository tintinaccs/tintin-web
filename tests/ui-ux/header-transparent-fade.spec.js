const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const styles=fs.readFileSync('css/theme/sistema-superficies-tintin.css','utf8');
const sizes=[[320,568],[390,844],[768,1024],[1024,768],[1180,820],[1181,820],[1366,768],[1440,900],[1920,1080],[844,390]];
const surfaces=['id="tt-header-desktop-tablet" class="tt-header"','id="tt-header-tablet"','id="tt-mobile-brand"','class="ck-header"','class="login-brand"','class="adm-topbar"','class="adm-header"'];
async function pixelsAt(page,clip){const strip=await page.screenshot({clip});return page.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return Array.from(ctx.getImageData(0,0,c.width,c.height).data);},strip.toString('base64'));}
for(const[width,height]of sizes)test(`borde transparente sobre fondos cambiantes y al reaparecer · ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 for(const surface of surfaces){
  await page.setContent(`<style>${styles}body{margin:0;min-height:2400px}header{position:fixed;top:0;left:0;width:100%;height:88px;z-index:20;display:block!important}button{position:absolute;left:40%;top:12px;width:120px;height:48px}#under{position:fixed;inset:0;background:var(--under);z-index:0}</style><div id="under"></div><header ${surface}><button onclick="this.dataset.clicked='yes'">Menú</button></header>`);
  const header=page.locator('header');
  for(const tone of ['#ffffff','#f8aaca','#303846']){
   await page.evaluate(tone=>document.documentElement.style.setProperty('--under',tone),tone);
   const layer=await header.evaluate(n=>{const s=getComputedStyle(n,'::before');return{mask:s.maskImage||s.webkitMaskImage,blur:s.backdropFilter||s.webkitBackdropFilter,pointer:s.pointerEvents};});
   const pixels=await pixelsAt(page,{x:8,y:48,width:1,height:92});
   let jump=0;for(let y=1;y<92;y++)for(let c=0;c<3;c++)jump=Math.max(jump,Math.abs(pixels[y*4+c]-pixels[(y-1)*4+c]));
   expect(jump,`${surface} sobre ${tone}: no debe haber una línea de corte`).toBeLessThan(18);
   expect(layer.mask).toContain('linear-gradient');expect(layer.blur).toContain('blur(18px)');expect(layer.pointer).toBe('none');
   const expected=tone.match(/[a-f0-9]{2}/g).map(x=>parseInt(x,16));
   expect(pixels.slice(-4,-1),`${surface}: el extremo debe revelar exactamente el fondo`).toEqual(expected);
  }
  await page.evaluate(()=>scrollTo(0,500));await header.evaluate(n=>n.style.transform='translateY(calc(-100% - 12px))');
  expect((await pixelsAt(page,{x:8,y:0,width:1,height:1})).slice(0,3),'ocultar el header no debe dejar un halo').toEqual([48,56,70]);
  await header.evaluate(n=>{n.style.transform='';n.classList.add('scrolled');});
  await expect(header).toBeVisible();await header.locator('button').click();await expect(header.locator('button')).toHaveAttribute('data-clicked','yes');
  await expect(header).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(header).toHaveCSS('backdrop-filter','none');
  expect(await header.evaluate(n=>getComputedStyle(n).filter)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }
});
