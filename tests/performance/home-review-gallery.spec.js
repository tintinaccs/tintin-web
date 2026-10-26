const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const html = removeFixtureScripts(fs.readFileSync('index.html', 'utf8'), { removeModulePreloads: true });
const runtime = fs.readFileSync('js/pages/home/resenas-clientas.js', 'utf8');

for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  test(`reseñas reales: cuatro imágenes y galería accesible sin cargarla antes de abrir · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/__home-reviews', route => route.fulfill({ contentType: 'text/html', body: html }));
    const requested = [];
    page.on('request', request => {
      if (request.url().includes('/resenas-clientas/') && request.url().endsWith('.jpg')) requested.push(request.url());
    });
    await page.goto('/__home-reviews');
    await page.addScriptTag({ content: runtime });
    const preview = page.locator('.tt-reviews-section .tt-review-screen img');
    await expect(preview).toHaveCount(4);
    const more = page.getByRole('button', { name: 'Ver más reseñas' });
    await more.scrollIntoViewIfNeeded();
    await expect.poll(() => preview.evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(requested.length).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await more.click();
    const dialog = page.locator('#tt-reviews-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-reviews-content] img')).toHaveCount(23);
    const close = dialog.getByRole('button', { name: 'Cerrar reseñas' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    // El diálogo nativo también permite pasar a la barra del navegador;
    // nunca debe enviar el foco a un enlace de la página de fondo.
    expect(await dialog.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
    await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect(await close.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.right <= innerWidth && node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(more).toBeFocused();
    await more.click();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(more).toBeFocused();
    await expect(dialog.locator('[data-reviews-content] img')).toHaveCount(23);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    const imageButton=page.getByRole('button',{name:'Reseña de una clienta de Tintin, captura 1. Ampliar reseña',exact:true});
    await imageButton.click();await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');await expect(imageButton).toBeFocused();
    await page.keyboard.press('Enter');await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');await expect(imageButton).toBeFocused();
  });
}

for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
  test(`ampliar la reseña tocada y navegar sin perder foco · ${width}`, async ({page},info) => {
    await page.setViewportSize({width,height});
    await page.route('**/__home-reviews',route=>route.fulfill({contentType:'text/html',body:html}));
    await page.goto('/__home-reviews');await page.addScriptTag({content:runtime});
    const trigger=page.locator('.tt-reviews-section .tt-review-screen button').nth(2);
    const src=await trigger.locator('img').getAttribute('src');
    await trigger.click();const dialog=page.locator('#tt-reviews-dialog');
    const enlarged=dialog.locator('[data-review-enlarged]');
    await expect(enlarged).toBeVisible();await expect(enlarged).toHaveAttribute('src',src);
    await expect(enlarged).toHaveCSS('object-fit','contain');
    await expect(dialog.getByRole('button',{name:'Cerrar reseñas'})).toBeFocused();
    await page.keyboard.press('ArrowRight');await expect(enlarged).not.toHaveAttribute('src',src);
    await page.keyboard.press('ArrowLeft');await expect(enlarged).toHaveAttribute('src',src);
    await dialog.getByRole('button',{name:'Reseña siguiente',exact:true}).click();
    expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`review-enlarged-${width}.png`)});
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe('');
    await page.getByRole('button',{name:'Ver más reseñas'}).click();
    const item=dialog.locator('.tt-review-screen button').first();const itemSrc=await item.locator('img').getAttribute('src');
    await item.click();await expect(enlarged).toHaveAttribute('src',itemSrc);
  });
}

test('portada de colección se revalida aun con caché reciente y conserva respaldo sin red',async({page})=>{
  await page.route('**/__collection-metadata',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Metadata sintética</title></html>'}));
  await page.goto('/__collection-metadata');
  const result=await page.evaluate(async()=>{
    const moduleUrl='/js/pages/collections/datos-publicos-colecciones.js';
    const {loadCollections,CACHE_KEY}=await import(moduleUrl);
    const cacheUrl='/js/core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
    const {writeCached}=await import(cacheUrl);
    writeCached(CACHE_KEY,[{slug:'aros',name:'Aros',image:'https://img.test/old.webp',order:1}]);
    let calls=0;const original=window.fetch;
    window.fetch=async()=>{calls++;return new Response(JSON.stringify({ok:true,resource:'collections',items:[{id:'aros',data:{name:'Aros',image:'https://img.test/new.webp'}}]}),{status:200,headers:{'content-type':'application/json'}});};
    const emissions=[];const rows=await loadCollections({onData:(list,source)=>emissions.push({image:list[0].image,source})});
    window.fetch=async()=>{throw Error('offline');};
    const offline=await loadCollections();window.fetch=original;
    return {calls,rows,emissions,offline};
  });
  expect(result.calls).toBe(1);expect(result.emissions[0].image).toBe('https://img.test/old.webp');
  expect(result.rows[0].image).toBe('https://img.test/new.webp');expect(result.offline[0].image).toBe('https://img.test/new.webp');
});

test('catálogo usa caché sin esperar red y encabezado recibe la portada revalidada',async({page})=>{
  await page.route('https://img.test/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')}));
  await page.route('**/catalogo?__collection-header',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><nav data-collections-nav="desktop"></nav></html>'}));
  await page.goto('/catalogo?__collection-header');
  await page.route('**/js/cargador-mantenimiento-pagina.js*',route=>route.fulfill({contentType:'application/javascript',body:''}));
  const policySpecifier=fs.readFileSync('js/core/store/estado-productos.js','utf8').split('\n').find(line=>line.includes('{ catalogVisibilityReady }')).split("'")[1];
  await page.evaluate(async(policySpecifier)=>{
    const cacheUrl='/js/core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
    const {writeCached}=await import(cacheUrl);
    writeCached('collections:public:unified-v2',[{slug:'aros',name:'Aros',image:'https://img.test/old.webp',order:1}]);
    window.phase6Items=[{id:'qa-ear',name:'Aro',category:'aros',price:30000,stock:2,active:true},{id:'qa-watch',name:'Reloj',category:'relojes',price:40000,stock:2,active:true}];
    window.productReads=0;
    window.fetch=(resource)=>String(resource).includes('resource=collections') ? new Promise(resolve=>{window.releaseMetadata=()=>resolve(Response.json({ok:true,resource:'collections',items:[{id:'aros',data:{name:'Aros',image:'https://img.test/new.webp'}},{id:'relojes',data:{name:'Relojes'}}]}));}) : Promise.resolve(Response.json({ok:true,resource:'products',items:(window.productReads++,window.phase6Items.map(({id,...data})=>({id,data})))}));
    const navUrl='/js/components/navigation/compartido/carga-colecciones.js';
    const {initNavCollections}=await import(navUrl);window.headerReady=initNavCollections();
    const storeUrl=new URL('/js/core/store/estado-productos.js',location.origin);
    await import(storeUrl.href);
    await window.TintinProductsStore.loadAll();
    const {catalogVisibilityReady}=await import(new URL(policySpecifier,storeUrl).href);
    window.policyReady=false;catalogVisibilityReady.then(()=>{window.policyReady=true;});
  },policySpecifier);
  await expect.poll(()=>page.evaluate(()=>window.policyReady)).toBe(true);
  expect(await page.evaluate(()=>window.PRODUCTS.map(item=>item.id))).toEqual(['qa-ear']);
  // La fuente canónica cambia mientras sigue pendiente la metadata. El aro
  // eliminado no debe reaparecer y el reloj debe recuperarse al hacerse visible.
  await page.evaluate(async()=>{window.phase6Items=[{id:'qa-watch',name:'Reloj',category:'relojes',price:40000,stock:3,active:true}];await window.TintinProductsStore.loadAll({force:true});});
  expect(await page.evaluate(()=>window.PRODUCTS)).toEqual([]);
  const image=page.locator('[data-collections-nav="desktop"] img').first();
  await expect(image).toHaveAttribute('src','https://img.test/old.webp');
  await page.evaluate(async()=>{window.releaseMetadata();await window.headerReady;});
  await expect(image).toHaveAttribute('src','https://img.test/new.webp');
  await expect.poll(()=>page.evaluate(()=>window.PRODUCTS.map(item=>({id:item.id,stock:item.stock})))).toEqual([{id:'qa-watch',stock:3}]);
  expect(await page.evaluate(()=>window.productReads)).toBeGreaterThanOrEqual(3);
});
