const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js', 'utf8');
const renderer = source.slice(source.indexOf('const cardColorSelections'), source.indexOf('function renderProductsGrid'));
const media = source.slice(source.indexOf('function productVariantGroups'), source.indexOf('function _pdSyncVariantToImage'));
const harness = `
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeAttribute=escapeHtml;
const sanitizeClassicImageUrl=value=>value||'';
const isInStock=p=>p.stock!==0, getProductImage=()=>'', priceMarkup=()=>'<span>Gs. 100.000</span>',heartIconMarkup=()=>'';
${media}
${renderer}
const product={id:'fixture',name:'Colores reales',variants:{Color:['Dorado','Plateado']},imageUrl:'/gold1.svg',variantMedia:[{Color:'Dorado',imageUrls:['/gold1.svg','/gold2.svg'],colorHex:'#123ABC'},{Color:'Plateado',imageUrls:['/silver1.svg']}]};
function paint(){document.getElementById('cards').innerHTML=renderProductCardMarkup(product);}
paint();window.paint=paint;window.paintOnlySilver=()=>{product.stock=2;product.variantInventory=[{variant:'Dorado',stock:0},{variant:'Plateado',stock:2}];paint();};window.paintSoldOut=()=>{product.stock=0;paint();};`;
for(const width of [320,390,768,1024,1280,1440,1920]) test(`tarjeta cambia foto inmediatamente y conserva color en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/card-color-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.min.css"><link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"><link rel="stylesheet" href="/css/theme/sistema-superficies-tintin.css"><style>body{margin:16px}.tt-product-card{max-width:300px}.tt-product-img-real{width:100%}.tt-card-color{width:44px;height:44px}.tt-color-swatch{display:block;width:24px;height:24px;border-radius:50%}</style></head><body><div id="cards"></div><script src="/js/components/images/galeria-producto.js"></script><script src="/card-color-harness.js"></script></body></html>`}));
  await page.route('**/card-color-harness.js',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:harness}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'}));
  await page.goto('/card-color-fixture');
  await expect(page.getByRole('button',{name:'Dorado',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.getByRole('button',{name:'Dorado',exact:true}).locator('span').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(18, 58, 188)');
  await page.getByRole('button',{name:'Plateado',exact:true}).click();
  await expect(page.locator('.tt-product-img-real')).toHaveAttribute('src',/silver1.svg$/);
  await expect(page.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>window.paint());
  await expect(page.locator('.tt-product-img-real')).toHaveAttribute('src',/silver1.svg$/);
  await expect(page.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Dorado',exact:true}).click();
  await expect(page.locator('.tt-product-img-real')).toHaveAttribute('src',/gold1.svg$/);
  const image=page.locator('.tt-product-img-real');
  await expect(image).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('.tt-product-info')).toHaveCSS('border-top-style','solid');
  await expect(page.locator('.tt-product-info')).toHaveCSS('border-top-width','1px');
  await expect(image).toHaveCSS('opacity','1');
  await page.evaluate(()=>window.paintOnlySilver());
  await expect(image).toHaveAttribute('src',/silver1.svg$/);
  await expect(page.getByRole('button',{name:'Dorado — Agotado',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.paintSoldOut());
  const label=page.locator('.tt-stock-label');
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS('writing-mode','horizontal-tb');
  await expect(label).toHaveCSS('background-color','rgb(229, 231, 235)');
  await expect(label).toHaveCSS('color','rgb(75, 85, 99)');
  await expect(image).toHaveCSS('opacity','0.55');
  const geometry=await label.evaluate(label=>{const a=label.getBoundingClientRect(),b=label.parentElement.getBoundingClientRect();return {x:Math.abs(a.x+a.width/2-b.x-b.width/2),y:Math.abs(a.y+a.height/2-b.y-b.height/2),font:parseFloat(getComputedStyle(label).fontSize)};});
  expect(geometry.x).toBeLessThanOrEqual(1);expect(geometry.y).toBeLessThanOrEqual(1);expect(geometry.font).toBeGreaterThanOrEqual(14);
  await page.evaluate(()=>{const card=document.querySelector('.tt-product-card');card.className='tt-card tt-stock-unavailable';card.querySelector('.tt-product-img').className='tt-card-img-wrap';card.querySelector('.tt-product-info').className='tt-card-info';});
  await expect(page.locator('.tt-card-info')).toHaveCSS('border-top-width','1px');
  await expect(page.locator('.tt-card-img-wrap')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await image.evaluate(img=>img.className='');
  await expect(page.locator('.tt-card-img-wrap img')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(label).toBeVisible();
  expect(errors).toEqual([]);
});

for(const width of [320,768,1440]) test(`catálogo muestra colores y cambia foto/enlaces en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/catalog-color-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.min.css"><link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"><link rel="stylesheet" href="/css/theme/sistema-superficies-tintin.css"><style>body{margin:16px}.tt-card{max-width:300px}.tt-card-img-wrap img{width:100%}</style></head><body><div id="cards"></div><script src="/js/components/images/galeria-producto.js"></script><script src="/card-color-harness.js"></script></body></html>`}));
  await page.route('**/card-color-harness.js',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:harness.replace('paint();window.paint=paint;','')+`
document.getElementById('cards').innerHTML='<article class="tt-card" data-product-id="fixture"><a href="product.html?id=fixture" class="tt-card-img-wrap"><img src="/gold1.svg" srcset="/gold1.svg 480w" sizes="300px" alt="Colores reales"></a><div class="tt-card-info"><h2 class="tt-card-name"><a href="product.html?id=fixture">Colores reales</a></h2>'+renderProductCardColors(product,'/gold1.svg')+'<div class="tt-card-btns"><a class="tt-card-btn tt-card-btn-view" href="product.html?id=fixture">Ver</a></div></div></article>';`}));
  await page.route(/\/(gold|silver)\d\.svg$/,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'}));
  await page.goto('/catalog-color-fixture');
  await expect(page.locator('.tt-card .tt-card-color')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Dorado',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Plateado',exact:true}).click();
  const image=page.locator('.tt-card-img-wrap img');
  await expect(image).toHaveAttribute('src',/silver1.svg$/);
  await expect(image).not.toHaveAttribute('srcset',/./);
  expect(await image.evaluate(img=>img.currentSrc)).toMatch(/silver1.svg$/);
  await expect(page.locator('a.tt-card-btn-view')).toHaveAttribute('href','/product?id=fixture&color=Plateado');
  await expect(page.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
