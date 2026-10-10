const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js', 'utf8');
const renderer = source.slice(source.indexOf('const cardColorSelections'), source.indexOf('function renderProductsGrid'));
const media = source.slice(source.indexOf('function productVariantGroups'), source.indexOf('function _pdSyncVariantToImage'));
const harness = `
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeAttribute=escapeHtml;
const sanitizeClassicImageUrl=value=>value||'';
const isInStock=()=>true, getProductImage=()=>'', priceMarkup=()=>'<span>Gs. 100.000</span>',heartIconMarkup=()=>'';
${media}
${renderer}
const product={id:'fixture',name:'Colores reales',variants:{Color:['Dorado','Plateado']},imageUrl:'/gold1.svg',variantMedia:[{Color:'Dorado',imageUrls:['/gold1.svg','/gold2.svg'],colorHex:'#123ABC'},{Color:'Plateado',imageUrls:['/silver1.svg']}]};
function paint(){document.getElementById('cards').innerHTML=renderProductCardMarkup(product);}
paint();window.paint=paint;`;
for(const width of [320,390,768,1024,1280,1440,1920]) test(`tarjeta cambia foto inmediatamente y conserva color en ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/card-color-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px}.tt-product-card{max-width:300px}.tt-product-img-real{width:100%}.tt-card-color{width:44px;height:44px}.tt-color-swatch{display:block;width:24px;height:24px;border-radius:50%}</style></head><body><div id="cards"></div><script src="/js/components/images/galeria-producto.js"></script><script src="/card-color-harness.js"></script></body></html>`}));
  await page.route('**/card-color-harness.js',r=>r.fulfill({contentType:'text/javascript',body:harness}));
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
  expect(errors).toEqual([]);
});
