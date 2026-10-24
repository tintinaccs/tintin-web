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
