const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const html = restoreStyleSources(removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true }));
const types = { '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
for (const [width,height] of [[320,568],[390,844],[430,932],[667,375],[844,390],[768,1024],[820,1180],[1024,768],[1120,840],[1121,800],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
  test(`banner completo sin recorte ni deformación · ${width}x${height}`, async ({page}, testInfo) => {
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
      return {image:box(image),media:box(media),hero:box(hero),ratio:image.naturalWidth/image.naturalHeight,scrollWidth:document.documentElement.scrollWidth,whatsapp:box(document.querySelector('.tt-wa-float')),actions:[...hero.querySelectorAll('.tt-hero-actions a')].map(box)};
    });
    const geometryPath = testInfo.outputPath('geometria-banner.json');
    fs.writeFileSync(geometryPath, JSON.stringify(result, null, 2));
    await testInfo.attach('geometria-banner', { path: geometryPath, contentType: 'application/json' });
    expect(result.scrollWidth).toBeLessThanOrEqual(width+1);
    expect(Math.abs(result.image.width/result.image.height-result.ratio)).toBeLessThan(.002);
    for(const edge of ['left','right','top','bottom']) expect(Math.abs(result.image[edge]-result.media[edge])).toBeLessThanOrEqual(1);
    expect(result.image.left).toBeGreaterThanOrEqual(0);
    expect(result.image.right).toBeLessThanOrEqual(width);
    expect(result.image.top).toBeGreaterThanOrEqual(0);
    expect(result.image.bottom).toBeLessThanOrEqual(result.hero.bottom+1);
    for(const action of result.actions) {
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeLessThanOrEqual(width);
      expect(action.top).toBeGreaterThanOrEqual(width<=767?result.image.bottom:result.image.top);
      expect(action.bottom).toBeLessThanOrEqual(result.hero.bottom+1);
      expect(action.height).toBeGreaterThanOrEqual(44);
      if (width<=767) expect(action.right).toBeLessThanOrEqual(result.whatsapp.left-8);
    }
    await page.locator('#hero').screenshot({path:testInfo.outputPath('banner.png')});
  });
}
