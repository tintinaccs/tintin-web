const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js','utf8');
const functions = source.slice(source.indexOf('function formatPrice'), source.indexOf('function normalizeClassicCart')) +
  source.slice(source.indexOf('function productVariantGroups'),source.indexOf('function _showProductNotFound')) +
  source.slice(source.indexOf('function productSpecDisplayValue'),source.indexOf('async function _copyProductLink')) +
  source.slice(source.indexOf('function _pdSelectedValues'),source.indexOf('function _galleryThumbClick')) +
  source.slice(source.indexOf('function _galleryThumbClick'),source.indexOf('async function _addToCartWithQty')) +
  source.slice(source.indexOf('function selectVariant'),source.indexOf('/*',source.indexOf('function selectVariant')));
// Sólo el renderer real de galería y selección; ningún SDK ni escritura.
const harness = `let _pdGalleryImages=[],_pdGalleryIndex=0,_pdQty=1,_pdMaxQty=99,_pdLoadTimer=null;let _pdProduct={id:'fixture',name:'Fotos por color',price:100000,stock:10,variants:{Color:['Dorado','Plateado']},imageUrl:'/gold1.svg',imagesExtra:['/gold1.svg','/gold2.svg','/gold3.svg','/silver1.svg','/silver2.svg','/silver3.svg'],variantMedia:[{Color:'Dorado',imageUrls:['/gold1.svg','/gold2.svg','/gold3.svg']},{Color:'Plateado',imageUrls:['/silver1.svg','/silver2.svg','/silver3.svg']}]};
function getProductImage(){return ''}function _injectProductJsonLd(){}function _updateProductMeta(){}function _pdUpdateQtyUI(){}function _openLightbox(images){window.lightboxImages=images}${functions}
_renderProductDetail(_pdProduct);window.fixtureReady=true;`;
const fixture = `<!doctype html><html lang="es"><head><link rel="stylesheet" href="/css/pages/checkout/checkout.css"><link rel="stylesheet" href="/css/pages/checkout/checkout-maintenance.css"><link rel="stylesheet" href="/css/admin/admin.css"><style>body{margin:20px;font-family:Montserrat}#gallery-main{width:min(400px,100%);height:260px}#gallery-thumbs{display:flex;gap:8px}.tt-gallery-thumb{width:64px;height:64px}.ck-body{display:none}</style></head><body>
<div class="ck-body"></div><div class="ck-steps">${['Carrito','Envío','Datos','Pago','Confirmación'].map((name,i)=>`<div class="ck-step"><div class="ck-step-num">${i+1}</div><div class="ck-step-label">${name}</div></div>`).join('')}</div>
<button id="gallery-main" aria-label="Ampliar"></button><div id="product-variants"><div class="tt-product-variants" data-variant-key="Color"><div class="tt-variant-options"><button class="tt-variant-option">Dorado</button><button class="tt-variant-option">Plateado</button></div></div></div><div id="gallery-thumbs"></div>
<h2>Super Admin: asignación de fotos</h2><textarea id="options">Color: Dorado\nColor: Plateado</textarea><textarea id="extras">/gold1.svg\n/gold2.svg\n/gold3.svg\n/silver1.svg\n/silver2.svg\n/silver3.svg</textarea><input id="main" value="/gold1.svg"><div id="editor"></div>
<script src="/js/components/images/galeria-producto.js"></script><script src="/gallery-fixture.js"></script><script type="module">import {attachColorPhotos} from '/js/admin/products/fotos-por-color.js';window.editor=attachColorPhotos({container:document.getElementById('editor'),product:_pdProduct,variantsInput:document.getElementById('options'),imagesInput:document.getElementById('extras'),mainInput:document.getElementById('main'),openLibrary:async()=>'/gold4.svg'});window.editorReady=true;</script></body></html>`;
for(const width of [320,390,709,768,1024,1440,1920]) test(`galería y editor de tres fotos por color en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/color-gallery-fixture',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.route('**/gallery-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="40" fill="${r.request().url().includes('gold')?'gold':'silver'}"/></svg>`}));
  await page.goto('/color-gallery-fixture');await page.waitForFunction(()=>window.fixtureReady&&window.editorReady);
  await expect(page.locator('#gallery-thumbs button')).toHaveCount(6);
  await page.getByRole('button',{name:'Dorado',exact:true}).click();await expect(page.locator('#gallery-thumbs button')).toHaveCount(6);
  await page.getByRole('button',{name:'Ver imagen 3',exact:true}).click();await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/gold3.svg$/);
  await page.getByRole('button',{name:'Plateado',exact:true}).click();await expect(page.locator('#gallery-thumbs button')).toHaveCount(6);await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/silver1.svg$/);
  await expect(page.locator('#gallery-thumbs button.active')).toHaveAttribute('data-src',/silver1.svg$/);
  await page.getByRole('button',{name:'Ver imagen 2',exact:true}).click();await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/gold2.svg$/);
  await expect(page.getByRole('button',{name:'Dorado',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#gallery-thumbs button')).toHaveCount(6);
  await page.getByRole('button',{name:'Ampliar',exact:true}).click();expect(await page.evaluate(()=>window.lightboxImages.length)).toBe(6);
  const rows=await page.evaluate(()=>window.editor.serialize());expect(rows.map(r=>r.imageUrls.length)).toEqual([3,3]);
  expect(await page.evaluate(()=>window.editor.serialize().some(row=>Object.values(row).some(value=>value===undefined)))).toBe(false);
  await page.getByRole('checkbox',{name:'Asignar foto 3 a Dorado',exact:true}).uncheck();
  expect((await page.evaluate(()=>window.editor.serialize()))[0].imageUrls).toHaveLength(2);
  await page.getByRole('button',{name:'Elegir foto de biblioteca para Dorado',exact:true}).click();
  expect((await page.evaluate(()=>window.editor.serialize()))[0].imageUrls).toHaveLength(3);
  const tops=await page.locator('.ck-step-num').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('el inventario conserva sus colores y destruir el editor cancela la detección pendiente',async({page})=>{
  const lockedFixture=fixture.replace('product:_pdProduct,','product:{..._pdProduct,variantMedia:[]},').replace('<textarea id="options">','<textarea id="options" readonly>');
  await page.route('**/color-gallery-fixture',r=>r.fulfill({contentType:'text/html',body:lockedFixture}));
  await page.route('**/gallery-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
  let finishPhoto;
  await page.route(/\/(gold|silver)\d\.svg$/,async r=>{
    if (!finishPhoto) await new Promise(resolve=>{finishPhoto=resolve;});
    await r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="40" fill="blue"/></svg>'}).catch(()=>{});
  });
  await page.goto('/color-gallery-fixture',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.editorReady);
  await expect(page.getByRole('combobox',{name:'Paleta de colores',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.editor.destroy());finishPhoto?.();
  await expect(page.locator('#editor')).toBeEmpty();
  expect((await page.evaluate(()=>window.editor.serialize())).map(row=>row.Color)).toEqual(['Dorado','Plateado']);
});

const productHtml = fs.readFileSync('product.html', 'utf8');
const styleLinks = [...productHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('');
const productSectionStart = productHtml.indexOf('<section class="tt-product-page"');
const productSection = productHtml.slice(productSectionStart, productHtml.indexOf('</section>', productSectionStart) + '</section>'.length);
const minimalFixture = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styleLinks}<link rel="stylesheet" href="/css/pages/product/product-maintenance.css"></head><body class="tt-product-maintenance tt-product-runtime-ready">${productSection}<script src="/js/components/images/galeria-producto.js"></script><script src="/gallery-fixture.js"></script></body></html>`;
for (const width of [320,390,709,768,1024,1280,1440,1920]) test(`ficha real minimalista, orden y controles en ${width}px`, async ({page}) => {
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.setViewportSize({width,height:1000});
  await page.route('**/minimal-product-fixture',r=>r.fulfill({contentType:'text/html',body:minimalFixture}));
  await page.route('**/gallery-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="130" fill="${r.request().url().includes('gold')?'gold':'silver'}"/></svg>`}));
  await page.goto('/minimal-product-fixture',{waitUntil:'domcontentloaded'});expect(pageErrors).toEqual([]);await page.waitForFunction(()=>window.fixtureReady,{},{timeout:5000});
  const geometry = await page.evaluate(() => {
    const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}; };
    return {main:rect('#gallery-main'),thumbs:rect('#gallery-thumbs'),colors:rect('#product-variants'),panel:rect('.tt-product-info-panel'),actions:[rect('#btn-product-add-cart'),rect('#btn-product-buy-now')],overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(geometry.main.bottom).toBeLessThanOrEqual(geometry.thumbs.top);
  expect(geometry.thumbs.bottom).toBeLessThanOrEqual(geometry.colors.top);
  expect(geometry.overflow).toBe(false);
  expect(geometry.main.left).toBeGreaterThanOrEqual(16);
  expect(geometry.main.right).toBeLessThanOrEqual(width-16);
  expect(await page.locator('.tt-product-info-panel').evaluate(node=>getComputedStyle(node).boxShadow)).toBe('none');
  expect(await page.locator('.tt-product-info-panel').evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('0px');
  for (const button of geometry.actions) {
    expect(button.left).toBeGreaterThanOrEqual(geometry.panel.left-1);expect(button.right).toBeLessThanOrEqual(geometry.panel.right+1);expect(button.height).toBeGreaterThanOrEqual(52);
  }
  const circle = page.getByRole('button',{name:'Dorado',exact:true});
  expect(await circle.evaluate(node=>getComputedStyle(node).borderRadius)).toBe('50%');
  expect(await circle.locator('.tt-variant-name').evaluate(node=>getComputedStyle(node).clipPath)).toBe('inset(50%)');
  // Elegir una foto primero selecciona su color y conserva la miniatura activa.
  await page.getByRole('button',{name:'Ver imagen 5',exact:true}).click();
  await expect(page.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/silver2.svg$/);
  await expect(page.locator('#gallery-thumbs button.active')).toHaveAttribute('data-src',/\/silver2.svg$/);
  await expect(page.locator('#gallery-thumbs button.active')).toBeFocused();
  expect(await page.evaluate(()=>_pdGetSelectedVariant())).toBe('Plateado');
});

test('las sugerencias agrupan varias fotos y respetan el cambio manual',async({page})=>{
  const autoFixture=fixture.replace('product:_pdProduct,','product:{..._pdProduct,variantMedia:[]},');
  await page.route('**/color-gallery-fixture',r=>r.fulfill({contentType:'text/html',body:autoFixture}));
  await page.route('**/gallery-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="40" fill="${r.request().url().includes('gold')?'gold':'silver'}"/></svg>`}));
  await page.goto('/color-gallery-fixture');await page.waitForFunction(()=>window.editorReady&&window.editor.serialize().every(row=>row.imageUrls.length===3));
  const rows=await page.evaluate(()=>window.editor.serialize());
  expect(rows[0].imageUrls.every(url=>url.includes('gold'))).toBe(true);expect(rows[1].imageUrls.every(url=>url.includes('silver'))).toBe(true);
  await page.getByRole('checkbox',{name:'Asignar foto 1 a Dorado',exact:true}).uncheck();
  await page.getByRole('checkbox',{name:'Asignar foto 1 a Plateado',exact:true}).check();
  await page.evaluate(()=>window.editor.refresh());
  expect((await page.evaluate(()=>window.editor.serialize()))[0].imageUrls).toHaveLength(2);
  expect((await page.evaluate(()=>window.editor.serialize()))[1].imageUrls).toHaveLength(4);
});

test('paleta administrativa y reemplazo manual se conservan al serializar',async({page})=>{
  await page.route('**/color-gallery-fixture',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.route('**/gallery-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="40" fill="gold"/></svg>'}));
  await page.goto('/color-gallery-fixture');await page.waitForFunction(()=>window.editorReady);
  await page.getByRole('combobox',{name:'Aspecto del círculo de Dorado',exact:true}).selectOption('dorado');
  expect((await page.evaluate(()=>window.editor.serialize()))[0].swatch).toBe('dorado');
  await page.getByRole('combobox',{name:'Paleta de colores',exact:true}).selectOption('fucsia');
  await page.getByRole('button',{name:'Agregar color',exact:true}).click();
  expect((await page.evaluate(()=>window.editor.serialize())).map(row=>row.Color)).toContain('fucsia');
  await page.getByRole('checkbox',{name:'Asignar foto 1 a fucsia',exact:true}).check();
  expect((await page.evaluate(()=>window.editor.serialize())).find(row=>row.Color==='fucsia').imageUrls.some(url=>url.endsWith('/gold1.svg'))).toBe(true);
});
