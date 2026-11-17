const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const html = restoreStyleSources(removeFixtureScripts(source, { removeModulePreloads: true }));
const runtimeHtml = html.replace('<head>', '<head>' +
  source.match(/<script>window\.TT_PAGE_LOADER_WAIT[\s\S]*?<\/script>/)[0] +
  source.match(/<script[^>]*src="js\/pages\/home\/inicio-premium\.js[^"]*"[^>]*><\/script>/)[0]);
const types = { '.js': 'text/javascript', '.mjs':'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
async function open(page, options = {}) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'layout.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:options.runtime ? runtimeHtml : html});
    if (/hero-reference\/suitcase(?:-\d+)?\.(?:webp|png)$/.test(url.pathname)) {
      if (options.artError) return route.abort('failed');
      if (options.artGate) await options.artGate;
    }
    if (url.pathname.endsWith('/inicio-premium.js')) {
      if (options.runtimeError) return route.abort('failed');
      if (options.runtimeGate) await options.runtimeGate;
    }
    if (url.pathname.endsWith('/espera-cargador.js')) return route.fulfill({contentType:'text/javascript',body:'export const waitForLoaderHidden=()=>Promise.resolve()'});
    const file=path.resolve(root,'.'+url.pathname);
    if (!file.startsWith(root+path.sep)) return route.abort();
    try { return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'}); } catch { return route.abort(); }
  });
  await page.goto('https://layout.test/', { waitUntil: options.runtimeGate ? 'commit' : options.runtime ? 'domcontentloaded' : 'load' });
  await page.locator('#hero').waitFor({ state: 'attached' });
  await page.waitForFunction(()=>[...document.querySelectorAll('link[rel="stylesheet"]')].every(l=>l.sheet));
  await page.evaluate(()=>document.body.classList.add('tt-public-shell-mounted','tt-home-runtime-ready'));
  await page.evaluate(()=>document.fonts.ready);
}
for(const [width,height] of [[844,320],[844,390],[1306,630],[320,568],[375,812],[390,844],[430,932],[568,320],[768,1024],[820,1180],[1024,768],[1024,1366],[1120,840],[1280,720],[1440,900],[1920,1080]]) {
  test(`estructura sin recortes, marca plana y sin Colecciones · ${width}x${height}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});await open(page);
    await expect.poll(()=>page.locator('.tt-hero-suitcase img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
    const g=await page.evaluate(()=>{
      const hero=document.querySelector('#hero'),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {wa:rect(document.querySelector('.tt-wa-float')),hero:rect(hero),brand:rect(hero.querySelector('.tt-hero-brand')),art:rect(hero.querySelector('.tt-hero-suitcase')),title:rect(hero.querySelector('h1')),actions:[...hero.querySelectorAll('.tt-hero-actions a')].map(rect),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,logoShadow:getComputedStyle(hero.querySelector('.tt-hero-symbol')).boxShadow,logoFilter:getComputedStyle(hero.querySelector('.tt-hero-symbol')).filter,removed:!document.querySelector('.tt-hero-index,.tt-hero-collections'),gap:document.querySelector('.tt-trust-bar').getBoundingClientRect().top-hero.getBoundingClientRect().bottom,fit:getComputedStyle(hero.querySelector('.tt-hero-suitcase img')).objectFit};
    });
    expect(g.hero.bottom).toBeLessThanOrEqual(height+1);expect(g.removed).toBe(true);expect(g.gap).toBeCloseTo(0);expect(g.overflow).toBeLessThanOrEqual(1);expect(g.fit).toBe('contain');expect(g.logoShadow).toBe('none');expect(g.logoFilter).not.toContain('drop-shadow');
    for(const box of [g.brand,g.art,g.title,...g.actions]){expect(box.left).toBeGreaterThanOrEqual(-1);expect(box.right).toBeLessThanOrEqual(width+1);expect(box.top).toBeGreaterThanOrEqual(g.hero.top-1);expect(box.bottom).toBeLessThanOrEqual(g.hero.bottom+1);}
    for(const action of g.actions){expect(action.height).toBeGreaterThanOrEqual(44);expect(action.left<g.wa.right&&action.right>g.wa.left&&action.top<g.wa.bottom&&action.bottom>g.wa.top,'WhatsApp no debe cubrir acciones del hero').toBe(false);}
    if(height>width&&width<=1120){expect(g.brand.bottom).toBeLessThanOrEqual(g.art.top+1);expect(g.art.bottom).toBeLessThanOrEqual(g.title.top+1);}else{expect(g.art.right).toBeLessThanOrEqual(g.brand.left+1);}
    await expect(page.locator('.tt-hero-cta')).toHaveText('Comprar ahora');await expect(page.locator('.tt-hero-cta')).toHaveAttribute('href','/catalogo');await expect(page.locator('.tt-hero-link')).toHaveAttribute('href','/about');
    await page.locator('.tt-hero-cta').focus();expect(await page.locator('.tt-hero-cta').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
    await page.locator('.tt-hero-cta').blur();
    await page.locator('#hero').screenshot({path:testInfo.outputPath('hero.png')});
  });
}
test('recurso original del maletín disponible y decodificable antes de publicar',async({page})=>{
  for(const name of ['suitcase.png','suitcase-960.png','suitcase-640.png','suitcase.webp','suitcase-960.webp','suitcase-640.webp']) expect(fs.existsSync(path.join(root,'assets-tintin/images/home/hero-reference',name)),`Falta el archivo original: ${name}`).toBe(true);
  await open(page);await expect.poll(()=>page.locator('.tt-hero-suitcase img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  const equality=await page.evaluate(async()=>{
    const original=new Image();original.src='/assets-tintin/images/home/hero-reference/suitcase-original.png';await original.decode();
    const optimized=new Image();optimized.src='/assets-tintin/images/home/hero-reference/suitcase.png?v=suitcase-1';await optimized.decode();
    const digest=async(image,source)=>{const canvas=document.createElement('canvas');canvas.width=1050;canvas.height=1086;const ctx=canvas.getContext('2d');if(source)ctx.drawImage(image,200,0,1050,1086,0,0,1050,1086);else ctx.drawImage(image,0,0);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,1050,1086).data))].join(',')};
    return {source:await digest(original,true),webp:await digest(optimized,false)};
  });
  expect(equality.webp).toBe(equality.source);
  const webpFidelity=await page.evaluate(async()=>{
    const out=[];const dir='/assets-tintin/images/home/hero-reference/';
    const pixels=async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {w:image.naturalWidth,h:image.naturalHeight,data:ctx.getImageData(0,0,image.naturalWidth,image.naturalHeight).data}};
    for(const name of ['suitcase','suitcase-960','suitcase-640']){
      const png=await pixels(dir+name+'.png'),webp=await pixels(dir+name+'.webp?v=suitcase-2');let alpha=0,visible=0;
      for(let k=0;k<png.data.length;k+=4){if(png.data[k+3]!==webp.data[k+3])alpha++;for(let c=0;c<3;c++)visible=Math.max(visible,Math.abs(png.data[k+c]*png.data[k+3]-webp.data[k+c]*webp.data[k+3])/255);}
      out.push({name,size:[png.w,png.h,webp.w,webp.h],alpha,visible});
    }
    return out;
  });
  for(const item of webpFidelity){expect(item.size[0],item.name).toBe(item.size[2]);expect(item.size[1],item.name).toBe(item.size[3]);expect(item.alpha,`${item.name}: transparencia idéntica`).toBe(0);expect(item.visible,`${item.name}: sin diferencia visible (solo redondeo ≤2/255)`).toBeLessThanOrEqual(2);}

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
  expect(flow.background).toContain('linear-gradient');expect(flow.background).toContain('248, 170, 202');expect(flow.fade).toContain('linear-gradient');expect(flow.pointer).toBe('none');expect(flow.hiddenLayer).toBe('none');
});

test('el título conserva la misma fuente y color cuando el editor actualiza sus líneas',async({page})=>{
 await open(page);
 const before=await page.locator('.tt-hero-title').evaluate(e=>({family:getComputedStyle(e).fontFamily,color:getComputedStyle(e).color}));
 await page.evaluate(async()=>{
  const {applyVisualContentPreview}=await import(new URL('../../js/core/store/editor-visual-runtime.js',location.href).href);
  applyVisualContentPreview('index',{hero:{title:'El encanto está\nen los detalles',primaryText:'Comprar ahora'}});
 });
 await expect(page.locator('.tt-hero-title')).toHaveCount(1);
 for(const line of await page.locator('.tt-hero-title-line').all()){
  await expect(line).toHaveCSS('font-family',before.family);
  await expect(line).toHaveCSS('font-size',await page.locator('.tt-hero-title').evaluate(e=>getComputedStyle(e).fontSize));
  await expect(line).toHaveCSS('color',before.color);
 }
 await expect(page.locator('.tt-hero-cta')).toHaveCSS('text-transform','none');
});


for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080],[2560,1440]]) test(`foto pendiente no aparece a medias y revela completa · ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  let release;
  const artGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page, { runtime: true, artGate });
    const picture = page.locator('.tt-hero-suitcase');
    await expect(picture).toHaveCSS('visibility', 'hidden');
    const reserved = await picture.boundingBox();
    // Superar el antiguo corte de1500ms no autoriza pintar una foto incompleta.
    await page.waitForTimeout(1800);
    await expect(picture).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('.tt-hero-cta')).toBeVisible();
    release();
    await expect.poll(() => picture.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(picture).toHaveCSS('visibility', 'visible');
    await expect.poll(() => picture.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    const final = await picture.boundingBox();
    expect(final.width).toBeCloseTo(reserved.width, 0);
    expect(final.height).toBeCloseTo(reserved.height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  } finally { release(); }
});


test('descarga completa todavía espera decode antes de empezar el reveal', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const nativeAnimate = Element.prototype.animate;
    let release;
    const decoding = new Promise(resolve => { release = resolve; });
    window.releaseHeroDecode = release;
    window.heroDecodeFinished = false;
    window.heroPhotoFrames = [];
    HTMLImageElement.prototype.decode = function (...args) {
      if (!this.closest('.tt-hero-suitcase')) return nativeDecode.apply(this, args);
      return decoding.then(() => nativeDecode.apply(this, args)).then(() => { window.heroDecodeFinished = true; });
    };
    Element.prototype.animate = function (...args) {
      if (this.matches('.tt-hero-suitcase')) window.heroPhotoFrames.push({ decoded: window.heroDecodeFinished, complete: this.querySelector('img').complete, first: args[0][0] });
      return nativeAnimate.apply(this, args);
    };
  });
  await open(page, { runtime: true });
  await expect.poll(() => page.locator('.tt-hero-suitcase img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.waitForTimeout(1800);
  await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
  expect(await page.evaluate(() => window.heroPhotoFrames)).toEqual([]);
  await page.evaluate(() => window.releaseHeroDecode());
  await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
  expect(await page.evaluate(() => window.heroPhotoFrames)).toEqual([{ decoded: true, complete: true, first: { opacity: 0, transform: 'translateY(20px) scale(0.96)' } }]);
});

for (const width of [390,1440]) test(`movimiento reducido espera la foto y aparece sin desplazamiento · ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const artGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page, { runtime: true, artGate });
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
    release();
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
    expect(await page.locator('#hero').evaluate(hero => hero.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('transform', 'none');
    await expect(page.locator('.tt-hero-cta')).toBeVisible();
  } finally { release(); }
});

test('fallo de imagen no deja el texto ni las acciones del hero bloqueados', async ({ page }) => {
  await open(page, { runtime: true, artError: true });
  await expect(page.locator('.tt-hero-suitcase')).toHaveAttribute('data-tt-image-error', '');
  await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.tt-hero-title')).toBeVisible();
  await expect(page.locator('.tt-hero-cta')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/tt-home-(?:reveal|art)-pending/);
  await page.locator('.tt-hero-cta').focus();
  await expect(page.locator('.tt-hero-cta')).toBeFocused();
});

test('cambiar de orientación mientras descarga revela sólo la imagen seleccionada completa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release;
  const artGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page, { runtime: true, artGate });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
    release();
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
    const image = await page.locator('.tt-hero-suitcase img').evaluate(image => ({ complete: image.complete, width: image.naturalWidth, source: image.currentSrc }));
    expect(image.complete).toBe(true);
    expect(image.width).toBeGreaterThan(0);
    expect(image.source).toMatch(/suitcase(?:-\d+)?\.webp/);
  } finally { release(); }
});


test('controlador lento mantiene la foto oculta y no repite el texto ya disponible', async ({ page }) => {
  let releaseRuntime, releaseArt;
  const runtimeGate = new Promise(resolve => { releaseRuntime = resolve; });
  const artGate = new Promise(resolve => { releaseArt = resolve; });
  await page.addInitScript(() => {
    const native = Element.prototype.animate;
    window.heroLateAnimations = [];
    Element.prototype.animate = function (...args) {
      if (this.closest('#hero')) window.heroLateAnimations.push(this.matches('.tt-hero-suitcase') ? 'photo' : 'copy');
      return native.apply(this, args);
    };
  });
  try {
    await open(page, { runtime: true, runtimeGate, artGate });
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
    await page.waitForTimeout(4500);
    await expect(page.locator('.tt-hero-cta')).toBeVisible();
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
    releaseRuntime();
    await page.waitForFunction(() => window.TintinHomePremiumBooted);
    await expect(page.locator('.tt-hero-title')).toHaveCSS('opacity', '1');
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'hidden');
    releaseArt();
    await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
    expect(await page.evaluate(() => window.heroLateAnimations)).toEqual(['photo']);
  } finally { releaseRuntime(); releaseArt(); }
});

test('controlador no disponible conserva la portada estática accesible', async ({ page }) => {
  await open(page, { runtime: true, runtimeError: true });
  await expect(page.locator('.tt-hero-title')).toBeVisible();
  await expect(page.locator('.tt-hero-cta')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/tt-home-(?:reveal|art)-pending/);
  await expect.poll(() => page.locator('.tt-hero-suitcase img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
});

test('sin API de animación la foto lista y las acciones permanecen visibles', async ({ page }) => {
  await page.addInitScript(() => { Element.prototype.animate = undefined; });
  await open(page, { runtime: true });
  await expect(page.locator('.tt-hero-cta')).toBeVisible();
  await expect(page.locator('.tt-hero-suitcase')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('html')).not.toHaveClass(/tt-home-(?:reveal|art)-pending/);
});
