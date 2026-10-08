const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js','utf8');
const functions = source.slice(source.indexOf('function formatPrice'), source.indexOf('function normalizeClassicCart')) +
  source.slice(source.indexOf('function productVariantGroups'),source.indexOf('function _showProductNotFound')) +
  source.slice(source.indexOf('function _pdSelectedValues'),source.indexOf('function _galleryThumbClick')) +
  source.slice(source.indexOf('function _galleryThumbClick'),source.indexOf('async function _addToCartWithQty')) +
  source.slice(source.indexOf('function selectVariant'),source.indexOf('/*',source.indexOf('function selectVariant')));
// Sólo el renderer real de galería y selección; ningún SDK ni escritura.
const harness = `let _pdGalleryImages=[],_pdGalleryIndex=0,_pdQty=1,_pdMaxQty=99,_pdLoadTimer=null;let _pdProduct={id:'fixture',name:'Fotos por color',stock:10,variants:{Color:['Dorado','Plateado']},imageUrl:'/gold1.svg',imagesExtra:['/gold1.svg','/gold2.svg','/gold3.svg','/silver1.svg','/silver2.svg','/silver3.svg'],variantMedia:[{Color:'Dorado',imageUrls:['/gold1.svg','/gold2.svg','/gold3.svg']},{Color:'Plateado',imageUrls:['/silver1.svg','/silver2.svg','/silver3.svg']}]};
function getProductImage(){return ''}function _injectProductJsonLd(){}function _updateProductMeta(){}function _pdUpdateQtyUI(){}function _openLightbox(images){window.lightboxImages=images}${functions}
_renderProductDetail(_pdProduct);window.fixtureReady=true;`;
const fixture = `<!doctype html><html lang="es"><head><link rel="stylesheet" href="/css/pages/checkout/checkout.css"><link rel="stylesheet" href="/css/pages/checkout/checkout-maintenance.css"><link rel="stylesheet" href="/css/admin/admin.css"><style>body{margin:20px;font-family:Arial}#gallery-main{width:min(400px,100%);height:260px}#gallery-thumbs{display:flex;gap:8px}.tt-gallery-thumb{width:64px;height:64px}.ck-body{display:none}</style></head><body>
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
  await page.getByRole('button',{name:'Dorado',exact:true}).click();await expect(page.locator('#gallery-thumbs button')).toHaveCount(3);
  await page.getByRole('button',{name:'Ver imagen 3',exact:true}).click();await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/gold3.svg$/);
  await page.getByRole('button',{name:'Plateado',exact:true}).click();await expect(page.locator('#gallery-thumbs button')).toHaveCount(3);await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/silver1.svg$/);
  await page.getByRole('button',{name:'Ampliar',exact:true}).click();expect(await page.evaluate(()=>window.lightboxImages.length)).toBe(3);
  const rows=await page.evaluate(()=>window.editor.serialize());expect(rows.map(r=>r.imageUrls.length)).toEqual([3,3]);
  await page.getByRole('checkbox',{name:'Asignar foto 3 a Dorado',exact:true}).uncheck();
  expect((await page.evaluate(()=>window.editor.serialize()))[0].imageUrls).toHaveLength(2);
  await page.getByRole('button',{name:'Elegir foto de biblioteca para Dorado',exact:true}).click();
  expect((await page.evaluate(()=>window.editor.serialize()))[0].imageUrls).toHaveLength(3);
  const tops=await page.locator('.ck-step-num').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
