'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
const product={name:'Reloj de prueba',description:'Datos ficticios para comprobar la versión única del editor.',category:'qa-tablet',price:180000,stock:5,imageUrl:'https://img.test/reloj.webp',variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:3},{variant:'Plateado',stock:2}],active:true,publicationStatus:'active'};
for(const width of [320,390,600,768,1024,1440])test(`versión única: abrir, fotos, variantes, guardar y recuperar ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true,initialRecords:[['products/qa',product]]});
 await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.route('https://img.test/reloj.webp',route=>route.fulfill({contentType:'image/webp',body:fs.readFileSync('assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp')}));
 await page.locator('.tt-work-back').click();
 for(let opening=0;opening<3;opening++){
  await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});
  await page.evaluate(()=>window.qaProductController.workspace.ready);
  await expect(page.locator('#prod-form-card')).toHaveCount(1);
  await expect(page.locator('.tt-editor-layout')).toHaveCount(1);
  await expect(page.locator('.tt-product-section-nav')).toHaveCount(1);
  await expect(page.locator('.tt-unified-photos')).toHaveCount(1);
  // Studio es ahora una clase visual del formulario canónico, no otro editor.
  await expect(page.locator('.tt-editor-studio')).toHaveCount(1);
  await expect(page.locator('#prod-form-card')).toHaveClass(/\btt-editor-studio\b/);
  await expect(page.locator('.tt-editor-guide,.tt-editor-studio:not(#prod-form-card),.tt-editor-section-links')).toHaveCount(0);
  await expect(page.locator('link[href*="editor-producto-studio"]')).toHaveCount(0);
  if(opening<2)await page.locator('.tt-work-back').click();
 }
 await page.getByRole('tab',{name:'Fotos y colores',exact:true}).click();
 await expect(page.locator('.tt-unified-photo')).toHaveCount(1);
 await expect(page.locator('.tt-unified-photo img')).toHaveJSProperty('complete',true);
 await page.locator('#prod-form-card .adm-card-body').evaluate(node=>node.scrollTop=0);
 await page.evaluate(()=>document.activeElement?.blur());
 await page.screenshot({path:info.outputPath(`version-unica-fotos-${width}.png`),animations:'disabled'});
 await page.getByRole('tab',{name:'Variantes',exact:true}).click();
 await expect(page.locator('.tt-option-group')).toHaveCount(1);
 await expect(page.locator('#prod-stock')).toHaveValue('5');
 await page.locator('#prod-form-card .adm-card-body').evaluate(node=>node.scrollTop=0);
 await page.screenshot({path:info.outputPath(`version-unica-variantes-${width}.png`),animations:'disabled'});
 await page.getByRole('tab',{name:'Información',exact:true}).click();
 await page.locator('#prod-name').fill('Versión única conservada');
 await expect(page.locator('#prod-save-btn')).toBeInViewport();
 expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>window.qaProductWrites.filter(path=>path==='products/qa').length)).toBe(1);
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('qa');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(page.locator('#prod-name')).toHaveValue('Versión única conservada');
 expect(await page.evaluate(()=>window.qaProductStore.get('products/qa').variantInventory)).toEqual(product.variantInventory);
 expect(errors).toEqual([]);
});
