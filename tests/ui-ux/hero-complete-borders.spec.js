const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const html = restoreStyleSources(removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true }));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
async function open(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'layout.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:html});
    if (url.pathname.endsWith('/espera-cargador.js')) return route.fulfill({contentType:'text/javascript',body:'export const waitForLoaderHidden=()=>Promise.resolve()'});
    const file=path.resolve(root,'.'+url.pathname);
    if (!file.startsWith(root+path.sep)) return route.abort();
    try { return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'}); } catch { return route.abort(); }
  });
  await page.goto('https://layout.test/');
  await page.waitForFunction(()=>[...document.querySelectorAll('link[rel="stylesheet"]')].every(l=>l.sheet));
  await page.evaluate(()=>document.body.classList.add('tt-public-shell-mounted','tt-home-runtime-ready'));
  await page.evaluate(()=>document.fonts.ready);
}
for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[568,320],[768,1024],[820,1180],[1024,768],[1024,1366],[1120,840],[1280,720],[1440,900],[1920,1080]]) {
  test(`estructura sin recortes, marca plana y sin Colecciones · ${width}x${height}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});await open(page);
    await expect.poll(()=>page.locator('.tt-hero-suitcase img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
    const g=await page.evaluate(()=>{
      const hero=document.querySelector('#hero'),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {hero:rect(hero),brand:rect(hero.querySelector('.tt-hero-brand')),art:rect(hero.querySelector('.tt-hero-suitcase')),title:rect(hero.querySelector('h1')),actions:[...hero.querySelectorAll('.tt-hero-actions a')].map(rect),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,logoShadow:getComputedStyle(hero.querySelector('.tt-hero-symbol')).boxShadow,logoFilter:getComputedStyle(hero.querySelector('.tt-hero-symbol')).filter,removed:!document.querySelector('.tt-hero-index,.tt-hero-collections'),gap:document.querySelector('.tt-trust-bar').getBoundingClientRect().top-hero.getBoundingClientRect().bottom,fit:getComputedStyle(hero.querySelector('.tt-hero-suitcase img')).objectFit};
    });
    expect(g.removed).toBe(true);expect(g.gap).toBeCloseTo(0);expect(g.overflow).toBeLessThanOrEqual(1);expect(g.fit).toBe('contain');expect(g.logoShadow).toBe('none');expect(g.logoFilter).not.toContain('drop-shadow');expect(g.hero.bottom).toBeLessThanOrEqual(height+1);
    for(const box of [g.brand,g.art,g.title,...g.actions]){expect(box.left).toBeGreaterThanOrEqual(-1);expect(box.right).toBeLessThanOrEqual(width+1);expect(box.top).toBeGreaterThanOrEqual(g.hero.top-1);expect(box.bottom).toBeLessThanOrEqual(g.hero.bottom+1);}
    for(const action of g.actions) expect(action.height).toBeGreaterThanOrEqual(44);
    if(height>=width&&width<=1120){expect(g.brand.bottom).toBeLessThanOrEqual(g.art.top+1);expect(g.art.bottom).toBeLessThanOrEqual(g.title.top+1);}else{expect(g.art.right).toBeLessThanOrEqual(g.brand.left+1);}
    await expect(page.locator('.tt-hero-cta')).toHaveText('COMPRAR AHORA');await expect(page.locator('.tt-hero-cta')).toHaveAttribute('href','/catalogo');await expect(page.locator('.tt-hero-link')).toHaveAttribute('href','/about');
    await page.locator('.tt-hero-cta').focus();expect(await page.locator('.tt-hero-cta').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
    await page.locator('.tt-hero-cta').blur();
    await page.locator('#hero').screenshot({path:testInfo.outputPath('hero.png')});
  });
}
test('recurso original del maletín disponible y decodificable antes de publicar',async({page})=>{
  for(const name of ['suitcase.png','suitcase-960.png','suitcase-640.png']) expect(fs.existsSync(path.join(root,'assets-tintin/images/home/hero-reference',name)),`Falta el archivo original: ${name}`).toBe(true);
  await open(page);await expect.poll(()=>page.locator('.tt-hero-suitcase img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  const equality=await page.evaluate(async()=>{
    const original=new Image();original.src='/assets-tintin/images/home/hero-reference/suitcase-original.png';await original.decode();
    const optimized=new Image();optimized.src='/assets-tintin/images/home/hero-reference/suitcase.png?v=suitcase-1';await optimized.decode();
    const digest=async(image,source)=>{const canvas=document.createElement('canvas');canvas.width=1050;canvas.height=1086;const ctx=canvas.getContext('2d');if(source)ctx.drawImage(image,200,0,1050,1086,0,0,1050,1086);else ctx.drawImage(image,0,0);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,1050,1086).data))].join(',')};
    return {source:await digest(original,true),webp:await digest(optimized,false)};
  });
  expect(equality.webp).toBe(equality.source);

});
test('movimiento de entrada una vez, sin parallax y cancelable por preferencia',async({page})=>{
  await open(page);await page.evaluate(()=>{const native=Element.prototype.animate;window.heroEntrances=0;Element.prototype.animate=function(...args){if(this.closest('#hero'))window.heroEntrances++;return native.apply(this,args)}});
  await page.addScriptTag({url:'https://layout.test/js/pages/home/inicio-premium.js'});
  await expect.poll(()=>page.evaluate(()=>window.heroEntrances)).toBe(7);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('#hero').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);
  await page.evaluate(()=>scrollTo(0,1200));await page.evaluate(()=>scrollTo(0,0));await page.emulateMedia({reducedMotion:'no-preference'});expect(await page.evaluate(()=>window.heroEntrances)).toBe(7);
  expect(await page.locator('.tt-hero-suitcase').evaluate(e=>getComputedStyle(e).transform)).toBe('none');
});
test('sin JavaScript y con movimiento reducido el contenido empieza visible',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce'});const page=await context.newPage();
  await page.setContent('<style>'+fs.readFileSync(path.join(root,'css/pages/home/hero-bienvenida-inicio.css'),'utf8')+'</style>'+html.match(/<section class="tt-hero"[\s\S]*?<\/section>/)[0]);
  await expect(page.locator('h1')).toBeVisible();await expect(page.locator('.tt-hero-cta')).toBeVisible();await context.close();
});
test('transición mantiene el rosa del hero al activar el flujo compartido',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await open(page);
  await page.addScriptTag({url:'https://layout.test/js/theme/alternancia-secciones.js'});
  await expect(page.locator('#hero')).toHaveAttribute('data-tt-flow-block','light');
  await expect(page.locator('.tt-trust-bar')).toHaveAttribute('data-tt-flow-block','pink');
  const flow=await page.evaluate(()=>{const h=document.querySelector('#hero'),s=getComputedStyle(h),after=getComputedStyle(h,'::after');return {background:s.backgroundImage,fade:after.backgroundImage,pointer:after.pointerEvents,hiddenLayer:getComputedStyle(h.querySelector('[data-tt-flow-background]')).display}});
  expect(flow.background).toContain('linear-gradient');expect(flow.background).toContain('255, 181, 215');expect(flow.fade).toContain('linear-gradient');expect(flow.pointer).toBe('none');expect(flow.hiddenLayer).toBe('none');
});
