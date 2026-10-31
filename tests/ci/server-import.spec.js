const { test, expect } = require('@playwright/test');

// No page/browser fixture: exercise Playwright's Node transform without Chromium.
test('metadata de producto carga en el mismo runtime que las suites SEO', async () => {
  const product = await import('../../functions/product.js');
  expect(typeof product.onRequest).toBe('function');
  expect(typeof product.renderProductMetadataHtml).toBe('function');
});

for (const [label,patch,available] of [
  ['legacy agotado',{stock:0},false],
  ['v2 contado con agregado desactualizado',{stock:0,variantCommerceVersion:2,variants:{Color:['Plateado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:2,price:250}]},true],
  ['v2 sin control con agregado desactualizado',{stock:0,variantCommerceVersion:2,variants:{Color:['Plateado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:null,price:250}]},true],
  ['v2 combinación desactivada',{stock:2,variantCommerceVersion:2,variants:{Color:['Plateado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:2,price:250,active:false}]},false],
]) test(`JSON-LD reutiliza disponibilidad comercial: ${label}`,async()=>{
 const fs=require('node:fs');
 const {renderProductMetadataHtml}=await import('../../functions/product.js');
 const data={name:'Fixture',category:'aros',price:100,active:true,...patch};
 const {html}=renderProductMetadataHtml(fs.readFileSync('product.html','utf8'),'fixture',data);
 const ld=JSON.parse(html.match(/<script type="application\/ld\+json" id="tt-product-jsonld-server">([\s\S]*?)<\/script>/)[1]);
 expect(ld.offers.availability).toBe(`https://schema.org/${available?'InStock':'OutOfStock'}`);
 expect(ld.offers.price).toBe(data.variantCommerceVersion===2?'250':'100');
});

test('JSON-LD publica disponibilidad y precio por variante', async () => {
 const fs=require('node:fs');
 const {renderProductMetadataHtml}=await import('../../functions/product.js');
 const data={name:'Fixture',category:'aros',price:100,active:true,stock:2,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',attributes:{Color:'Dorado'},stock:0,price:300},{variant:'Plateado',attributes:{Color:'Plateado'},stock:2,price:250}]};
 const {html}=renderProductMetadataHtml(fs.readFileSync('product.html','utf8'),'fixture',data);
 const ld=JSON.parse(html.match(/<script type="application\/ld\+json" id="tt-product-jsonld-server">([\s\S]*?)<\/script>/)[1]);
 expect(ld['@type']).toBe('ProductGroup');
 expect(ld.offers.availability).toBe('https://schema.org/InStock');
 expect(ld.hasVariant.map(v=>[v.name,v.offers.price,v.offers.availability])).toEqual([
  ['Fixture — Dorado','300','https://schema.org/OutOfStock'],
  ['Fixture — Plateado','250','https://schema.org/InStock'],
 ]);
 const simple=renderProductMetadataHtml(fs.readFileSync('product.html','utf8'),'simple',{name:'Simple',category:'aros',price:100,stock:1}).html;
 const simpleLd=JSON.parse(simple.match(/id="tt-product-jsonld-server">([\s\S]*?)<\/script>/)[1]);
 expect(simpleLd['@type']).toBe('Product');expect(simpleLd.hasVariant).toBeUndefined();
});
