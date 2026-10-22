const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    const file=path.resolve(root,'.'+url.pathname);
    if(route.request().method()!=='GET'||!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
    const type={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.woff2':'font/woff2'}[path.extname(file)];
    return route.fulfill({path:file,contentType:type});
  });
});
const styles = fs.readFileSync('css/theme/sistema-superficies-tintin.css', 'utf8');
const runtime = fs.readFileSync('js/theme/alternancia-secciones.js', 'utf8');
const viewports = [[320,568],[390,844],[768,1024],[1024,768],[1180,820],[1181,820],[1366,768],[1440,900],[1920,1080],[844,390]];
for (const [width,height] of viewports) {
  test(`producto alterna selección, recomendaciones y footer con fondo completo · ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    const product = removeFixtureScripts(fs.readFileSync('product.html','utf8'), {removeModulePreloads:true});
    await page.route('**/__product-surfaces', route => route.fulfill({contentType:'text/html',body:product}));
    await page.goto('/__product-surfaces');
    await page.addScriptTag({content:runtime});
    const blocks=page.locator('[data-tt-flow-block]');
    await expect.poll(()=>blocks.evaluateAll(nodes=>nodes.map(n=>n.dataset.ttFlowBlock))).toEqual(['light','pink','light','pink']);
    await expect(page.locator('#tinsel-root')).toHaveAttribute('data-tt-flow-block','pink');
    await expect(page.locator('.tt-related-section')).toHaveAttribute('data-tt-flow-block','light');
    await expect(page.locator('.tt-footer')).toHaveAttribute('data-tt-flow-block','pink');
    const rows=await blocks.evaluateAll(nodes=>nodes.map(n=>{
      const layer=n.querySelector('[data-tt-flow-background]');const s=getComputedStyle(layer),r=layer.getBoundingClientRect();
      return {left:r.left,width:r.width,gradient:s.backgroundImage,start:getComputedStyle(n).getPropertyValue('--tt-section-start'),end:getComputedStyle(n).getPropertyValue('--tt-section-end')};
    }));
    for(let i=0;i<rows.length;i++) {
      expect(Math.abs(rows[i].left)).toBeLessThan(1);expect(rows[i].width).toBe(width);
      expect(rows[i].gradient).toContain('50%');
      if(i)expect(rows[i-1].end).toBe(rows[i].start);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:`artifacts/local-close/product-tones-${width}.png`,fullPage:true});
  });
  test(`encabezado público rosa difuminado en todo el fondo · ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/__header-surfaces',route=>route.fulfill({contentType:'text/html',body:removeFixtureScripts(fs.readFileSync('404.html','utf8'),{removeModulePreloads:true})}));
    await page.goto('/__header-surfaces');
    await page.addScriptTag({type:'module',content:`import {renderDesktopHeader} from '../../js/components/navigation/escritorio/encabezado-escritorio.js';import {renderTabletHeader} from '../../js/components/navigation/tableta/encabezado-tableta.js';document.body.insertAdjacentHTML('afterbegin',renderDesktopHeader()+renderTabletHeader());`});
    await page.addScriptTag({url:'/js/components/color/logotipo-marca.js'});
    const header=page.locator(width<768?'#tt-mobile-brand':width<1025?'#tt-header-tablet':'#tt-header-desktop-tablet');
    await expect(header).toBeVisible();
    const style=await header.evaluate(n=>{const s=getComputedStyle(n),paint=getComputedStyle(n,'::before');return {background:paint.backgroundImage,blur:paint.backdropFilter,mask:paint.maskImage,border:s.borderBottomWidth,canvas:s.backgroundColor,filter:s.filter};});
    expect(style.background).toContain('linear-gradient');expect(style.background).not.toContain('184, 76, 114');
    expect(style.blur).toContain('blur(18px)');expect(style.border).toBe('0px');
    expect(style.mask).toContain('linear-gradient');expect(style.canvas).toBe('rgba(0, 0, 0, 0)');expect(style.filter).toBe('none');
    const extension=await header.evaluate(n=>{const s=getComputedStyle(n,'::before');return {depth:-parseFloat(s.bottom),height:parseFloat(s.height),header:n.clientHeight,pointer:s.pointerEvents};});
    expect(extension.depth).toBeGreaterThanOrEqual(32);expect(extension.depth).toBeLessThanOrEqual(56);
    expect(extension.height).toBeGreaterThanOrEqual(extension.header+extension.depth-1);expect(extension.pointer).toBe('none');
    if(width<768)await expect(page.locator('.tt-mobile-brand-ink')).toHaveCSS('flood-color','rgb(255, 255, 255)');
    else {
      const logo=header.locator('.tt-logo-img,.tt-tablet-logo-img');
      await expect(logo).toHaveAttribute('src',/\/images\/general\/logo\.png\?v=/);
      await expect(logo).toHaveCSS('filter','brightness(0) invert(1)');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:`artifacts/local-close/header-tones-${width}.png`});
  });
}
for (const width of [390, 1440]) test(`bloques entre wrappers llenan el ancho y alternan al ocultar secciones en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<style>${styles}body{margin:0}.cat-wrap{max-width:800px;margin:auto;padding:24px}.cat-hero{height:160px;border-radius:24px;margin-bottom:32px}.cat-layout{height:200px}.tt-footer{height:140px}.white-card{background:white;height:60px;width:120px}</style><body><div class="cat-wrap"><section class="cat-hero"><h1>Catálogo</h1></section><section id="hidden-block" hidden>Oculto</section><div class="cat-layout"><article class="white-card">Tarjeta blanca</article></div></div><footer class="tt-footer">Pie</footer><section role="dialog">Panel</section></body>`);
  await page.addScriptTag({ content: runtime });
  const sequence = () => page.evaluate(() => [...document.querySelectorAll('[data-tt-flow-block]')].map(node => ({ flow: node.dataset.ttFlowBlock, left: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().left, width: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().width, start: getComputedStyle(node).getPropertyValue('--tt-section-start'), end: getComputedStyle(node).getPropertyValue('--tt-section-end') })));
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink', 'light']);
  for (const row of await sequence()) { expect(Math.abs(row.left)).toBeLessThan(1); expect(row.width).toBe(width); }
  const rows = await sequence(); expect(rows[0].end).toBe(rows[1].start); expect(rows[1].end).toBe(rows[2].start);
  await expect(page.locator('.white-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.locator('.cat-layout').evaluate(node => { node.hidden = true; });
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

for (const width of [390, 1024, 1440]) {
  test(`identidad tipográfica compartida en las páginas completas · ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const pages = fs.readdirSync(root).filter(file => file.endsWith('.html') && !file.startsWith('google'));
    const inventory = [];
    for (const file of pages) {
      await page.route('**/__identity-page', route => route.fulfill({
        // Nosotros es un alias con meta-refresh; se revisa su destino canónico.
        contentType: 'text/html', body: removeFixtureScripts(fs.readFileSync(path.join(root, file === 'nosotros.html' ? 'about.html' : file), 'utf8'), { removeModulePreloads: true }),
      }));
      await page.goto('/__identity-page');
      await page.evaluate(() => document.fonts.ready);
      const headings = await page.locator('h1,h2,h3').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { text: node.textContent.trim(), weight: style.fontWeight, font: style.fontFamily };
      }));
      for (const heading of headings) {
        expect(heading.font, `${file}: ${heading.text}`).toContain('Montserrat');
        expect(heading.weight, `${file}: ${heading.text}`).toBe('600');
      }
      inventory.push({ file, headings });
      await page.unroute('**/__identity-page');
    }
    expect(inventory).toHaveLength(18);
    await info.attach('identidad-18-paginas', { body: JSON.stringify(inventory), contentType: 'application/json' });
  });
}
const html = removeFixtureScripts(fs.readFileSync('perfil.html', 'utf8'));
const flow = runtime;
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`perfil conserva tarjetas blancas y controles descubiertos · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/__profile-surfaces', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/__profile-surfaces');
    await page.locator('#perfil-nombre-display').evaluate(el => { el.textContent = 'TINTIN ACCESORIOS Y RELOJES'; });
    await page.locator('.perfil-card').first().evaluate(el => el.classList.add('tt-visual-block'));
    await page.addScriptTag({ content: flow });
    await expect(page.locator('.tt-profile-hero')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.perfil-card').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (const button of await page.locator('[data-profile-tab]').all()) {
      await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(el => {
        const b = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const title = await page.locator('#perfil-nombre-display').boundingBox();
    expect(title.x).toBeGreaterThanOrEqual(0);
    expect(title.x + title.width).toBeLessThanOrEqual(width);
  });
}

const profileHtml=removeFixtureScripts(fs.readFileSync('perfil.html','utf8'));
for(const width of [320,390,768,1024,1440,1920]) test(`perfil muestra pestañas completas sobre las transiciones en ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/__profile-flow',r=>r.fulfill({contentType:'text/html',body:profileHtml}));
 await page.goto('/__profile-flow');await page.addScriptTag({content:runtime});
 await expect(page.locator('.tt-profile-tabs')).toHaveCSS('position','relative');
 const tabs=page.locator('[data-profile-tab]');
 for(let i=0;i<await tabs.count();i++){
  await tabs.nth(i).scrollIntoViewIfNeeded();
  expect(await tabs.nth(i).evaluate(n=>{const r=n.getBoundingClientRect();return [0.2,0.8].every(y=>n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height*y)));})).toBe(true);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('insertar tarjetas sin cambiar el tamaño no vuelve a medir todas las secciones', async ({ page }) => {
  await page.setContent('<main><section id="products" style="height:200px;overflow:hidden"></section><section style="height:200px">Otra sección</section></main>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await page.waitForTimeout(150);
  const reads = await page.evaluate(async () => {
    window.__flowGeometryReads = 0;
    document.querySelectorAll('section').forEach(node => {
      const measure = node.getBoundingClientRect.bind(node);
      node.getBoundingClientRect = () => { window.__flowGeometryReads++; return measure(); };
    });
    for (let i = 0; i < 25; i++) {
      document.getElementById('products').append(document.createElement('article'));
      await new Promise(requestAnimationFrame);
    }
    return window.__flowGeometryReads;
  });
  expect(reads).toBe(0);
  await page.locator('#products').evaluate(node => { node.style.height = '300px'; });
  await expect.poll(() => page.evaluate(() => window.__flowGeometryReads)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.textContent = 'Nueva sección'; section.style.height = '100px';
    document.querySelector('main').append(section);
  });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(3);
});

test('scripts, diálogos fijos y clases repetidas no vuelven a medir el flujo; una clase real sí lo actualiza', async ({ page }) => {
  await page.setContent('<style>section{height:100px}#later{visibility:hidden}body.reveal #later{visibility:visible}</style><body class="ready"><main><section>Visible</section><section id="later">Oculta</section></main></body>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(1);
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__flowStartupReads = 0;
    document.querySelectorAll('section').forEach(node => {
      const rect = node.getBoundingClientRect.bind(node);
      node.getBoundingClientRect = () => { window.__flowStartupReads++; return rect(); };
    });
  });
  await page.evaluate(async () => {
    for (let i=0; i<20; i++) {
      const script = document.createElement('script'); script.type='application/json'; script.textContent='{}'; document.body.append(script);
      const dialog = document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.style.position='fixed'; document.body.append(dialog);
      document.body.classList.add('ready');
      await new Promise(requestAnimationFrame);
    }
  });
  expect(await page.evaluate(() => window.__flowStartupReads)).toBe(0);
  await page.evaluate(() => document.body.classList.add('reveal'));
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await expect(page.locator('#later')).toHaveAttribute('data-tt-flow-block', 'pink');
});

test('medir sin cambios no reescribe los tonos de las superficies', async ({ page }) => {
  await page.setContent('<main><section id="first" style="height:100px">Primera</section><section id="second" style="height:100px">Segunda</section></main>');
  await page.addScriptTag({ content: runtime });
  await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
  await page.waitForTimeout(150);
  const writes = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['data-tt-flow-block'] });
    for (let i=0;i<10;i++) {
      window.TintinSectionFlow.refresh();
      await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    observer.disconnect(); return count;
  });
  expect(writes).toBe(0);
  await page.locator('#first').evaluate(node => { node.hidden=true; });
  await expect(page.locator('#second')).toHaveAttribute('data-tt-flow-block', 'light');
});

for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]) {
  test(`login revelado desde html recupera sus superficies sin resize ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    const loginGate=fs.readFileSync('login.html','utf8').match(/<style>(html\.login-auth-pending[\s\S]*?)<\/style>/)[1];
    await page.setContent(`<style>${styles}${loginGate}body{margin:0}.login-page{height:240px}.tt-footer{height:100px}</style><main class="login-page">Acceso</main><footer class="tt-footer">Pie</footer>`);
    await page.evaluate(()=>document.documentElement.classList.add('login-auth-pending'));
    await page.addScriptTag({content:runtime});
    await expect(page.locator('[data-tt-flow-block]')).toHaveCount(0);
    await page.waitForTimeout(100);
    await page.evaluate(()=>document.documentElement.classList.remove('login-auth-pending'));
    await expect(page.locator('.login-page')).toHaveAttribute('data-tt-flow-block','light');
    await expect(page.locator('.tt-footer')).toHaveAttribute('data-tt-flow-block','pink');
    await page.evaluate(()=>document.documentElement.classList.add('login-auth-pending'));
    await expect(page.locator('[data-tt-flow-block]')).toHaveCount(0);
    await page.evaluate(()=>document.documentElement.classList.remove('login-auth-pending'));
    await expect(page.locator('[data-tt-flow-block]')).toHaveCount(2);
    await expect(page.locator('[data-tt-flow-background]')).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

// Regresion de transparencia compartida por todos los encabezados.
{
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
   const bottom=await header.evaluate(n=>Math.ceil(n.getBoundingClientRect().bottom-Math.min(0,parseFloat(getComputedStyle(n,'::before').bottom))));
   const pixels=await pixelsAt(page,{x:8,y:48,width:1,height:bottom-48+52});
   let jump=0;for(let y=1;y<pixels.length/4;y++)for(let c=0;c<3;c++)jump=Math.max(jump,Math.abs(pixels[y*4+c]-pixels[(y-1)*4+c]));
   expect(jump,`${surface} sobre ${tone}: no debe haber una línea de corte`).toBeLessThan(18);
   expect(layer.mask).toContain('linear-gradient');expect(layer.blur).toContain('blur(18px)');expect(layer.pointer).toBe('none');
   const expected=tone.match(/[a-f0-9]{2}/g).map(x=>parseInt(x,16));
   expect(pixels.slice(-4,-1),`${surface}: el extremo debe revelar exactamente el fondo`).toEqual(expected);
  }
  await page.evaluate(()=>scrollTo(0,500));await header.evaluate(n=>n.style.transform='translateY(calc(-100% - var(--tt-header-fade-depth, 0px) - 12px))');
  expect((await pixelsAt(page,{x:8,y:0,width:1,height:1})).slice(0,3),'ocultar el header no debe dejar un halo').toEqual([48,56,70]);
  await header.evaluate(n=>{n.style.transform='';n.classList.add('scrolled');});
  await expect(header).toBeVisible();await header.locator('button').click();await expect(header.locator('button')).toHaveAttribute('data-clicked','yes');
  await expect(header).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(header).toHaveCSS('backdrop-filter','none');
  expect(await header.evaluate(n=>getComputedStyle(n).filter)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }
});

}
