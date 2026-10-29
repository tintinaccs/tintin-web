const { test, expect } = require('@playwright/test');
test.use({ deviceScaleFactor: 2 });

test('About conserva resolución Retina después del snapshot y respeta la foto personalizada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/__image-quality', route => route.fulfill({ contentType: 'text/html', body: '<div data-img-slot="about_foto" style="width:358px;height:398px"></div>' }));
  await page.route('**/images/imagenes.js*', route => route.fulfill({ contentType: 'text/javascript', body: `export const HERO_IMAGE_CONFIG_VERSION='fixture';export const HERO_IMAGE_FALLBACKS={};export const resolveSlotImage=(values,slot,device)=>values[slot+'_'+device]||values[slot]||'';export function onImagesUpdate(callback){window.confirmImages=callback;callback({});callback({});}` }));
  await page.goto('/__image-quality');
  await page.addScriptTag({ type: 'module', url: '/js/components/images/gestion-imagenes.js' });
  const image = page.locator('[data-img-slot="about_foto"] img');
  await expect.poll(() => image.evaluate(img => img.currentSrc)).toMatch(/barbi-historia-original.jpeg$/);
  const custom = '/assets-tintin/images/nosotros/barbi-mision/barbi-mision-desktop.webp?custom=1';
  await page.evaluate(custom => window.confirmImages({ about_foto_mobile: custom }), custom);
  await expect.poll(() => image.evaluate(img => img.currentSrc)).toContain('?custom=1');
});

test('las nuevas fotos conservan bytes y resolución originales sin ampliar imágenes pequeñas', async ({ page }) => {
  await page.goto('/404.html');
  const results = await page.evaluate(async () => {
    const { processImage } = await import('../../js/components/images/procesamiento-imagenes.js');
    const output = [];
    for (const [width, height] of [[4000, 2400], [640, 480]]) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F8AACA'; ctx.fillRect(0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'foto.png', { type: 'image/png' });
      const result = await processImage(file);
      const full = await createImageBitmap(result.fullBlob);
      const thumb = await createImageBitmap(result.thumbBlob);
      output.push({ width: full.width, height: full.height, thumbWidth: thumb.width, thumbHeight: thumb.height, sourcePreserved: result.fullBlob === file });
      full.close(); thumb.close();
    }
    return output;
  });
  expect(results).toEqual([
    { width: 4000, height: 2400, thumbWidth: 320, thumbHeight: 192, sourcePreserved: true },
    { width: 640, height: 480, thumbWidth: 320, thumbHeight: 240, sourcePreserved: true },
  ]);
});

for (const device of ['desktop','mobile','tablet-horizontal','tablet-vertical']) test(`hero ${device}: compresión sin pérdida con los píxeles originales`, async ({ page }) => {
  const fs = require('node:fs'), path = require('node:path');
  const dir = path.resolve(__dirname, '../../assets-tintin/images/home/hero-nuevo');
  const stem = `hero-nuevo-${device}`;
  expect(fs.statSync(path.join(dir,stem+'-lossless.webp')).size).toBeLessThan(fs.statSync(path.join(dir,stem+'.png')).size*.75);
  await page.goto('/404.html');
  const comparison = await page.evaluate(async stem => {
    async function pixels(ext) {
      const bitmap = await createImageBitmap(await (await fetch('/assets-tintin/images/home/hero-nuevo/'+stem+ext)).blob());
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,canvas.width,canvas.height).data))).join(',');
      return {width:canvas.width,height:canvas.height,hash};
    }
    return {original:await pixels('.png'),optimized:await pixels('-lossless.webp')};
  },stem);
  expect(comparison.optimized).toEqual(comparison.original);
});

test('imágenes globales: prioridad explícita y lecturas agrupadas sin promover todas las miniaturas',async({page})=>{
  await page.route('**/__image-priority',route=>route.fulfill({contentType:'text/html',body:'<style>img{width:20px;height:20px}#images{max-width:300px}</style><main><img id="hero" fetchpriority="high"><img id="low" fetchpriority="low"><img id="lazy" loading="lazy"><div id="images"></div><div style="margin-top:3000px"><img id="below"></div></main>'}));
  await page.goto('/__image-priority');
  await page.evaluate(()=>{
    const host=document.getElementById('images');for(let i=0;i<100;i++)host.append(document.createElement('img'));
    window.readsAfterWrite=0;window.imageReads=0;let wrote=false;window.resetImageWrites=()=>{wrote=false;};window.frameReads=[];const frame=window.requestAnimationFrame;window.requestAnimationFrame=callback=>frame.call(window,time=>{wrote=false;window.frameReads.push(0);callback(time);});
    const rect=Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect=function(){if(this instanceof HTMLImageElement){window.imageReads++;window.frameReads[window.frameReads.length-1]++;if(wrote)window.readsAfterWrite++;}return rect.call(this);};
    const loading=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'loading');
    Object.defineProperty(HTMLImageElement.prototype,'loading',{...loading,set(value){wrote=true;loading.set.call(this,value);}});
  });
  await page.addScriptTag({url:'/js/components/images/rendimiento-imagenes.js'});
  await expect(page.locator('#images img').last()).toHaveAttribute('decoding','async');
  expect(await page.evaluate(()=>window.readsAfterWrite)).toBe(0);
  expect(await page.evaluate(()=>window.imageReads)).toBe(102);
  expect(await page.evaluate(()=>Math.max(...window.frameReads))).toBeLessThanOrEqual(64);
  await expect(page.locator('#hero')).toHaveAttribute('fetchpriority','high');
  await expect(page.locator('#low')).toHaveAttribute('fetchpriority','low');
  await expect(page.locator('#lazy')).toHaveAttribute('loading','lazy');
  await expect(page.locator('#images img[fetchpriority=high]')).toHaveCount(0);
  await expect(page.locator('#images img').first()).toHaveAttribute('fetchpriority','auto');
  await expect(page.locator('#below')).toHaveAttribute('fetchpriority','low');
  const reads=await page.evaluate(()=>window.imageReads);
  await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('tintin:products-loaded'));document.dispatchEvent(new CustomEvent('tintin:page-ready'));});
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.imageReads)).toBe(reads);
  await page.evaluate(()=>{window.imageReads=0;window.readsAfterWrite=0;window.resetImageWrites();const box=document.createElement('div');document.getElementById('images').append(box);const img=document.createElement('img');img.id='new-thumb';box.append(img);});
  await expect(page.locator('#new-thumb')).toHaveAttribute('decoding','async');
  expect(await page.evaluate(()=>window.imageReads)).toBe(1);
  expect(await page.evaluate(()=>window.readsAfterWrite)).toBe(0);
});

for(const [width,height,device] of [[320,568,'mobile'],[390,844,'mobile'],[540,900,'mobile'],[820,1180,'tablet-vertical'],[1024,768,'tablet-horizontal'],[1440,900,'desktop']])test(`precarga y picture comparten una sola portada ${width}`,async({page})=>{
  const fs=require('node:fs'),path=require('node:path');
  const {removeFixtureScripts}=require('../../scripts/lib/html-layout-fixture.js');
  const html=removeFixtureScripts(fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8'),{removeModulePreloads:true});
  const requests=[];page.on('request',request=>{const url=new URL(request.url());if(/\/hero-nuevo\/.*\.(png|webp)$/.test(url.pathname))requests.push(url.href);});
  await page.setViewportSize({width,height});
  await page.route('**/__hero-delivery',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('/__hero-delivery');
  await expect.poll(()=>page.locator('#tt-hero-img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('#tt-hero-img')).toHaveJSProperty('currentSrc',new URL(`/assets-tintin/images/home/hero-nuevo/hero-nuevo-${device}-lossless.webp?v=tintin-20261029-lossless-1`,page.url()).href);
  expect(requests).toHaveLength(1);
  // La portada ya decodificada se revela en un frame, sin una segunda espera
  // por opacidad. Se prueba con el CSS real generado para cada dispositivo.
  const reveal = await page.evaluate(async () => {
    document.body.classList.remove('tt-hero-atomic-ready');
    document.body.classList.add('tt-hero-atomic-pending');
    const media = document.getElementById('tt-hero-media');
    getComputedStyle(media).opacity;
    document.body.classList.replace('tt-hero-atomic-pending', 'tt-hero-atomic-ready');
    await new Promise(requestAnimationFrame);
    return { opacity: getComputedStyle(media).opacity, duration: getComputedStyle(media).transitionDuration };
  });
  expect(reveal).toEqual({ opacity: '1', duration: '0s' });
  if (width < 768) {
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const hero = document.getElementById('hero').getBoundingClientRect();
      const group = document.querySelector('#hero .tt-hero-actions').getBoundingClientRect();
      const whatsapp = document.querySelector('.tt-wa-float').getBoundingClientRect();
      return { axis: hero.left + hero.width / 2, center: group.left + group.width / 2, whatsappLeft: whatsapp.left,
        actions: [...document.querySelectorAll('#hero .tt-hero-actions a')].map(a => ({ right: a.getBoundingClientRect().right, clipped: a.scrollWidth > a.clientWidth + 1 })) };
    });
    expect(Math.abs(geometry.center - geometry.axis)).toBeLessThanOrEqual(1);
    expect(geometry.actions).toHaveLength(2);
    for (const action of geometry.actions) {
      expect(action.right).toBeLessThanOrEqual(geometry.whatsappLeft - 8);
      expect(action.clipped).toBe(false);
    }
  }
});
