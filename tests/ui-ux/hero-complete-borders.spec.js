const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const html = restoreStyleSources(removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true }));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
for (const [width,height] of [[320,568],[390,844],[430,932],[568,320],[667,375],[844,390],[768,1024],[820,1180],[1024,768],[1120,840],[1121,800],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440]]) {
  test(`marca y productos completos con fondo editable · ${width}x${height}`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height});
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'layout.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:html});
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)] || 'application/octet-stream'}); }
      catch { return route.abort(); }
    });
    await page.goto('https://layout.test/');
    await page.waitForFunction(()=> [...document.querySelectorAll('link[rel="stylesheet"]')].every(l=>l.sheet) && document.querySelector('#tt-hero-img').naturalWidth);
    // Reproduce la configuración antigua que ampliaba y recortaba el arte.
    await page.evaluate(()=>{
      document.body.classList.add('tt-public-shell-mounted','tt-home-runtime-ready');
      document.querySelector('.tt-hero-pause').hidden = false;
      const img=document.querySelector('#tt-hero-img');
      for (const device of ['desktop','tablet','mobile']) {
        img.style.setProperty(`--tt-hero-fit-${device}`,'cover');
        img.style.setProperty(`--tt-hero-scale-${device}`,'2');
        img.style.setProperty(`--tt-hero-pos-${device}`,'right bottom');
      }
    });
    const result=await page.evaluate(()=>{
      const image=document.querySelector('#tt-hero-img'), media=image.closest('.tt-hero-media'), hero=document.querySelector('#hero');
      const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {image:box(image),media:box(media),hero:box(hero),brand:box(hero.querySelector('.tt-hero-brand')),necklace:box(hero.querySelector('.tt-hero-piece--necklace')),brandFilter:getComputedStyle(hero.querySelector('.tt-hero-brand')).filter,brandSrc:hero.querySelector('.tt-hero-brand').getAttribute('src'),fade:{background:getComputedStyle(hero,'::after').backgroundImage,pointer:getComputedStyle(hero,'::after').pointerEvents,z:getComputedStyle(hero,'::after').zIndex},control:(()=>{const e=hero.querySelector('.tt-hero-pause'),s=getComputedStyle(e);return {...box(e),border:parseFloat(s.borderTopWidth),background:s.backgroundColor,shadow:s.boxShadow,reachable:e.contains(document.elementFromPoint(e.getBoundingClientRect().x+e.getBoundingClientRect().width/2,e.getBoundingClientRect().y+e.getBoundingClientRect().height/2)),icon:box(e.querySelector('svg'))}})(),ratio:hero.querySelector('.tt-hero-brand').naturalWidth/hero.querySelector('.tt-hero-brand').naturalHeight,pieces:[...hero.querySelectorAll('.tt-hero-piece img')].map(img=>({fit:getComputedStyle(img).objectFit,loaded:img.complete&&img.naturalWidth>0})),scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),whatsapp:box(document.querySelector('.tt-wa-float')),actions:[...hero.querySelectorAll('.tt-hero-actions a')].map(a=>({...box(a),clipped:a.scrollWidth>a.clientWidth+1}))};
    });
    const geometryPath = testInfo.outputPath('geometria-banner.json');
    fs.writeFileSync(geometryPath, JSON.stringify(result, null, 2));
    await testInfo.attach('geometria-banner', { path: geometryPath, contentType: 'application/json' });
    expect(result.scrollWidth).toBeLessThanOrEqual(width+1);
    expect(Math.abs(result.brand.width/result.brand.height-result.ratio)).toBeLessThan(.002);
    expect(result.control.width).toBe(44);
    expect(result.control.height).toBe(44);
    expect(result.control.border).toBe(0);
    expect(result.control.background).toBe('rgba(0, 0, 0, 0)');
    expect(result.control.icon.width).toBe(18);
    expect(result.control.shadow).toBe('none');
    expect(result.control.reachable).toBe(true);
    expect(result.control.top).toBeGreaterThanOrEqual(result.hero.top);
    expect(result.control.right).toBeLessThanOrEqual(result.hero.right);
    expect(result.brandFilter).toBe('none');
    expect(result.brandSrc).toContain('tintin-white.webp');
    expect((result.fade.background.match(/linear-gradient/g)||[])).toHaveLength(2);
    expect(result.fade.background).toContain('radial-gradient');
    expect(result.fade.pointer).toBe('none');
    expect(result.fade.z).toBe('0');
    for(const edge of ['left','top'])expect(result.necklace[edge]-result.hero[edge],`necklace ${edge}`).toBeGreaterThanOrEqual(0);
    for(const edge of ['right','bottom'])expect(result.hero[edge]-result.necklace[edge],`necklace ${edge}`).toBeGreaterThanOrEqual(0);
    expect(result.pieces).toHaveLength(4);
    expect(result.pieces.every(piece=>piece.fit==='contain'&&piece.loaded)).toBe(true);
    for(const edge of ['left','right','top','bottom']) expect(Math.abs(result.hero[edge]-result.media[edge])).toBeLessThanOrEqual(1);
    expect(result.brand.left).toBeGreaterThanOrEqual(0);
    expect(result.brand.right).toBeLessThanOrEqual(width);
    expect(result.brand.top).toBeGreaterThanOrEqual(result.hero.top);
    expect(result.brand.bottom).toBeLessThanOrEqual(result.hero.bottom+1);
    for(const action of result.actions) {
      expect(action.clipped).toBe(false);
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeLessThanOrEqual(width);
      expect(action.top).toBeGreaterThanOrEqual(result.hero.top);
      expect(action.bottom).toBeLessThanOrEqual(result.hero.bottom+1);
      expect(action.height).toBeGreaterThanOrEqual(44);

    }
    await page.locator('#hero').screenshot({path:testInfo.outputPath('banner.png')});
  });
}

test('el banner pausa, respeta movimiento reducido y conserva enlaces al desplazar',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='motion.test')return route.abort();
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'})}catch{return route.abort()}
 });
 await page.goto('https://motion.test/');
 await page.evaluate(()=>document.body.classList.add('tt-public-shell-mounted'));
 await page.addScriptTag({url:'https://motion.test/js/pages/home/inicio-premium.js'});
 const hero=page.locator('#hero'),pause=page.locator('.tt-hero-pause');
 await expect(pause).toBeVisible();
 await expect(hero).toHaveAttribute('data-hero-moving','true');
 await pause.click();
 await expect(pause).toHaveAttribute('aria-pressed','true');
 await expect(pause.locator('path')).toHaveAttribute('d','M9 5l10 7-10 7z');
 await expect(pause).toHaveAttribute('title','Reanudar animación');
 await expect(hero).toHaveAttribute('data-hero-paused','true');
 const before=await page.locator('.tt-hero-piece').first().evaluate(e=>getComputedStyle(e).transform);
 await page.evaluate(()=>scrollTo(0,120));await page.waitForTimeout(50);
 expect(await page.locator('.tt-hero-piece').first().evaluate(e=>getComputedStyle(e).transform)).toBe(before);
 const chainInside=await page.locator('.tt-hero-piece--necklace').evaluate(e=>{const r=e.getBoundingClientRect(),h=e.closest('#hero').getBoundingClientRect();return r.top>=h.top&&r.left>=h.left&&r.right<=h.right&&r.bottom<=h.bottom;});
 expect(chainInside).toBe(true);
 await pause.click();await expect(hero).toHaveAttribute('data-hero-moving','true');
 await expect(pause.locator('path')).toHaveAttribute('d','M8 5v14M16 5v14');
 await pause.focus();
 await pause.press('Space');
 await expect(pause).toHaveAttribute('aria-pressed','true');
 expect(await pause.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
 await pause.press('Enter');
 await expect(pause).toHaveAttribute('aria-pressed','false');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(hero).toHaveAttribute('data-hero-paused','true');
 await expect(pause).toBeHidden();
 expect(await hero.evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.playState==='running'))).toBe(false);
 await expect(page.locator('.tt-hero-cta')).toHaveAttribute('href','/catalogo');
 await expect(page.locator('.tt-hero-link')).toHaveAttribute('href','/about');
});
