const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const read=p=>fs.readFileSync(p,'utf8');
const html=read('product.html');
const links=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
const start=html.indexOf('<section class="tt-product-page"');const section=html.slice(start,html.indexOf('</section>',start)+10);
const store=read('tienda.js');const qty=store.slice(store.indexOf('function _pdUpdateQtyUI()'),store.indexOf('function productVariantGroups'));
const maintenance=read('js/pages/product/mantenimiento-producto.js');const inspect=maintenance.slice(maintenance.indexOf('  function inspectProduct()'),maintenance.indexOf('  function inspectRelated()'));
for(const width of [390,768,1024,1440])test(`stock por variante cambia aviso, punto y compra sin rayas en ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/stock-status-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${links}<link rel="stylesheet" href="/css/pages/product/product-maintenance.css"></head><body class="tt-product-maintenance">${section}</body></html>`}));
 await page.goto('/stock-status-fixture',{waitUntil:'load'});
 await page.addScriptTag({content:`let _pdQty=1,_pdMaxQty=2,_pdProduct={stock:2};let selected='Dorado';const _pdGetSelectedVariant=()=>selected;window.TintinCatalogPolicy={variantStockLimit:()=>selected==='Plateado'?0:2};
 const productStatus=document.getElementById('product-status');const detailGrid=document.getElementById('product-grid');const loading=document.getElementById('product-loading');const notFound=null,loadError=null;let productResolved=false,relatedResolved=false,selectionResolved=false,pageObserver=null;
 const isVisible=()=>false;const setDatasetIfChanged=(node,key,value)=>node.dataset[key]=value;const setAttributeIfChanged=(node,key,value)=>node?.setAttribute(key,value);const removeStylePropertyIfPresent=(node,key)=>node.style.removeProperty(key);
 ${qty}${inspect}
 detailGrid.style.display='';loading.style.display='none';window.chooseStock=value=>{selected=value;_pdUpdateQtyUI();inspectProduct();};window.chooseStock('Dorado');`});
 const status=page.locator('#product-status');
 const dot=()=>status.evaluate(n=>getComputedStyle(n,'::before').backgroundColor);
 await expect(status).toHaveText('Disponible');const available=await dot();
 await page.evaluate(()=>window.chooseStock('Plateado'));
 await expect(status).toHaveText('Agotado');await expect(status).toHaveAttribute('data-stock-state','out');expect(await dot()).not.toBe(available);
 await expect(page.locator('#btn-product-add-cart')).toBeDisabled();await expect(page.locator('#btn-product-buy-now')).toBeDisabled();
 expect(await page.locator('#gallery-main').evaluate(n=>getComputedStyle(n,'::after').content)).toBe('none');
 await page.evaluate(()=>window.chooseStock('Dorado'));await expect(status).toHaveText('Disponible');await expect(status).toHaveAttribute('data-stock-state','available');expect(await dot()).toBe(available);
 await expect(page.locator('#btn-product-add-cart')).toBeEnabled();await expect(page.locator('#btn-product-buy-now')).toBeEnabled();
 await page.evaluate(()=>{document.getElementById('product-status').textContent='Sin stock';inspectProduct();});await expect(status).toHaveAttribute('data-stock-state','out');expect(await dot()).not.toBe(available);
});
