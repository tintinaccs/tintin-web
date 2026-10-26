const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
for(const width of [320,390,600,768,1024,1440])test(`edición contextual y asociación múltiple ${width}`,async({page},info)=>{
 await page.route('https://img.test/*.webp',route=>route.fulfill({contentType:'image/webp',body:fs.readFileSync('assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp')}));
 await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('#prod-name').fill('Bolso contextual');
 await page.evaluate(()=>{for(const [id,value] of Object.entries({'prod-variants-text':'Color: Dorado, Plateado','prod-imageUrl':'https://img.test/a.webp','prod-images-extra':'https://img.test/b.webp'})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event(id==='prod-imageUrl'?'change':'input',{bubbles:true}));}});
 await page.getByRole('checkbox',{name:'Seleccionar foto 1',exact:true}).check();await page.getByRole('checkbox',{name:'Seleccionar foto 2',exact:true}).check();
 await page.getByRole('button',{name:'Asociar fotos seleccionadas',exact:true}).click();await page.getByLabel('Asociación: Color',{exact:true}).selectOption('Dorado');await page.getByRole('button',{name:'Asociar fotografía',exact:true}).click();
 await page.evaluate(()=>window.qaProductController.workspace.save());
 const snapshot=await page.evaluate(()=>[...window.qaProductStore.values()].find(row=>row.snapshot)?.snapshot);
 const assigned=snapshot.variantMedia.find(row=>row.Color==='Dorado');expect(assigned).toBeTruthy();expect(new Set([assigned.imageUrl,...(assigned.imageUrls || [])].filter(Boolean))).toEqual(new Set(['https://img.test/a.webp','https://img.test/b.webp']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('#prod-name')).toHaveValue('Bolso contextual');
 await page.locator('#prod-editor-section').selectOption('prices');await expect(page.locator('#prod-price')).toBeFocused();
 await expect(page.locator('[data-product-section="photos"]')).toBeVisible();
 await page.screenshot({path:info.outputPath(`contexto-${width}.png`),fullPage:true});
});
test('sugerencias de bolsos preparan opciones sin agregarlas automáticamente',async({page})=>{
 await openProductSaveFixture(page,1024,900,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.evaluate(()=>{const category=document.getElementById('prod-category');category.append(new Option('Bags','bags'));category.value='bags';category.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('.tt-editor-suggestions summary').click();await page.getByRole('button',{name:'Modelo: Bandolera',exact:true}).click();
 await expect(page.getByLabel('Nueva opción de variante',{exact:true})).toHaveValue('Bandolera');await expect(page.locator('#prod-variants-text')).toHaveValue('');
 await page.getByRole('button',{name:'Agregar opción',exact:true}).click();await expect(page.locator('#prod-variants-text')).toHaveValue('Modelo: Bandolera');
});
test('cambiar de asociación conserva un reemplazo pendiente',async({page})=>{
 await openProductSaveFixture(page,1024,900,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.evaluate(()=>{for(const [id,value] of Object.entries({'prod-variants-text':'Color: Dorado','prod-imageUrl':'https://img.test/a.webp'})){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event(id==='prod-imageUrl'?'change':'input',{bubbles:true}));}});
 await page.getByRole('button',{name:'Reemplazar foto 1',exact:true}).click();
 await page.locator('.tt-unified-photos input[type=file]:not([multiple])').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Asociar foto 1',exact:true}).click();await expect(page.locator('.tt-unified-photos')).toContainText('Terminá o cancelá el reemplazo');
 await page.evaluate(()=>window.qaProductController.workspace.save());await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/replacement.png');
});
